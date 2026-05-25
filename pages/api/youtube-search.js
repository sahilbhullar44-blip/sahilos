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
        const contents = data.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

        if (!contents) {
            return res.status(200).json({ tracks: [] });
        }

        const videos = [];
        for (const item of contents) {
            if (item.videoRenderer) {
                const vr = item.videoRenderer;
                const videoId = vr.videoId;
                const title = vr.title?.runs?.[0]?.text;
                const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url;
                const artist = vr.ownerText?.runs?.[0]?.text;
                const duration = vr.lengthText?.simpleText || "0:00";

                if (videoId && title) {
                    videos.push({
                        id: videoId,
                        title,
                        thumbnail,
                        artist,
                        duration,
                        uri: `youtube:track:${videoId}`
                    });
                }
            }
        }

        return res.status(200).json({ tracks: videos.slice(0, 15) });
    } catch (error) {
        console.error('YouTube Search API Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
