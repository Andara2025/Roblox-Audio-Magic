import React, { useState, useRef } from 'react';
import { UploadCloud, Youtube, Music, Loader2, Plus, AlertCircle, FileAudio, Check, Scissors, Sparkles } from 'lucide-react';
import { isValidYouTubeUrl, fetchYouTubeInfo, downloadYouTubeAudio, YouTubeVideoInfo } from '../utils/youtubeService';
import { formatDuration } from '../utils/audioEngine';
import { parseTimestampsFromText } from '../utils/timestampParser';

interface AudioInputSectionProps {
  onFilesSelected: (files: File[]) => void;
  onYouTubeAudioLoaded: (blob: Blob, title: string, duration: number, thumbnail?: string) => void;
  onOpenSplitModal: (options: {
    youtubeInfo?: YouTubeVideoInfo | null;
    youtubeUrl?: string;
    localFile?: File | null;
  }) => void;
  queueCount: number;
}

export const AudioInputSection: React.FC<AudioInputSectionProps> = ({
  onFilesSelected,
  onYouTubeAudioLoaded,
  onOpenSplitModal,
  queueCount,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'youtube'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitFileInputRef = useRef<HTMLInputElement>(null);

  // YouTube state
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytVideoInfo, setYtVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytDownloadedBytes, setYtDownloadedBytes] = useState(0);

  // Detected tracks in current YouTube video
  const detectedTrackCount = ytVideoInfo
    ? ytVideoInfo.chapters && ytVideoInfo.chapters.length > 1
      ? ytVideoInfo.chapters.length
      : parseTimestampsFromText(ytVideoInfo.description || '', ytVideoInfo.duration).length
    : 0;

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
      const audioFiles = Array.from(e.dataTransfer.files).filter(f =>
        f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|weba)$/i.test(f.name)
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

  const handleCheckYouTube = async () => {
    if (!isValidYouTubeUrl(ytUrl)) {
      setYtError('Masukkan URL YouTube yang valid (contoh: https://www.youtube.com/watch?v=...)');
      return;
    }

    setYtLoading(true);
    setYtError(null);
    setYtVideoInfo(null);

    try {
      const info = await fetchYouTubeInfo(ytUrl);
      setYtVideoInfo(info);
    } catch (err: unknown) {
      setYtError((err as Error).message || 'Gagal memuat info YouTube');
    } finally {
      setYtLoading(false);
    }
  };

  const handleDownloadAndQueueYouTube = async () => {
    if (!ytUrl) return;
    setYtDownloading(true);
    setYtError(null);
    setYtDownloadedBytes(0);

    try {
      const { blob, fileName } = await downloadYouTubeAudio(ytUrl, (bytes) => {
        setYtDownloadedBytes(bytes);
      });

      const title = ytVideoInfo ? ytVideoInfo.title : fileName.replace('.mp3', '');
      const duration = ytVideoInfo ? ytVideoInfo.duration : 0;
      const thumb = ytVideoInfo?.thumbnail;

      onYouTubeAudioLoaded(blob, title, duration, thumb);

      // Reset form
      setYtUrl('');
      setYtVideoInfo(null);
    } catch (err: unknown) {
      setYtError((err as Error).message || 'Gagal mengunduh audio YouTube');
    } finally {
      setYtDownloading(false);
    }
  };

  return (
    <div id="audio-input-section" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100">
      {/* Tabs Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-upload-btn"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'upload'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File Audio (Single & Multi Antrean)</span>
          </button>

          <button
            id="tab-youtube-btn"
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'youtube'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            <Youtube className="w-4 h-4 text-white" />
            <span>Convert YouTube ke MP3</span>
          </button>
        </div>

        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-slate-500" />
          <span>Antrean Saat Ini: <strong className="text-white">{queueCount}</strong> audio</span>
        </div>
      </div>

      {/* Tab 1: Local Upload (Drag & Drop) */}
      {activeTab === 'upload' && (
        <div className="mt-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba"
            className="hidden"
            id="audio-file-input"
          />

          <div
            id="dropzone-area"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              isDragging
                ? 'border-red-500 bg-red-500/10'
                : 'border-slate-750 hover:border-red-500/60 bg-slate-950/40 hover:bg-slate-850/40'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3 shadow-inner">
              <UploadCloud className="w-7 h-7" />
            </div>

            <p className="text-sm font-semibold text-white">
              Tarik & Lepas File Audio di Sini, atau <span className="text-red-400 underline decoration-red-400/50">Pilih File</span>
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Mendukung input audio <strong>Single</strong> maupun <strong>Multiple antrean</strong> sekaligus (MP3, WAV, OGG, M4A, FLAC).
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Batch Processing</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Multi Queue</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Lossless Decode</span>
            </div>
          </div>

          {/* Quick tool: Split local long file by timestamp */}
          <input
            type="file"
            ref={splitFileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onOpenSplitModal({ localFile: e.target.files[0] });
                e.target.value = '';
              }
            }}
            accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
            className="hidden"
            id="split-local-audio-input"
          />

          <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Punya file audio kompilasi / DJ mix panjang dari komputer?</span>
            </div>
            <button
              type="button"
              onClick={() => splitFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/40 transition flex items-center gap-1.5 shrink-0"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Split File dengan Timestamp</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: YouTube Converter */}
      {activeTab === 'youtube' && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                id="youtube-url-input"
                type="text"
                value={ytUrl}
                onChange={(e) => {
                  setYtUrl(e.target.value);
                  setYtError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckYouTube()}
                placeholder="Paste link YouTube (contoh: https://www.youtube.com/watch?v=... atau youtu.be/...)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 pl-10"
              />
              <Youtube className="w-4 h-4 text-red-500 absolute left-3.5 top-3" />
            </div>

            <button
              id="check-youtube-btn"
              onClick={handleCheckYouTube}
              disabled={ytLoading || !ytUrl.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5 min-w-[120px]"
            >
              {ytLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{ytLoading ? 'Memeriksa...' : 'Cek Video'}</span>
            </button>
          </div>

          {ytError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{ytError}</span>
            </div>
          )}

          {/* YouTube Video Preview Card */}
          {ytVideoInfo && (
            <div id="youtube-preview-card" className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {ytVideoInfo.thumbnail ? (
                  <img
                    src={ytVideoInfo.thumbnail}
                    alt={ytVideoInfo.title}
                    className="w-20 h-14 object-cover rounded-lg border border-slate-800"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-20 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                    <FileAudio className="w-6 h-6" />
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-white line-clamp-1">{ytVideoInfo.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ytVideoInfo.author} • Durasi: {formatDuration(ytVideoInfo.duration)}
                  </p>
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    Siap Dikonversi ke MP3 & Antrean
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {detectedTrackCount > 1 && (
                  <button
                    type="button"
                    onClick={() => onOpenSplitModal({ youtubeInfo: ytVideoInfo, youtubeUrl: ytUrl })}
                    disabled={ytDownloading}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Split {detectedTrackCount} Lagu</span>
                  </button>
                )}

                <button
                  id="download-and-queue-yt-btn"
                  onClick={handleDownloadAndQueueYouTube}
                  disabled={ytDownloading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {ytDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        Mengunduh... {ytDownloadedBytes > 0 ? `(${(ytDownloadedBytes / (1024 * 1024)).toFixed(1)} MB)` : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{detectedTrackCount > 1 ? 'Unduh Utuh (1 File)' : 'Konversi & Masukkan Antrean'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Banner notification if playlist/timestamps detected */}
          {ytVideoInfo && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-950/40 via-amber-950/25 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>Fitur Split Playlist / Timestamp</span>
                    {detectedTrackCount > 1 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                        {detectedTrackCount} Lagu Terdeteksi
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                        Input Timestamp
                      </span>
                    )}
                  </h5>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {detectedTrackCount > 1
                      ? `Video ini memiliki ${detectedTrackCount} lagu dengan timestamp. Klik tombol di kanan untuk memecah audio jadi lagu individual secara otomatis!`
                      : 'Punya daftar timestamp untuk video ini? Tempel daftar timestamp untuk memecahnya otomatis jadi lagu individual.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenSplitModal({ youtubeInfo: ytVideoInfo, youtubeUrl: ytUrl })}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{detectedTrackCount > 1 ? `Buka Splitter (${detectedTrackCount} Lagu)` : 'Buka Splitter Timestamp'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
