const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 유튜버 차단 우회를 위한 에이전트 생성
const agent = ytdl.createAgent();

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

        // 유튜버 차단 우회를 위한 옵션 추가
        const info = await ytdl.getInfo(url, {
            agent,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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
                res.status(500).send('Streaming error occurred');
            }
        });

        stream.pipe(res);

    } catch (err) {
        console.error('Full Server Error:', err);
        res.status(500).send(`변환 실패: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
