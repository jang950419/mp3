const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { create: createYtDlp } = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp 인스턴스 생성
const ytDlp = createYtDlp();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 쿠키 파일 생성 (yt-dlp가 파일을 읽어야 함)
const COOKIE_FILE = path.join(__dirname, 'youtube_cookies.txt');
const cookieStr = process.env.YOUTUBE_COOKIE;

if (cookieStr) {
    try {
        // Netscape 형식이나 JSON 형식 그대로 파일에 씀
        fs.writeFileSync(COOKIE_FILE, cookieStr);
        console.log('Successfully created cookie file for yt-dlp.');
    } catch (e) {
        console.error('Failed to create cookie file:', e.message);
    }
}

app.get('/download', async (req, res) => {
    try {
        let url = req.query.url;
        console.log('Original URL:', url);

        // yt-dlp 옵션 설정
        const options = {
            extractAudio: true,
            audioFormat: 'mp3',
            output: '-',  // stdout으로 스트리밍
            noPlaylist: true,
            quiet: true
        };

        // 쿠키 파일이 있으면 추가
        if (fs.existsSync(COOKIE_FILE)) {
            options.cookies = COOKIE_FILE;
        }

        // 먼저 영상 제목만 가져옴
        const metadata = await ytDlp(url, {
            dumpSingleJson: true,
            noPlaylist: true,
            cookies: fs.existsSync(COOKIE_FILE) ? COOKIE_FILE : undefined
        });

        const title = metadata.title.replace(/[^\w\s]/gi, '') || 'audio';
        console.log('Starting stream for:', title);

        // 헤더 설정
        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // yt-dlp 실행하여 스트리밍
        const subprocess = ytDlp.exec(url, options);

        subprocess.stdout.pipe(res);

        subprocess.on('error', (err) => {
            console.error('yt-dlp Execution Error:', err);
            if (!res.headersSent) {
                res.status(500).send('Streaming error: ' + err.message);
            }
        });

        req.on('close', () => {
            subprocess.kill();
        });

    } catch (err) {
        console.error('Full Server Error:', err);
        let errorMsg = err.message;
        if (errorMsg.includes('Sign in to confirm')) {
            errorMsg = '유튜브 차단에 막혔습니다. 쿠키가 만료되었거나 IP가 차단되었습니다.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
