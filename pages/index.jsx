"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Command, Wifi, WifiOff, Battery, Search, SlidersHorizontal, 
    Folder, Terminal, Image as ImageIcon, Music, Play, Pause, 
    X, Minus, Maximize2, Smile, Code, Settings, Trash2, Repeat, 
    SkipBack, SkipForward, Volume2, Video, PlayCircle, Atom, Shuffle 
} from 'lucide-react';

// --- SPOTIFY PKCE HELPERS ---
const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (a) => {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

const generateCodeChallenge = async (codeVerifier) => {
    const hashed = await sha256(codeVerifier);
    return base64urlencode(hashed);
};

// --- Reusable Draggable Window Component ---
const DraggableWindow = ({ id, title, defaultPos, isActive, bringToFront, closeApp, children, dark, width = "w-[600px]", height = "h-[400px]" }) => {
    const [pos, setPos] = useState(defaultPos);
    const [dragging, setDragging] = useState(false);
    const offset = useRef({ x: 0, y: 0 });

    const startDrag = (e) => {
        bringToFront(id);
        setDragging(true);
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (dragging) setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
        };
        const handleMouseUp = () => setDragging(false);

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging]);

    return (
        <div
            onMouseDown={() => bringToFront(id)}
            style={{ top: pos.y, left: pos.x, zIndex: isActive ? 50 : 10 }}
            className={`absolute flex flex-col rounded-xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-shadow duration-300 ${isActive ? 'shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]' : ''} ${width} ${height} ${dark ? 'bg-[#1e1e1e]/90 backdrop-blur-3xl border-[0.5px] border-white/20' : 'bg-white/70 backdrop-blur-3xl border-[0.5px] border-white/40'}`}
        >
            <div onMouseDown={startDrag} className={`h-[52px] flex items-center px-4 relative cursor-grab active:cursor-grabbing shrink-0 ${dark ? 'bg-transparent border-b border-black/50' : 'bg-transparent border-b border-black/10'}`}>
               <div className="flex space-x-2 absolute left-4">
                    <button onClick={(e) => { e.stopPropagation(); closeApp(id); }} className="w-3 h-3 rounded-full bg-[#FF5F56] border-[0.5px] border-black/20 hover:brightness-110 flex items-center justify-center group">
                        <X size={8} strokeWidth={4} className="text-black/50 opacity-0 group-hover:opacity-100" />
                    </button>
                    <button className="w-3 h-3 rounded-full bg-[#FFBD2E] border-[0.5px] border-black/20 hover:brightness-110 flex items-center justify-center group">
                        <Minus size={8} strokeWidth={4} className="text-black/50 opacity-0 group-hover:opacity-100" />
                    </button>
                    <button className="w-3 h-3 rounded-full bg-[#27C93F] border-[0.5px] border-black/20 hover:brightness-110 flex items-center justify-center group">
                        <Maximize2 size={8} strokeWidth={4} className="text-black/50 opacity-0 group-hover:opacity-100" />
                    </button>
               </div>
               <div className={`w-full text-center text-[13px] font-semibold tracking-wide select-none ${dark ? 'text-white/80' : 'text-black/70'}`}>{title}</div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
                {children}
            </div>
        </div>
    );
};

