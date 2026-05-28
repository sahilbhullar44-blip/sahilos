const parseDurationToSeconds = (durationStr) => {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // mm:ss
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]; // hh:mm:ss
    }
    return 0;
};

export default async function handler(req, res) {
    const { q } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Enhance query with music terms if needed to get real songs instead of vlogs
    let enhancedQuery = q;
    const lowerQuery = q.toLowerCase();
    const musicKeywords = ["song", "music", "audio", "video", "lyrics", "lofi", "beat", "remix", "cover", "sing", "rap", "hiphop", "pop", "live", "concert", "singer", "artist", "hits", "play", "track", "album", "unplugged", "acoustic", "diljit", "sidhu", "punjabi"];
    const hasKeyword = musicKeywords.some(keyword => lowerQuery.includes(keyword));
    if (!hasKeyword) {
        enhancedQuery = `${q} song`;
    }

    try {
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(enhancedQuery)}`, {
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
            if (!title) continue;

            const artist = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Artist";
            const duration = vr.lengthText?.simpleText || "0:00";

            // 1. Filter out compilations / mixes / streams by duration (must be between 45s and 10 mins)
            const seconds = parseDurationToSeconds(duration);
            if (seconds < 45 || seconds > 600) {
                continue;
            }

            // 2. Filter out non-music content by title / artist keywords
            const lowerTitle = title.toLowerCase();
            const lowerArtist = artist.toLowerCase();
            const excludeTerms = ["reaction", "review", "unboxing", "tutorial", "news", "gameplay", "vlog", "interview", "trailer", "teaser", "episode", "full movie", "stream recording"];
            if (excludeTerms.some(term => lowerTitle.includes(term) || lowerArtist.includes(term))) {
                continue;
            }

            const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url;
            seenIds.add(videoId);
            videos.push({
                id: videoId,
                title,
                thumbnail,
                artist,
                duration,
                uri: `youtube:track:${videoId}`
            });
        }

        return res.status(200).json({ tracks: videos.slice(0, 15) });
    } catch (error) {
        console.error('YouTube Search API Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
