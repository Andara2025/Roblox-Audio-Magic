import React from 'react';
import { AudioSettings, OutputAudioFormat, ROBLOX_SPEED_PRESETS, ReverbType } from '../types';
import { Gauge, Volume2, Waves, Sliders, ShieldCheck, Zap, RefreshCw, FileCheck2, Info } from 'lucide-react';

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
    const safeSpeed = Math.max(0.1, Math.min(20, speedUp));
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
      mix = 0.25; // Default enjoyable mix
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

  return (
    <div id="global-controls" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Parameter & Efek Audio</h3>
            <p className="text-xs text-slate-400">Pengaturan kecepatan playback, amplify dB, dan filter efek reverb.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="apply-settings-all-btn"
            onClick={onApplyToAllQueue}
            disabled={queueCount === 0 || isProcessing}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 disabled:opacity-40 transition flex items-center gap-1.5"
            title="Terapkan konfigurasi ini ke semua file di antrean"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Terapkan ke Semua Antrean</span>
          </button>

          <button
            id="process-all-btn"
            onClick={onProcessAll}
            disabled={queueCount === 0 || isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 disabled:opacity-40 transition flex items-center gap-2"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>{isProcessing ? 'Sedang Memproses...' : `Proses Semua (${queueCount})`}</span>
          </button>
        </div>
      </div>

      {/* Format Output Selector: OGG (Default & Lightweight) vs WAV (Lossless) */}
      <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Format File Output:</span>
              <span className="text-[11px] text-slate-400">
                {settings.outputFormat === 'ogg' ? (
                  <strong className="text-emerald-400 font-semibold">OGG Vorbis (~90% lebih ringan, limit 20MB Roblox aman!)</strong>
                ) : (
                  <strong className="text-amber-400 font-semibold">WAV Lossless PCM (Ukuran besar, ~10x lebih berat)</strong>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              File <strong>WAV</strong> tidak dikompresi (~30–50MB), sedangkan <strong>OGG</strong> dikompresi efisien (~2–4MB) sehingga lolos batas upload Roblox.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => handleFormatChange('ogg')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              settings.outputFormat === 'ogg'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>OGG (.ogg)</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-200 border border-emerald-500/40">
              Default / Ringan
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFormatChange('wav')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              settings.outputFormat === 'wav'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>WAV (.wav)</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-blue-950/80 text-blue-200 border border-blue-500/40">
              Lossless
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
        {/* Section 1: Playback Speed */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-red-400" />
              <span>Playback Speed</span>
            </label>
            <div className="text-right">
              <span className="text-sm font-bold text-red-400 font-mono">{settings.speedUp}x</span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Roblox: {settings.robloxPlaybackSpeed}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {ROBLOX_SPEED_PRESETS.map((p) => {
              const active = Math.abs(settings.speedUp - p.speedUp) < 0.01;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSpeedChange(p.speedUp)}
                  className={`py-1.5 px-2 rounded-lg font-medium border text-center transition ${
                    active
                      ? 'bg-red-500/20 border-red-500 text-white font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {p.speedUp}x
                </button>
              );
            })}
          </div>

          {/* Speed Slider */}
          <div className="pt-2">
            <input
              type="range"
              min="0.25"
              max="10"
              step="0.05"
              value={settings.speedUp}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-red-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>0.25x</span>
              <span>1x (Normal)</span>
              <span>4x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-400 font-medium">Metode Pitch:</span>
              <span className="text-red-300 font-semibold">
                {settings.pitchMode === 'resample' ? 'Roblox Resample (Rekomendasi)' : 'Time-Stretch (Pitch Tetap)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[10px]">
              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, pitchMode: 'resample' })}
                className={`py-1 rounded font-medium transition ${
                  settings.pitchMode === 'resample' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Roblox Resample
              </button>
              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, pitchMode: 'timestretch' })}
                className={`py-1 rounded font-medium transition ${
                  settings.pitchMode === 'timestretch' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Time-Stretch
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Amplify (dB) */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Amplify Gain (dB)</span>
            </label>
            <div className="text-right">
              <span className={`text-sm font-bold font-mono ${
                settings.amplifyDb > 0 ? 'text-emerald-400' : settings.amplifyDb < 0 ? 'text-blue-400' : 'text-slate-300'
              }`}>
                {settings.amplifyDb > 0 ? `+${settings.amplifyDb}` : settings.amplifyDb} dB
              </span>
              <span className="text-[10px] text-slate-400 block">
                {settings.amplifyDb === 0 ? 'Level Normal' : settings.amplifyDb > 0 ? 'Perkuat Volume' : 'Redam Volume'}
              </span>
            </div>
          </div>

          {/* Quick Amplify Presets */}
          <div className="grid grid-cols-4 gap-1.5 text-[11px]">
            {[
              { label: 'Normal (0dB)', db: 0 },
              { label: '+3 dB', db: 3 },
              { label: '+6 dB', db: 6 },
              { label: '-3 dB', db: -3 },
            ].map((p) => {
              const active = settings.amplifyDb === p.db;
              return (
                <button
                  key={p.db}
                  onClick={() => handleAmplifyChange(p.db)}
                  className={`py-1.5 px-1 rounded-lg font-medium border text-center transition text-[10px] ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {p.db > 0 ? `+${p.db}` : p.db} dB
                </button>
              );
            })}
          </div>

          {/* Amplify Slider */}
          <div className="pt-2">
            <input
              type="range"
              min="-18"
              max="18"
              step="1"
              value={settings.amplifyDb}
              onChange={(e) => handleAmplifyChange(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>-18 dB</span>
              <span>0 dB (Normal)</span>
              <span>+18 dB</span>
            </div>
          </div>

          {/* Quality protection indicator */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Kualitas Terjaga (Anti-Distorsi)</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
              Soft Limiter Aktif
            </span>
          </div>
        </div>

        {/* Section 3: Filter Effect (Reverb) */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span>Filter Effect: Reverb</span>
            </label>
            <span className="text-xs font-semibold text-cyan-400 capitalize">
              {settings.reverbType === 'none' ? 'Mati (Normal)' : settings.reverbType}
            </span>
          </div>

          {/* Reverb Presets */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {[
              { id: 'none', label: 'Off' },
              { id: 'room', label: 'Room' },
              { id: 'hall', label: 'Hall' },
              { id: 'cathedral', label: 'Cathedral' },
              { id: 'space', label: 'Space' },
            ].map((r) => {
              const active = settings.reverbType === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleReverbTypeChange(r.id as ReverbType)}
                  className={`py-1.5 px-2 rounded-lg font-medium border text-center transition ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Reverb Mix & Decay Sliders */}
          {settings.reverbType !== 'none' ? (
            <div className="space-y-2 pt-1">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Wet / Reverb Mix:</span>
                  <span className="text-cyan-300 font-mono">{Math.round(settings.reverbMix * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={settings.reverbMix}
                  onChange={(e) => onChangeSettings({ ...settings, reverbMix: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Decay Time:</span>
                  <span className="text-cyan-300 font-mono">{settings.reverbDecay.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.2"
                  value={settings.reverbDecay}
                  onChange={(e) => onChangeSettings({ ...settings, reverbDecay: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 text-center">
              Reverb dinonaktifkan (audio kering / dry alami).
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Fade In & Fade Out Controls */}
      <div className="mt-5 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <span>Fade In & Fade Out (Transisi Intro / Outro)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono ${
                  settings.fadeInEnabled || settings.fadeOutEnabled
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {settings.fadeInEnabled || settings.fadeOutEnabled ? 'Aktif' : 'Mati (Off)'}
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Mencegah suara mengagetkan di awal dan memotong mendadak di akhir lagu
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Fade In (Awal Lagu) */}
          <div className={`p-3.5 rounded-xl border transition ${
            settings.fadeInEnabled
              ? 'bg-indigo-950/20 border-indigo-800/60'
              : 'bg-slate-900/50 border-slate-800/60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-indigo-300 block">Fade In (Awal)</span>
                <span className="text-[10px] text-slate-400">Naik perlahan dari hening</span>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, fadeInEnabled: !settings.fadeInEnabled })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                  settings.fadeInEnabled
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.fadeInEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{settings.fadeInEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {settings.fadeInEnabled ? (
              <div className="space-y-2 pt-2 border-t border-slate-800/80 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Durasi Fade In:</span>
                  <span className="text-indigo-300 font-bold font-mono">{settings.fadeInDuration} detik</span>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {[0.5, 1.0, 2.0, 3.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, fadeInDuration: dur })}
                      className={`py-1 rounded border text-center transition ${
                        settings.fadeInDuration === dur
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="0.2"
                  max="10.0"
                  step="0.2"
                  value={settings.fadeInDuration}
                  onChange={(e) => onChangeSettings({ ...settings, fadeInDuration: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.2s</span>
                  <span>2.0s</span>
                  <span>10.0s</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 italic mt-1">
                Fitur Fade In tidak aktif. Audio mulai langsung pada volume normal.
              </div>
            )}
          </div>

          {/* Fade Out (Akhir Lagu) */}
          <div className={`p-3.5 rounded-xl border transition ${
            settings.fadeOutEnabled
              ? 'bg-purple-950/20 border-purple-800/60'
              : 'bg-slate-900/50 border-slate-800/60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-purple-300 block">Fade Out (Akhir)</span>
                <span className="text-[10px] text-slate-400">Menghilang perlahan ke hening</span>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => onChangeSettings({ ...settings, fadeOutEnabled: !settings.fadeOutEnabled })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                  settings.fadeOutEnabled
                    ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.fadeOutEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{settings.fadeOutEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {settings.fadeOutEnabled ? (
              <div className="space-y-2 pt-2 border-t border-slate-800/80 mt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Durasi Fade Out:</span>
                  <span className="text-purple-300 font-bold font-mono">{settings.fadeOutDuration} detik</span>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  {[1.0, 2.0, 3.0, 5.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, fadeOutDuration: dur })}
                      className={`py-1 rounded border text-center transition ${
                        settings.fadeOutDuration === dur
                          ? 'bg-purple-500/20 border-purple-500 text-purple-200 font-bold'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="15.0"
                  step="0.5"
                  value={settings.fadeOutDuration}
                  onChange={(e) => onChangeSettings({ ...settings, fadeOutDuration: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.5s</span>
                  <span>3.0s</span>
                  <span>15.0s</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 italic mt-1">
                Fitur Fade Out tidak aktif. Audio selesai tanpa penurunan volume.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
