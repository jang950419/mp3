const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytDlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 쿠키 파일 생성
const COOKIE_FILE = path.join(__dirname, 'youtube_cookies.txt');
const cookieStr = process.env.YOUTUBE_COOKIE;

if (cookieStr) {
    try {
        fs.writeFileSync(COOKIE_FILE, cookieStr.trim());
        console.log('Cookie file created successfully.');
    } catch (e) {
        console.error('Failed to create cookie file:', e.message);
    }
}

app.get('/download', async (req, res) => {
    try {
        let url = req.query.url;
        console.log('Processing URL:', url);

        // 1. 영상 정보(제목 등) 가져오기
        const metadataOptions = {
            dumpSingleJson: true,
            noPlaylist: true,
            noWarnings: true,
        };
        if (fs.existsSync(COOKIE_FILE)) metadataOptions.cookies = COOKIE_FILE;

        const metadata = await ytDlp(url, metadataOptions);
        const title = metadata.title.replace(/[^\w\s]/gi, '') || 'audio';
        console.log('Title found:', title);

        // 2. 헤더 설정
        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // 3. 스트리밍 다운로드 실행
        // ytDlp.exec는 자식 프로세스를 반환하여 stdout을 스트리밍할 수 있게 해줍니다.
        const downloadOptions = {
            extractAudio: true,
            audioFormat: 'mp3',
            output: '-', // stdout으로 출력
            noPlaylist: true,
            noWarnings: true,
        };
        if (fs.existsSync(COOKIE_FILE)) downloadOptions.cookies = COOKIE_FILE;

        const subprocess = ytDlp.exec(url, downloadOptions);

        // 에러 처리
        subprocess.on('error', (err) => {
            console.error('Subprocess error:', err);
            if (!res.headersSent) res.status(500).send('Download error');
        });

        // 데이터 스트리밍
        subprocess.stdout.pipe(res);

        // 클라이언트가 연결을 끊으면 프로세스 종료
        req.on('close', () => {
            if (subprocess) subprocess.kill();
        });

    } catch (err) {
        console.error('Full Server Error:', err);
        let errorMsg = err.message;
        if (errorMsg.includes('Sign in to confirm')) {
            errorMsg = '유튜브 보안 시스템이 접근을 차단했습니다. 쿠키를 갱신해야 할 수 있습니다.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
