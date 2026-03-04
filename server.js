const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

app.get('/download', async (req, res) => {
    try {
        const url = req.query.url;
        console.log('Download requested for:', url);

        if (!ytdl.validateURL(url)) {
            console.error('Invalid URL:', url);
            return res.status(400).send('Invalid YouTube URL');
        }

        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, ''); // Clean title
        console.log('Video title:', title);

        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
        });

        stream.on('error', (err) => {
            console.error('YTDL Stream Error:', err);
            if (!res.headersSent) {
                res.status(500).send('Streaming error occurred');
            }
        });

        stream.pipe(res);

    } catch (err) {
        console.error('Full Server Error:', err);
        res.status(500).send(`An error occurred: ${err.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
