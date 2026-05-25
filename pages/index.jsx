"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Command, Wifi, WifiOff, Battery, Search, SlidersHorizontal, 
    Folder, Terminal, Image as ImageIcon, Music, Play, Pause, 
    X, Minus, Maximize2, Smile, Code, Settings, Trash2, Repeat, 
    SkipBack, SkipForward, Volume2, Video, PlayCircle, Atom, Shuffle 
} from 'lucide-react';

const parseDurationToMs = (durationStr) => {
    if (!durationStr) return 0;
    if (typeof durationStr === 'number') return durationStr;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    return 0;
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

    // Player States
    const [spotifyPlaying, setSpotifyPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    
    // Player UI States
    const [activeTab, setActiveTab] = useState('home');
    const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'context', 'track'
    const [shuffleMode, setShuffleMode] = useState(false);
    const [trackProgress, setTrackProgress] = useState(0);
    const [trackDuration, setTrackDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [musicUser, setMusicUser] = useState('Sahilpreet');
    
    // Play Queue States
    const [previewQueue, setPreviewQueue] = useState([]);
    const [previewIndex, setPreviewIndex] = useState(-1);
    
    // Window Management
    const [openApps, setOpenApps] = useState(['app-spotify', 'app-photos', 'app-terminal']);
    const [activeApp, setActiveApp] = useState('app-spotify');

    // Media Player State
    const [isPlayingVideo, setIsPlayingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);

    // YouTube Player Initialization & References
    const ytPlayerRef = useRef(null);
    const [ytPlayerReady, setYtPlayerReady] = useState(false);
    const previewQueueRef = useRef([]);
    const previewIndexRef = useRef(-1);
    const onStateChangeRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleRenameUser = () => {
        if (typeof window !== 'undefined') {
            const newName = prompt("Enter profile name:", musicUser);
            if (newName && newName.trim()) {
                setMusicUser(newName.trim());
            }
        }
    };

    // Stop Music Function
    const handleSpotifyLogout = () => {
        if (ytPlayerRef.current && ytPlayerReady) {
            try {
                ytPlayerRef.current.stopVideo();
            } catch (e) {
                console.error("Error stopping video:", e);
            }
        }
        setSpotifyPlaying(false);
        setCurrentTrack(null);
        setTrackProgress(0);
        setTrackDuration(0);
        setPreviewQueue([]);
        setPreviewIndex(-1);
    };

    // Clean up local audio player on unmount
    useEffect(() => {
        return () => {
            if (ytPlayerRef.current && ytPlayerReady) {
                try {
                    ytPlayerRef.current.stopVideo();
                } catch (e) {
                    console.error("Error stopping video on unmount:", e);
                }
            }
        };
    }, [ytPlayerReady]);

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


    useEffect(() => {
        previewQueueRef.current = previewQueue;
    }, [previewQueue]);

    useEffect(() => {
        previewIndexRef.current = previewIndex;
    }, [previewIndex]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initializeYTPlayer = () => {
            if (ytPlayerRef.current) return;
            const player = new window.YT.Player('yt-player', {
                height: '0',
                width: '0',
                videoId: '',
                playerVars: {
                    'playsinline': 1,
                    'controls': 0,
                    'disablekb': 1,
                    'fs': 0,
                    'rel': 0,
                    'modestbranding': 1
                },
                events: {
                    'onStateChange': (event) => {
                        if (onStateChangeRef.current) {
                            onStateChangeRef.current(event);
                        }
                    },
                    'onReady': () => {
                        setYtPlayerReady(true);
                    }
                }
            });
            ytPlayerRef.current = player;
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = initializeYTPlayer;
        } else if (window.YT && window.YT.Player) {
            initializeYTPlayer();
        }
    }, []);

    // Safeguard event handler for state closure issues
    onStateChangeRef.current = (event) => {
        // YT.PlayerState: 0 = ended, 1 = playing, 2 = paused
        if (event.data === 0) {
            if (repeatMode === 'track') {
                if (ytPlayerRef.current && ytPlayerReady) {
                    ytPlayerRef.current.seekTo(0, true);
                    ytPlayerRef.current.playVideo();
                }
            } else {
                handleNextTrack();
            }
        } else if (event.data === 1) {
            setSpotifyPlaying(true);
        } else if (event.data === 2) {
            setSpotifyPlaying(false);
        }
    };

    // YouTube Music API Search
    const searchMusic = async (query) => {
        if (!query || !query.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.tracks) {
                const mappedTracks = data.tracks.map(track => ({
                    id: track.id,
                    name: track.title,
                    artists: [{ name: track.artist }],
                    album: {
                        images: [{ url: track.thumbnail }]
                    },
                    uri: track.uri,
                    duration: track.duration,
                    duration_ms: parseDurationToMs(track.duration)
                }));
                setSearchResults(mappedTracks);
            }
        } catch (error) {
            console.error("YouTube Search Error:", error);
            alert("Search failed. Please check your connection.");
        } finally {
            setIsSearching(false);
        }
    };

    // YouTube Play Track unified function
    const playTrack = (track, queue = []) => {
        if (!track) return;

        setPreviewQueue(queue.length > 0 ? queue : [track]);
        const index = queue.length > 0 ? queue.findIndex(t => t.id === track.id) : 0;
        setPreviewIndex(index);

        setCurrentTrack({
            name: track.name || track.title,
            album: {
                images: track.album?.images || [{ url: track.thumbnail }]
            },
            artists: track.artists || [{ name: track.artist }],
            uri: track.uri,
            id: track.id,
            duration: track.duration
        });

        const durationMs = track.duration_ms || parseDurationToMs(track.duration);
        setTrackProgress(0);
        setTrackDuration(durationMs > 0 ? durationMs : 240000);

        if (ytPlayerRef.current && ytPlayerReady) {
            ytPlayerRef.current.loadVideoById(track.id);
            ytPlayerRef.current.playVideo();
            setSpotifyPlaying(true);
        }
    };

    // playSpotifyTrack compatibility wrapper
    const playSpotifyTrack = (uri, contextTracks = []) => {
        let trackToPlay = null;
        if (contextTracks.length > 0) {
            trackToPlay = contextTracks.find(t => t.uri === uri || t.id === uri || (typeof t === 'object' && t.uri === uri));
        }
        if (!trackToPlay) {
            trackToPlay = searchResults.find(t => t.uri === uri || t.id === uri);
        }
        
        if (!trackToPlay) {
            const videoId = uri.startsWith('youtube:track:') ? uri.replace('youtube:track:', '') : uri;
            trackToPlay = { 
                id: videoId, 
                uri: uri, 
                name: "YouTube Song", 
                artists: [{ name: "YouTube Music" }], 
                album: { images: [{ url: "" }] } 
            };
        }

        playTrack(trackToPlay, contextTracks);
    };

    // Poll current playback progress from YT Player
    useEffect(() => {
        let interval;
        if (spotifyPlaying && ytPlayerRef.current && ytPlayerReady) {
            interval = setInterval(() => {
                if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                    const currentSecs = ytPlayerRef.current.getCurrentTime();
                    setTrackProgress(currentSecs * 1000);
                    
                    const durationSecs = ytPlayerRef.current.getDuration();
                    if (durationSecs > 0) {
                        setTrackDuration(durationSecs * 1000);
                    }
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [spotifyPlaying, ytPlayerReady]);

    // Spotify controls handlers
    const toggleSpotifyRepeat = () => {
        const nextMode = repeatMode === 'off' ? 'track' : repeatMode === 'track' ? 'context' : 'off';
        setRepeatMode(nextMode);
    };

    const toggleSpotifyShuffle = () => {
        setShuffleMode(!shuffleMode);
    };

    const handleVolumeChange = (e) => {
        const newVolume = Number(e.target.value);
        setVolume(newVolume);
        
        if (ytPlayerRef.current && ytPlayerReady) {
            ytPlayerRef.current.setVolume(newVolume * 100);
        }
    };

    const handleSeek = (e) => {
        const newProgress = Number(e.target.value);
        setTrackProgress(newProgress);
        
        if (ytPlayerRef.current && ytPlayerReady) {
            ytPlayerRef.current.seekTo(newProgress / 1000, true);
        }
    };

    const handleNextTrack = () => {
        const currentQueue = previewQueueRef.current;
        const currentIndex = previewIndexRef.current;
        
        if (currentQueue.length === 0) return;
        
        let nextIdx = currentIndex + 1;
        if (nextIdx < currentQueue.length) {
            playTrack(currentQueue[nextIdx], currentQueue);
        } else if (repeatMode === 'context') {
            playTrack(currentQueue[0], currentQueue);
        } else {
            setSpotifyPlaying(false);
        }
    };

    const handlePrevTrack = () => {
        const currentQueue = previewQueueRef.current;
        const currentIndex = previewIndexRef.current;
        
        if (currentQueue.length === 0) return;
        
        let prevIdx = currentIndex - 1;
        if (prevIdx >= 0) {
            playTrack(currentQueue[prevIdx], currentQueue);
        } else if (repeatMode === 'context') {
            playTrack(currentQueue[currentQueue.length - 1], currentQueue);
        }
    };

    const handleTogglePlay = () => {
        if (!ytPlayerRef.current || !ytPlayerReady) return;
        
        if (spotifyPlaying) {
            ytPlayerRef.current.pauseVideo();
            setSpotifyPlaying(false);
        } else {
            ytPlayerRef.current.playVideo();
            setSpotifyPlaying(true);
        }
    };

    // Helper to search and play a search query as a playlist queue
    const playGenreOrSong = async (query) => {
        setIsSearching(true);
        try {
            const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.tracks && data.tracks.length > 0) {
                const mappedTracks = data.tracks.map(track => ({
                    id: track.id,
                    name: track.title,
                    artists: [{ name: track.artist }],
                    album: {
                        images: [{ url: track.thumbnail }]
                    },
                    uri: track.uri,
                    duration: track.duration,
                    duration_ms: parseDurationToMs(track.duration)
                }));
                // Play first track and load the rest in the play queue
                playSpotifyTrack(mappedTracks[0].uri, mappedTracks);
            }
        } catch (error) {
            console.error("Play genre error:", error);
        } finally {
            setIsSearching(false);
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
                    <div className="flex flex-col h-full bg-[#0b0b0e] text-white relative">
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Sidebar */}
                            <div className="w-48 bg-[#0b0b0f]/95 p-4 flex flex-col shrink-0 border-r border-white/5 backdrop-blur-xl">
                                
                                {/* User Profile Card */}
                                <div 
                                    onClick={handleRenameUser}
                                    title="Click to change name"
                                    className="flex items-center space-x-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-3 mb-6 cursor-pointer transition-all duration-200"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-xs font-black text-white flex items-center justify-center shadow-[0_0_10px_rgba(142,45,226,0.3)] shrink-0">
                                        {musicUser ? musicUser[0].toUpperCase() : 'G'}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-xs font-extrabold text-white truncate">{musicUser}</div>
                                        <div className="flex items-center text-[9px] text-[#27C93F] font-bold tracking-wider mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#27C93F] inline-block mr-1.5 animate-pulse"></span>
                                            ONLINE
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Navigation */}
                                <div className="space-y-2 mb-6">
                                    <div 
                                        onClick={() => { setActiveTab('home'); setSearchResults([]); }}
                                        className={`flex items-center space-x-3 px-3 py-2 rounded-xl cursor-pointer transition-all hover:translate-x-1 duration-200 ${activeTab === 'home' ? 'bg-gradient-to-r from-[#8E2DE2]/20 to-transparent border-l-2 border-[#8E2DE2] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Smile size={18} className={activeTab === 'home' ? 'text-[#8E2DE2]' : ''} />
                                        <span className="text-xs font-bold">Discover</span>
                                    </div>
                                    <div 
                                        onClick={() => setActiveTab('search')}
                                        className={`flex items-center space-x-3 px-3 py-2 rounded-xl cursor-pointer transition-all hover:translate-x-1 duration-200 ${activeTab === 'search' ? 'bg-gradient-to-r from-[#8E2DE2]/20 to-transparent border-l-2 border-[#8E2DE2] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Search size={18} className={activeTab === 'search' ? 'text-[#8E2DE2]' : ''} />
                                        <span className="text-xs font-bold">Search Tracks</span>
                                    </div>
                                </div>

                                <div className="mx-1 mb-4 px-2.5 py-1.5 rounded-xl bg-[#8E2DE2]/10 border border-[#8E2DE2]/20 text-[#c892ff] text-[9px] font-black text-center uppercase tracking-widest select-none animate-[pulse_2s_infinite]">
                                    🎵 Cyber-Cast Engine
                                </div>

                                {/* Playlists Section */}
                                <div className="border-t border-white/5 pt-4 flex-1 overflow-y-auto custom-scroll select-none">
                                    <div className="flex items-center justify-between mb-3 px-2">
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">My Library</h4>
                                    </div>
                                    <div className="space-y-1 text-xs text-gray-400">
                                        <div 
                                            onClick={() => playGenreOrSong("lofi")}
                                            className="hover:text-white cursor-pointer truncate font-medium flex items-center px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <Music size={12} className="mr-2 shrink-0 text-[#8E2DE2]" />
                                            Lofi Focus Beats
                                        </div>
                                        <div 
                                            onClick={() => playGenreOrSong("punjabi")}
                                            className="hover:text-white cursor-pointer truncate font-medium flex items-center px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <Music size={12} className="mr-2 shrink-0 text-[#8E2DE2]" />
                                            Punjabi Hits
                                        </div>
                                        <div 
                                            onClick={() => playGenreOrSong("top global")}
                                            className="hover:text-white cursor-pointer truncate font-medium flex items-center px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <Music size={12} className="mr-2 shrink-0 text-[#8E2DE2]" />
                                            Top 50 - Global
                                        </div>
                                        <div 
                                            onClick={() => playGenreOrSong("coding beats")}
                                            className="hover:text-white cursor-pointer truncate font-medium flex items-center px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <Music size={12} className="mr-2 shrink-0 text-[#8E2DE2]" />
                                            Coding Chillhop
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Sidebar footer */}
                                <button 
                                    onClick={handleSpotifyLogout} 
                                    className="text-[9px] font-black tracking-widest text-red-400 hover:text-white transition-colors border border-red-500/20 hover:border-red-500/60 bg-red-950/10 hover:bg-red-500/10 py-2 rounded-xl mt-auto text-center uppercase"
                                >
                                    Reset Player
                                </button>
                            </div>

                            {/* Main Content Window */}
                            <div className="flex-1 flex flex-col bg-gradient-to-b from-[#0e0a16] to-[#07070a] overflow-hidden relative">
                                {/* Ambient radial-gradient background for luxury depth */}
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#8E2DE2]/5 rounded-full blur-[100px] pointer-events-none"></div>

                                {/* Header */}
                                <div className="px-6 py-4 bg-transparent flex items-center justify-between shrink-0 relative z-10">
                                    <div className="flex items-center space-x-4">
                                        {activeTab === 'search' && (
                                            <div className="relative w-72">
                                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search songs, artists, genres..."
                                                    className="w-full bg-white/5 border border-white/15 focus:border-[#8E2DE2] text-xs text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#8E2DE2]/30 transition-all placeholder-gray-500 font-semibold"
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && searchMusic(searchQuery)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {isSearching && (
                                            <div className="flex items-center space-x-1.5 mr-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#8E2DE2] animate-bounce"></span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#8E2DE2] animate-bounce [animation-delay:0.2s]"></span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#8E2DE2] animate-bounce [animation-delay:0.4s]"></span>
                                                <span className="text-[10px] text-[#c892ff] font-black tracking-widest uppercase">SEARCHING</span>
                                            </div>
                                        )}
                                        <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 cursor-default select-none">
                                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-[10px] font-black text-white flex items-center justify-center">
                                                {musicUser ? musicUser[0].toUpperCase() : 'G'}
                                            </div>
                                            <span className="text-xs font-bold text-white/90">{musicUser}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Scrollable Area */}
                                <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scroll relative z-10">
                                    {searchResults.length > 0 ? (
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-base font-black tracking-tight">Search Results</h3>
                                                <button onClick={() => setSearchResults([])} className="text-xs text-gray-400 hover:text-white font-bold transition">Clear</button>
                                            </div>
                                            <div className="space-y-1.5 bg-black/20 p-2 rounded-2xl backdrop-blur-md border border-white/5">
                                                {searchResults.map((track, index) => {
                                                    const isCurrentTrack = currentTrack?.id === track.id;
                                                    return (
                                                        <div 
                                                            key={track.id} 
                                                            onClick={() => playSpotifyTrack(track.uri, searchResults)}
                                                            className={`flex items-center p-2 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-xl cursor-pointer transition-all duration-200 group ${isCurrentTrack ? 'bg-[#8E2DE2]/10 border-[#8E2DE2]/20' : ''}`}
                                                        >
                                                            <div className="w-8 flex items-center justify-center mr-2">
                                                                {isCurrentTrack && spotifyPlaying ? (
                                                                    <div className="flex items-end justify-center space-x-0.5 h-3.5 w-4 select-none">
                                                                        <div className="w-[2px] bg-[#8E2DE2] animate-[bounce_0.8s_infinite] h-full"></div>
                                                                        <div className="w-[2px] bg-[#8E2DE2] animate-[bounce_0.8s_infinite_0.2s] h-2/3"></div>
                                                                        <div className="w-[2px] bg-[#8E2DE2] animate-[bounce_0.8s_infinite_0.4s] h-4/5"></div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <span className={`text-xs font-bold text-gray-500 group-hover:hidden ${isCurrentTrack ? 'text-[#8E2DE2]' : ''}`}>{index + 1}</span>
                                                                        <Play size={12} className="text-[#8E2DE2] hidden group-hover:block fill-current" />
                                                                    </>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="relative w-10 h-10 mr-4 shrink-0 rounded-lg overflow-hidden border border-white/5 shadow-md">
                                                                <img src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17'} className="w-full h-full object-cover" alt={track.name} />
                                                            </div>

                                                            <div className="flex-1 overflow-hidden">
                                                                <div className={`text-xs font-bold truncate transition-colors ${isCurrentTrack ? 'text-[#8E2DE2]' : 'text-white'}`}>{track.name}</div>
                                                                <div className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">{track.artists.map(a => a.name).join(', ')}</div>
                                                            </div>

                                                            <span className="text-[10px] text-gray-400 font-semibold px-3 select-none">
                                                                {track.duration}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : activeTab === 'search' ? (
                                        <div>
                                            <h3 className="text-sm font-black text-white/50 uppercase tracking-widest mb-4 select-none">Explore Genres</h3>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div onClick={() => playGenreOrSong("punjabi")} className="h-28 rounded-2xl p-4 cursor-pointer bg-gradient-to-br from-[#FF007A] to-[#9600FF] relative overflow-hidden group shadow-lg hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:shadow-[0_8px_24px_rgba(150,0,255,0.4)]">
                                                    <span className="text-sm font-black text-white drop-shadow-md">Punjabi Hits</span>
                                                    <Music size={44} className="absolute -bottom-2 -right-2 text-white/10 transform rotate-12 group-hover:scale-125 group-hover:rotate-45 transition-all duration-300" />
                                                </div>
                                                <div onClick={() => playGenreOrSong("lofi chill")} className="h-28 rounded-2xl p-4 cursor-pointer bg-gradient-to-br from-[#0052D4] via-[#4364F7] to-[#6FB1FC] relative overflow-hidden group shadow-lg hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:shadow-[0_8px_24px_rgba(67,100,247,0.4)]">
                                                    <span className="text-sm font-black text-white drop-shadow-md">Lofi & Chill</span>
                                                    <Music size={44} className="absolute -bottom-2 -right-2 text-white/10 transform rotate-12 group-hover:scale-125 group-hover:rotate-45 transition-all duration-300" />
                                                </div>
                                                <div onClick={() => playGenreOrSong("top songs")} className="h-28 rounded-2xl p-4 cursor-pointer bg-gradient-to-br from-[#12C2E9] via-[#C471ED] to-[#F64F59] relative overflow-hidden group shadow-lg hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:shadow-[0_8px_24px_rgba(196,113,237,0.4)]">
                                                    <span className="text-sm font-black text-white drop-shadow-md">Top Charts</span>
                                                    <Music size={44} className="absolute -bottom-2 -right-2 text-white/10 transform rotate-12 group-hover:scale-125 group-hover:rotate-45 transition-all duration-300" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* HOME VIEW */
                                        <div className="space-y-6 select-none">
                                            <div>
                                                <h2 className="text-lg font-black tracking-tight text-white/90 mb-4">
                                                    {(() => {
                                                        const hour = new Date().getHours();
                                                        if (hour < 12) return `Good Morning, ${musicUser}`;
                                                        if (hour < 17) return `Good Afternoon, ${musicUser}`;
                                                        return `Good Evening, ${musicUser}`;
                                                    })()}
                                                </h2>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div onClick={() => playGenreOrSong("lofi study beats")} className="flex items-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 group relative pr-4 hover:scale-[1.01]">
                                                        <img src="https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0 border-r border-white/5" alt="Lofi" />
                                                        <span className="text-xs font-bold truncate">Lofi Study Beats</span>
                                                        <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                            <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                        </button>
                                                    </div>
                                                    <div onClick={() => playGenreOrSong("diljit dosanjh")} className="flex items-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 group relative pr-4 hover:scale-[1.01]">
                                                        <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0 border-r border-white/5" alt="Diljit" />
                                                        <span className="text-xs font-bold truncate">Diljit Dosanjh Hits</span>
                                                        <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                            <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                        </button>
                                                    </div>
                                                    <div onClick={() => playGenreOrSong("punjabi pop")} className="flex items-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 group relative pr-4 hover:scale-[1.01]">
                                                        <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0 border-r border-white/5" alt="Top Global" />
                                                        <span className="text-xs font-bold truncate">Punjabi Pop Hits</span>
                                                        <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                            <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                        </button>
                                                    </div>
                                                    <div onClick={() => playGenreOrSong("coding beats lofi")} className="flex items-center bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 group relative pr-4 hover:scale-[1.01]">
                                                        <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=200&auto=format&fit=crop" className="w-14 h-14 object-cover mr-4 shrink-0" alt="Coding" />
                                                        <span className="text-xs font-bold truncate">Coding Chill Session</span>
                                                        <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute right-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                            <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-black text-white/50 uppercase tracking-widest mb-3">Recommended for You</h3>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div onClick={() => playGenreOrSong("sidhu moose wala")} className="bg-[#100D1A]/60 border border-white/5 p-3.5 rounded-2xl hover:bg-white/5 cursor-pointer transition-all duration-300 group shadow-lg hover:-translate-y-1">
                                                        <div className="relative mb-3 overflow-hidden rounded-xl border border-white/10 shadow-md">
                                                            <img src="https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-500" alt="Sidhu Moose Wala" />
                                                            <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                                <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                            </button>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-white truncate">Sidhu Moose Wala Mix</h4>
                                                        <p className="text-[10px] text-gray-400 mt-1 truncate">Sidhu Moose Wala & Punjabi Legends</p>
                                                    </div>
                                                    <div onClick={() => playGenreOrSong("focus instrumental lofi")} className="bg-[#100D1A]/60 border border-white/5 p-3.5 rounded-2xl hover:bg-white/5 cursor-pointer transition-all duration-300 group shadow-lg hover:-translate-y-1">
                                                        <div className="relative mb-3 overflow-hidden rounded-xl border border-white/10 shadow-md">
                                                            <img src="https://images.unsplash.com/photo-1485579149621-3123dd979885?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-500" alt="Lofi Study" />
                                                            <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                                <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                            </button>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-white truncate">Lofi Focus Session</h4>
                                                        <p className="text-[10px] text-gray-400 mt-1 truncate">Instrumental study & work beats</p>
                                                    </div>
                                                    <div onClick={() => playGenreOrSong("viral acoustic songs")} className="bg-[#100D1A]/60 border border-white/5 p-3.5 rounded-2xl hover:bg-white/5 cursor-pointer transition-all duration-300 group shadow-lg hover:-translate-y-1">
                                                        <div className="relative mb-3 overflow-hidden rounded-xl border border-white/10 shadow-md">
                                                            <img src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=300&auto=format&fit=crop" className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-500" alt="Acoustic" />
                                                            <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] text-white shadow-lg flex items-center justify-center absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 hover:scale-115 transition-all">
                                                                <Play size={12} fill="white" className="ml-0.5 text-white" />
                                                            </button>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-white truncate">Acoustic Chill Hits</h4>
                                                        <p className="text-[10px] text-gray-400 mt-1 truncate">Sweet unplugged vocals & chords</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Player controls (Bottom) */}
                        <div className="bg-[#0B0B0E]/95 px-5 py-4 flex items-center justify-between border-t border-white/10 shadow-[0_-15px_30px_rgba(0,0,0,0.6)] shrink-0 select-none backdrop-blur-xl relative z-25">
                            {/* Track detail info */}
                            <div className="flex items-center w-1/4 min-w-[150px] overflow-hidden">
                                {currentTrack ? (
                                    <>
                                        <div className="relative shrink-0 mr-3">
                                            <img 
                                                src={currentTrack.album.images[0]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17'} 
                                                className={`w-11 h-11 rounded-full shadow-lg object-cover border border-white/10 ${spotifyPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`} 
                                                alt="Thumbnail" 
                                            />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#0B0B0E] border border-white/15"></div>
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-bold text-white truncate hover:underline cursor-pointer">{currentTrack.name}</div>
                                            <div className="text-[10px] text-gray-400 truncate hover:underline cursor-pointer mt-0.5">{currentTrack.artists.map(a => a.name).join(', ')}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center space-x-3 text-gray-500">
                                        <div className="w-11 h-11 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                                            <Music size={14} />
                                        </div>
                                        <span className="text-[11px] font-bold tracking-wider uppercase text-gray-500">No Song</span>
                                    </div>
                                )}
                            </div>

                            {/* Playback action controls */}
                            <div className="flex flex-col items-center justify-center w-2/4 max-w-[450px]">
                                <div className="flex items-center gap-5 mb-2">
                                    <button 
                                        onClick={toggleSpotifyShuffle} 
                                        className={`transition-all duration-200 hover:scale-110 ${shuffleMode ? 'text-[#8E2DE2] drop-shadow-[0_0_8px_rgba(142,45,226,0.6)]' : 'text-gray-400 hover:text-white'}`}
                                        title="Shuffle"
                                    >
                                        <Shuffle size={14} className={shuffleMode ? 'stroke-[2.5px]' : ''} />
                                    </button>
                                    <button 
                                        onClick={handlePrevTrack} 
                                        className="text-gray-400 hover:text-white hover:scale-110 transition-all duration-200"
                                        title="Previous"
                                    >
                                        <SkipBack size={16} fill="currentColor" />
                                    </button>
                                    <button 
                                        onClick={handleTogglePlay} 
                                        className="w-9 h-9 flex items-center justify-center bg-white hover:bg-gray-100 text-black rounded-full hover:scale-110 active:scale-95 transition-all duration-200 shadow-md"
                                        title={spotifyPlaying ? "Pause" : "Play"}
                                    >
                                        {spotifyPlaying ? <Pause size={14} className="text-black fill-black" /> : <Play size={14} className="text-black fill-black ml-0.5" />}
                                    </button>
                                    <button 
                                        onClick={handleNextTrack} 
                                        className="text-gray-400 hover:text-white hover:scale-110 transition-all duration-200"
                                        title="Next"
                                    >
                                        <SkipForward size={16} fill="currentColor" />
                                    </button>
                                    <button 
                                        onClick={toggleSpotifyRepeat} 
                                        className={`transition-all duration-200 hover:scale-110 relative ${repeatMode !== 'off' ? 'text-[#8E2DE2] drop-shadow-[0_0_8px_rgba(142,45,226,0.6)]' : 'text-gray-400 hover:text-white'}`}
                                        title={`Repeat: ${repeatMode}`}
                                    >
                                        <Repeat size={14} className={repeatMode !== 'off' ? 'stroke-[2.5px]' : ''} />
                                        {repeatMode === 'track' && <div className="w-1 h-1 bg-[#8E2DE2] rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2"></div>}
                                    </button>
                                </div>

                                {/* Progress Slider */}
                                <div className="flex items-center w-full gap-2.5 text-[9px] text-gray-500 font-bold select-none">
                                    <span className="w-8 text-right">
                                        {Math.floor(trackProgress / 60000)}:
                                        {String(Math.floor((trackProgress % 60000) / 1000)).padStart(2, '0')}
                                    </span>
                                    <div className="relative flex-1 group">
                                        <input 
                                            type="range"
                                            min="0"
                                            max={trackDuration || 0}
                                            value={trackProgress}
                                            onChange={handleSeek}
                                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#8E2DE2] hover:accent-[#8E2DE2] focus:outline-none outline-none transition-all"
                                        />
                                    </div>
                                    <span className="w-8 text-left">
                                        {Math.floor(trackDuration / 60000)}:
                                        {String(Math.floor((trackDuration % 60000) / 1000)).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>

                            {/* Volume control slider */}
                            <div className="flex items-center justify-end w-1/4 gap-2 text-gray-400">
                                <Volume2 size={15} />
                                <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:accent-[#8E2DE2] focus:outline-none outline-none transition-all"
                                />
                            </div>
                        </div>
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

            {/* Global Hidden YouTube Player Container */}
            <div style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div id="yt-player"></div>
            </div>

        </div>
    );
}
