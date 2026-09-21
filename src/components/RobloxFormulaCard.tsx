import React, { useState } from 'react';
import { ROBLOX_SPEED_PRESETS, RobloxSpeedPreset } from '../types';
import {
  Sparkles,
  Calculator,
  Copy,
  Check,
  Zap,
  Code,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RobloxFormulaCardProps {
  activeSpeedUp: number;
  onSelectPreset: (preset: RobloxSpeedPreset) => void;
  onCustomSpeedChange: (speedUp: number) => void;
}

export const RobloxFormulaCard: React.FC<RobloxFormulaCardProps> = ({
  activeSpeedUp,
  onSelectPreset,
  onCustomSpeedChange,
}) => {
  const [copiedSpeed, setCopiedSpeed] = useState(false);
  const [copiedLua, setCopiedLua] = useState(false);
  const [customSpeedInput, setCustomSpeedInput] = useState<string>(activeSpeedUp.toString());

  const currentRobloxSpeed = parseFloat((1 / Math.max(0.01, activeSpeedUp)).toFixed(4));

  const handleCustomSpeedChange = (valStr: string) => {
    setCustomSpeedInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      onCustomSpeedChange(val);
    }
  };

  const handleCustomRobloxChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      const speedUp = parseFloat((1 / val).toFixed(4));
      setCustomSpeedInput(speedUp.toString());
      onCustomSpeedChange(speedUp);
    }
  };

  const copySpeedValue = () => {
    navigator.clipboard.writeText(currentRobloxSpeed.toString());
    setCopiedSpeed(true);
    setTimeout(() => setCopiedSpeed(false), 2000);
  };

  const copyLuaScript = () => {
    const script = `-- Roblox Audio Playback Script (Kembali ke Tempo & Pitch Normal)
local SoundService = game:GetService("SoundService")
local sound = Instance.new("Sound")
sound.Name = "ProcessedAudio"
sound.SoundId = "rbxassetid://YOUR_AUDIO_ID" -- Ganti dengan ID Audio Roblox Anda
sound.PlaybackSpeed = ${currentRobloxSpeed} -- Formula: 1 / ${activeSpeedUp}x percepatan
sound.Volume = 1
sound.Looped = false
sound.Parent = SoundService
sound:Play()`;
    navigator.clipboard.writeText(script);
    setCopiedLua(true);
    setTimeout(() => setCopiedLua(false), 2000);
  };

  // Sample duration calculation for live illustration
  const sampleOriginalSec = 210; // 3 menit 30 detik
  const sampleReducedSec = Math.round(sampleOriginalSec / Math.max(0.1, activeSpeedUp));
  const savedPercent = Math.max(0, Math.min(95, Math.round((1 - 1 / activeSpeedUp) * 100)));

  return (
    <div
      id="roblox-formula-card"
      className="relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 shadow-xl backdrop-blur-md"
    >
      {/* Glow elements */}
      <div className="pointer-events-none absolute top-0 right-1/4 w-72 h-32 bg-red-600/10 rounded-full blur-3xl" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-600/25 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Formula & Preset Roblox PlaybackSpeed</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                100% Roblox Studio Valid
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Audio dipercepat di sini agar lolos batas ukuran 20MB, lalu dinormalkan kembali di Roblox melalui PlaybackSpeed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="copy-lua-script-btn"
            onClick={copyLuaScript}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="Salin snippet script Roblox Luau"
          >
            {copiedLua ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5 text-red-400" />}
            <span>{copiedLua ? 'Script Disalin!' : 'Copy Script Luau'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Speed Presets */}
      <div>
        <div className="text-xs font-semibold text-zinc-300 mb-2.5 flex items-center justify-between">
          <span>Pilih Preset Kecepatan Roblox Populer:</span>
          <span className="text-[11px] text-zinc-500">Klik untuk langsung menerapkan</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
          {ROBLOX_SPEED_PRESETS.map((preset) => {
            const isSelected = Math.abs(activeSpeedUp - preset.speedUp) < 0.01;
            return (
              <button
                type="button"
                key={preset.id}
                id={`preset-btn-${preset.id}`}
                onClick={() => {
                  onSelectPreset(preset);
                  setCustomSpeedInput(preset.speedUp.toString());
                }}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between active:scale-95 ${
                  isSelected
                    ? 'bg-red-500/15 border-red-500/60 shadow-md shadow-red-500/15 ring-1 ring-red-500/40'
                    : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-medium text-zinc-400">Roblox:</span>
                    <span className="text-xs font-mono font-bold text-white">{preset.robloxPlaybackSpeed}</span>
                  </div>
                  <div className="text-[13px] font-mono font-extrabold text-red-400">
                    {preset.speedUp}x
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 truncate mt-1 pt-1 border-t border-zinc-800/80">
                  {preset.speedUp === 1 ? 'Normal' : `Hemat ~${Math.round((1 - 1 / preset.speedUp) * 100)}%`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Live Formula Simulation Banner */}
      <div className="mt-4 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Mathematical visual */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between sm:justify-start gap-4 shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Speed-Up Input</div>
              <div className="text-base font-mono font-extrabold text-white">{activeSpeedUp}x</div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Roblox PlaybackSpeed</div>
              <div className="text-base font-mono font-extrabold text-red-400">{currentRobloxSpeed}</div>
            </div>
          </div>

          <div className="text-xs text-zinc-300 flex-1">
            <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulasi Durasi File (Contoh Lagu 03:30):</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed">
              Durasi asli <strong>210s</strong> dipadatkan menjadi hanya{' '}
              <strong className="text-emerald-400 font-mono">
                {Math.floor(sampleReducedSec / 60)}m {sampleReducedSec % 60}s
              </strong>{' '}
              <span className="text-emerald-400 font-bold">(-{savedPercent}%)</span>. Saat di-play di Roblox Studio pada{' '}
              <span className="font-mono text-red-300 font-semibold">Sound.PlaybackSpeed = {currentRobloxSpeed}</span>, durasi kembali utuh 03:30 tanpa ada yang terpotong!
            </p>
          </div>
        </div>

        {/* Right: Quick Copy Speed Button */}
        <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            id="copy-roblox-speed-btn"
            onClick={copySpeedValue}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
          >
            {copiedSpeed ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-red-400" />}
            <span>{copiedSpeed ? 'Nilai Disalin!' : `Copy Nilai (${currentRobloxSpeed})`}</span>
          </button>
        </div>
      </div>

      {/* Two-Way Custom Calculator Inputs */}
      <div className="mt-3.5 pt-3.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Kalkulator Kustom:
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="custom-speed-up-input" className="text-zinc-400 font-mono text-[11px]">
              Percepat (x):
            </label>
            <input
              id="custom-speed-up-input"
              type="number"
              step="0.01"
              min="0.1"
              max="20"
              value={customSpeedInput}
              onChange={(e) => handleCustomSpeedChange(e.target.value)}
              className="w-20 bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="custom-roblox-speed-input" className="text-zinc-400 font-mono text-[11px]">
              Roblox PlaybackSpeed:
            </label>
            <input
              id="custom-roblox-speed-input"
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={currentRobloxSpeed}
              onChange={(e) => handleCustomRobloxChange(e.target.value)}
              className="w-20 bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-red-300 font-mono font-bold focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
