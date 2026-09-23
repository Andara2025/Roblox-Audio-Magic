import React, { useEffect, useRef, useState } from 'react';
import { QueueItem } from '../types';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Download,
  Repeat,
  Sparkles,
  Disc3,
  Sliders,
} from 'lucide-react';
import { formatDuration, formatFileSize } from '../utils/audioEngine';

interface AudioPlayerBarProps {
  item: QueueItem;
  type: 'original' | 'processed';
  onClose: () => void;
  onToggleType: (type: 'original' | 'processed') => void;
  onDownload: (item: QueueItem) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  item,
  type,
  onClose,
  onToggleType,
  onDownload,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRobloxSimulated, setIsRobloxSimulated] = useState(false);

  // Apply playbackRate and pitch preservation whenever source or simulation mode changes
  useEffect(() => {
    if (audioRef.current) {
      if (type === 'processed' && isRobloxSimulated) {
        audioRef.current.playbackRate = item.settings.robloxPlaybackSpeed;
        (audioRef.current as any).preservesPitch = false;
        (audioRef.current as any).mozPreservesPitch = false;
        (audioRef.current as any).webkitPreservesPitch = false;
      } else {
        audioRef.current.playbackRate = 1.0;
        (audioRef.current as any).preservesPitch = true;
      }
    }
  }, [type, isRobloxSimulated, item.settings.robloxPlaybackSpeed]);

  // Update audio source when item or type changes
  useEffect(() => {
    let url: string | null = null;
    let cleanupNeeded = false;

    // Save previous progress ratio or time to seamlessly continue listening
    const prevTime = audioRef.current?.currentTime || 0;
    const prevDuration = audioRef.current?.duration || 0;
    const progressRatio = prevDuration > 0 ? prevTime / prevDuration : 0;

    if (type === 'processed' && item.processedBlob) {
      url = URL.createObjectURL(item.processedBlob);
      cleanupNeeded = true;
    } else if (type === 'original') {
      if (item.originalBlob) {
        url = URL.createObjectURL(item.originalBlob);
        cleanupNeeded = true;
      } else if (item.originalUrl) {
        url = item.originalUrl;
      }
    }

    setAudioUrl(url);

    return () => {
      if (cleanupNeeded && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [item, type]);

  // Handle play/pause on source ready, maintaining seek position if switching A/B
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((e) => {
          console.warn('Playback autoplay blocked or error:', e);
          setIsPlaying(false);
        });
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div
      id="bottom-audio-player-bar"
      className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 pointer-events-none"
    >
      <div className="max-w-6xl mx-auto rounded-2xl bg-zinc-950/95 border border-zinc-800/90 shadow-2xl backdrop-blur-xl p-3 sm:p-4 text-zinc-100 pointer-events-auto ring-1 ring-white/10 transition-all">
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
            }}
            onLoadedMetadata={() => {
              if (audioRef.current) setDuration(audioRef.current.duration);
            }}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Play button + Title + Mode Chips */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              id="player-play-pause-btn"
              onClick={togglePlay}
              className="w-11 h-11 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30 transition active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h5
                  className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-xs"
                  title={item.title}
                >
                  {item.title}
                </h5>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    type === 'processed'
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {type === 'processed' ? 'Hasil Dipercepat' : 'Audio Asli'}
                </span>

                {isRobloxSimulated && type === 'processed' && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    Simulasi Roblox ({item.settings.robloxPlaybackSpeed}x)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                {type === 'processed' ? (
                  <span>
                    Speed: <strong className="text-white">{item.settings.speedUp}x</strong> | Roblox:{' '}
                    <strong className="text-red-400">{item.settings.robloxPlaybackSpeed}</strong> | Format:{' '}
                    <strong className="text-teal-400">
                      {item.settings.outputFormat === 'ogg'
                        ? `OGG ${item.settings.oggQuality === 10 ? '500k' : item.settings.oggQuality === 9 ? '320k' : item.settings.oggQuality === 8 ? '256k' : item.settings.oggQuality === 7 ? '224k' : '160k'}`
                        : 'WAV'}
                    </strong> | Gain:{' '}
                    <strong className="text-emerald-400">
                      {item.settings.amplifyDb > 0
                        ? `+${item.settings.amplifyDb}`
                        : item.settings.amplifyDb}
                      dB
                    </strong>
                    {item.settings.fadeInEnabled && (
                      <span className="ml-1 text-indigo-300">
                        | FadeIn: {item.settings.fadeInDuration}s
                      </span>
                    )}
                    {item.settings.fadeOutEnabled && (
                      <span className="ml-1 text-indigo-300">
                        | FadeOut: {item.settings.fadeOutDuration}s
                      </span>
                    )}
                    {item.settings.reverbType !== 'none' && (
                      <span className="ml-1 text-cyan-300 capitalize">
                        | Reverb: {item.settings.reverbType}
                      </span>
                    )}
                    {item.settings.remasterProfile && item.settings.remasterProfile !== 'none' && (
                      <span className="ml-1 text-amber-300 font-semibold">
                        | Remaster: {item.settings.remasterProfile === 'clarity'
                          ? 'Studio Master'
                          : item.settings.remasterProfile === 'bass_punch'
                          ? 'Bass Punch'
                          : item.settings.remasterProfile === 'vocal_air'
                          ? 'Vocal Air'
                          : 'Max Loudness'}
                      </span>
                    )}
                    {item.processedSize && (
                      <span className="ml-1 font-mono">
                        | Size:{' '}
                        <span className={item.processedSize > 20 * 1024 * 1024 ? 'text-rose-400 font-extrabold' : 'text-emerald-400 font-bold'}>
                          {formatFileSize(item.processedSize)} {item.processedSize > 20 * 1024 * 1024 ? '(⚠️ Melebihi 20MB)' : '(✓ Lolos Roblox)'}
                        </span>
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    Audio Mentah Input | Size: <span className="font-mono text-zinc-300">{formatFileSize(item.fileSize)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick A/B Switch (Sebelum vs Sesudah Remaster) and Roblox Simulation button */}
            {item.status === 'ready' && (
              <div className="flex items-center gap-1.5 shrink-0 ml-1 sm:ml-2">
                {/* Dedicated Before/After Segmented Toggle */}
                <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-700/80">
                  <button
                    type="button"
                    onClick={() => onToggleType('original')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                      type === 'original'
                        ? 'bg-cyan-500 text-zinc-950 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Dengar audio asli (Sebelum Remaster)"
                  >
                    <span>Sebelum</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleType('processed')}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                      type === 'processed'
                        ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                    title="Dengar audio hasil (Sesudah Remaster & Efek)"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Sesudah</span>
                  </button>
                </div>

                {type === 'processed' && (
                  <button
                    type="button"
                    onClick={() => setIsRobloxSimulated(!isRobloxSimulated)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition flex items-center gap-1.5 active:scale-95 ${
                      isRobloxSimulated
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                    }`}
                    title="Simulasikan suara persis saat diputar di Roblox Studio dengan PlaybackSpeed (nada normal)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Simulasi Roblox (Normal)</span>
                    <span className="sm:hidden">Roblox</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Center: Seekbar & Progress */}
          <div className="flex items-center gap-3 w-full lg:max-w-md">
            <span className="text-[11px] font-mono text-zinc-400 min-w-[36px] text-right">
              {formatDuration(currentTime)}
            </span>

            <input
              type="range"
              min="0"
              max={duration || 1}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 accent-red-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
            />

            <span className="text-[11px] font-mono text-zinc-400 min-w-[36px]">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Right: Volume, Download & Close */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            {/* Mobile A/B mode toggle */}
            {item.status === 'ready' && (
              <div className="flex sm:hidden items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => onToggleType(type === 'processed' ? 'original' : 'processed')}
                  className="px-2 py-1 rounded text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700"
                >
                  {type === 'processed' ? 'Asli' : 'Hasil'}
                </button>
                {type === 'processed' && (
                  <button
                    type="button"
                    onClick={() => setIsRobloxSimulated(!isRobloxSimulated)}
                    className={`px-2 py-1 rounded text-[11px] border ${
                      isRobloxSimulated
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    Roblox
                  </button>
                )}
              </div>
            )}

            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 accent-red-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
            </div>

            {type === 'processed' && item.status === 'ready' && (
              <button
                type="button"
                onClick={() => onDownload(item)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95"
              title="Tutup Pemutar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
