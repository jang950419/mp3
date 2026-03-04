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

        // 1. URL 정문화 (비디오 ID만 추출)
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

        // 2. 공통 옵션 설정 (차단 우회 핵심)
        const commonArgs = {
            noPlaylist: true,
            noWarnings: true,
            noCheckCertificates: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
            referer: 'https://www.youtube.com/',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };
        if (fs.existsSync(COOKIE_FILE)) commonArgs.cookies = COOKIE_FILE;

        // 3. 메타데이터 가져오기
        console.log('Fetching metadata for:', videoId);
        const metadata = await ytDlp(url, {
            ...commonArgs,
            dumpSingleJson: true,
        });

        const title = metadata.title.replace(/[^\w\s]/gi, '') || 'audio';
        console.log('Starting conversion for:', title);

        // 4. 헤더 및 응답 설정
        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // 5. 다운로드 및 변환 스트리밍
        const subprocess = ytDlp.exec(url, {
            ...commonArgs,
            extractAudio: true,
            audioFormat: 'mp3',
            ffmpegLocation: ffmpegPath,
            output: '-',
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
            errorMsg = '유튜브 봇 감지에 차단되었습니다. 최신 쿠키로 갱신이 필요합니다.';
        } else if (errorMsg.includes('format is not available')) {
            errorMsg = '이 영상은 현재 서버에서 추출할 수 없는 형식입니다.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
