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
        if (!videoUrl) {
            return res.status(400).send('URL이 필요합니다.');
        }

        console.log('API Request (YouTube to MP315) for:', videoUrl);

        const options = {
            method: 'GET',
            url: 'https://youtube-to-mp315.p.rapidapi.com/download',
            params: { url: videoUrl },
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'youtube-to-mp315.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        
        // YouTube to MP315 API의 응답 구조에 맞게 수정
        if (response.data && response.data.downloadUrl) {
            console.log('API Success! Redirecting to download link.');
            res.redirect(response.data.downloadUrl);
        } else {
            console.error('API Response Format Error:', response.data);
            res.status(500).send('변환 실패: API 응답 형식이 올바르지 않습니다.');
        }

    } catch (err) {
        console.error('Full Server Error:', err.message);
        res.status(500).send('서버 오류: ' + (err.response?.data?.message || err.message));
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