// --- Main Application Component ---
export default function App() {
    // SSR Hydration Guard
    const [mounted, setMounted] = useState(false);

    // 1. Global States
    const [wallpaper, setWallpaper] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2560&auto=format&fit=crop');
    const [time, setTime] = useState('Loading...');
    const [wifiOn, setWifiOn] = useState(true);

    // Spotify SDK States
    const [spotifyToken, setSpotifyToken] = useState('');
    const [deviceId, setDeviceId] = useState(null);
    const [player, setPlayer] = useState(null);
    const [spotifyPlaying, setSpotifyPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Spotify Player States
    const [activeTab, setActiveTab] = useState('home');
    const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'context', 'track'
    const [shuffleMode, setShuffleMode] = useState(false);
    const [trackProgress, setTrackProgress] = useState(0);
    const [trackDuration, setTrackDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    
    // Window Management
    const [openApps, setOpenApps] = useState(['app-spotify', 'app-photos', 'app-terminal']);
    const [activeApp, setActiveApp] = useState('app-spotify');

    // Media Player State
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);

    // --- SPOTIFY OAUTH (LOGIN) CONSTANTS ---
    const SPOTIFY_CLIENT_ID = "2420d19b204e4423b0080864f124c9e3"; 
    const SPOTIFY_REDIRECT_URI = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://sahilos-nine.vercel.app/';
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "token";
    const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";

    useEffect(() => {
        setMounted(true);
    }, []);

    // Handle Spotify Login & Token Extraction
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let token = window.localStorage.getItem("spotifyToken");
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            const codeVerifier = window.localStorage.getItem("spotify_code_verifier");
            const fetchToken = async () => {
                try {
                    const response = await fetch('https://accounts.spotify.com/api/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            client_id: SPOTIFY_CLIENT_ID,
                            grant_type: 'authorization_code',
                            code: code,
                            redirect_uri: SPOTIFY_REDIRECT_URI,
                            code_verifier: codeVerifier,
                        }),
                    });

                    const data = await response.json();
                    if (data.access_token) {
                        window.localStorage.setItem("spotifyToken", data.access_token);
                        setSpotifyToken(data.access_token);
                        // Clean up URL query parameters
                        window.history.replaceState({}, document.title, window.location.pathname);
                    } else if (data.error) {
                        console.error("Token exchange failed:", data.error_description || data.error);
                    }
                } catch (error) {
                    console.error("Error exchanging Spotify code:", error);
                }
            };
            fetchToken();
        } else if (token) {
            setSpotifyToken(token);
        }
    }, []);

    // Login Redirect Function
    const handleSpotifyLogin = async () => {
        if (SPOTIFY_CLIENT_ID === "YOUR_CLIENT_ID_HERE") {
            alert("Bhai code mein apna Spotify Client ID daalna mat bhoolna!");
            return;
        }

        const codeVerifier = generateRandomString(128);
        window.localStorage.setItem("spotify_code_verifier", codeVerifier);

        const codeChallenge = await generateCodeChallenge(codeVerifier);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: SCOPES,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
        });

        window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
    };

    // Logout Function
    const handleSpotifyLogout = () => {
        setSpotifyToken("");
        window.localStorage.removeItem("spotifyToken");
        if (player) player.disconnect();
        setPlayer(null);
        setDeviceId(null);
    };

    // 2. System Clock
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            let hours = now.getHours();
            let minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12; 
            minutes = minutes < 10 ? '0' + minutes : minutes;
            setTime(`${days[now.getDay()]} ${hours}:${minutes} ${ampm}`);
        };
        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, []);

    // 3. Video Player Mock Progress
    useEffect(() => {
        let interval;
        if (isPlayingVideo) {
            interval = setInterval(() => {
                setVideoProgress(prev => prev > 100 ? 0 : prev + 0.5);
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isPlayingVideo]);

    // Spotify Web Playback SDK Initialization
    useEffect(() => {
        if (!spotifyToken) return;

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const spotifyPlayer = new window.Spotify.Player({
                name: 'Sahilpreet OS Web Player',
                getOAuthToken: cb => { cb(spotifyToken); },
                volume: 0.5
            });

            spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
            });

            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setDeviceId(null);
            });

            spotifyPlayer.addListener('player_state_changed', (state) => {
                if (!state) return;
                setSpotifyPlaying(!state.paused);
                setCurrentTrack(state.track_window.current_track);
                setTrackProgress(state.position);
                setTrackDuration(state.duration);
                setShuffleMode(state.shuffle);
                setRepeatMode(state.repeat_mode === 0 ? 'off' : state.repeat_mode === 1 ? 'context' : 'track');
            });

            spotifyPlayer.connect();
            setPlayer(spotifyPlayer);
        };

        return () => {
            if (player) player.disconnect();
        };
    }, [spotifyToken]);

    // Spotify API Search
    const searchMusic = async (query) => {
        if (!query || !spotifyToken) return;
        setIsSearching(true);
        try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
                headers: { 'Authorization': `Bearer ${spotifyToken}` }
            });
            const data = await res.json();
            if (data.tracks && data.tracks.items) {
                setSearchResults(data.tracks.items);
            }
        } catch (error) {
            console.error("Spotify Search Error:", error);
            alert("Search failed. Please check your token.");
        } finally {
            setIsSearching(false);
        }
    };

    // Play Specific Track via SDK (with support for context/queues)
    const playSpotifyTrack = async (uri, contextUris = []) => {
        if (!deviceId || !spotifyToken) return;
        const body = contextUris.length > 0 
            ? { uris: contextUris, offset: { uri: uri } }
            : { uris: [uri] };
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${spotifyToken}`
            },
        });
    };

    // Incremental progress updater hook
    useEffect(() => {
        let interval;
        if (spotifyPlaying) {
            interval = setInterval(() => {
                setTrackProgress(prev => {
                    if (prev + 1000 > trackDuration) {
                        return trackDuration;
                    }
                    return prev + 1000;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [spotifyPlaying, trackDuration]);

    // Spotify controls handlers
    const toggleSpotifyRepeat = async () => {
        if (!spotifyToken) return;
        const nextMode = repeatMode === 'off' ? 'track' : repeatMode === 'track' ? 'context' : 'off';
        setRepeatMode(nextMode);
        try {
            await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${nextMode}${deviceId ? `&device_id=${deviceId}` : ''}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${spotifyToken}`
                }
            });
        } catch (e) {
            console.error("Error setting repeat mode:", e);
        }
    };

    const toggleSpotifyShuffle = async () => {
        if (!spotifyToken) return;
        const nextShuffle = !shuffleMode;
        setShuffleMode(nextShuffle);
        try {
            await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${nextShuffle}${deviceId ? `&device_id=${deviceId}` : ''}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${spotifyToken}`
                }
            });
        } catch (e) {
            console.error("Error setting shuffle mode:", e);
        }
    };

    const handleVolumeChange = async (e) => {
        const newVolume = Number(e.target.value);
        setVolume(newVolume);
        if (player) {
            try {
                await player.setVolume(newVolume);
            } catch (err) {
                console.error("Error setting volume:", err);
            }
        }
    };

    const handleSeek = async (e) => {
        if (!player) return;
        const newProgress = Number(e.target.value);
        setTrackProgress(newProgress);
        try {
            await player.seek(newProgress);
        } catch (err) {
            console.error("Error seeking:", err);
        }
    };

    // Helper to search and play a search query as a playlist queue
    const playGenreOrSong = async (query) => {
        if (!spotifyToken || !deviceId) return;
        try {
            const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
                headers: { 'Authorization': `Bearer ${spotifyToken}` }
            });
            const data = await res.json();
            if (data.tracks && data.tracks.items.length > 0) {
                const uris = data.tracks.items.map(t => t.uri);
                await playSpotifyTrack(uris[0], uris);
            }
        } catch (error) {
            console.error("Play genre error:", error);
        }
    };

    // 4. Actions
    const handleOpenApp = (id) => {
        if (!openApps.includes(id)) {
            setOpenApps([...openApps, id]);
        }
        setActiveApp(id);
    };

    const handleCloseApp = (id) => {
        setOpenApps(openApps.filter(app => app !== id));
        if (id === 'app-mediaplayer') setIsPlayingVideo(false);
    };

    const photosList = [
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1550439062-609e1531270e?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1506744626753-1fa44df14dd4?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=600&auto=format&fit=crop"
    ];

    if (!mounted) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center text-white">
                <span className="text-sm font-medium animate-pulse">Initializing OS...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-screen overflow-hidden select-none text-white font-sans bg-black relative" 
             style={{ backgroundImage: `url('${wallpaper}')`, backgroundSize: 'cover', backgroundPosition: 'center', transition: 'background-image 0.5s ease-in-out' }}>
            
            <style dangerouslySetInnerHTML={{__html: `
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 10px; }
                .dock-icon { transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); transform-origin: bottom; }
                .dock-icon:hover { transform: scale(1.3) translateY(-10px); margin: 0 10px; z-index: 50; }
                .mac-text-shadow { text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
            `}} />

            {/* TOP MENU BAR */}
            <nav className="w-full h-7 bg-black/20 backdrop-blur-2xl flex justify-between items-center px-4 text-[13px] font-medium z-[100] fixed top-0 text-white shadow-sm">
                <div className="flex items-center space-x-4">
                    <Command size={14} className="mb-0.5 cursor-pointer hover:text-white/70 transition-colors" />
                    <span className="font-bold cursor-pointer hover:text-white/70 transition-colors">Sahilpreet</span>
                    <span className="hidden sm:inline cursor-pointer hover:text-white/70 transition-colors">File</span>
                    <span className="hidden sm:inline cursor-pointer hover:text-white/70 transition-colors">Edit</span>
                    <span className="hidden sm:inline cursor-pointer hover:text-white/70 transition-colors">View</span>
                    <span className="hidden sm:inline cursor-pointer hover:text-white/70 transition-colors">Go</span>
                </div>
                <div className="flex items-center space-x-4">
                    {wifiOn ? (
                        <Wifi size={14} className="cursor-pointer hover:text-white/70 transition-colors" onClick={() => setWifiOn(false)} />
                    ) : (
                        <WifiOff size={14} className="cursor-pointer hover:text-white/70 transition-colors text-white/40" onClick={() => setWifiOn(true)} />
                    )}
                    <Battery size={16} />
                    <Search size={14} className="cursor-pointer hover:text-white/70 transition-colors" />
                    <SlidersHorizontal size={14} className="cursor-pointer hover:text-white/70 transition-colors" />
                    <span className="cursor-pointer hover:text-white/70 transition-colors tracking-wide">{time}</span>
                </div>
            </nav>

            {/* DESKTOP FOLDERS */}
            <div className="absolute top-12 left-4 flex flex-col space-y-8 p-2">
                <div className="flex flex-col items-center w-24 cursor-pointer group" onDoubleClick={() => handleOpenApp('app-spotify')}>
                    <div className="w-16 h-16 flex items-center justify-center transition-transform duration-200 group-hover:brightness-75 group-active:scale-95">
                        <div className="w-[52px] h-[52px] bg-[#1DB954] rounded-full shadow-md flex items-center justify-center overflow-hidden drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                            <Music size={24} className="text-white" fill="white" />
                        </div>
                    </div>
                    <span className="text-[12px] mt-1 text-center font-medium mac-text-shadow px-1.5 py-0.5 rounded tracking-wide leading-tight group-active:bg-blue-500/50">Music</span>
                </div>

                <div className="flex flex-col items-center w-24 cursor-pointer group" onDoubleClick={() => handleOpenApp('app-mediaplayer')}>
                    <div className="w-16 h-16 flex items-center justify-center transition-transform duration-200 group-hover:brightness-75 group-active:scale-95">
                        <Folder size={64} className="text-[#4294FF] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" fill="#4294FF" strokeWidth={1} />
                    </div>
                    <span className="text-[12px] mt-1 text-center font-medium mac-text-shadow px-1.5 py-0.5 rounded tracking-wide leading-tight group-active:bg-blue-500/50">React Course</span>
                </div>

                <div className="flex flex-col items-center w-24 cursor-pointer group" onDoubleClick={() => handleOpenApp('app-terminal')}>
                    <div className="w-16 h-16 flex items-center justify-center transition-transform duration-200 group-hover:brightness-75 group-active:scale-95">
                         <div className="w-[52px] h-[52px] bg-gray-800 rounded-lg shadow-md flex items-center justify-center overflow-hidden border-[0.5px] border-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                            <Terminal size={32} className="text-[#4AF626]" />
                        </div>
                    </div>
                    <span className="text-[12px] mt-1 text-center font-medium mac-text-shadow px-1.5 py-0.5 rounded tracking-wide leading-tight group-active:bg-blue-500/50">Terminal</span>
                </div>

                <div className="flex flex-col items-center w-24 cursor-pointer group" onDoubleClick={() => handleOpenApp('app-photos')}>
                    <div className="w-16 h-16 flex items-center justify-center transition-transform duration-200 group-hover:brightness-75 group-active:scale-95">
                        <div className="w-[52px] h-[52px] bg-white rounded-xl shadow-md border-[0.5px] border-black/10 flex items-center justify-center overflow-hidden drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                            <ImageIcon size={28} className="text-blue-500" />
                        </div>
                    </div>
                    <span className="text-[12px] mt-1 text-center font-medium mac-text-shadow px-1.5 py-0.5 rounded tracking-wide leading-tight group-active:bg-blue-500/50">Photos</span>
                </div>
            </div>

            {/* --- WINDOWS --- */}

            {/* Spotify App Window */}
            {openApps.includes('app-spotify') && (
                <DraggableWindow id="app-spotify" title="Spotify Web Player" dark defaultPos={{x: 200, y: 100}} width="w-[820px]" height="h-[530px]" isActive={activeApp === 'app-spotify'} bringToFront={setActiveApp} closeApp={handleCloseApp}>
                    <div className="flex flex-col h-full bg-[#121212] text-white relative">
                        {!spotifyToken ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#1e1e1e] to-[#121212]">
                                <Music size={64} className="text-[#1DB954] mb-6 animate-bounce" />
                                <h2 className="text-2xl font-bold mb-2">Login with Spotify Premium</h2>
                                <p className="text-gray-400 text-sm mb-8 max-w-md">Connect your Spotify account securely to play full songs directly inside this OS.</p>
                                <button 
                                    onClick={handleSpotifyLogin}
                                    className="bg-[#1DB954] text-black font-extrabold px-10 py-3.5 rounded-full hover:scale-105 hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(29,185,84,0.4)]"
                                >
                                    Log in with Spotify
                                </button>
                                <p className="text-xs text-gray-600 mt-6 max-w-sm">
                                    Requires a valid <code className="bg-white/10 px-1 rounded">CLIENT_ID</code> in code.
                                </p>
                            </div>
                        ) : !deviceId ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#1e1e1e] to-[#121212]">
                                <Music size={64} className="text-[#1DB954] mb-6 animate-pulse" />
                                <h2 className="text-2xl font-bold mb-2">Connecting...</h2>
                                <p className="text-gray-400 text-sm mb-6">Initializing Spotify Web Playback SDK.</p>
                                <button onClick={handleSpotifyLogout} className="text-xs text-white/50 hover:text-white underline">Cancel / Logout</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 flex overflow-hidden">
                                    {/* Left Sidebar */}
                                    <div className="w-48 bg-[#000000] p-4 flex flex-col shrink-0">
                                        {/* Sidebar Navigation */}
                                        <div className="space-y-4 mb-6">
                                            <div 
                                                onClick={() => { setActiveTab('home'); setSearchResults([]); }}
                                                className={`flex items-center space-x-3 cursor-pointer transition-colors ${activeTab === 'home' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                <Smile size={20} />
                                                <span className="text-sm font-bold">Home</span>
                                            </div>
                                            <div 
                                                onClick={() => setActiveTab('search')}
                                                className={`flex items-center space-x-3 cursor-pointer transition-colors ${activeTab === 'search' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                <Search size={20} />
                                                <span className="text-sm font-bold">Search</span>
                                            </div>
                                        </div>

                                        {/* Playlists Section */}
                                        <div className="border-t border-[#282828] pt-4 flex-1 overflow-y-auto custom-scroll">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Playlists</h4>
                                            <div className="space-y-2 text-xs text-gray-400">
                                                <div 
                                                    onClick={() => playGenreOrSong("lofi")}
                                                    className="hover:text-white cursor-pointer truncate font-medium flex items-center"
                                                >
                                                    <Music size={14} className="mr-2 shrink-0 text-gray-500" />
                                                    Lofi Study Chill
                                                </div>
                                                <div 
                                                    onClick={() => playGenreOrSong("punjabi")}
                                                    className="hover:text-white cursor-pointer truncate font-medium flex items-center"
                                                >
                                                    <Music size={14} className="mr-2 shrink-0 text-gray-500" />
                                                    Punjabi Hits
                                                </div>
                                                <div 
                                                    onClick={() => playGenreOrSong("top global")}
                                                    className="hover:text-white cursor-pointer truncate font-medium flex items-center"
                                                >
                                                    <Music size={14} className="mr-2 shrink-0 text-gray-500" />
                                                    Top 50 - Global
                                                </div>
                                                <div 
                                                    onClick={() => playGenreOrSong("coding beats")}
                                                    className="hover:text-white cursor-pointer truncate font-medium flex items-center"
                                                >
                                                    <Music size={14} className="mr-2 shrink-0 text-gray-500" />
                                                    Coding Chillhop
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Sidebar footer */}
                                        <button 
                                            onClick={handleSpotifyLogout} 
                                            className="text-[10px] font-bold tracking-wider text-gray-400 hover:text-white transition-colors border border-gray-800 hover:border-white/25 py-1.5 rounded-full mt-auto text-center"
                                        >
                                            LOG OUT
                                        </button>
                                    </div>

                                    {/* Main Content Window */}
                                    <div className="flex-1 flex flex-col bg-gradient-to-b from-[#1c1c1c] to-[#121212] overflow-hidden">
                                        {/* Header */}
                                        <div className="px-6 py-4 bg-transparent flex items-center justify-between shrink-0">
                                            <div className="flex items-center space-x-4">
                                                {activeTab === 'search' && (
                                                    <div className="relative w-72">
                                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="What do you want to listen to?"
                                                            className="w-full bg-[#242424] text-xs text-white pl-11 pr-4 py-2 rounded-full focus:outline-none focus:ring-1 focus:ring-white/25 transition-all placeholder-gray-500 font-medium"
                                                            value={searchQuery}
                                                            onChange={e => setSearchQuery(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && searchMusic(searchQuery)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {isSearching && <span className="text-[10px] text-[#1DB954] animate-pulse font-bold tracking-widest mr-2">SEARCHING...</span>}
                                                <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 cursor-default select-none">
                                                    <div className="w-5 h-5 rounded-full bg-[#1DB954] text-[10px] font-black text-black flex items-center justify-center">S</div>
                                                    <span className="text-xs font-bold text-white/95">Sahilpreet</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Scrollable Area */}
                                        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scroll">
                                            {searchResults.length > 0 ? (
                                                <div>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-lg font-black tracking-tight">Search Results</h3>
                                                        <button onClick={() => setSearchResults([])} className="text-xs text-gray-400 hover:text-white font-bold transition">Clear</button>
                                                    </div>
                                                    <div className="space-y-1 bg-black/20 p-2 rounded-xl backdrop-blur-md border border-white/5">
                                                        {searchResults.map((track, index) => (
                                                            <div 
                                                                key={track.id} 
                                                                onClick={() => playSpotifyTrack(track.uri, searchResults.map(t => t.uri))}
                                                                className="flex items-center p-2.5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group"
                                                            >
                                                                <span className="text-sm font-bold text-gray-500 w-6 text-center group-hover:hidden">{index + 1}</span>
                                                                <Play size={14} className="text-[#1DB954] w-6 hidden group-hover:block fill-current mr-0" />
                                                                <img src={track.album.images[2]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17'} className="w-10 h-10 rounded mr-4 object-cover" alt={track.name} />
                                                                <div className="flex-1 overflow-hidden">
                                                                    <div className="text-sm font-bold truncate text-white group-hover:text-[#1DB954] transition-colors">{track.name}</div>
                                                                    <div className="text-xs text-gray-400 truncate mt-0.5">{track.artists.map(a => a.name).join(', ')}</div>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mr-4 hidden md:block truncate max-w-[150px]">{track.album.name}</div>
                                                                <span className="text-xs text-gray-400">
                                                                    {Math.floor(track.duration_ms / 60000)}:
                                                                    {String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : activeTab === 'search' ? (
                                                <div>
                                                    <h3 className="text-lg font-black tracking-tight mb-4">Browse All</h3>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div onClick={() => playGenreOrSong("punjabi")} className="h-24 rounded-lg p-4 cursor-pointer bg-gradient-to-br from-pink-500 to-indigo-600 relative overflow-hidden group shadow-lg hover:scale-[1.02] transition-transform">
                                                            <span className="text-sm font-black text-white">Punjabi Hits</span>
                                                            <Music size={40} className="absolute -bottom-2 -right-2 text-white/20 transform rotate-12 group-hover:scale-110 transition-transform" />
                                                        </div>
                                                        <div onClick={() => playGenreOrSong("pop")} className="h-24 rounded-lg p-4 cursor-pointer bg-gradient-to-br from-green-500 to-teal-600 relative overflow-hidden group shadow-lg hover:scale-[1.02] transition-transform">
                                                            <span className="text-sm font-black text-white">Pop</span>
                                                            <Music size={40} className="absolute -bottom-2 -right-2 text-white/20 transform rotate-12 group-hover:scale-110 transition-transform" />
                                                        </div>
                                                        <div onClick={() => playGenreOrSong("lofi beats")} className="h-24 rounded-lg p-4 cursor-pointer bg-gradient-to-br from-purple-500 to-pink-600 relative overflow-hidden group shadow-lg hover:scale-[1.02] transition-transform">
                                                            <span className="text-sm font-black text-white">Lofi & Chill</span>
                                                            <Music size={40} className="absolute -bottom-2 -right-2 text-white/20 transform rotate-12 group-hover:scale-110 transition-transform" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* HOME VIEW */
                                                <div className="space-y-6">
                                                    <div>
                                                        <h2 className="text-xl font-black tracking-tight mb-4">Good Afternoon</h2>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div onClick={() => playGenreOrSong("lofi study")} className="flex items-center bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-colors group relative pr-4">
                                                                <img src="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0" alt="Lofi" />
                                                                <span className="text-xs font-bold truncate">Lofi Study beats</span>
                                                                <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                    <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                </button>
                                                            </div>
                                                            <div onClick={() => playGenreOrSong("diljit dosanjh")} className="flex items-center bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-colors group relative pr-4">
                                                                <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0" alt="Diljit" />
                                                                <span className="text-xs font-bold truncate">Diljit Dosanjh hits</span>
                                                                <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                    <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                </button>
                                                            </div>
                                                            <div onClick={() => playGenreOrSong("punjabi pop")} className="flex items-center bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-colors group relative pr-4">
                                                                <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0" alt="Top Global" />
                                                                <span className="text-xs font-bold truncate">Punjabi Pop Hits</span>
                                                                <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                    <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                </button>
                                                            </div>
                                                            <div onClick={() => playGenreOrSong("coding mix")} className="flex items-center bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-colors group relative pr-4">
                                                                <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0" alt="Coding" />
                                                                <span className="text-xs font-bold truncate">Coding Chill Session</span>
                                                                <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                    <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-lg font-black tracking-tight mb-3">Recommended for You</h3>
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div onClick={() => playGenreOrSong("diljit dosanjh")} className="bg-[#181818] p-3.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors group shadow-lg">
                                                                <div className="relative mb-3 overflow-hidden rounded-md shadow-md">
                                                                    <img src="https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover" alt="Diljit" />
                                                                    <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                        <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                    </button>
                                                                </div>
                                                                <h4 className="text-xs font-bold text-white truncate">Diljit Dosanjh Mix</h4>
                                                                <p className="text-[10px] text-gray-400 mt-1 truncate">Ultimate Punjabi playlist</p>
                                                            </div>
                                                            <div onClick={() => playGenreOrSong("study lofi")} className="bg-[#181818] p-3.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors group shadow-lg">
                                                                <div className="relative mb-3 overflow-hidden rounded-md shadow-md">
                                                                    <img src="https://images.unsplash.com/photo-1485579149621-3123dd979885?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover" alt="Lofi Study" />
                                                                    <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                        <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                    </button>
                                                                </div>
                                                                <h4 className="text-xs font-bold text-white truncate">Lofi Focus Session</h4>
                                                                <p className="text-[10px] text-gray-400 mt-1 truncate">Instrumental chillhop beats</p>
                                                            </div>
                                                            <div onClick={() => playGenreOrSong("acoustic pop")} className="bg-[#181818] p-3.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors group shadow-lg">
                                                                <div className="relative mb-3 overflow-hidden rounded-md shadow-md">
                                                                    <img src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover" alt="Acoustic" />
                                                                    <button className="w-8 h-8 rounded-full bg-[#1DB954] text-black shadow-md flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-105 transition-all">
                                                                        <Play size={14} fill="black" className="ml-0.5 text-black" />
                                                                    </button>
                                                                </div>
                                                                <h4 className="text-xs font-bold text-white truncate">Acoustic Pop Chill</h4>
                                                                <p className="text-[10px] text-gray-400 mt-1 truncate">Unplugged vocals and guitars</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Player controls (Bottom) */}
                                <div className="bg-[#181818] px-4 py-3 flex items-center justify-between border-t border-[#282828] shadow-[0_-10px_20px_rgba(0,0,0,0.3)] shrink-0 select-none">
                                    {/* Track detail info */}
                                    <div className="flex items-center w-1/4 min-w-[150px] overflow-hidden">
                                        {currentTrack ? (
                                            <>
                                                <img src={currentTrack.album.images[0]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17'} className="w-12 h-12 rounded mr-3 shadow-md object-cover shrink-0" alt="Thumbnail" />
                                                <div className="truncate">
                                                    <div className="text-xs font-bold text-white truncate hover:underline cursor-pointer">{currentTrack.name}</div>
                                                    <div className="text-[10px] text-gray-400 truncate hover:underline cursor-pointer">{currentTrack.artists.map(a => a.name).join(', ')}</div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center space-x-3 text-gray-500">
                                                <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center shrink-0">
                                                    <Music size={16} />
                                                </div>
                                                <span className="text-xs font-medium">No track playing</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Playback action buttons */}
                                    <div className="flex flex-col items-center justify-center w-2/4 max-w-[450px]">
                                        <div className="flex items-center gap-5 mb-1.5">
                                            <button 
                                                onClick={toggleSpotifyShuffle} 
                                                className={`transition-colors ${shuffleMode ? 'text-[#1DB954] hover:text-[#1ed760]' : 'text-gray-400 hover:text-white'}`}
                                                title="Shuffle"
                                            >
                                                <Shuffle size={15} className={shuffleMode ? 'stroke-[2.5px]' : ''} />
                                            </button>
                                            <button 
                                                onClick={() => player?.previousTrack()} 
                                                className="text-gray-400 hover:text-white transition-colors"
                                                title="Previous"
                                            >
                                                <SkipBack size={18} fill="currentColor" />
                                            </button>
                                            <button 
                                                onClick={() => player?.togglePlay()} 
                                                className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
                                                title={spotifyPlaying ? "Pause" : "Play"}
                                            >
                                                {spotifyPlaying ? <Pause size={14} className="text-black fill-black" /> : <Play size={14} className="text-black fill-black ml-0.5" />}
                                            </button>
                                            <button 
                                                onClick={() => player?.nextTrack()} 
                                                className="text-gray-400 hover:text-white transition-colors"
                                                title="Next"
                                            >
                                                <SkipForward size={18} fill="currentColor" />
                                            </button>
                                            <button 
                                                onClick={toggleSpotifyRepeat} 
                                                className={`transition-colors relative ${repeatMode !== 'off' ? 'text-[#1DB954] hover:text-[#1ed760]' : 'text-gray-400 hover:text-white'}`}
                                                title={`Repeat: ${repeatMode}`}
                                            >
                                                <Repeat size={15} className={repeatMode !== 'off' ? 'stroke-[2.5px]' : ''} />
                                                {repeatMode === 'track' && <div className="w-1.5 h-1.5 bg-[#1DB954] rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2 scale-55"></div>}
                                            </button>
                                        </div>

                                        {/* Progress Bar slider */}
                                        <div className="flex items-center w-full gap-2 text-[10px] text-gray-400 font-medium select-none">
                                            <span>
                                                {Math.floor(trackProgress / 60000)}:
                                                {String(Math.floor((trackProgress % 60000) / 1000)).padStart(2, '0')}
                                            </span>
                                            <input 
                                                type="range"
                                                min="0"
                                                max={trackDuration || 0}
                                                value={trackProgress}
                                                onChange={handleSeek}
                                                className="w-full h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer accent-white hover:accent-[#1DB954] focus:outline-none outline-none"
                                            />
                                            <span>
                                                {Math.floor(trackDuration / 60000)}:
                                                {String(Math.floor((trackDuration % 60000) / 1000)).padStart(2, '0')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Volume control slider */}
                                    <div className="flex items-center justify-end w-1/4 gap-2 text-gray-400">
                                        <Volume2 size={16} />
                                        <input 
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={volume}
                                            onChange={handleVolumeChange}
                                            className="w-16 h-1 bg-[#4d4d4d] rounded-full appearance-none cursor-pointer accent-white hover:accent-[#1DB954] focus:outline-none outline-none"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </DraggableWindow>
            )}

            {/* Media Player Window */}
            {openApps.includes('app-mediaplayer') && (
                <DraggableWindow id="app-mediaplayer" title="React Masterclass" dark defaultPos={{x: typeof window !== 'undefined' ? window.innerWidth/4 : 200, y: 100}} width="w-[800px]" height="h-[500px]" isActive={activeApp === 'app-mediaplayer'} bringToFront={setActiveApp} closeApp={handleCloseApp}>
                    <div className="flex flex-1 overflow-hidden">
                        <div className="w-64 bg-black/40 border-r border-white/10 p-4 overflow-y-auto">
                            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Course Content</h3>
                            <ul className="space-y-2">
                                <li className="p-2 bg-blue-500/20 rounded-lg text-sm text-blue-300 font-medium cursor-pointer flex items-center">
                                    <PlayCircle size={16} className="mr-2" /> 1. Introduction to React
                                </li>
                                <li className="p-2 hover:bg-white/10 rounded-lg text-sm text-white/80 cursor-pointer transition flex items-center">
                                    <Video size={16} className="mr-2 text-white/50" /> 2. Components & Props
                                </li>
                                <li className="p-2 hover:bg-white/10 rounded-lg text-sm text-white/80 cursor-pointer transition flex items-center">
                                    <Video size={16} className="mr-2 text-white/50" /> 3. useState Hook
                                </li>
                            </ul>
                        </div>
                        <div className="flex-1 bg-black flex flex-col relative">
                            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative group">
                                <Atom size={120} className="text-[#61DAFB] opacity-20 absolute" />
                                <div className={`w-20 h-20 bg-white/10 backdrop-blur rounded-full flex items-center justify-center cursor-pointer transition z-10 ${isPlayingVideo ? 'opacity-0 hover:opacity-100' : 'opacity-100 hover:bg-white/20'}`} onClick={() => setIsPlayingVideo(!isPlayingVideo)}>
                                    {isPlayingVideo ? <Pause size={32} className="text-white fill-white" /> : <Play size={36} className="text-white fill-white ml-2" />}
                                </div>
                                <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition duration-300">
                                     <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                                         <div className="h-full bg-blue-500 transition-all duration-500" style={{width: `${videoProgress}%`}}></div>
                                     </div>
                                     <div className="flex justify-between mt-2 text-xs text-white/70">
                                         <span>0:00</span>
                                         <span>12:45</span>
                                     </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {/* Photos App Window */}
            {openApps.includes('app-photos') && (
                <DraggableWindow id="app-photos" title="Photos (Click to Set Wallpaper)" defaultPos={{x: typeof window !== 'undefined' ? window.innerWidth/3 : 250, y: 150}} width="w-[700px]" height="h-[450px]" isActive={activeApp === 'app-photos'} bringToFront={setActiveApp} closeApp={handleCloseApp}>
                    <div className="flex-1 p-6 overflow-y-auto bg-black/20">
                        <div className="grid grid-cols-3 gap-4">
                            {photosList.map((src, idx) => (
                                <img key={idx} src={src} className="w-full h-32 object-cover rounded-lg cursor-pointer hover:ring-4 ring-blue-400 transition transform hover:scale-105 shadow-lg" onClick={() => setWallpaper(src)} alt={`Wallpaper ${idx + 1}`} />
                            ))}
                        </div>
                    </div>
                </DraggableWindow>
            )}

            {/* Terminal Window */}
            {openApps.includes('app-terminal') && (
                <DraggableWindow id="app-terminal" title="jatin@macbook-pro:~" dark defaultPos={{x: 100, y: 200}} width="w-[600px]" height="h-[350px]" isActive={activeApp === 'app-terminal'} bringToFront={setActiveApp} closeApp={handleCloseApp}>
                    <div className="flex-1 bg-[#1C1C1E] p-4 font-mono text-sm overflow-y-auto text-[#4AF626]">
                        <p>Last login: {new Date().toString().substring(0, 24)} on ttys000</p>
                        <br/>
                        <p className="text-white">sahilpreet@macbook ~ % <span className="text-yellow-300">cd Portfolio</span></p>
                        <p className="text-white">sahilpreet@macbook Portfolio % <span className="text-yellow-300">npm run dev</span></p>
                        <br/>
                        <p className="text-blue-400">{"> portfolio@1.0.0 dev"}</p>
                        <p className="text-[#61DAFB]">{"> next dev"}</p>
                        <br/>
                        <p>ready - started server on 0.0.0.0:3000, url: http://localhost:3000</p>
                        <p>event - compiled client and server successfully in 1250 ms (145 modules)</p>
                        <p>wait  - compiling...</p>
                        <p>event - compiled client and server successfully in 150 ms (145 modules)</p>
                        <br/>
                        <p className="text-white flex items-center">sahilpreet@macbook Portfolio % <span className="w-2 h-4 bg-white/70 ml-1 animate-pulse inline-block"></span></p>
                    </div>
                </DraggableWindow>
            )}

            {/* BOTTOM DOCK */}
            <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[100]">
                <div className="bg-white/20 backdrop-blur-3xl border-[0.5px] border-white/30 px-3 py-2.5 rounded-[32px] flex items-end space-x-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                    
                    {/* Finder */}
                    <div className="relative group dock-icon">
                        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-[#f3f3f3] to-[#d4d4d4] shadow-md flex items-center justify-center cursor-pointer border-t border-white/80 overflow-hidden">
                             <div className="w-full h-full bg-gradient-to-r from-[#2177f3] to-[#2177f3] w-1/2 absolute left-0 opacity-20"></div>
                            <Smile size={32} className="text-[#1a66cc] drop-shadow-sm z-10" />
                        </div>
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-black/50 dark:bg-white/80 rounded-full"></div>
                    </div>

                    {/* Spotify App */}
                    <div className="relative group dock-icon" onClick={() => handleOpenApp('app-spotify')}>
                        <div className="w-12 h-12 rounded-[14px] bg-[#1DB954] shadow-md flex items-center justify-center cursor-pointer border-[0.5px] border-black/20 overflow-hidden">
                             <Music size={28} className="text-white" fill="white" />
                        </div>
                        {openApps.includes('app-spotify') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-black/50 dark:bg-white/80 rounded-full"></div>}
                    </div>
                    
                    {/* Terminal */}
                    <div className="relative group dock-icon" onClick={() => handleOpenApp('app-terminal')}>
                        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-[#333] to-[#111] shadow-md flex items-center justify-center cursor-pointer border border-white/10 relative overflow-hidden">
                            <Code size={24} className="text-[#4AF626] drop-shadow-[0_0_5px_rgba(74,246,38,0.5)]" />
                        </div>
                        {openApps.includes('app-terminal') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-black/50 dark:bg-white/80 rounded-full"></div>}
                    </div>

                    {/* Photos */}
                    <div className="relative group dock-icon" onClick={() => handleOpenApp('app-photos')}>
                        <div className="w-12 h-12 rounded-[14px] bg-white shadow-md flex items-center justify-center cursor-pointer border-t border-white/80 overflow-hidden">
                             <ImageIcon size={24} className="text-blue-500" />
                        </div>
                        {openApps.includes('app-photos') && <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-black/50 dark:bg-white/80 rounded-full"></div>}
                    </div>

                    {/* System Settings */}
                    <div className="relative group dock-icon">
                        <div className="w-12 h-12 rounded-[14px] bg-gradient-to-b from-[#e6e6e6] to-[#b3b3b3] shadow-md flex items-center justify-center cursor-pointer border-t border-white/80">
                            <Settings size={28} className="text-gray-700 drop-shadow-sm" />
                        </div>
                    </div>
                    
                    <div className="w-[1px] h-10 bg-white/30 mx-1 self-center rounded-full"></div>

                    {/* Trash */}
                    <div className="relative group dock-icon">
                        <div className="w-12 h-12 rounded-[14px] bg-white/10 backdrop-blur-md shadow-inner flex items-center justify-center cursor-pointer border-[0.5px] border-white/30">
                            <Trash2 size={24} className="text-white/90 drop-shadow-md" />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
