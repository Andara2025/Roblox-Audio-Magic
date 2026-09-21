import React, { useEffect, useRef, useState } from 'react';
import { QueueItem } from '../types';
import { Play, Pause, Volume2, VolumeX, X, Download, Repeat, Sparkles } from 'lucide-react';
import { formatDuration } from '../utils/audioEngine';

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
    setCurrentTime(0);

    return () => {
      if (cleanupNeeded && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [item, type]);

  // Handle play/pause on source ready
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
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
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => setIsPlaying(false));
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
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shadow-2xl px-4 py-3 text-slate-100 transition-all animate-in slide-in-from-bottom-4"
    >
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

      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Info & A/B Mode Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30 transition"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-bold text-white truncate max-w-[200px] md:max-w-xs" title={item.title}>
                {item.title}
              </h5>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                type === 'processed'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              }`}>
                {type === 'processed' ? 'Hasil (Processed)' : 'Asli (Original)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              {type === 'processed' ? (
                <span>
                  Speed: <strong className="text-white">{item.settings.speedUp}x</strong> | Roblox: <strong className="text-red-400">{item.settings.robloxPlaybackSpeed}</strong> | Gain: <strong className="text-emerald-400">{item.settings.amplifyDb > 0 ? `+${item.settings.amplifyDb}` : item.settings.amplifyDb}dB</strong>
                  {item.settings.reverbType !== 'none' && (
                    <> | Reverb: <strong className="text-cyan-400 capitalize">{item.settings.reverbType} ({Math.round(item.settings.reverbMix * 100)}%)</strong></>
                  )}
                  {(item.settings.fadeInEnabled || item.settings.fadeOutEnabled) && (
                    <> | Fade: <strong className="text-indigo-300 font-mono">
                      {item.settings.fadeInEnabled ? `In ${item.settings.fadeInDuration}s` : ''}
                      {item.settings.fadeInEnabled && item.settings.fadeOutEnabled ? ', ' : ''}
                      {item.settings.fadeOutEnabled ? `Out ${item.settings.fadeOutDuration}s` : ''}
                    </strong></>
                  )}
                </span>
              ) : (
                <span>Audio Masukan Asli</span>
              )}
            </div>
          </div>

          {/* Quick A/B Switch if processed is available */}
          {item.status === 'ready' && (
            <div className="hidden md:flex items-center gap-1.5">
              <button
                onClick={() => onToggleType(type === 'processed' ? 'original' : 'processed')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
                title="Bandingkan langsung audio Asli vs Hasil"
              >
                <Repeat className="w-3 h-3 text-red-400" />
                <span>Dengar {type === 'processed' ? 'Asli' : 'Hasil'}</span>
              </button>

              {type === 'processed' && (
                <button
                  onClick={() => setIsRobloxSimulated(!isRobloxSimulated)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition ${
                    isRobloxSimulated
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-bold'
                      : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title="Simulasikan suara persis saat diputar di Roblox Studio (nada normal)"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{isRobloxSimulated ? `Simulasi Roblox (${item.settings.robloxPlaybackSpeed}x)` : 'Mode Roblox'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center: Seekbar & Times */}
        <div className="flex items-center gap-3 w-full sm:max-w-md md:max-w-xl">
          <span className="text-[11px] font-mono text-slate-400 min-w-[36px] text-right">
            {formatDuration(currentTime)}
          </span>

          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="flex-1 accent-red-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />

          <span className="text-[11px] font-mono text-slate-400 min-w-[36px]">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Right: Volume, Download & Close */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={toggleMute} className="text-slate-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 accent-red-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          {type === 'processed' && item.status === 'ready' && (
            <button
              onClick={() => onDownload(item)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Tutup Pemutar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
