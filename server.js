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
        console.log('Cookie file created.');
    } catch (e) {
        console.error('Failed to create cookie file:', e.message);
    }
}

app.get('/download', async (req, res) => {
    try {
        let url = req.query.url;
        console.log('Processing:', url);

        // 1. 영상 메타데이터 가져오기
        const metadataOptions = {
            dumpSingleJson: true,
            noPlaylist: true,
            noWarnings: true,
        };
        if (fs.existsSync(COOKIE_FILE)) metadataOptions.cookies = COOKIE_FILE;

        const metadata = await ytDlp(url, metadataOptions);
        const title = metadata.title.replace(/[^\w\s]/gi, '') || 'audio';
        console.log('Video title:', title);

        // 2. 헤더 설정
        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // 3. 변환 및 스트리밍 다운로드
        const downloadOptions = {
            extractAudio: true,
            audioFormat: 'mp3',
            ffmpegLocation: ffmpegPath, // FFmpeg 경로 지정 (중요)
            output: '-', // stdout으로 출력
            noPlaylist: true,
            noWarnings: true,
            format: 'bestaudio/best', // 최상의 오디오 품질 선택
        };
        if (fs.existsSync(COOKIE_FILE)) downloadOptions.cookies = COOKIE_FILE;

        const subprocess = ytDlp.exec(url, downloadOptions);

        // 에러 처리
        subprocess.on('error', (err) => {
            console.error('Subprocess Error:', err);
            if (!res.headersSent) res.status(500).send('Streaming failed.');
        });

        // 클라이언트(브라우저)로 데이터 전송
        subprocess.stdout.pipe(res);

        // 클라이언트가 연결을 끊으면 프로세스 강제 종료
        req.on('close', () => {
            if (subprocess) subprocess.kill();
        });

    } catch (err) {
        console.error('Download Failure:', err);
        let errorMsg = err.message;
        if (errorMsg.includes('confirm you’re not a bot')) {
            errorMsg = '유튜브 보안 시스템에 의해 차단되었습니다. 쿠키를 새로 갱신해 보세요.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
