const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Netscape 쿠키 형식을 JSON 객체 배열로 변환하는 함수
function parseNetscapeCookies(cookieStr) {
    const cookies = [];
    if (!cookieStr) return cookies;
    const lines = cookieStr.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('\t');
        if (parts.length < 7) continue;
        cookies.push({
            domain: parts[0],
            path: parts[2],
            secure: parts[3].toUpperCase() === 'TRUE',
            expirationDate: parseInt(parts[4]),
            name: parts[5],
            value: parts[6]
        });
    }
    return cookies;
}

// 환경 변수에서 쿠키를 가져와 에이전트 생성
let agent;
const cookieStr = process.env.YOUTUBE_COOKIE;

console.log('--- Server Startup ---');
if (cookieStr) {
    try {
        let cookies;
        if (cookieStr.trim().startsWith('[') || cookieStr.trim().startsWith('{')) {
            cookies = JSON.parse(cookieStr);
            console.log('Detected JSON cookie format.');
        } else if (cookieStr.includes('\t')) {
            cookies = parseNetscapeCookies(cookieStr);
            console.log('Detected Netscape cookie format.');
        }

        if (Array.isArray(cookies) && cookies.length > 0) {
            agent = ytdl.createAgent(cookies);
            console.log('Successfully loaded YouTube cookies. Count:', cookies.length);
        } else {
            console.error('No valid cookies found in YOUTUBE_COOKIE.');
            agent = ytdl.createAgent();
        }
    } catch (e) {
        console.error('Failed to parse YOUTUBE_COOKIE:', e.message);
        agent = ytdl.createAgent();
    }
} else {
    console.warn('YOUTUBE_COOKIE environment variable is missing!');
    agent = ytdl.createAgent();
}
console.log('-----------------------');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/download', async (req, res) => {
    try {
        let url = req.query.url;
        console.log('Original URL:', url);

        // 1. URL에서 비디오 ID만 추출하여 깨끗한 URL로 만듦
        try {
            const videoID = ytdl.getURLVideoID(url);
            url = `https://www.youtube.com/watch?v=${videoID}`;
            console.log('Cleaned URL:', url);
        } catch (e) {
            return res.status(400).send('Invalid YouTube URL format');
        }

        // 2. 영상 정보를 가져올 때 옵션 강화
        const requestOptions = {
            agent,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                }
            }
        };

        const info = await ytdl.getInfo(url, requestOptions);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        console.log('Successfully fetched info for:', title);

        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        
        const stream = ytdl.downloadFromInfo(info, {
            quality: 'highestaudio',
            filter: format => format.audioBitrate > 0,
            agent
        });

        stream.on('error', (err) => {
            console.error('YTDL Stream Error:', err);
            if (!res.headersSent) {
                res.status(500).send('Streaming error occurred: ' + err.message);
            }
        });

        stream.pipe(res);

    } catch (err) {
        console.error('Full Server Error:', err);
        let errorMsg = err.message;
        if (errorMsg.includes('confirm you’re not a bot')) {
            errorMsg = '유튜브 보안 시스템이 서버를 차단했습니다. 쿠키가 만료되었거나 이 서버의 IP가 차단되었을 수 있습니다.';
        } else if (errorMsg.includes('playable formats')) {
            errorMsg = '재생 가능한 오디오 형식을 찾을 수 없습니다.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
