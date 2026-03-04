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

        // 1. API 호출하여 다운로드 링크 확보
        const apiOptions = {
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

        const apiResponse = await axios.request(apiOptions);
        const downloadLink = apiResponse.data.downloadUrl || apiResponse.data.link;

        if (!downloadLink) {
            console.error('No download link in API response:', apiResponse.data);
            return res.status(500).send('변환 실패: API가 다운로드 링크를 제공하지 않았습니다.');
        }

        console.log('API Success! Proxying file from:', downloadLink);

        // 2. 서버가 직접 파일을 스트리밍하여 사용자에게 전달 (프록시 방식)
        const fileResponse = await axios({
            method: 'get',
            url: downloadLink,
            responseType: 'stream'
        });

        // 파일 이름 설정 (API에서 주면 사용, 없으면 기본값)
        const title = apiResponse.data.title ? apiResponse.data.title.replace(/[^\w\s]/gi, '') : 'download';
        
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // 파일 데이터를 브라우저로 직접 파이핑
        fileResponse.data.pipe(res);

        fileResponse.data.on('error', (err) => {
            console.error('Stream Error:', err.message);
            if (!res.headersSent) res.status(500).send('파일 전송 중 오류 발생');
        });

    } catch (err) {
        console.error('Full Server Error:', err.message);
        const errorDetail = err.response?.data?.message || err.message;
        if (!res.headersSent) {
            res.status(500).send('서버 오류: ' + errorDetail);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
