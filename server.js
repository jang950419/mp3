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

        console.log('API Request (YouTube to MP315 POST) for:', videoUrl);

        // 사용자가 제공한 curl 정보를 바탕으로 POST 요청 구성
        const options = {
            method: 'POST',
            url: 'https://youtube-to-mp315.p.rapidapi.com/download',
            params: {
                url: videoUrl,
                format: 'mp3'
            },
            headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': 'youtube-to-mp315.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'aa6f81d82bmshca7ee4461e2fdacp115c40jsn029b9cca4ebe'
            },
            data: {}
        };

        const response = await axios.request(options);
        
        // API 응답 데이터 확인 (보통 downloadUrl 또는 link 필드에 주소가 담깁니다)
        if (response.data && (response.data.downloadUrl || response.data.link)) {
            const downloadLink = response.data.downloadUrl || response.data.link;
            console.log('API Success! Redirecting to:', downloadLink);
            res.redirect(downloadLink);
        } else {
            console.error('API Response Detail:', response.data);
            res.status(500).send('변환 실패: API가 다운로드 링크를 제공하지 않았습니다.');
        }

    } catch (err) {
        console.error('Full Server Error:', err.message);
        const errorDetail = err.response?.data?.message || err.message;
        res.status(500).send('서버 오류: ' + errorDetail);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
