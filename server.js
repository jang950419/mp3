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

        console.log('--- Processing Request (New API) ---');
        console.log('Video ID:', videoId);

        // 1. 새로운 YouTube MP3 Downloader API 호출
        const apiOptions = {
            method: 'GET',
            url: `https://youtube-mp3-audio-video-downloader.p.rapidapi.com/get_raw_audio_download_link/${videoId}`,
            params: { quality: '140' }, // 고품질 오디오 요청
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'aa6f81d82bmshca7ee4461e2fdacp115c40jsn029b9cca4ebe',
                'x-rapidapi-host': 'youtube-mp3-audio-video-downloader.p.rapidapi.com'
            }
        };

        const apiResponse = await axios.request(apiOptions);
        console.log('API Response:', apiResponse.data);

        // API 응답 구조에 따라 링크 추출 (보통 link 또는 url 필드)
        const downloadLink = apiResponse.data.link || apiResponse.data.url || apiResponse.data.download_link;

        if (!downloadLink) {
            console.error('No download link in API response:', apiResponse.data);
            return res.status(500).json({ success: false, message: 'API가 다운로드 링크를 제공하지 않았습니다.' });
        }

        console.log('Download link found, proxying...');

        // 2. 서버 프록시 다운로드 (서버가 대신 받아 전달)
        const fileResponse = await axios({
            method: 'get',
            url: downloadLink,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/'
            }
        });

        // 3. 브라우저로 스트리밍 전송
        const title = (apiResponse.data.title || 'audio').replace(/[^\w\s]/gi, '');
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
            errorMsg = 'API 서버에서 파일을 찾을 수 없습니다.';
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
