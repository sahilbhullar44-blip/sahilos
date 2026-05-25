export default async function handler(req, res) {
    const { q, type = 'track', limit = '10' } = req.query;
    
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID || "2420d19b204e4423b0080864f124c9e3";
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "5b0da09ba65f44759361553156fa4409";

    try {
        // 1. Get Client Credentials Token from Spotify
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            },
            body: 'grant_type=client_credentials',
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            return res.status(500).json({ 
                error: 'Failed to retrieve access token from Spotify', 
                details: tokenData 
            });
        }

        const accessToken = tokenData.access_token;

        // 2. Perform search query on Spotify using the retrieved token
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const searchData = await searchResponse.json();
        return res.status(200).json(searchData);
    } catch (error) {
        console.error('Spotify Search API Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
