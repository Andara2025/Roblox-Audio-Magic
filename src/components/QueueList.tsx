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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  Archive,
  Volume2,
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

  const readyCount = queue.filter((item) => item.status === 'ready').length;
  const processingCount = queue.filter((item) => item.status === 'processing' || item.status === 'decoding').length;

  if (queue.length === 0) {
    return (
      <div id="queue-empty-state" className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500 mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white">Antrean Audio Kosong</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Silakan upload file audio (single atau multiple) atau masukkan link YouTube di bagian atas untuk memulai.
        </p>
      </div>
    );
  }

  return (
    <div id="queue-list-section" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100">
      {/* Queue Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <FileAudio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2 flex-wrap">
              <span>Daftar Antrean & Hasil Audio</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {queue.length} Audio
              </span>
              {folderName && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  📁 {selectedDirectoryName ? `${selectedDirectoryName}/` : ''}{folderName}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {readyCount} dari {queue.length} audio siap diunduh. Download individual atau sekaligus dalam format ZIP.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {readyCount > 0 && (
            <button
              id="download-all-zip-btn"
              onClick={onDownloadAllZip}
              disabled={isDownloadingZip}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition flex items-center gap-1.5"
              title="Download semua audio yang telah selesai diproses dalam 1 file ZIP"
            >
              <Archive className="w-4 h-4" />
              <span>{isDownloadingZip ? 'Membuat ZIP...' : `Download Sekaligus (${readyCount} File ZIP)`}</span>
            </button>
          )}

          <button
            id="clear-all-queue-btn"
            onClick={onClearAll}
            disabled={processingCount > 0}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-900/40 transition flex items-center gap-1.5"
            title="Kosongkan seluruh antrean"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Kosongkan Antrean</span>
          </button>
        </div>
      </div>

      {/* Queue Items Cards */}
      <div className="space-y-3 mt-4">
        {queue.map((item, index) => {
          const isPlayingOriginal = activePlayingId === item.id && activePlayingType === 'original';
          const isPlayingProcessed = activePlayingId === item.id && activePlayingType === 'processed';
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              id={`queue-item-${item.id}`}
              className={`rounded-xl border transition-all overflow-hidden ${
                item.status === 'ready'
                  ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  : item.status === 'processing'
                  ? 'bg-red-950/20 border-red-900/40 ring-1 ring-red-500/30'
                  : item.status === 'error'
                  ? 'bg-rose-950/20 border-rose-900/40'
                  : 'bg-slate-950/40 border-slate-800'
              }`}
            >
              {/* Card Primary Bar */}
              <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                {/* Left: Thumbnail, Name & Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-400 shrink-0 border border-slate-700">
                    {index + 1}
                  </div>

                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-10 object-cover rounded-md border border-slate-800 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-10 rounded-md bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
                      <FileAudio className="w-5 h-5 text-red-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-white truncate max-w-md" title={item.originalFileName}>
                        {item.title || item.originalFileName}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        item.source === 'youtube'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {item.source === 'youtube' ? 'YouTube' : 'Upload'}
                      </span>
                    </div>

                    {/* Output Name Information */}
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/30">
                        Output: {item.outputFileName}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatDuration(item.duration)}
                        {item.processedDuration ? (
                          <strong className="text-red-300"> → {formatDuration(item.processedDuration)}</strong>
                        ) : null}
                      </span>
                      {item.fileSize > 0 && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <HardDrive className="w-3 h-3 text-slate-500" />
                          {formatFileSize(item.fileSize)}
                        </span>
                      )}
                    </div>

                    {/* Applied Parameters Badge */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase font-mono">
                        {item.settings.outputFormat || 'ogg'} {item.processedSize ? `(${formatFileSize(item.processedSize)})` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 font-mono">
                        Speed: {item.settings.speedUp}x (Roblox: {item.settings.robloxPlaybackSpeed})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                        Amplify: {item.settings.amplifyDb > 0 ? `+${item.settings.amplifyDb}` : item.settings.amplifyDb} dB
                      </span>
                      {item.settings.reverbType !== 'none' && (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                          Reverb: {item.settings.reverbType} ({Math.round(item.settings.reverbMix * 100)}%)
                        </span>
                      )}
                      {(item.settings.fadeInEnabled || item.settings.fadeOutEnabled) && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                          Fade: {item.settings.fadeInEnabled ? `In ${item.settings.fadeInDuration}s` : ''}
                          {item.settings.fadeInEnabled && item.settings.fadeOutEnabled ? ' / ' : ''}
                          {item.settings.fadeOutEnabled ? `Out ${item.settings.fadeOutDuration}s` : ''}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {item.settings.pitchMode === 'resample' ? 'Roblox Resample' : 'Time-Stretch'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Status & Actions */}
                <div className="flex items-center gap-2 self-stretch md:self-center justify-between md:justify-end shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                  {/* Status Indicator */}
                  <div className="text-right">
                    {item.status === 'ready' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selesai</span>
                      </span>
                    )}

                    {item.status === 'processing' && (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                          <span>Memproses ({item.progress}%)</span>
                        </span>
                      </div>
                    )}

                    {item.status === 'decoding' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span>Decoding...</span>
                      </span>
                    )}

                    {item.status === 'idle' && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                        <span>Menunggu</span>
                      </span>
                    )}

                    {item.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20" title={item.errorMessage}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Gagal</span>
                      </span>
                    )}
                  </div>

                  {/* Audio Preview Buttons */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {/* Play Original */}
                    <button
                      onClick={() => onTogglePlay(item.id, 'original')}
                      disabled={!item.originalBuffer && !item.originalUrl}
                      className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
                        isPlayingOriginal
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title="Putar Audio Asli"
                    >
                      {isPlayingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span className="text-[10px] hidden sm:inline">Asli</span>
                    </button>

                    {/* Play Processed */}
                    <button
                      onClick={() => onTogglePlay(item.id, 'processed')}
                      disabled={item.status !== 'ready'}
                      className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
                        isPlayingProcessed
                          ? 'bg-red-600 text-white font-semibold'
                          : item.status === 'ready'
                          ? 'text-red-400 hover:text-white hover:bg-slate-800'
                          : 'text-slate-600 cursor-not-allowed'
                      }`}
                      title="Putar Audio Hasil Proses"
                    >
                      {isPlayingProcessed ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span className="text-[10px] hidden sm:inline">Hasil</span>
                    </button>
                  </div>

                  {/* Process or Re-process */}
                  <button
                    onClick={() => onProcessItem(item.id)}
                    disabled={item.status === 'processing' || item.status === 'decoding'}
                    className="p-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 disabled:opacity-50 transition"
                    title={item.status === 'ready' ? 'Proses Ulang' : 'Proses Audio Ini'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Individual Download */}
                  {item.status === 'ready' && (
                    <div className="flex items-center gap-1">
                      <button
                        id={`download-item-btn-${item.id}`}
                        onClick={() => onDownloadItem(item, item.settings.outputFormat || 'ogg')}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                        title={`Download audio format ${(item.settings.outputFormat || 'ogg').toUpperCase()}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download ({(item.settings.outputFormat || 'ogg').toUpperCase()})</span>
                      </button>

                      {/* Secondary download option for the other format */}
                      <button
                        onClick={() =>
                          onDownloadItem(
                            item,
                            item.settings.outputFormat === 'ogg' ? 'wav' : 'ogg'
                          )
                        }
                        className="px-2 py-1.5 rounded-xl text-[11px] font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
                        title={`Download versi alternatif (${item.settings.outputFormat === 'ogg' ? 'WAV' : 'OGG'})`}
                      >
                        {item.settings.outputFormat === 'ogg' ? 'WAV' : 'OGG'}
                      </button>
                    </div>
                  )}

                  {/* Expand Settings toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="p-2 rounded-xl text-xs bg-slate-850 hover:bg-slate-800 text-slate-400 border border-slate-750 transition"
                    title="Pengaturan Khusus Item Ini"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Sliders className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete Item */}
                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-2 rounded-xl text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                    title="Hapus dari antrean"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expandable Per-item Setting Panel */}
              {isExpanded && onUpdateItemSettings && (
                <div className="p-4 border-t border-slate-850 bg-slate-900/90 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Sesuaikan Parameter Khusus Audio Ini:</span>
                    <span className="text-[11px] text-slate-400">
                      Perubahan hanya memengaruhi audio ini. Klik 'Proses Ulang' setelah mengubah.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Format */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Format Output:</span>
                        <span className="font-mono text-emerald-300 font-bold uppercase">
                          {item.settings.outputFormat || 'ogg'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItemSettings(item.id, {
                              ...item.settings,
                              outputFormat: 'ogg',
                            })
                          }
                          className={`py-1 px-1.5 rounded text-[11px] font-semibold transition ${
                            item.settings.outputFormat === 'ogg'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          OGG (Ringan)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItemSettings(item.id, {
                              ...item.settings,
                              outputFormat: 'wav',
                            })
                          }
                          className={`py-1 px-1.5 rounded text-[11px] font-semibold transition ${
                            item.settings.outputFormat === 'wav'
                              ? 'bg-blue-600 text-white shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          WAV (Besar)
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {item.settings.outputFormat === 'ogg'
                          ? 'Cocok untuk Roblox (hemat kuota & lolos batas 20MB).'
                          : 'Format PCM murni tanpa kompresi.'}
                      </div>
                    </div>

                    {/* Speed */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Speed-Up:</span>
                        <span className="font-mono text-red-300 font-bold">{item.settings.speedUp}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.25"
                        max="10"
                        step="0.05"
                        value={item.settings.speedUp}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          onUpdateItemSettings(item.id, {
                            ...item.settings,
                            speedUp: val,
                            robloxPlaybackSpeed: parseFloat((1 / val).toFixed(4)),
                          });
                        }}
                        className="w-full accent-red-500"
                      />
                      <div className="text-[10px] text-slate-400 mt-1">
                        Roblox PlaybackSpeed: <b className="text-red-300 font-mono">{item.settings.robloxPlaybackSpeed}</b>
                      </div>
                    </div>

                    {/* Amplify */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Amplify (dB):</span>
                        <span className="font-mono text-emerald-300 font-bold">
                          {item.settings.amplifyDb > 0 ? `+${item.settings.amplifyDb}` : item.settings.amplifyDb} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-18"
                        max="18"
                        step="1"
                        value={item.settings.amplifyDb}
                        onChange={(e) => {
                          onUpdateItemSettings(item.id, {
                            ...item.settings,
                            amplifyDb: parseInt(e.target.value, 10),
                          });
                        }}
                        className="w-full accent-emerald-500"
                      />
                    </div>

                    {/* Reverb */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Reverb:</span>
                        <select
                          value={item.settings.reverbType}
                          onChange={(e) => {
                            onUpdateItemSettings(item.id, {
                              ...item.settings,
                              reverbType: e.target.value as any,
                              reverbMix: e.target.value === 'none' ? 0 : (item.settings.reverbMix || 0.25),
                            });
                          }}
                          className="bg-slate-800 border border-slate-700 text-cyan-300 rounded px-1.5 py-0.5 text-xs"
                        >
                          <option value="none">Off (None)</option>
                          <option value="room">Room</option>
                          <option value="hall">Hall</option>
                          <option value="cathedral">Cathedral</option>
                          <option value="space">Space</option>
                        </select>
                      </div>
                      {item.settings.reverbType !== 'none' && (
                        <div className="mt-2">
                          <span className="text-[10px] text-slate-400">Wet Mix: {Math.round(item.settings.reverbMix * 100)}%</span>
                          <input
                            type="range"
                            min="0.05"
                            max="0.8"
                            step="0.05"
                            value={item.settings.reverbMix}
                            onChange={(e) => {
                              onUpdateItemSettings(item.id, {
                                ...item.settings,
                                reverbMix: parseFloat(e.target.value),
                              });
                            }}
                            className="w-full accent-cyan-400"
                          />
                        </div>
                      )}
                    </div>

                    {/* Fade In & Out per-item */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 md:col-span-2 lg:col-span-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-slate-300 font-semibold text-xs">Transisi Fade In & Out:</span>
                        <span className="text-[10px] text-slate-500">Sesuaikan durasi fade khusus untuk item ini</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                        {/* Fade In */}
                        <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`fade-in-${item.id}`}
                              checked={item.settings.fadeInEnabled}
                              onChange={(e) => {
                                onUpdateItemSettings(item.id, {
                                  ...item.settings,
                                  fadeInEnabled: e.target.checked,
                                });
                              }}
                              className="rounded accent-indigo-500 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor={`fade-in-${item.id}`} className="text-xs text-indigo-200 cursor-pointer font-medium">
                              Fade In
                            </label>
                          </div>

                          {item.settings.fadeInEnabled && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min="0.2"
                                max="10.0"
                                step="0.2"
                                value={item.settings.fadeInDuration}
                                onChange={(e) => {
                                  onUpdateItemSettings(item.id, {
                                    ...item.settings,
                                    fadeInDuration: parseFloat(e.target.value),
                                  });
                                }}
                                className="w-20 accent-indigo-400"
                              />
                              <span className="text-[10px] font-mono text-indigo-300 min-w-[28px]">{item.settings.fadeInDuration}s</span>
                            </div>
                          )}
                        </div>

                        {/* Fade Out */}
                        <div className="flex items-center justify-between gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`fade-out-${item.id}`}
                              checked={item.settings.fadeOutEnabled}
                              onChange={(e) => {
                                onUpdateItemSettings(item.id, {
                                  ...item.settings,
                                  fadeOutEnabled: e.target.checked,
                                });
                              }}
                              className="rounded accent-purple-500 cursor-pointer w-4 h-4"
                            />
                            <label htmlFor={`fade-out-${item.id}`} className="text-xs text-purple-200 cursor-pointer font-medium">
                              Fade Out
                            </label>
                          </div>

                          {item.settings.fadeOutEnabled && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="range"
                                min="0.5"
                                max="15.0"
                                step="0.5"
                                value={item.settings.fadeOutDuration}
                                onChange={(e) => {
                                  onUpdateItemSettings(item.id, {
                                    ...item.settings,
                                    fadeOutDuration: parseFloat(e.target.value),
                                  });
                                }}
                                className="w-20 accent-purple-400"
                              />
                              <span className="text-[10px] font-mono text-purple-300 min-w-[28px]">{item.settings.fadeOutDuration}s</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => onProcessItem(item.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Terapkan & Proses Ulang Sekarang</span>
                    </button>
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
