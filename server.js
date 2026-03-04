const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/download', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        const videoId = extractVideoId(videoUrl);

        if (!videoId) {
            return res.status(400).json({ success: false, message: '유효하지 않은 유튜브 링크입니다.' });
        }

        console.log('--- Processing Request ---');
        console.log('Video ID:', videoId);

        // 1. YouTube MP36 API 호출 (가장 안정적)
        const apiOptions = {
            method: 'GET',
            url: 'https://youtube-mp36.p.rapidapi.com/dl',
            params: { id: videoId },
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'aa6f81d82bmshca7ee4461e2fdacp115c40jsn029b9cca4ebe',
                'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
            }
        };

        const apiResponse = await axios.request(apiOptions);
        const data = apiResponse.data;

        if (data.status !== 'ok' || !data.link) {
            console.error('API Error:', data);
            return res.status(500).json({ success: false, message: data.msg || '변환 링크 생성 실패' });
        }

        const downloadLink = data.link;
        const title = (data.title || 'audio').replace(/[^\w\s]/gi, '');
        console.log('Download link found, starting proxy...');

        // 2. 서버 프록시 다운로드 (서버가 대신 받아 전달)
        const fileResponse = await axios({
            method: 'get',
            url: downloadLink,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/'
            },
            timeout: 30000 // 30초 타임아웃
        });

        // 3. 브라우저로 스트리밍 전송
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        fileResponse.data.pipe(res);

        fileResponse.data.on('error', (err) => {
            console.error('Streaming Error:', err.message);
            if (!res.headersSent) res.status(500).send('전송 중 오류 발생');
        });

    } catch (err) {
        console.error('Full Error:', err.message);
        let errorMsg = '변환 중 오류가 발생했습니다.';
        
        if (err.response?.status === 404) {
            errorMsg = 'API 서버에서 파일을 찾을 수 없습니다. (잠시 후 다시 시도해 주세요)';
        } else if (err.code === 'ECONNABORTED') {
            errorMsg = '다운로드 시간이 초과되었습니다. 다시 시도해 주세요.';
        }

        if (!res.headersSent) {
            res.status(500).json({ success: false, message: errorMsg });
        }
    }
});

function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
