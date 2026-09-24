import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileAudio,
  Scissors,
  Music2,
  Sparkles,
  Layers,
  FolderOpen,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { IntroConfig } from '../types';

interface AudioInputSectionProps {
  onFilesSelected: (files: File[]) => void;
  onOpenSplitModal: (options: { localFile?: File | null }) => void;
  onOpenIntroModal: () => void;
  introConfig: IntroConfig;
  queueCount: number;
}

export const AudioInputSection: React.FC<AudioInputSectionProps> = ({
  onFilesSelected,
  onOpenSplitModal,
  onOpenIntroModal,
  introConfig,
  queueCount,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitFileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const audioFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|weba|wma|aiff)$/i.test(f.name)
      );
      if (audioFiles.length > 0) {
        onFilesSelected(audioFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const audioFiles = Array.from(e.target.files);
      onFilesSelected(audioFiles);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSplitFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onOpenSplitModal({ localFile: file });
      if (splitFileInputRef.current) {
        splitFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div
      id="audio-input-section"
      className="relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 shadow-xl backdrop-blur-md transition-all"
    >
      {/* Decorative gradient corner light */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-red-600/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Input & Unggah Audio</span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                Single / Multi Batch
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tarik file audio langsung dari komputer atau pilih beberapa file untuk antrean otomatis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Intro Audio Trigger Button */}
          <button
            type="button"
            onClick={onOpenIntroModal}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 active:scale-95 shadow-sm ${
              introConfig.enabled && introConfig.buffer
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30 ring-1 ring-emerald-500/30'
                : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 border-zinc-700 hover:text-white'
            }`}
            title="Unggah audio intro pendek untuk otomatis disematkan di awal semua audio dalam antrean"
          >
            <Radio className={`w-3.5 h-3.5 ${introConfig.enabled && introConfig.buffer ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>
              {introConfig.enabled && introConfig.buffer ? (
                <span className="flex items-center gap-1">
                  Intro Aktif ({introConfig.duration.toFixed(1)}s)
                </span>
              ) : (
                '🎙️ Pasang Audio Intro'
              )}
            </span>
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-xs text-zinc-300 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>
              Antrean: <strong className="text-white font-mono">{queueCount}</strong> file
            </span>
          </div>
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        id="dropzone-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative z-10 rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-red-500 bg-red-500/10 scale-[1.008] shadow-lg shadow-red-500/20'
            : 'border-zinc-700/70 hover:border-zinc-600 bg-zinc-950/40 hover:bg-zinc-950/70'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba,.wma,.aiff"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
              isDragging
                ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30'
                : 'bg-zinc-800/90 text-zinc-300 border border-zinc-700/80 shadow-inner'
            }`}
          >
            <Music2 className="w-7 h-7 text-red-400" />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white mt-3.5">
            {isDragging ? 'Lepaskan File di Sini' : 'Tarik & Letakkan File Audio ke Sini'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Mendukung batch upload. Gambar album cover besar akan otomatis dihapus/dibersihkan agar file ringan & lolos limit Roblox.
          </p>

          {/* Supported Format Tags */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            {['MP3', 'WAV', 'OGG', 'FLAC', 'M4A', 'AAC'].map((fmt) => (
              <span
                key={fmt}
                className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 border border-zinc-700/50"
              >
                .{fmt}
              </span>
            ))}
          </div>

          {/* Action Buttons Row */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-5 w-full sm:w-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              id="browse-audio-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/25 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Pilih File Dari Komputer</span>
            </button>

            <button
              type="button"
              id="open-intro-modal-btn"
              onClick={onOpenIntroModal}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 active:scale-95 shadow-sm ${
                introConfig.enabled && introConfig.buffer
                  ? 'bg-emerald-600/25 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-zinc-800/90 hover:bg-zinc-750 text-zinc-200 border-emerald-500/30 hover:border-emerald-500/60'
              }`}
              title="Unggah audio intro pendek untuk otomatis disematkan di awal semua audio dalam antrean"
            >
              <Radio className={`w-4 h-4 ${introConfig.enabled && introConfig.buffer ? 'text-emerald-400 animate-pulse' : 'text-emerald-400'}`} />
              <span>
                {introConfig.enabled && introConfig.buffer
                  ? `🎙️ Intro Terpasang (${introConfig.duration.toFixed(1)}s)`
                  : '🎙️ Pasang Audio Intro (Prepend)'}
              </span>
            </button>

            <button
              type="button"
              id="open-split-modal-btn"
              onClick={() => splitFileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-750 text-zinc-200 border border-amber-500/30 hover:border-amber-500/60 transition flex items-center justify-center gap-2 active:scale-95 shadow-sm"
              title="Potong intro lagu atau split file kompilasi panjang dengan timestamp"
            >
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>✂️ Potong / Split Audio (Timestamp)</span>
            </button>
            <input
              ref={splitFileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba"
              className="hidden"
              onChange={handleSplitFileInputChange}
            />
          </div>
        </div>
      </div>

      {/* Feature Footnote */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-zinc-400 px-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Semua file diproses langsung di browser secara instan tanpa batas kuota server</span>
        </div>
        <div className="text-zinc-500 font-mono">Max audio size: 100MB+ per file</div>
      </div>
    </div>
  );
};
