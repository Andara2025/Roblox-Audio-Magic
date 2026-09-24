import React, { useRef, useState } from 'react';
import { IntroConfig } from '../types';
import { decodeAudioFile } from '../utils/audioEngine';
import {
  Sparkles,
  Upload,
  Play,
  Pause,
  Trash2,
  Volume2,
  Clock,
  Music,
  CheckCircle2,
  Radio,
  Zap,
  X,
  Sliders,
  Check,
} from 'lucide-react';

interface IntroAudioModalProps {
  introConfig: IntroConfig;
  onUpdateIntroConfig: (newConfig: IntroConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const IntroAudioModal: React.FC<IntroAudioModalProps> = ({
  introConfig,
  onUpdateIntroConfig,
  isOpen,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    try {
      const buffer = await decodeAudioFile(file);
      onUpdateIntroConfig({
        ...introConfig,
        enabled: true,
        file,
        fileName: file.name,
        buffer,
        duration: buffer.duration,
      });
    } catch (err) {
      console.error('Failed to decode intro audio:', err);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleRemoveIntro = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    onUpdateIntroConfig({
      ...introConfig,
      enabled: false,
      file: null,
      fileName: '',
      buffer: null,
      duration: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePreviewPlay = () => {
    if (!introConfig.file) return;
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(URL.createObjectURL(introConfig.file));
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.volume = Math.min(1, Math.max(0, (introConfig.volumePercent || 100) / 100));
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Unggah & Pasang Audio Intro</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Auto-Prepend Semua Antrean
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Sematkan otomatis audio intro (jingle / voice watermark) di awal semua audio yang diproses
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Aktifkan Penyisipan Intro ke Semua Audio</span>
                {introConfig.enabled && introConfig.buffer && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Siap Digunakan
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Output audio akan berurutan: <strong className="text-emerald-300 font-mono">[Intro] + [Audio Speed-Up]</strong>
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={introConfig.enabled}
                disabled={!introConfig.buffer}
                onChange={(e) =>
                  onUpdateIntroConfig({
                    ...introConfig,
                    enabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 disabled:opacity-40"></div>
            </label>
          </div>

          {/* Upload Box or Loaded Intro Card */}
          {!introConfig.buffer ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-zinc-700 hover:border-emerald-500/70 bg-zinc-950/40 hover:bg-emerald-950/10 rounded-xl p-6 text-center cursor-pointer transition-all duration-200"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                {isDecoding ? 'Membaca & menganalisis audio intro...' : 'Klik untuk Pilih File Audio Intro'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Format didukung: MP3, OGG, WAV, M4A, FLAC (Disarankan durasi singkat: 1 - 5 detik)
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/40 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {introConfig.fileName}
                    </p>
                    <p className="text-xs text-zinc-400 font-mono">
                      Durasi Intro: {introConfig.duration.toFixed(2)} detik
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePreviewPlay}
                    className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 text-xs transition-colors shadow-sm"
                    title={isPlaying ? 'Jeda Pratinjau' : 'Putar Pratinjau Intro'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveIntro}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                    title="Hapus Intro Ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" /> Siap disematkan di awal semua audio
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-400 hover:text-white underline underline-offset-2"
                >
                  Ganti File Intro
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* Intro Fine Tuning Settings */}
          {introConfig.buffer && (
            <div className="space-y-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Pengaturan Penyambungan Intro
              </h3>

              {/* Pause / Gap Duration */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-300 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Jeda Antara Intro & Lagu
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {introConfig.gapDuration.toFixed(2)} detik
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2.0"
                  step="0.05"
                  value={introConfig.gapDuration}
                  onChange={(e) =>
                    onUpdateIntroConfig({
                      ...introConfig,
                      gapDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>0.0s (Mulus Tanpa Jeda)</span>
                  <span>0.2s (Rekomendasi)</span>
                  <span>2.0s</span>
                </div>
              </div>

              {/* Intro Volume Level */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-300 font-medium flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Volume Intro
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {introConfig.volumePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="5"
                  value={introConfig.volumePercent}
                  onChange={(e) =>
                    onUpdateIntroConfig({
                      ...introConfig,
                      volumePercent: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Normal vs Speedup Intro */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <div>
                  <p className="text-xs font-medium text-zinc-200">
                    Biarkan Intro di Kecepatan Asli 1.0x (Direkomendasikan)
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {introConfig.applyIntroSpeedUp
                      ? 'Intro ikut dipercepat bersama lagu utama'
                      : 'Intro terdengar natural di tempo normal 1.0x'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateIntroConfig({
                      ...introConfig,
                      applyIntroSpeedUp: !introConfig.applyIntroSpeedUp,
                    })
                  }
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all ${
                    !introConfig.applyIntroSpeedUp
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {!introConfig.applyIntroSpeedUp ? 'Normal 1.0x' : 'Ikut Speed Up'}
                </button>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300/90 leading-relaxed flex gap-2.5">
            <Zap className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
            <div>
              <p className="font-semibold text-cyan-200 mb-0.5">Cara Kerja di Roblox:</p>
              File audio output yang dihasilkan akan memutar intro terlebih dahulu di awal, kemudian langsung dilanjutkan lagu yang sudah dipercepat. Ketika diatur dengan PlaybackSpeed Roblox, lagu kembali normal dan intro menjadi pembuka yang pas.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-md flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Selesai & Terapkan ke Antrean</span>
          </button>
        </div>
      </div>
    </div>
  );
};
