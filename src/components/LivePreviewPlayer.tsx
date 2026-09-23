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
  RotateCcw,
  Radio,
  SlidersHorizontal,
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
  const [remasterBypass, setRemasterBypass] = useState<boolean>(false); // A/B test without remaster
  const [reverbBypass, setReverbBypass] = useState<boolean>(false); // A/B test without reverb
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Web Audio Graph References for real-time live manipulation
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassShelfRef = useRef<BiquadFilterNode | null>(null);
  const midCutRef = useRef<BiquadFilterNode | null>(null);
  const presencePeakRef = useRef<BiquadFilterNode | null>(null);
  const highAirRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
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

  // Real-time parameter updates without stopping playback!
  useEffect(() => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const currentRate = previewSpeedMode === 'normal' ? 1.0 : settings.speedUp;

    // 1. Update Speed / PlaybackRate
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.setValueAtTime(currentRate, now);
    }

    // 2. Update Master Gain (+dB / -dB)
    if (gainNodeRef.current) {
      const linearGain = Math.pow(10, settings.amplifyDb / 20);
      gainNodeRef.current.gain.setTargetAtTime(linearGain, now, 0.05);
    }

    // 3. Update Remaster Nodes (EQ + Multi-Band Compressor)
    const intensity = Math.min(Math.max(settings.remasterIntensity ?? 0.7, 0.1), 1.0);
    const profile = remasterBypass ? 'none' : settings.remasterProfile || 'none';

    if (
      bassShelfRef.current &&
      midCutRef.current &&
      presencePeakRef.current &&
      highAirRef.current &&
      compressorRef.current
    ) {
      if (profile === 'none') {
        bassShelfRef.current.gain.setTargetAtTime(0, now, 0.05);
        midCutRef.current.gain.setTargetAtTime(0, now, 0.05);
        presencePeakRef.current.gain.setTargetAtTime(0, now, 0.05);
        highAirRef.current.gain.setTargetAtTime(0, now, 0.05);
        compressorRef.current.threshold.setTargetAtTime(0, now, 0.05);
      } else if (profile === 'clarity') {
        bassShelfRef.current.gain.setTargetAtTime(2.5 * intensity, now, 0.05);
        midCutRef.current.gain.setTargetAtTime(-3.0 * intensity, now, 0.05);
        presencePeakRef.current.gain.setTargetAtTime(3.5 * intensity, now, 0.05);
        highAirRef.current.gain.setTargetAtTime(3.0 * intensity, now, 0.05);
        compressorRef.current.threshold.setTargetAtTime(-18 * intensity, now, 0.05);
        compressorRef.current.ratio.setTargetAtTime(4, now, 0.05);
      } else if (profile === 'bass_punch') {
        bassShelfRef.current.gain.setTargetAtTime(6.0 * intensity, now, 0.05);
        midCutRef.current.gain.setTargetAtTime(-2.5 * intensity, now, 0.05);
        presencePeakRef.current.gain.setTargetAtTime(1.5 * intensity, now, 0.05);
        highAirRef.current.gain.setTargetAtTime(2.0 * intensity, now, 0.05);
        compressorRef.current.threshold.setTargetAtTime(-20 * intensity, now, 0.05);
        compressorRef.current.ratio.setTargetAtTime(6, now, 0.05);
      } else if (profile === 'vocal_air') {
        bassShelfRef.current.gain.setTargetAtTime(1.0 * intensity, now, 0.05);
        midCutRef.current.gain.setTargetAtTime(-3.5 * intensity, now, 0.05);
        presencePeakRef.current.gain.setTargetAtTime(5.0 * intensity, now, 0.05);
        highAirRef.current.gain.setTargetAtTime(5.0 * intensity, now, 0.05);
        compressorRef.current.threshold.setTargetAtTime(-16 * intensity, now, 0.05);
        compressorRef.current.ratio.setTargetAtTime(3, now, 0.05);
      } else if (profile === 'loudness_war') {
        bassShelfRef.current.gain.setTargetAtTime(4.0 * intensity, now, 0.05);
        midCutRef.current.gain.setTargetAtTime(-2.0 * intensity, now, 0.05);
        presencePeakRef.current.gain.setTargetAtTime(3.0 * intensity, now, 0.05);
        highAirRef.current.gain.setTargetAtTime(3.5 * intensity, now, 0.05);
        compressorRef.current.threshold.setTargetAtTime(-24 * intensity, now, 0.05);
        compressorRef.current.ratio.setTargetAtTime(8, now, 0.05);
      }
    }

    // 4. Update Reverb Dry/Wet Mix WITHOUT REDUCING DRY VOLUME!
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
    settings.remasterProfile,
    settings.remasterIntensity,
    settings.reverbType,
    settings.reverbMix,
    previewSpeedMode,
    remasterBypass,
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
    const currentRate = currentMode === 'normal' ? 1.0 : settingsRef.current.speedUp;
    source.playbackRate.value = currentRate;

    // Gain node (Volume Booster / Padder)
    const gainNode = ctx.createGain();
    const linearGain = Math.pow(10, settingsRef.current.amplifyDb / 20);
    gainNode.gain.value = linearGain;

    // Remastering filter chain
    const bassShelf = ctx.createBiquadFilter();
    bassShelf.type = 'lowshelf';
    bassShelf.frequency.value = 105;

    const midCut = ctx.createBiquadFilter();
    midCut.type = 'peaking';
    midCut.frequency.value = 400;
    midCut.Q.value = 1.2;

    const presencePeak = ctx.createBiquadFilter();
    presencePeak.type = 'peaking';
    presencePeak.frequency.value = 3200;
    presencePeak.Q.value = 1.0;

    const highAir = ctx.createBiquadFilter();
    highAir.type = 'highshelf';
    highAir.frequency.value = 9500;

    const compressor = ctx.createDynamicsCompressor();

    const intensity = Math.min(Math.max(settingsRef.current.remasterIntensity ?? 0.7, 0.1), 1.0);
    const profile = remasterBypass ? 'none' : settingsRef.current.remasterProfile || 'none';

    if (profile === 'none') {
      bassShelf.gain.value = 0;
      midCut.gain.value = 0;
      presencePeak.gain.value = 0;
      highAir.gain.value = 0;
      compressor.threshold.value = 0;
    } else if (profile === 'clarity') {
      bassShelf.gain.value = 2.5 * intensity;
      midCut.gain.value = -3.0 * intensity;
      presencePeak.gain.value = 3.5 * intensity;
      highAir.gain.value = 3.0 * intensity;
      compressor.threshold.value = -18 * intensity;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.15;
    } else if (profile === 'bass_punch') {
      bassShelf.gain.value = 6.0 * intensity;
      midCut.gain.value = -2.5 * intensity;
      presencePeak.gain.value = 1.5 * intensity;
      highAir.gain.value = 2.0 * intensity;
      compressor.threshold.value = -20 * intensity;
      compressor.knee.value = 10;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.015;
      compressor.release.value = 0.12;
    } else if (profile === 'vocal_air') {
      bassShelf.gain.value = 1.0 * intensity;
      midCut.gain.value = -3.5 * intensity;
      presencePeak.gain.value = 5.0 * intensity;
      highAir.gain.value = 5.0 * intensity;
      compressor.threshold.value = -16 * intensity;
      compressor.knee.value = 15;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;
    } else if (profile === 'loudness_war') {
      bassShelf.gain.value = 4.0 * intensity;
      midCut.gain.value = -2.0 * intensity;
      presencePeak.gain.value = 3.0 * intensity;
      highAir.gain.value = 3.5 * intensity;
      compressor.threshold.value = -24 * intensity;
      compressor.knee.value = 8;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.1;
    }

    // Connect Remaster chain: source -> gain -> bass -> mid -> presence -> air -> compressor
    source.connect(gainNode);
    gainNode.connect(bassShelf);
    bassShelf.connect(midCut);
    midCut.connect(presencePeak);
    presencePeak.connect(highAir);
    highAir.connect(compressor);

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

    // ZERO VOLUME DROP FIX:
    // dryGain is always 1.0 so the main sound stays at 100% volume.
    // wetGain adds the reverb atmosphere cleanly on top.
    dryGain.gain.value = 1.0;

    if (impulse && !reverbBypass && settingsRef.current.reverbMix > 0.01) {
      convolver.buffer = impulse;
      convolver.normalize = true;
      const wetAmount = Math.min(Math.max(settingsRef.current.reverbMix, 0), 1);
      wetGain.gain.value = wetAmount * 0.75;

      compressor.connect(dryGain);
      compressor.connect(convolver);
      convolver.connect(wetGain);

      dryGain.connect(ctx.destination);
      wetGain.connect(ctx.destination);
    } else {
      wetGain.gain.value = 0;
      compressor.connect(dryGain);
      dryGain.connect(ctx.destination);
    }

    // Save refs for real-time live changes
    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
    bassShelfRef.current = bassShelf;
    midCutRef.current = midCut;
    presencePeakRef.current = presencePeak;
    highAirRef.current = highAir;
    compressorRef.current = compressor;
    convolverRef.current = convolver;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;

    const safeOffset = Math.min(Math.max(offsetSeconds, 0), Math.max(0, buffer.duration - 0.1));
    startTimeRef.current = ctx.currentTime - safeOffset / currentRate;
    pausedAtRef.current = safeOffset;

    source.start(0, safeOffset);
    setIsPlaying(true);

    source.onended = () => {
      // If user paused intentionally, don't reset to 0!
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
      // PAUSE: record current position and stop playback node
      pausedAtRef.current = currentTime;
      stopAudio(true);
    } else {
      // RESUME: play from recorded paused position
      playLiveAudio(pausedAtRef.current);
    }
  };

  const handleSwitchSpeedMode = (newMode: 'normal' | 'speedup') => {
    setPreviewSpeedMode(newMode);
    previewSpeedModeRef.current = newMode;

    const currentOffset = pausedAtRef.current;
    if (isPlaying) {
      // Re-launch audio playback node cleanly at the new playback rate
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
              Dengarkan langsung karakter lagu saat Anda mengubah <strong>Gain (+dB)</strong>, <strong>Remaster</strong>, dan <strong>Reverb</strong> tanpa volume drop.
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
              title="Dengarkan di kecepatan normal 1.0x agar kualitas EQ, Reverb, dan Gain mudah dinilai"
            >
              <Volume2 className="w-4 h-4" />
              <span>1.0x Normal (Audisi EQ/Gain)</span>
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
              title="Dengarkan simulasi hasil dipercepat Roblox (Chipmunk/Nightcore)"
            >
              <Disc3 className="w-4 h-4" />
              <span>{settings.speedUp}x Dipercepat Roblox</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time DSP Active Inspector & A/B Bypass Switches */}
      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3">
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

        {/* 2. Remaster Profile & A/B Bypass */}
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Remaster Status:</span>
            </span>
            <span className="font-bold text-amber-300 text-xs">
              {remasterBypass
                ? 'Bypass (Mati)'
                : settings.remasterProfile === 'clarity'
                ? '✨ Studio Master'
                : settings.remasterProfile === 'bass_punch'
                ? '🔊 Bass Punch'
                : settings.remasterProfile === 'vocal_air'
                ? '🎙️ Vocal Air'
                : settings.remasterProfile === 'loudness_war'
                ? '⚡ Max Loudness'
                : 'Biasa (Off)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-800/80">
            <span className="text-zinc-500 text-[11px]">Bandingkan Suara A/B:</span>
            <button
              type="button"
              onClick={() => setRemasterBypass((prev) => !prev)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${
                remasterBypass
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
              }`}
            >
              {remasterBypass ? 'Tes: Suara Asli (Mati)' : 'Tes: Remaster Aktif'}
            </button>
          </div>
        </div>

        {/* 3. Reverb Ambient & A/B Bypass (Zero volume drop guarantee) */}
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
