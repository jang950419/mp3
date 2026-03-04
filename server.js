const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 환경 변수에서 쿠키를 가져와 에이전트 생성
let agent;
const cookieStr = process.env.YOUTUBE_COOKIE;

console.log('--- Server Startup ---');
if (cookieStr) {
    try {
        const cookies = JSON.parse(cookieStr);
        if (Array.isArray(cookies)) {
            agent = ytdl.createAgent(cookies);
            console.log('Successfully loaded YouTube cookies (Array format). Count:', cookies.length);
        } else {
            console.error('YOUTUBE_COOKIE is not an array. Please check the format.');
            agent = ytdl.createAgent();
        }
    } catch (e) {
        console.error('Failed to parse YOUTUBE_COOKIE JSON:', e.message);
        // 쿠키 문자열 앞부분만 출력하여 형식 확인 (보안 위해 일부만)
        console.log('Cookie string starts with:', cookieStr.substring(0, 20) + '...');
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

        const info = await ytdl.getInfo(url, {
            agent,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                }
            }
        });

        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        console.log('Successfully fetched info for:', title);

        res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        
        const stream = ytdl.downloadFromInfo(info, {
            filter: 'audioonly',
            quality: 'highestaudio',
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
        // 에러 메시지에 더 자세한 내용 포함
        let errorMsg = err.message;
        if (errorMsg.includes('confirm you’re not a bot')) {
            errorMsg = '유튜브의 봇 감지에 차단되었습니다. 쿠키 설정이 올바른지 확인해 주세요.';
        }
        res.status(500).send(`변환 실패: ${errorMsg}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
