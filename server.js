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
            return res.status(400).json({ success: false, message: '유튜브 링크를 입력해 주세요.' });
        }

        console.log('--- New Download Request ---');
        console.log('Target URL:', videoUrl);

        // 사용자가 제공한 API (YouTube to MP315)로 다시 시도
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
        console.log('API Response:', response.data);

        // API마다 응답 필드명이 다를 수 있어 여러 케이스 대응
        const downloadLink = response.data.downloadUrl || response.data.link || response.data.url;
        
        if (downloadLink) {
            console.log('Success! Link found:', downloadLink);
            res.json({ 
                success: true, 
                link: downloadLink, 
                title: response.data.title || 'audio' 
            });
        } else {
            console.error('No link found in response');
            res.status(500).json({ 
                success: false, 
                message: 'API가 다운로드 링크를 생성하지 못했습니다. (다른 영상을 시도해 보세요)' 
            });
        }

    } catch (err) {
        console.error('Detailed Server Error:', err.response?.data || err.message);
        
        // 구체적인 에러 메시지 전달
        let errorMsg = '서버 오류가 발생했습니다.';
        if (err.response?.status === 401 || err.response?.status === 403) {
            errorMsg = 'API 키가 올바르지 않거나 사용량이 초과되었습니다.';
        } else if (err.response?.status === 404) {
            errorMsg = 'API 서버에서 영상을 찾을 수 없습니다.';
        } else if (err.message) {
            errorMsg = `오류 발생: ${err.message}`;
        }

        res.status(500).json({ success: false, message: errorMsg });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
