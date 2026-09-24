import React, { useEffect, useRef, useState } from 'react';
import { QueueItem, AudioSettings } from '../types';
import {
  getAudioContext,
  createReverbImpulse,
} from '../utils/audioEngine';
import {
  Play,
  Pause,
  Volume2,
  Sparkles,
  Disc3,
  Radio,
} from 'lucide-react';

interface LivePreviewPlayerProps {
  queue: QueueItem[];
  settings: AudioSettings;
  onChangeSettings?: (newSettings: AudioSettings) => void;
}

export const LivePreviewPlayer: React.FC<LivePreviewPlayerProps> = ({
  queue,
  settings,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Default: Normal speed (1.0x). User can switch to speedup mode anytime.
  const [previewSpeedMode, setPreviewSpeedMode] = useState<'normal' | 'speedup'>('normal');
  const [reverbBypass, setReverbBypass] = useState<boolean>(false); // A/B test without reverb
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Web Audio Graph References for real-time live manipulation
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);

  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const isStoppingIntentionallyRef = useRef<boolean>(false);

  // Keep latest state in refs so callbacks always see updated values
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef<number>(0);
  currentTimeRef.current = currentTime;

  const previewSpeedModeRef = useRef<'normal' | 'speedup'>('normal');
  previewSpeedModeRef.current = previewSpeedMode;

  const settingsRef = useRef<AudioSettings>(settings);
  settingsRef.current = settings;

  // Pick first item with originalBuffer
  const activeItem =
    queue.find((q) => q.id === selectedItemId && q.originalBuffer) ||
    queue.find((q) => q.originalBuffer);

  useEffect(() => {
    if (activeItem && (!selectedItemId || !queue.some((q) => q.id === selectedItemId))) {
      setSelectedItemId(activeItem.id);
    }
  }, [queue, selectedItemId, activeItem]);

  // Clean stop helper
  const stopAudio = (preservePausedPosition: boolean = true) => {
    isStoppingIntentionallyRef.current = true;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (!preservePausedPosition) {
      pausedAtRef.current = 0;
      setCurrentTime(0);
    }
    setIsPlaying(false);
    isStoppingIntentionallyRef.current = false;
  };

  // Stop when selected item changes
  useEffect(() => {
    stopAudio(false);
    if (activeItem?.originalBuffer) {
      setDuration(activeItem.originalBuffer.duration);
    }
  }, [selectedItemId]);

  // Real-time parameter updates without stopping playback
  useEffect(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const detuneCents = settings.antiCopyrightStealth ? (settings.pitchDetuneCents ?? 45) : 0;
    const detuneRatio = detuneCents !== 0 ? Math.pow(2, detuneCents / 1200) : 1.0;
    const currentRate = previewSpeedMode === 'normal'
      ? 1.0
      : settings.speedUp * (settings.pitchMode === 'resample' ? detuneRatio : 1.0);

    // 1. Update Speed / PlaybackRate
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.setValueAtTime(currentRate, now);
    }

    // 2. Update Master Gain (+dB / -dB)
    if (gainNodeRef.current) {
      const linearGain = Math.pow(10, settings.amplifyDb / 20);
      gainNodeRef.current.gain.setTargetAtTime(linearGain, now, 0.05);
    }

    // 3. Update Reverb Dry/Wet Mix WITHOUT REDUCING DRY VOLUME!
    // Dry signal always stays full (1.0) so audio never drops in volume when reverb is enabled.
    if (wetGainRef.current && dryGainRef.current) {
      if (reverbBypass || settings.reverbType === 'none' || settings.reverbMix <= 0.01) {
        wetGainRef.current.gain.setTargetAtTime(0, now, 0.05);
        dryGainRef.current.gain.setTargetAtTime(1.0, now, 0.05);
      } else {
        const wetAmount = Math.min(Math.max(settings.reverbMix, 0), 1);
        wetGainRef.current.gain.setTargetAtTime(wetAmount * 0.75, now, 0.05);
        dryGainRef.current.gain.setTargetAtTime(1.0, now, 0.05); // KEEP DRY AT 100%!
      }
    }
  }, [
    settings.speedUp,
    settings.amplifyDb,
    settings.reverbType,
    settings.reverbMix,
    previewSpeedMode,
    reverbBypass,
  ]);

  // Start live playing from a specific offset
  const playLiveAudio = (offsetSeconds: number = 0, explicitSpeedMode?: 'normal' | 'speedup') => {
    if (!activeItem?.originalBuffer) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Stop current without resetting paused time
    stopAudio(true);

    const buffer = activeItem.originalBuffer;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const currentMode = explicitSpeedMode ?? previewSpeedModeRef.current;
    const detuneCents = settingsRef.current.antiCopyrightStealth ? (settingsRef.current.pitchDetuneCents ?? 45) : 0;
    const detuneRatio = detuneCents !== 0 ? Math.pow(2, detuneCents / 1200) : 1.0;
    const currentRate = currentMode === 'normal'
      ? 1.0
      : settingsRef.current.speedUp * (settingsRef.current.pitchMode === 'resample' ? detuneRatio : 1.0);
    source.playbackRate.value = currentRate;

    // Gain node (Volume Booster / Padder)
    const gainNode = ctx.createGain();
    const linearGain = Math.pow(10, settingsRef.current.amplifyDb / 20);
    gainNode.gain.value = linearGain;

    // Connect source to gain
    source.connect(gainNode);

    // Reverb convolution routing
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const convolver = ctx.createConvolver();

    const impulse = createReverbImpulse(
      ctx,
      settingsRef.current.reverbType,
      settingsRef.current.reverbDecay,
      1.0
    );

    // ZERO VOLUME DROP: dryGain is always 1.0 so the main sound stays at 100% volume
    dryGain.gain.value = 1.0;

    if (impulse && !reverbBypass && settingsRef.current.reverbMix > 0.01) {
      convolver.buffer = impulse;
      convolver.normalize = true;
      const wetAmount = Math.min(Math.max(settingsRef.current.reverbMix, 0), 1);
      wetGain.gain.value = wetAmount * 0.75;

      gainNode.connect(dryGain);
      gainNode.connect(convolver);
      convolver.connect(wetGain);

      dryGain.connect(ctx.destination);
      wetGain.connect(ctx.destination);
    } else {
      wetGain.gain.value = 0;
      gainNode.connect(dryGain);
      dryGain.connect(ctx.destination);
    }

    // Save refs for real-time live changes
    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
    convolverRef.current = convolver;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;

    const safeOffset = Math.min(Math.max(offsetSeconds, 0), Math.max(0, buffer.duration - 0.1));
    startTimeRef.current = ctx.currentTime - safeOffset / currentRate;
    pausedAtRef.current = safeOffset;

    source.start(0, safeOffset);
    setIsPlaying(true);

    source.onended = () => {
      // If user paused intentionally, don't reset to 0
      if (isStoppingIntentionallyRef.current) return;
      setIsPlaying(false);
      pausedAtRef.current = 0;
      setCurrentTime(0);
    };

    // Progress update loop
    const updateProgress = () => {
      if (sourceNodeRef.current) {
        const rate = previewSpeedModeRef.current === 'normal' ? 1.0 : settingsRef.current.speedUp;
        const currentElapsed = (ctx.currentTime - startTimeRef.current) * rate;
        const boundedTime = Math.min(Math.max(0, currentElapsed), buffer.duration);
        setCurrentTime(boundedTime);
        pausedAtRef.current = boundedTime;
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      pausedAtRef.current = currentTime;
      stopAudio(true);
    } else {
      playLiveAudio(pausedAtRef.current);
    }
  };

  const handleSwitchSpeedMode = (newMode: 'normal' | 'speedup') => {
    setPreviewSpeedMode(newMode);
    previewSpeedModeRef.current = newMode;

    const currentOffset = pausedAtRef.current;
    if (isPlaying) {
      playLiveAudio(currentOffset, newMode);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPos = parseFloat(e.target.value);
    setCurrentTime(newPos);
    pausedAtRef.current = newPos;
    if (isPlaying) {
      playLiveAudio(newPos);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio(false);
    };
  }, []);

  if (queue.length === 0) {
    return null;
  }

  const formatSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-zinc-950/95 border-2 border-amber-500/40 shadow-2xl shadow-amber-500/10 relative overflow-hidden">
      {/* Top Banner / Heading */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3.5 border-b border-zinc-800/80">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-zinc-950 font-bold shrink-0 shadow-lg shadow-amber-500/25">
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Audisi Real-Time DSP</span>
                <span className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${
                  previewSpeedMode === 'normal'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {previewSpeedMode === 'normal' ? 'Kecepatan Asli 1.0x (Normal)' : `${settings.speedUp}x Dipercepat Roblox`}
                </span>
              </h3>
            </div>
            <p className="text-xs text-zinc-300 mt-0.5">
              Dengarkan langsung audio asli jernih saat Anda mengatur <strong>Gain (+dB)</strong> dan <strong>Reverb</strong> tanpa penurunan volume.
            </p>
          </div>
        </div>

        {/* Speed Audition Selector: Normal 1.0x vs Roblox Speedup */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-900 p-1.5 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              id="preview-btn-normal-speed"
              onClick={() => handleSwitchSpeedMode('normal')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 active:scale-95 ${
                previewSpeedMode === 'normal'
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/30 font-extrabold ring-1 ring-amber-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="Dengarkan simulasi audio saat diputar kembali normal di dalam game Roblox (1.0x)"
            >
              <Volume2 className="w-4 h-4" />
              <span>1.0x Normal (Simulasi Playback Roblox)</span>
            </button>

            <button
              type="button"
              id="preview-btn-speedup"
              onClick={() => handleSwitchSpeedMode('speedup')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 active:scale-95 ${
                previewSpeedMode === 'speedup'
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/30 font-extrabold ring-1 ring-red-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="Dengarkan file ekspor dipercepat sebelum PlaybackSpeed diterapkan"
            >
              <Disc3 className="w-4 h-4" />
              <span>{settings.speedUp}x Ekspor Roblox (Speed-Up)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time DSP Active Inspector & Controls */}
      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. Track Selection & Gain Monitor */}
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 font-medium">Lagu yang diuji:</span>
            {queue.length > 1 ? (
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-amber-500 max-w-[150px] truncate"
              >
                {queue.map((item, idx) => (
                  <option key={item.id} value={item.id}>
                    {idx + 1}. {item.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-white truncate max-w-[160px]">
                {activeItem?.title}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-800/80">
            <span className="text-zinc-400">Volume Gain:</span>
            <span className="font-mono font-bold text-emerald-400">
              {settings.amplifyDb > 0 ? `+${settings.amplifyDb} dB` : `${settings.amplifyDb} dB`}
            </span>
          </div>
        </div>

        {/* 2. Reverb Ambient & A/B Bypass (Zero volume drop guarantee) */}
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>Reverb Ruang:</span>
            </span>
            <span className="font-bold text-purple-300 text-xs uppercase">
              {reverbBypass ? 'Dry (Mati)' : settings.reverbType}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-800/80">
            <span className="text-zinc-500 text-[11px]">Bypass Reverb:</span>
            <button
              type="button"
              onClick={() => setReverbBypass((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                reverbBypass
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/50'
              }`}
            >
              {reverbBypass ? 'Reverb: OFF' : 'Reverb: ON'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Playback Bar (Play / Pause, Track Time, Scrubbing Slider) */}
      <div className="mt-4 pt-3 border-t border-zinc-800/90 flex items-center gap-3">
        <button
          type="button"
          id="preview-play-pause-btn"
          onClick={handleTogglePlay}
          disabled={!activeItem?.originalBuffer}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition active:scale-95 shadow-xl ${
            isPlaying
              ? 'bg-amber-500 text-zinc-950 font-bold shadow-amber-500/40 ring-2 ring-white/20'
              : 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 hover:from-amber-400 hover:to-rose-400 text-zinc-950 font-bold shadow-amber-500/20'
          }`}
          title={isPlaying ? 'Jeda Audisi (Pause)' : 'Putar Audisi (Play)'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white truncate max-w-xs sm:max-w-md">
                {activeItem?.title || 'Pilih audio di atas'}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.2 rounded border ${
                previewSpeedMode === 'normal'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-red-500/15 text-red-300 border-red-500/30'
              }`}>
                {previewSpeedMode === 'normal' ? 'Speed 1.0x Normal' : `${settings.speedUp}x Roblox Speedup`}
              </span>
            </div>
            <span className="text-zinc-400">
              <strong className="text-amber-400">{formatSec(currentTime)}</strong> / {formatSec(duration)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            disabled={!activeItem?.originalBuffer}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
