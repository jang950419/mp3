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
            return res.status(400).json({ success: false, message: '유효한 유튜브 링크를 입력해 주세요.' });
        }

        console.log('--- Attempting YouTube MP36 API ---');
        
        // 1. YouTube MP36 API 호출 (가장 안정적인 무료 API)
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

        if (data.status === 'ok' && data.link) {
            console.log('Success! Proxying file...');
            
            // 2. 서버 프록시 다운로드
            const fileResponse = await axios({
                method: 'get',
                url: data.link,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                },
                timeout: 60000 // 60초로 넉넉하게 설정
            });

            const title = (data.title || 'audio').replace(/[^\w\s]/gi, '');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');

            fileResponse.data.pipe(res);

            fileResponse.data.on('error', (err) => {
                console.error('Streaming Error:', err.message);
                if (!res.headersSent) res.status(500).send('전송 중 오류가 발생했습니다.');
            });

        } else {
            console.error('API Response Status Not OK:', data);
            res.status(500).json({ success: false, message: data.msg || 'API 서비스가 현재 불안정합니다. 다른 영상을 시도해 주세요.' });
        }

    } catch (err) {
        console.error('Final Error Handler:', err.message);
        let errorMsg = '변환 실패: 서버 혹은 API 오류입니다.';
        
        if (err.response?.status === 429) {
            errorMsg = 'API 사용량이 초과되었습니다. 내일 다시 시도해 주세요.';
        } else if (err.response?.data?.message) {
            errorMsg = `API 오류: ${err.response.data.message}`;
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
