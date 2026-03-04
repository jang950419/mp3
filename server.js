const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');

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
        console.log('Cookie file updated.');
    } catch (e) {
        console.error('Failed to create cookie file:', e.message);
    }
}

app.get('/download', async (req, res) => {
    try {
        let originalUrl = req.query.url;
        console.log('Requested URL:', originalUrl);

        let videoId;
        try {
            if (originalUrl.includes('v=')) {
                videoId = originalUrl.split('v=')[1].split('&')[0];
            } else if (originalUrl.includes('youtu.be/')) {
                videoId = originalUrl.split('youtu.be/')[1].split('?')[0];
            }
            if (!videoId) throw new Error('Invalid ID');
        } catch (e) {
            return res.status(400).send('유효하지 않은 유튜브 링크입니다.');
        }
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // 차단 우회를 위한 초강력 옵션
        const commonArgs = {
            noPlaylist: true,
            noWarnings: true,
            noCheckCertificates: true,
            youtubeSkipDashManifest: true,
            // 클라이언트 속이기: 안드로이드와 웹 플레이어를 동시에 시뮬레이션
            extractorArgs: 'youtube:player_client=android,web',
            referer: 'https://www.youtube.com/',
            userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
        };
        if (fs.existsSync(COOKIE_FILE)) commonArgs.cookies = COOKIE_FILE;

        console.log('Fetching metadata for:', videoId);
        const metadata = await ytDlp(url, {
            ...commonArgs,
            dumpSingleJson: true,
        });

        const title = metadata.title.replace(/[^\w\s]/gi, '') || 'audio';
        console.log('Starting conversion for:', title);

        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // 다운로드 시 포맷 선택을 극도로 유연하게 변경
        const subprocess = ytDlp.exec(url, {
            ...commonArgs,
            extractAudio: true,
            audioFormat: 'mp3',
            ffmpegLocation: ffmpegPath,
            output: '-',
            // 가장 넓은 범위의 오디오 포맷 허용
            format: 'bestaudio/best'
        });

        subprocess.stdout.pipe(res);

        subprocess.on('error', (err) => {
            console.error('Subprocess Error:', err);
            if (!res.headersSent) res.status(500).send('변환 중 오류 발생');
        });

        req.on('close', () => {
            if (subprocess) subprocess.kill();
        });

    } catch (err) {
        console.error('Download Failure:', err);
        let errorMsg = err.message;
        if (errorMsg.includes('Sign in to confirm')) {
            errorMsg = '유튜브 봇 감지에 차단되었습니다. 최신 쿠키로 갱신하거나 잠시 후 시도해 주세요.';
        } else if (errorMsg.includes('format is not available')) {
            errorMsg = '유튜브가 서버의 접근을 제한하여 오디오 데이터를 보내주지 않고 있습니다.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
