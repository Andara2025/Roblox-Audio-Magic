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
  Sparkles,
  Radio,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Info,
  Lock,
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
            title="Terapkan konfigurasi parameter ini ke semua item di antrean dan langsung proses ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Terapkan & Proses Ulang</span>
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

      {/* 1-Click Quick Preset Selector Bar */}
      <div className="mb-5 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-zinc-200 tracking-wide">Preset Siap Pakai Roblox:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                ...settings,
                speedUp: 2.326,
                robloxPlaybackSpeed: 0.43,
                amplifyDb: 5,
                fadeInEnabled: true,
                fadeInDuration: 2.0,
                fadeOutEnabled: true,
                fadeOutDuration: 3.0,
                outputFormat: 'ogg',
                oggQuality: 8,
                reverbType: 'hall',
                reverbMix: 0.25,
                reverbDecay: 2.4,
                preserveQuality: true,
                autoFitRobloxLimit: true,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
              settings.amplifyDb === 5 &&
              settings.reverbType === 'hall' &&
              settings.fadeInEnabled &&
              settings.fadeOutEnabled &&
              (settings.oggQuality ?? 8) === 8 &&
              settings.speedUp === 2.326
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
            }`}
            title="Preset rekomendasi: +5dB Volume, Fade In 2s & Out 3s, OGG 256k, Concert Hall Reverb, Speed 2.326x"
          >
            <span>🔥 Roblox Concert Pro (+5dB • Fade • Concert Hall • 256k)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                ...settings,
                speedUp: 2.326,
                robloxPlaybackSpeed: 0.43,
                amplifyDb: 5,
                fadeInEnabled: true,
                fadeInDuration: 2.0,
                fadeOutEnabled: true,
                fadeOutDuration: 3.0,
                outputFormat: 'ogg',
                oggQuality: 8,
                reverbType: 'none',
                preserveQuality: true,
                autoFitRobloxLimit: true,
              })
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
              settings.reverbType === 'none' && settings.amplifyDb === 5 && settings.speedUp === 2.326
                ? 'bg-zinc-700 text-white font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
            title="Preset kering tanpa reverb: +5dB Volume, Fade In/Out, OGG 256k, Speed 2.326x"
          >
            <span>Roblox Clean (+5dB • Dry)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeSettings({
                ...settings,
                speedUp: 1.0,
                robloxPlaybackSpeed: 1.0,
                amplifyDb: 0,
                fadeInEnabled: false,
                fadeOutEnabled: false,
                outputFormat: 'ogg',
                oggQuality: 8,
                reverbType: 'none',
                preserveQuality: true,
                autoFitRobloxLimit: true,
              })
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition active:scale-95 ${
              settings.speedUp === 1.0 && settings.amplifyDb === 0
                ? 'bg-zinc-700 text-white font-semibold'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
            title="Kembalikan ke setting standar: Speed asli 1.0x, 0dB gain, tanpa efek"
          >
            <span>Reset Normal (1.0x • 0dB)</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: 3 Responsive Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Module 3: Format File Output & Kontrol Ukuran File Roblox (Limit 20MB) */}
        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-amber-400" />
                <span>Format File & Kontrol Ukuran (Limit 20MB)</span>
              </span>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${
                settings.outputFormat === 'ogg'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
              }`}>
                {settings.outputFormat === 'ogg' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Lolos Batas 20MB</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Resiko Ditolak Roblox</span>
                  </>
                )}
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
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <span>OGG Vorbis</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-extrabold">
                      WAJIB ROBLOX
                    </span>
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Ukuran <strong className="text-emerald-400 font-mono">~2.5 - 4 MB</strong>. 100% lolos batas 20MB Roblox & cepat streaming!
                </div>
              </button>

              <button
                type="button"
                id="format-wav-btn"
                onClick={() => handleFormatChange('wav')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  settings.outputFormat === 'wav'
                    ? 'bg-rose-500/15 border-rose-500/60 shadow-sm ring-1 ring-rose-500/40'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">WAV PCM</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                    Bengkak 30-50MB
                  </span>
                </div>
                <div className="text-[10px] text-rose-300/80 mt-1">
                  Audio mentah uncompressed. <strong>Pasti ditolak Roblox</strong> jika &gt; 20MB.
                </div>
              </button>
            </div>

            {/* Warning if WAV is currently selected */}
            {settings.outputFormat === 'wav' && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-200">
                      Penyebab Utama File Bengkak Sampai 50MB:
                    </div>
                    <div className="text-[11px] text-rose-300/90 mt-1 leading-relaxed">
                      Format WAV PCM menyimpan audio tanpa kompresi (~10.6 MB per menit). Lagu 4-5 menit akan berukuran <strong>40-52 MB</strong> dan <strong>pasti ditolak sistem upload Roblox (limit 20MB)</strong>!
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFormatChange('ogg')}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ganti ke OGG Vorbis (Aman & Ringan)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OGG Quality / Bitrate Selector with 224 kbps clarity explanation */}
            {settings.outputFormat === 'ogg' && (
              <div className="mt-3 p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-zinc-300 font-semibold text-[11px] flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-emerald-400" />
                    <span>Pilihan Bitrate OGG:</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold text-[11px]">
                    {(settings.oggQuality ?? 8) === 8
                      ? 'q8 • 256 kbps (Rekomendasi Hi-Fi Studio)'
                      : (settings.oggQuality ?? 8) === 7
                      ? 'q7 • 224 kbps (Standar Seimbang)'
                      : (settings.oggQuality ?? 8) === 9
                      ? 'q9 • 320 kbps (Audiophile Max)'
                      : (settings.oggQuality ?? 8) === 6
                      ? 'q6 • 192 kbps (Hemat Kuota)'
                      : (settings.oggQuality ?? 8) === 5
                      ? 'q5 • 160 kbps (Spotify Normal)'
                      : 'q10 • 450 kbps (Max Lossless-grade)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { q: 6, label: '192k', desc: 'Hemat Kuota', size: '~2-3MB' },
                    { q: 7, label: '224k', desc: 'Standar Bersih', size: '~2.5-3.5MB' },
                    { q: 8, label: '256k', desc: 'Hi-Fi Studio', size: '~3-4.5MB', isPopular: true },
                    { q: 9, label: '320k', desc: 'Ultra Jernih', size: '~4-5.5MB' },
                  ].map((item) => (
                    <button
                      key={item.q}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, oggQuality: item.q })}
                      className={`p-1.5 rounded-lg text-center transition flex flex-col items-center justify-center relative ${
                        (settings.oggQuality ?? 8) === item.q
                          ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60 hover:text-zinc-200'
                      }`}
                    >
                      {item.isPopular && (
                        <span className="absolute -top-2 right-1 text-[8px] font-extrabold px-1 py-0.2 rounded bg-amber-500 text-zinc-950 shadow-sm">
                          REKOMENDASI
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-bold">{item.label}</span>
                      <span className="text-[9px] text-zinc-400 font-mono mt-0.5">{item.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Realtime Size & Roblox Limit Safety Estimation */}
          <div className="mt-3 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] space-y-2">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estimasi File Lagu 3–4 Menit ({settings.speedUp}x):</span>
              </span>
              <span className="font-mono font-bold text-white">
                {settings.outputFormat === 'ogg'
                  ? (settings.oggQuality ?? 7) === 6
                    ? '~2.1 MB'
                    : (settings.oggQuality ?? 7) === 7
                    ? '~2.6 MB'
                    : (settings.oggQuality ?? 7) === 8
                    ? '~3.2 MB'
                    : '~3.9 MB'
                  : '~32.0 MB (OVER 20MB)'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400">
              {settings.outputFormat === 'ogg' ? (
                <span className="text-emerald-400 font-medium">
                  ✓ Aman terkontrol: Menggunakan ~13% dari batas kuota 20MB Roblox.
                </span>
              ) : (
                <span className="text-rose-400 font-bold">
                  ❌ Melebihi kuota: 160% dari batas 20MB Roblox (Pasti Gagal Upload).
                </span>
              )}
            </div>

            {/* Auto-Fit Roblox Safeguard Switch */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-cyan-400" />
                <span className="text-zinc-300 font-medium text-[11px]">
                  Garansi Batas 20MB Roblox (Auto-Fit Bitrate)
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChangeSettings({
                    ...settings,
                    autoFitRobloxLimit: !(settings.autoFitRobloxLimit ?? true),
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  (settings.autoFitRobloxLimit ?? true) ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
                title="Otomatis sesuaikan bitrate untuk lagu panjang agar tidak pernah melampaui batas 20MB Roblox"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    (settings.autoFitRobloxLimit ?? true) ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
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
