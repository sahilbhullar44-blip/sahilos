"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Command, Wifi, WifiOff, Battery, Search, SlidersHorizontal, 
    Folder, Terminal, Image as ImageIcon, Music, Play, Pause, 
    X, Minus, Maximize2, Smile, Code, Settings, Trash2, Repeat, 
    SkipBack, SkipForward, Volume2, Video, PlayCircle, Atom 
} from 'lucide-react';

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
        const hash = window.location.hash;
        let token = window.localStorage.getItem("spotifyToken");

        // Jab user login karke wapas aayega, toh URL me token hoga
        if (hash && hash.includes("access_token")) {
            token = hash.substring(1).split("&").find(elem => elem.startsWith("access_token")).split("=")[1];
            window.location.hash = "";
            window.localStorage.setItem("spotifyToken", token);
        }

        if (token) {
            setSpotifyToken(token);
        }
    }, []);

    // Login Redirect Function
    const handleSpotifyLogin = () => {
        if (SPOTIFY_CLIENT_ID === "YOUR_CLIENT_ID_HERE") {
            alert("Bhai code mein apna Spotify Client ID daalna mat bhoolna!");
            return;
        }
        window.location.href = `${AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&response_type=${RESPONSE_TYPE}&scope=${encodeURIComponent(SCOPES)}`;
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

    // Play Specific Track via SDK
    const playSpotifyTrack = async (uri) => {
        if (!deviceId || !spotifyToken) return;
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [uri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${spotifyToken}`
            },
        });
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
                <DraggableWindow id="app-spotify" title="Spotify Web Player" dark defaultPos={{x: 200, y: 100}} width="w-[750px]" height="h-[500px]" isActive={activeApp === 'app-spotify'} bringToFront={setActiveApp} closeApp={handleCloseApp}>
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
                                {/* Top Bar: Search */}
                                <div className="px-6 py-4 bg-[#181818] border-b border-[#282828] flex items-center justify-between">
                                    <div className="relative w-80">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search Spotify..."
                                            className="w-full bg-[#242424] text-sm text-white pl-12 pr-4 py-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder-gray-500 font-medium"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && searchMusic(searchQuery)}
                                        />
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        {isSearching && <span className="text-sm text-[#1DB954] animate-pulse font-medium">Searching...</span>}
                                        <button onClick={handleSpotifyLogout} className="text-xs font-semibold text-white/70 hover:text-white border border-white/20 px-4 py-1.5 rounded-full hover:bg-white/10 transition-colors">Logout</button>
                                    </div>
                                </div>

                                {/* Main Content: Album Art or Search Results */}
                                <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#1e1e1e] to-[#121212] p-6 custom-scroll">
                                    {searchResults.length > 0 ? (
                                        <div>
                                            <h3 className="text-lg font-bold mb-4">Search Results</h3>
                                            <div className="space-y-2">
                                                {searchResults.map((track) => (
                                                    <div 
                                                        key={track.id} 
                                                        onClick={() => playSpotifyTrack(track.uri)}
                                                        className="flex items-center p-3 hover:bg-white/10 rounded-md cursor-pointer transition-colors group"
                                                    >
                                                        <img src={track.album.images[2]?.url} className="w-10 h-10 rounded mr-4 object-cover" alt={track.name} />
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="text-sm font-bold truncate text-white group-hover:text-[#1DB954] transition-colors">{track.name}</div>
                                                            <div className="text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</div>
                                                        </div>
                                                        <Play size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : currentTrack ? (
                                        <div className="flex flex-col items-center justify-center h-full animate-fade-in">
                                            <img src={currentTrack.album.images[0]?.url} className={`w-56 h-56 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] mb-8 object-cover ${spotifyPlaying ? 'animate-[pulse_4s_ease-in-out_infinite]' : ''}`} alt="Album Art" />
                                            <h2 className="text-3xl font-extrabold mb-2 text-center text-white drop-shadow-md px-4">{currentTrack.name}</h2>
                                            <p className="text-gray-400 text-lg text-center font-medium">{currentTrack.artists.map(a => a.name).join(', ')}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                            <Music size={64} className="mb-4 text-gray-500" />
                                            <p className="font-medium text-lg">Play a song to see album art</p>
                                        </div>
                                    )}
                                </div>

                                {/* Player Controls (Bottom) */}
                                <div className="bg-[#181818] px-6 py-5 flex items-center justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.3)] shrink-0">
                                    <div className="flex items-center w-1/3 overflow-hidden">
                                        {currentTrack && (
                                            <>
                                                <img src={currentTrack.album.images[0]?.url} className="w-14 h-14 rounded-md mr-4 shadow-md object-cover" alt="Thumbnail" />
                                                <div className="truncate">
                                                    <div className="text-sm font-bold text-white truncate">{currentTrack.name}</div>
                                                    <div className="text-xs text-gray-400 truncate">{currentTrack.artists.map(a => a.name).join(', ')}</div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center justify-center w-1/3">
                                        <div className="flex items-center gap-6">
                                            <button onClick={() => player?.previousTrack()} className="text-gray-400 hover:text-white transition-colors">
                                                <SkipBack size={24} fill="currentColor" />
                                            </button>
                                            <button onClick={() => player?.togglePlay()} className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform">
                                                {spotifyPlaying ? <Pause size={24} className="text-black fill-black" /> : <Play size={24} className="text-black fill-black ml-1" />}
                                            </button>
                                            <button onClick={() => player?.nextTrack()} className="text-gray-400 hover:text-white transition-colors">
                                                <SkipForward size={24} fill="currentColor" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end w-1/3 gap-3 text-gray-400">
                                        <Volume2 size={20} />
                                        <div className="w-24 h-1.5 bg-[#4d4d4d] rounded-full overflow-hidden">
                                            <div className="w-full h-full bg-white rounded-full"></div>
                                        </div>
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
