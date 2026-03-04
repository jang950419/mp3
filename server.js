const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Netscape 쿠키 형식을 JSON 객체 배열로 변환하는 함수
function parseNetscapeCookies(cookieStr) {
    const cookies = [];
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
        const url = req.query.url;
        console.log('Download requested for:', url);

        if (!ytdl.validateURL(url)) {
            return res.status(400).send('Invalid YouTube URL');
        }

        // 영상 정보를 가져올 때 옵션 강화
        const info = await ytdl.getInfo(url, {
            agent,
        });

        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        console.log('Successfully fetched info for:', title);

        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        
        // 필터를 'audioonly'에서 더 넓게 확장하거나 품질 설정을 변경
        const stream = ytdl.downloadFromInfo(info, {
            quality: 'highestaudio',
            filter: format => format.container === 'mp4' && !format.hasVideo || format.audioBitrate > 0,
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
            errorMsg = '유튜브의 봇 감지에 차단되었습니다. 쿠키가 만료되었거나 올바르지 않습니다.';
        } else if (errorMsg.includes('playable formats')) {
            errorMsg = '재생 가능한 오디오 형식을 찾을 수 없습니다. 다른 영상으로 시도해 주세요.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
