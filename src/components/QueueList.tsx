import React, { useState } from 'react';
import { QueueItem } from '../types';
import {
  Download,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  FileAudio,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Sliders,
  Archive,
  Volume2,
  Zap,
  Check,
  Copy,
} from 'lucide-react';
import { formatDuration, formatFileSize } from '../utils/audioEngine';

interface QueueListProps {
  queue: QueueItem[];
  folderName?: string;
  selectedDirectoryName?: string | null;
  onProcessItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onDownloadItem: (item: QueueItem, format?: 'ogg' | 'wav') => void;
  onDownloadAllZip: () => void;
  isDownloadingZip: boolean;
  activePlayingId: string | null;
  activePlayingType: 'original' | 'processed' | null;
  onTogglePlay: (id: string, type: 'original' | 'processed') => void;
  onUpdateItemSettings?: (id: string, newSettings: QueueItem['settings']) => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  queue,
  folderName,
  selectedDirectoryName,
  onProcessItem,
  onDeleteItem,
  onClearAll,
  onDownloadItem,
  onDownloadAllZip,
  isDownloadingZip,
  activePlayingId,
  activePlayingType,
  onTogglePlay,
  onUpdateItemSettings,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const readyCount = queue.filter((item) => item.status === 'ready').length;
  const processingCount = queue.filter(
    (item) => item.status === 'processing' || item.status === 'decoding'
  ).length;

