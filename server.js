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

        console.log('API Request for:', videoUrl);

        const options = {
            method: 'GET',
            url: 'https://youtube-mp36.p.rapidapi.com/dl',
            params: { id: extractVideoId(videoUrl) },
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
            }
        };

        const response = await axios.request(options);
        
        if (response.data.status === 'ok') {
            console.log('API Success! Redirecting to:', response.data.link);
            // API가 준 실제 MP3 파일 주소로 리다이렉트 (사용자 브라우저에서 다운로드 시작)
            res.redirect(response.data.link);
        } else {
            console.error('API Error Response:', response.data);
            res.status(500).send('변환 실패: ' + (response.data.msg || '알 수 없는 오류'));
        }

    } catch (err) {
        console.error('Full Server Error:', err.message);
        res.status(500).send('서버 오류: ' + err.message);
    }
});

// 유튜브 URL에서 비디오 ID만 추출하는 함수
function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
