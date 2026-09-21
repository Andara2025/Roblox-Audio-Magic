import React, { useState, useEffect } from 'react';
import {
  Scissors,
  X,
  Play,
  Check,
  Music,
  ListMusic,
  FileText,
  AlertCircle,
  Loader2,
  Download,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Youtube,
  Clock
} from 'lucide-react';
import { YouTubeVideoInfo, downloadYouTubeAudio } from '../utils/youtubeService';
import {
  ParsedTrack,
  parseTimestampsFromText,
  sliceAudioBuffer,
  secondsToTimeString
} from '../utils/timestampParser';
import { decodeAudioFile, audioBufferToWav, formatDuration, getAudioContext } from '../utils/audioEngine';

export interface SlicedTrackResult {
  title: string;
  blob: Blob;
  buffer: AudioBuffer;
  duration: number;
  originalFileName: string;
  thumbnail?: string;
}

interface TimestampSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If invoked from YouTube
  youtubeInfo?: YouTubeVideoInfo | null;
  youtubeUrl?: string;
  // If invoked from local file
  localFile?: File | null;
  onTracksSplitted: (results: SlicedTrackResult[]) => void;
}

export const TimestampSplitModal: React.FC<TimestampSplitModalProps> = ({
  isOpen,
  onClose,
  youtubeInfo,
  youtubeUrl,
  localFile,
  onTracksSplitted,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'text'>('list');
  const [rawText, setRawText] = useState('');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [totalMediaDuration, setTotalMediaDuration] = useState<number>(0);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize timestamps from YouTube info or chapters
  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setErrorMsg(null);
      return;
    }

    let initialDuration = 0;
    let initialText = '';

    if (youtubeInfo) {
      initialDuration = youtubeInfo.duration || 0;
      setTotalMediaDuration(initialDuration);

      // Check if chapters exist
      if (youtubeInfo.chapters && youtubeInfo.chapters.length > 0) {
        initialText = youtubeInfo.chapters
          .map((ch) => `${secondsToTimeString(ch.start_time)} ${ch.title}`)
          .join('\n');
      } else if (youtubeInfo.description) {
        initialText = youtubeInfo.description;
      }
    } else if (localFile) {
      // For local files, we can estimate duration once decoded or default to 0
      initialDuration = 0;
      setTotalMediaDuration(0);
    }

    setRawText(initialText);
    const parsed = parseTimestampsFromText(initialText, initialDuration);
    setTracks(parsed);
    if (parsed.length === 0 && initialText.trim()) {
      setActiveTab('text');
    } else {
      setActiveTab('list');
    }
  }, [isOpen, youtubeInfo, localFile]);

  // Handle re-parsing when text changes
  const handleApplyText = () => {
    const parsed = parseTimestampsFromText(rawText, totalMediaDuration);
    setTracks(parsed);
    if (parsed.length > 0) {
      setActiveTab('list');
      setErrorMsg(null);
    } else {
      setErrorMsg('Tidak ditemukan format timestamp yang valid. Contoh: 00:02:08 Judul Lagu');
    }
  };

  // Toggle selection
  const handleToggleTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setTracks((prev) => prev.map((t) => ({ ...t, selected: select })));
  };

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
  };

  const selectedCount = tracks.filter((t) => t.selected).length;

  // Execute the split process
  const handleStartSplit = async () => {
    const tracksToProcess = tracks.filter((t) => t.selected);
    if (tracksToProcess.length === 0) {
      setErrorMsg('Pilih minimal 1 lagu untuk di-split.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPercent(5);

    try {
      let masterBlob: Blob | null = null;
      let masterBuffer: AudioBuffer | null = null;
      const audioCtx = getAudioContext();

      // Step 1: Obtain Audio Blob
      if (youtubeUrl) {
        setProgressStage('Mengunduh audio YouTube master...');
        const { blob } = await downloadYouTubeAudio(youtubeUrl, (bytes) => {
          const mb = (bytes / (1024 * 1024)).toFixed(1);
          setProgressStage(`Mengunduh audio YouTube (${mb} MB)...`);
        });
        masterBlob = blob;
      } else if (localFile) {
        masterBlob = localFile;
      }

      if (!masterBlob) {
        throw new Error('Sumber audio tidak ditemukan');
      }

      // Step 2: Decode Master Audio
      setProgressPercent(35);
      setProgressStage('Mendekode master audio ke format PCM...');
      const decodedBuffer: AudioBuffer = await decodeAudioFile(masterBlob);
      masterBuffer = decodedBuffer;
      const actualDuration = decodedBuffer.duration;
      setTotalMediaDuration(actualDuration);

      // Recalculate last track end time if needed
      const lastIndex = tracksToProcess.length - 1;
      if (tracksToProcess[lastIndex].endTime > actualDuration) {
        tracksToProcess[lastIndex].endTime = actualDuration;
        tracksToProcess[lastIndex].duration = Math.max(0, actualDuration - tracksToProcess[lastIndex].startTime);
      }

      // Step 3: Slice each track
      const slicedResults: SlicedTrackResult[] = [];
      const totalToSlice = tracksToProcess.length;

      for (let i = 0; i < totalToSlice; i++) {
        const track = tracksToProcess[i];
        const currentNum = i + 1;
        setProgressStage(`Memotong lagu (${currentNum}/${totalToSlice}): ${track.title}`);
        const currentPct = 40 + Math.round((currentNum / totalToSlice) * 55);
        setProgressPercent(currentPct);

        // Ensure start and end bounds
        const startSec = track.startTime;
        const endSec = Math.min(track.endTime, actualDuration);
        const duration = Math.max(0.1, endSec - startSec);

        // Slice AudioBuffer in memory
        const slicedBuf = sliceAudioBuffer(masterBuffer!, startSec, endSec, audioCtx);
        // Encode slice to high quality WAV Blob
        const wavBlob = audioBufferToWav(slicedBuf);

        const safeTitle = track.title.trim() || `Track_${track.trackNumber}`;
        const originalFileName = `${safeTitle.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.wav`;

        slicedResults.push({
          title: safeTitle,
          blob: wavBlob,
          buffer: slicedBuf,
          duration,
          originalFileName,
          thumbnail: youtubeInfo?.thumbnail,
        });

        // Small yield to let React render progress bar
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      setProgressPercent(100);
      setProgressStage('Selesai! Memasukkan lagu ke antrean...');

      // Send sliced tracks back to App
      onTracksSplitted(slicedResults);
      onClose();
    } catch (err: any) {
      console.error('Splitting error:', err);
      setErrorMsg(err.message || 'Gagal memecah audio');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="timestamp-split-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="timestamp-split-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600/15 text-red-400 border border-red-500/30">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Split Audio Otomatis Berdasarkan Timestamp</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  {tracks.length} Lagu Terdeteksi
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pecah playlist / DJ mix / kompilasi YouTube menjadi lagu-lagu individual siap Roblox
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Banner */}
        <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {youtubeInfo?.thumbnail ? (
              <img
                src={youtubeInfo.thumbnail}
                alt="Thumbnail"
                className="w-14 h-10 object-cover rounded-lg border border-slate-800 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <Music className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">
                {youtubeInfo?.title || localFile?.name || 'Audio Kompilasi'}
              </h4>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                {youtubeInfo?.author && <span>{youtubeInfo.author} •</span>}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Total Durasi: {formatDuration(totalMediaDuration || youtubeInfo?.duration || 0)}
                </span>
              </p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'list'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Daftar Lagu ({tracks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'text'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Edit / Tempel Teks Timestamp</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tab 1: Tracks List */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              {tracks.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/30">
                  <Scissors className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-slate-300">Belum Ada Timestamp yang Terdeteksi</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Video ini mungkin tidak mencantumkan timestamp di deskripsi. Anda dapat menempelkan daftar timestamp Anda di tab <strong>Edit / Tempel Teks Timestamp</strong>.
                  </p>
                  <button
                    onClick={() => setActiveTab('text')}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    Tempel Timestamp Manual
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectAll(true)}
                        className="text-slate-400 hover:text-white transition flex items-center gap-1"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Pilih Semua</span>
                      </button>
                      <span className="text-slate-600">•</span>
                      <button
                        onClick={() => handleSelectAll(false)}
                        className="text-slate-400 hover:text-white transition flex items-center gap-1"
                      >
                        <Square className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kosongkan</span>
                      </button>
                    </div>

                    <span className="text-slate-400 font-mono text-[11px]">
                      Terpilih: <strong className="text-emerald-400">{selectedCount}</strong> dari {tracks.length} lagu
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {tracks.map((track) => (
                      <div
                        key={track.id}
                        className={`p-2.5 rounded-xl border transition flex items-center gap-3 ${
                          track.selected
                            ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            : 'bg-slate-950/30 border-slate-900 opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={track.selected}
                          onChange={() => handleToggleTrack(track.id)}
                          className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                        />

                        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-slate-300 shrink-0">
                          {track.trackNumber}
                        </div>

                        {/* Editable Title */}
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={track.title}
                            onChange={(e) => handleUpdateTitle(track.id, e.target.value)}
                            placeholder={`Track ${track.trackNumber}`}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-red-500 text-xs font-semibold text-white px-1 py-0.5 focus:outline-none font-sans truncate"
                          />
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                            <span>Mulai: {track.startTimeFormatted}</span>
                            <span>•</span>
                            <span>Selesai: {track.endTimeFormatted}</span>
                          </div>
                        </div>

                        {/* Duration Pill */}
                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {formatDuration(track.duration)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Raw Timestamp Text Area */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-red-400" />
                  <span>Daftar Teks Timestamp (Satu lagu per baris)</span>
                </label>
                <span className="text-[10px] text-slate-500">Mendukung format HH:MM:SS atau MM:SS</span>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`00:00:00 Still Into You (WENNAZ 'HIPDUT' Edit)\n00:02:08 One Time (WENNAZ 'HIPDUT' Edit)\n00:04:31 Bloodline (WENNAZ 'HIPDUT' Edit)\n00:07:01 Kehlani - Out The Window (NGHTYBOY 'HIPDUT' Again Edit)...`}
                rows={12}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-[11px] text-slate-400">
                  Format otomatis mendeteksi tanda kurung <code className="text-slate-300 font-mono">[02:08]</code>, strip <code className="text-slate-300 font-mono">02:08 - Judul</code>, atau nomor urut.
                </div>

                <button
                  type="button"
                  onClick={handleApplyText}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Terapkan & Parse Timestamp</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar (when splitting) */}
        {isProcessing && (
          <div className="px-5 py-3 bg-slate-950 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
              <span className="text-red-300 font-medium flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                <span>{progressStage}</span>
              </span>
              <span className="font-mono text-slate-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartSplit}
              disabled={isProcessing || selectedCount === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 disabled:opacity-50 transition flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sedang Memecah Audio...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>Pecah ({selectedCount} Lagu) & Masukkan ke Antrean</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
