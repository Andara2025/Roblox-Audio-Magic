import React from 'react';
import { AudioSettings, OutputAudioFormat, ReverbType } from '../types';
import {
  Sliders,
  Volume2,
  Waves,
  Zap,
  RefreshCw,
  FileCheck2,
  ShieldCheck,
  Disc3,
  SlidersHorizontal,
  Plus,
  Minus,
} from 'lucide-react';

interface GlobalControlsProps {
  settings: AudioSettings;
  onChangeSettings: (newSettings: AudioSettings) => void;
  onApplyToAllQueue: () => void;
  onProcessAll: () => void;
  isProcessing: boolean;
  queueCount: number;
}

export const GlobalControls: React.FC<GlobalControlsProps> = ({
  settings,
  onChangeSettings,
  onApplyToAllQueue,
  onProcessAll,
  isProcessing,
  queueCount,
}) => {
  const handleFormatChange = (outputFormat: OutputAudioFormat) => {
    onChangeSettings({
      ...settings,
      outputFormat,
    });
  };

  const handleSpeedChange = (speedUp: number) => {
    const safeSpeed = Math.max(0.1, Math.min(20, parseFloat(speedUp.toFixed(3))));
    const robloxPlayback = parseFloat((1 / safeSpeed).toFixed(4));
    onChangeSettings({
      ...settings,
      speedUp: safeSpeed,
      robloxPlaybackSpeed: robloxPlayback,
    });
  };

  const handleAmplifyChange = (amplifyDb: number) => {
    onChangeSettings({
      ...settings,
      amplifyDb,
    });
  };

  const handleReverbTypeChange = (reverbType: ReverbType) => {
    let decay = settings.reverbDecay;
    let mix = settings.reverbMix;

    if (reverbType === 'none') {
      mix = 0;
    } else if (mix === 0) {
      mix = 0.25;
    }

    if (reverbType === 'room') decay = 1.2;
    if (reverbType === 'hall') decay = 2.4;
    if (reverbType === 'cathedral') decay = 4.0;
    if (reverbType === 'space') decay = 6.0;

    onChangeSettings({
      ...settings,
      reverbType,
      reverbMix: mix,
      reverbDecay: decay,
    });
  };

  const reverbOptions: { id: ReverbType; label: string; desc: string }[] = [
    { id: 'none', label: 'Dry (None)', desc: 'Suara asli jernih' },
    { id: 'room', label: 'Studio Room', desc: 'Akustik ruangan hangat' },
    { id: 'hall', label: 'Concert Hall', desc: 'Gema panggung luas' },
    { id: 'cathedral', label: 'Cathedral', desc: 'Ekor gema dramatis' },
    { id: 'space', label: 'Space Echo', desc: 'Dimensi luas mendalam' },
  ];

  return (
    <div
      id="global-controls"
      className="relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 shadow-xl backdrop-blur-md"
    >
      {/* Top Header & Master Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Studio Master Parameter</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                DSP Audio Engine
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Atur kecepatan percepatan, gain volume, dan efek atmosfer untuk antrean file
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            id="apply-settings-all-btn"
            onClick={onApplyToAllQueue}
            disabled={queueCount === 0 || isProcessing}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40 transition flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Terapkan konfigurasi parameter ini ke semua item di antrean"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Terapkan ke Semua</span>
            <span className="sm:hidden">Terapkan Semua</span>
          </button>

          <button
            type="button"
            id="process-all-btn"
            onClick={onProcessAll}
            disabled={queueCount === 0 || isProcessing}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 disabled:opacity-40 transition flex items-center gap-2 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>{isProcessing ? 'Memproses DSP...' : `Proses Semua (${queueCount})`}</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: 3 Responsive Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Module 1: Speed-Up & PlaybackSpeed */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-red-400" />
                <span>Percepatan Audio (Speed-Up)</span>
              </span>
              <span className="text-xs font-mono font-extrabold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                {settings.speedUp}x
              </span>
            </div>

            <div className="space-y-3">
              <input
                id="speed-up-slider"
                type="range"
                min="0.5"
                max="10"
                step="0.05"
                value={settings.speedUp}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>0.5x</span>
                <span className="text-red-400 font-bold">{settings.speedUp}x</span>
                <span>10.0x</span>
              </div>
            </div>

            {/* Quick Step Buttons */}
            <div className="flex items-center justify-between gap-1.5 mt-3 pt-3 border-t border-zinc-800/60">
              <div className="text-[11px] text-zinc-400">Fine Adjust:</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSpeedChange(settings.speedUp - 0.1)}
                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  title="Kurangi 0.1x"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeedChange(settings.speedUp + 0.1)}
                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  title="Tambah 0.1x"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Roblox PlaybackSpeed:</span>
            <span className="font-mono font-bold text-red-300">
              {settings.robloxPlaybackSpeed}
            </span>
          </div>
        </div>

        {/* Module 2: Amplify & Soft-Limiter */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Penguat Volume (Amplify Gain)</span>
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  settings.amplifyDb > 0
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : settings.amplifyDb < 0
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                }`}
              >
                {settings.amplifyDb > 0 ? `+${settings.amplifyDb}` : settings.amplifyDb} dB
              </span>
            </div>

            <div className="space-y-3">
              <input
                id="amplify-slider"
                type="range"
                min="-6"
                max="18"
                step="0.5"
                value={settings.amplifyDb}
                onChange={(e) => handleAmplifyChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>-6 dB</span>
                <span>0 dB (Netral)</span>
                <span>+18 dB</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] flex items-center justify-between">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anti-Clipping Limiter:</span>
            </span>
            <span className="text-emerald-400 font-semibold text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
              Aktif (Aman dari Distorsi)
            </span>
          </div>
        </div>

        {/* Module 3: Format File Output (OGG vs WAV) */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-400" />
                <span>Format Output File</span>
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Roblox Compatible
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="format-ogg-btn"
                onClick={() => handleFormatChange('ogg')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.outputFormat === 'ogg'
                    ? 'bg-emerald-500/15 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">OGG Vorbis</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                    Definisi
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  ~90% lebih hemat. Tembus limit 20MB Roblox!
                </div>
              </button>

              <button
                type="button"
                id="format-wav-btn"
                onClick={() => handleFormatChange('wav')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.outputFormat === 'wav'
                    ? 'bg-blue-500/15 border-blue-500/50 shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">WAV PCM</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                    Lossless
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Ukuran mentah besar (30-50MB).
                </div>
              </button>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-400">
            {settings.outputFormat === 'ogg' ? (
              <span className="text-emerald-300">
                ✓ Format resmi Roblox Studio untuk audio game ringan & cepat streaming.
              </span>
            ) : (
              <span className="text-amber-300">
                ⚠ Perhatian: File WAV berdurasi panjang dapat melampaui limit 20MB Roblox.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Row: Reverb & Fades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Reverb Presets */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span>Efek Reverb Studio & Ruang</span>
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              Mix: {Math.round(settings.reverbMix * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-3">
            {reverbOptions.map((opt) => (
              <button
                type="button"
                key={opt.id}
                onClick={() => handleReverbTypeChange(opt.id)}
                className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition ${
                  settings.reverbType === opt.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {settings.reverbType !== 'none' && (
            <div className="pt-2 border-t border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Reverb Mix (Wet/Dry)</span>
                  <span className="font-mono text-cyan-300">{Math.round(settings.reverbMix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={settings.reverbMix}
                  onChange={(e) =>
                    onChangeSettings({ ...settings, reverbMix: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Reverb Decay (Waktu Gema)</span>
                  <span className="font-mono text-cyan-300">{settings.reverbDecay}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="7.0"
                  step="0.2"
                  value={settings.reverbDecay}
                  onChange={(e) =>
                    onChangeSettings({ ...settings, reverbDecay: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Smooth Fade Transitions */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Transisi Halus (Fade In & Fade Out)</span>
            </span>
            <span className="text-[11px] text-zinc-400">Mencegah hentakan suara tiba-tiba</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Fade In */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.fadeInEnabled}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, fadeInEnabled: e.target.checked })
                    }
                    className="rounded border-zinc-700 text-red-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-white text-xs">Fade In</span>
                </label>
                <span className="font-mono text-zinc-400 text-[11px]">{settings.fadeInDuration}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                disabled={!settings.fadeInEnabled}
                value={settings.fadeInDuration}
                onChange={(e) =>
                  onChangeSettings({ ...settings, fadeInDuration: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer disabled:opacity-30"
              />
            </div>

            {/* Fade Out */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.fadeOutEnabled}
                    onChange={(e) =>
                      onChangeSettings({ ...settings, fadeOutEnabled: e.target.checked })
                    }
                    className="rounded border-zinc-700 text-red-500 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="font-semibold text-white text-xs">Fade Out</span>
                </label>
                <span className="font-mono text-zinc-400 text-[11px]">{settings.fadeOutDuration}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.5"
                disabled={!settings.fadeOutEnabled}
                value={settings.fadeOutDuration}
                onChange={(e) =>
                  onChangeSettings({ ...settings, fadeOutDuration: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer disabled:opacity-30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
