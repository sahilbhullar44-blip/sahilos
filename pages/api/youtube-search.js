export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    try {
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = await response.text();

        // Extract ytInitialData
        const regex = /ytInitialData\s*=\s*({.+?});/;
        const match = html.match(regex);
        if (!match) {
            return res.status(500).json({ error: 'Failed to extract search data from YouTube response' });
        }

        const data = JSON.parse(match[1]);

        // Recursive search for videoRenderers
        const videoRenderers = [];
        const findVideos = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.videoRenderer) {
                videoRenderers.push(obj.videoRenderer);
            }
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    findVideos(obj[key]);
                }
            }
        };
        findVideos(data);

        if (videoRenderers.length === 0) {
            return res.status(200).json({ tracks: [] });
        }

        const videos = [];
        const seenIds = new Set();

        for (const vr of videoRenderers) {
            const videoId = vr.videoId;
            if (!videoId || seenIds.has(videoId)) continue;

            const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText;
            const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url;
            const artist = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text;
            const duration = vr.lengthText?.simpleText || "0:00";

            if (title) {
                seenIds.add(videoId);
                videos.push({
                    id: videoId,
                    title,
                    thumbnail,
                    artist: artist || "Unknown Artist",
                    duration,
                    uri: `youtube:track:${videoId}`
                });
            }
        }

        return res.status(200).json({ tracks: videos.slice(0, 15) });
    } catch (error) {
        console.error('YouTube Search API Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