  const copySpeed = (id: string, val: number) => {
    navigator.clipboard.writeText(val.toString());
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (queue.length === 0) {
    return (
      <div
        id="queue-empty-state"
        className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-8 sm:p-12 text-center backdrop-blur-md"
      >
        <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/80 text-zinc-400 mx-auto flex items-center justify-center mb-3">
          <Layers className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-1">Antrean Audio Masih Kosong</h3>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
          Unggah satu atau banyak file audio (.MP3, .WAV, .OGG, .M4A) di atas untuk memulai percepatan & konversi Roblox.
        </p>
        <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-950/60 px-3 py-1.5 rounded-full border border-zinc-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Tips: Anda dapat memilih banyak file sekaligus untuk di-export jadi 1 file .ZIP rapi</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id="queue-list-container"
      className="relative overflow-hidden rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 sm:p-6 shadow-xl backdrop-blur-md"
    >
      {/* Queue Header & Global Batch Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Daftar Antrean Audio</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700">
                {queue.length} file
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
              <span>
                <strong className="text-emerald-400">{readyCount}</strong> siap diunduh
              </span>
              {processingCount > 0 && (
                <span>
                  • <strong className="text-amber-400">{processingCount}</strong> sedang diproses
                </span>
              )}
              {selectedDirectoryName && (
                <span>
                  • Target: <strong className="text-cyan-400">{selectedDirectoryName}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            id="clear-all-queue-btn"
            onClick={onClearAll}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition flex items-center gap-1.5 active:scale-95"
            title="Hapus semua item dari antrean"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Kosongkan</span>
          </button>

          <button
            type="button"
            id="download-all-zip-btn"
            onClick={onDownloadAllZip}
            disabled={readyCount === 0 || isDownloadingZip}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 disabled:opacity-40 transition flex items-center gap-2 active:scale-95"
          >
            <Archive className="w-4 h-4" />
            <span>
              {isDownloadingZip ? 'Mengemas .ZIP...' : `Download Semua (.ZIP)`}
            </span>
          </button>
        </div>
      </div>

      {/* Queue Items Stack */}
      <div className="space-y-3">
        {queue.map((item) => {
          const isPlayingThis = activePlayingId === item.id;
          const isExpanded = expandedId === item.id;

          const savedDurationPercent =
            item.duration && item.processedDuration
              ? Math.max(
                  0,
                  Math.min(
                    95,
                    Math.round((1 - item.processedDuration / item.duration) * 100)
                  )
                )
              : Math.max(
                  0,
                  Math.min(
                    95,
                    Math.round((1 - 1 / (item.settings.speedUp || 1)) * 100)
                  )
                );

          return (
            <div
              key={item.id}
              id={`queue-item-${item.id}`}
              className={`rounded-xl border transition-all ${
                item.status === 'processing'
                  ? 'bg-zinc-950/90 border-red-500/50 shadow-md shadow-red-500/10'
                  : item.status === 'ready'
                  ? 'bg-zinc-950/70 border-zinc-800/90 hover:border-zinc-700'
                  : 'bg-zinc-950/50 border-zinc-850'
              }`}
            >
              {/* Main Item Row */}
              <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Info & Wave Icon */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      item.status === 'ready'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : item.status === 'processing'
                        ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
                        : item.status === 'error'
                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                        : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400'
                    }`}
                  >
                    <FileAudio className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                        {item.title}
                      </h4>

                      {/* Format Badge */}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {item.settings.outputFormat.toUpperCase()}
                      </span>

                      {/* Speed Badge */}
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                        {item.settings.speedUp}x
                      </span>

                      {/* Roblox PlaybackSpeed Pill */}
                      <button
                        type="button"
                        onClick={() => copySpeed(item.id, item.settings.robloxPlaybackSpeed)}
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition flex items-center gap-1"
                        title="Klik untuk salin nilai Roblox PlaybackSpeed"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>Roblox PBS: {item.settings.robloxPlaybackSpeed}</span>
                      </button>
                    </div>

                    {/* Secondary Meta Row */}
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{formatDuration(item.duration)}</span>
                        {item.status === 'ready' && (
                          <>
                            <span className="text-zinc-600">➔</span>
                            <span className="text-emerald-400 font-bold">
                              {formatDuration(item.processedDuration || item.duration / item.settings.speedUp)}
                            </span>
                            <span className="text-emerald-400">(-{savedDurationPercent}%)</span>
                          </>
                        )}
                      </span>

                      <span className="flex items-center gap-1 font-mono">
                        <HardDrive className="w-3 h-3 text-zinc-500" />
                        <span>{formatFileSize(item.fileSize)}</span>
                        {item.processedSize && (
                          <>
                            <span className="text-zinc-600">➔</span>
                            <span className="text-emerald-400 font-bold">
                              {formatFileSize(item.processedSize)}
                            </span>
                          </>
                        )}
                      </span>

                      {item.settings.reverbType !== 'none' && (
                        <span className="text-[10px] text-purple-400">
                          Reverb: {item.settings.reverbType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status & Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Status Indicator */}
                  {item.status === 'ready' && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Siap</span>
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Gagal</span>
                    </span>
                  )}

                  {/* Play Processed / Original Button */}
                  {item.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() =>
                        onTogglePlay(
                          item.id,
                          isPlayingThis && activePlayingType === 'processed' ? 'processed' : 'processed'
                        )
                      }
                      className={`p-2 rounded-xl border transition active:scale-95 ${
                        isPlayingThis && activePlayingType === 'processed'
                          ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/25'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                      }`}
                      title={
                        isPlayingThis && activePlayingType === 'processed'
                          ? 'Pause audio hasil'
                          : 'Putar audio hasil percepatan'
                      }
                    >
                      {isPlayingThis && activePlayingType === 'processed' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                  )}

                  {/* Process Single Item Button */}
                  {item.status !== 'processing' && item.status !== 'decoding' && (
                    <button
                      type="button"
                      onClick={() => onProcessItem(item.id)}
                      className="p-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition active:scale-95 shadow-sm"
                      title={item.status === 'ready' ? 'Proses ulang dengan parameter baru' : 'Proses audio ini'}
                    >
                      {item.status === 'ready' ? (
                        <RotateCcw className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <Zap className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  )}

                  {/* Download Single Item Button */}
                  {item.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => onDownloadItem(item)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex items-center gap-1.5 active:scale-95"
                      title="Download file ini"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  )}

                  {/* Expand Individual Settings */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                    title="Buka pengaturan khusus item ini"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2 rounded-xl bg-zinc-800/60 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 transition active:scale-95"
                    title="Hapus file dari antrean"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar during processing */}
              {(item.status === 'processing' || item.status === 'decoding') && (
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                    <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                      <Zap className="w-3 h-3 animate-spin" />
                      <span>{item.status === 'decoding' ? 'Mendecode PCM...' : 'Memproses DSP Engine...'}</span>
                    </span>
                    <span className="font-mono">{item.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Individual Item Settings Drawer */}
              {isExpanded && onUpdateItemSettings && (
                <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/90 rounded-b-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Pengaturan Khusus Track Ini:</span>
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Perubahan hanya berlaku untuk item ini
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Speed Override */}
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                      <div className="flex justify-between text-zinc-400 mb-1">
                        <span>Speed-Up:</span>
                        <span className="font-mono font-bold text-red-400">
                          {item.settings.speedUp}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.05"
                        value={item.settings.speedUp}
                        onChange={(e) => {
                          const speed = parseFloat(e.target.value);
                          onUpdateItemSettings(item.id, {
                            ...item.settings,
                            speedUp: speed,
                            robloxPlaybackSpeed: parseFloat((1 / speed).toFixed(4)),
                          });
                        }}
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Amplify Override */}
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                      <div className="flex justify-between text-zinc-400 mb-1">
                        <span>Amplify:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {item.settings.amplifyDb > 0 ? `+${item.settings.amplifyDb}` : item.settings.amplifyDb} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-6"
                        max="18"
                        step="0.5"
                        value={item.settings.amplifyDb}
                        onChange={(e) =>
                          onUpdateItemSettings(item.id, {
                            ...item.settings,
                            amplifyDb: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Output Format Override */}
                    <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                      <div className="text-zinc-400 mb-1.5">Format File:</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItemSettings(item.id, {
                              ...item.settings,
                              outputFormat: 'ogg',
                            })
                          }
                          className={`py-1 rounded text-center font-bold text-[11px] border ${
                            item.settings.outputFormat === 'ogg'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          .OGG
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItemSettings(item.id, {
                              ...item.settings,
                              outputFormat: 'wav',
                            })
                          }
                          className={`py-1 rounded text-center font-bold text-[11px] border ${
                            item.settings.outputFormat === 'wav'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          .WAV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
