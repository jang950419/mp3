const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 블로그 방식: 유튜브 페이지에서 직접 메타데이터 추출
async function getYouTubeMetadata(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        
        // 블로그에서 언급한 ytInitialData 추출
        let metadata = { title: 'Unknown Title' };
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content && content.includes('var ytInitialData =')) {
                const jsonStr = content.split('var ytInitialData =')[1].split(';</script>')[0].trim();
                try {
                    const jsonData = JSON.parse(jsonStr);
                    // 제목 추출 경로
                    metadata.title = jsonData.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer.title.runs[0].text;
                } catch (e) {
                    console.error('Metadata parse error:', e.message);
                }
            }
        });
        
        // script 태그에서 못 찾으면 meta 태그에서 찾음
        if (metadata.title === 'Unknown Title') {
            metadata.title = $('meta[property="og:title"]').attr('content') || 'audio';
        }
        
        return metadata;
    } catch (err) {
        console.error('Scraping error:', err.message);
        return { title: 'audio' };
    }
}

app.get('/download', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ success: false, message: 'URL이 필요합니다.' });
        }

        console.log('--- Start Processing ---');
        console.log('Target URL:', videoUrl);

        // 1. 메타데이터 추출 (블로그 핵심 로직 반영)
        const metadata = await getYouTubeMetadata(videoUrl);
        console.log('Scraped Title:', metadata.title);

        // 2. Cobalt API 호출 (가장 안정적인 최신 우회 방식)
        // 이 API는 별도의 키 없이도 공용 인스턴스를 통해 다운로드 링크를 제공합니다.
        const cobaltOptions = {
            method: 'POST',
            url: 'https://api.cobalt.tools/api/json',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            data: {
                url: videoUrl,
                downloadMode: 'audio', // 오디오만 추출
                audioFormat: 'mp3',
                audioBitrate: '128'
            }
        };

        const response = await axios.request(cobaltOptions);
        
        if (response.data && response.data.url) {
            console.log('Cobalt Success! Link obtained.');
            res.json({ 
                success: true, 
                link: response.data.url, 
                title: metadata.title 
            });
        } else {
            console.error('Cobalt Error:', response.data);
            res.status(500).json({ 
                success: false, 
                message: '다운로드 링크를 생성할 수 없습니다. (유튜브 차단)' 
            });
        }

    } catch (err) {
        console.error('Full Error:', err.response?.data || err.message);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류: ' + (err.response?.data?.text || err.message) 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
