import React, { useState } from 'react';
import { ROBLOX_SPEED_PRESETS, RobloxSpeedPreset } from '../types';
import { Sparkles, Calculator, Copy, Check, Info } from 'lucide-react';

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [customSpeedInput, setCustomSpeedInput] = useState<string>('2.326');
  const [customRobloxInput, setCustomRobloxInput] = useState<string>('0.43');
  const [copiedLua, setCopiedLua] = useState(false);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const handleCustomSpeedChange = (valStr: string) => {
    setCustomSpeedInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      const robloxVal = (1 / val).toFixed(4);
      setCustomRobloxInput(robloxVal);
      onCustomSpeedChange(val);
    }
  };

  const handleCustomRobloxChange = (valStr: string) => {
    setCustomRobloxInput(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      const speedVal = (1 / val).toFixed(4);
      setCustomSpeedInput(speedVal);
      onCustomSpeedChange(parseFloat(speedVal));
    }
  };

  const currentRobloxSpeed = (1 / Math.max(0.01, activeSpeedUp)).toFixed(3);

  const copyLuaScript = () => {
    const script = `-- Roblox Audio Setup Script
local sound = Instance.new("Sound")
sound.SoundId = "rbxassetid://YOUR_AUDIO_ID"
sound.PlaybackSpeed = ${currentRobloxSpeed} -- Formula: 1 / ${activeSpeedUp}
sound.Volume = 1
sound.Parent = workspace
sound:Play()`;
    navigator.clipboard.writeText(script);
    setCopiedLua(true);
    setTimeout(() => setCopiedLua(false), 2000);
  };

  return (
    <div id="roblox-formula-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
              Roblox PlaybackSpeed Presets & Formula
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                Formula: PlaybackSpeed = 1 / Speed-Up
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Percepat audio di sini lalu atur PlaybackSpeed di Roblox untuk mengembalikan pitch & kecepatan asli.
            </p>
          </div>
        </div>

        <button
          id="copy-lua-snippet-btn"
          onClick={copyLuaScript}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          title="Salin contoh kode script Roblox Luau"
        >
          {copiedLua ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedLua ? 'Tersalin!' : 'Copy Lua Snippet'}
        </button>
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        {ROBLOX_SPEED_PRESETS.filter(p => p.id !== 'normal').map((preset, idx) => {
          const isSelected = Math.abs(activeSpeedUp - preset.speedUp) < 0.01;
          return (
            <div
              key={preset.id}
              id={`preset-card-${preset.id}`}
              onClick={() => onSelectPreset(preset)}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-red-500/15 border-red-500/50 shadow-md shadow-red-500/10 ring-1 ring-red-400/50'
                  : 'bg-slate-800/60 border-slate-750 hover:bg-slate-800 hover:border-slate-700'
              }`}
            >
              {isSelected && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              )}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                  <span>Speed-up:</span>
                  <span className="text-sm font-bold text-white">{preset.speedUp}x</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-red-300 py-1 px-2 rounded bg-red-950/40 border border-red-900/40 my-1">
                  <span>Roblox PlaybackSpeed:</span>
                  <span className="font-mono font-bold text-sm text-red-200">{preset.robloxPlaybackSpeed}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono text-slate-500">{preset.formula}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(preset.robloxPlaybackSpeed.toString(), idx);
                  }}
                  className="p-1 hover:text-white rounded hover:bg-slate-700/50"
                  title="Salin nilai PlaybackSpeed"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Custom Speed Calculator */}
      <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Calculator className="w-4 h-4 text-red-400" />
          <span>Kalkulator Kustom:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Speed-up:</span>
            <div className="relative">
              <input
                id="custom-speedup-input"
                type="number"
                step="0.05"
                min="0.1"
                max="20"
                value={customSpeedInput}
                onChange={(e) => handleCustomSpeedChange(e.target.value)}
                className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-red-500"
              />
              <span className="absolute right-2 top-1 text-slate-400 text-xs pointer-events-none">x</span>
            </div>
          </div>

          <span className="text-slate-500 font-bold">⇄</span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Roblox PlaybackSpeed:</span>
            <input
              id="custom-roblox-input"
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={customRobloxInput}
              onChange={(e) => handleCustomRobloxChange(e.target.value)}
              className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-red-300 font-mono text-xs focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>Nilai Roblox = 1 / ({activeSpeedUp}x) = <b className="text-red-300">{currentRobloxSpeed}</b></span>
        </div>
      </div>

      {/* Roblox Audio Upload Tip: OGG Vorbis Recommendation */}
      <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[10px] font-bold tracking-wide uppercase text-emerald-300 border border-emerald-500/30">
            Tips Format Roblox
          </span>
          <span>
            Gunakan format <strong>OGG Vorbis (.ogg)</strong> (default) karena ukurannya <strong>~90% lebih ringan</strong> daripada WAV (~2–4MB vs ~35MB), sangat aman dari batas upload aset Roblox 20MB!
          </span>
        </div>
      </div>
    </div>
  );
};
