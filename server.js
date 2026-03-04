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
            return res.status(400).send('유효한 유튜브 ID를 찾을 수 없습니다.');
        }

        console.log('API Request (YouTube MP36) for ID:', videoId);

        // 가장 안정적인 YouTube MP36 API 사용
        const options = {
            method: 'GET',
            url: 'https://youtube-mp36.p.rapidapi.com/dl',
            params: { id: videoId },
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'aa6f81d82bmshca7ee4461e2fdacp115c40jsn029b9cca4ebe',
                'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        
        // API 응답 확인
        if (response.data && response.data.status === 'ok') {
            console.log('API Success! Returning link:', response.data.link);
            // 브라우저에서 직접 다운로드하도록 JSON으로 링크 전달 (프론트에서 처리)
            res.json({ success: true, link: response.data.link, title: response.data.title });
        } else {
            console.error('API Error Response:', response.data);
            res.status(500).json({ success: false, message: response.data.msg || 'API 처리 오류' });
        }

    } catch (err) {
        console.error('Full Server Error:', err.message);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
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
