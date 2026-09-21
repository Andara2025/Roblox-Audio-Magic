import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  X,
  Music,
  FileText,
  AlertCircle,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Clock,
  UploadCloud,
  Check,
} from 'lucide-react';
import {
  ParsedTrack,
  parseTimestampsFromText,
  sliceAudioBuffer,
  secondsToTimeString,
} from '../utils/timestampParser';
import {
  decodeAudioFile,
  audioBufferToWav,
  formatDuration,
  getAudioContext,
} from '../utils/audioEngine';

export interface SlicedTrackResult {
  title: string;
  blob: Blob;
  buffer: AudioBuffer;
  duration: number;
  originalFileName: string;
}

interface TimestampSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  localFile?: File | null;
  onTracksSplitted: (results: SlicedTrackResult[]) => void;
}

export const TimestampSplitModal: React.FC<TimestampSplitModalProps> = ({
  isOpen,
  onClose,
  localFile: initialLocalFile,
  onTracksSplitted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(initialLocalFile || null);
  const [activeTab, setActiveTab] = useState<'text' | 'list'>('text');
  const [rawText, setRawText] = useState('');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [totalMediaDuration, setTotalMediaDuration] = useState<number>(0);
  const [isDecodingAudio, setIsDecodingAudio] = useState(false);
  const [isSlicing, setIsSlicing] = useState(false);
  const [sliceProgress, setSliceProgress] = useState({ current: 0, total: 0, name: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (initialLocalFile) {
      setSelectedFile(initialLocalFile);
    }
  }, [initialLocalFile]);

  // Decode audio file when selectedFile changes
  useEffect(() => {
    let isCancelled = false;

    if (!selectedFile) {
      decodedBufferRef.current = null;
      setTotalMediaDuration(0);
      return;
    }

    const decodeFile = async () => {
      setIsDecodingAudio(true);
      setErrorMessage(null);
      try {
        const buffer = await decodeAudioFile(selectedFile);
        if (!isCancelled) {
          decodedBufferRef.current = buffer;
          setTotalMediaDuration(buffer.duration);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Gagal membaca file audio:', err);
          setErrorMessage('Gagal mendecode file audio: ' + (err.message || 'Format tidak didukung'));
        }
      } finally {
        if (!isCancelled) {
          setIsDecodingAudio(false);
        }
      }
    };

    decodeFile();

    return () => {
      isCancelled = true;
    };
  }, [selectedFile]);

  // Re-parse timestamps whenever rawText or totalMediaDuration changes
  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseTimestampsFromText(rawText, totalMediaDuration);
      setTracks(parsed);
      if (parsed.length > 0 && activeTab === 'text') {
        // Auto-switch to list tab if valid tracks are detected
      }
    } else {
      setTracks([]);
    }
  }, [rawText, totalMediaDuration]);

  if (!isOpen) return null;

  const handleLoadSample = () => {
    const sample = `00:00 Intro & Theme
01:30 Electronic Pulse
03:45 Nightfall Melody
06:20 Cyber Neon Drive
08:15 Outro Credits`;
    setRawText(sample);
    setActiveTab('list');
  };

  const handleToggleTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setTracks((prev) => prev.map((t) => ({ ...t, selected: select })));
  };

  const selectedTracks = tracks.filter((t) => t.selected);

  const handleProcessSplits = async () => {
    if (!selectedFile) {
      setErrorMessage('Pilih file audio terlebih dahulu.');
      return;
    }

    if (selectedTracks.length === 0) {
      setErrorMessage('Pilih minimal 1 track untuk dipotong.');
      return;
    }

    setIsSlicing(true);
    setErrorMessage(null);

    try {
      const audioCtx = getAudioContext();
      let masterBuffer = decodedBufferRef.current;

      if (!masterBuffer) {
        setIsDecodingAudio(true);
        masterBuffer = await decodeAudioFile(selectedFile);
        decodedBufferRef.current = masterBuffer;
        setIsDecodingAudio(false);
      }

      const results: SlicedTrackResult[] = [];
      const total = selectedTracks.length;

      for (let i = 0; i < total; i++) {
        const track = selectedTracks[i];
        setSliceProgress({
          current: i + 1,
          total,
          name: track.title,
        });

        // Small timeout to allow UI refresh
        await new Promise((res) => setTimeout(res, 20));

        const slicedBuffer = sliceAudioBuffer(
          masterBuffer,
          track.startTime,
          track.endTime,
          audioCtx
        );

        const wavBlob = audioBufferToWav(slicedBuffer);

        results.push({
          title: track.title,
          blob: wavBlob,
          buffer: slicedBuffer,
          duration: slicedBuffer.duration,
          originalFileName: `${track.title}.wav`,
        });
      }

      onTracksSplitted(results);
      onClose();
    } catch (err: any) {
      console.error('Error slicing audio:', err);
      setErrorMessage('Gagal memotong audio: ' + (err.message || 'Terjadi kesalahan sistem'));
    } finally {
      setIsSlicing(false);
    }
  };

  return (
    <div
      id="timestamp-split-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Split Audio Berdasarkan Timestamp</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Local In-Browser
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Potong kompilasi lagu, mix, atau album panjang menjadi track individu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSlicing}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95 disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* File Picker Zone */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                <Music className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">
                  {selectedFile ? selectedFile.name : 'Belum ada file audio yang dipilih'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                  {isDecodingAudio ? (
                    <span className="text-amber-400 animate-pulse">Sedang membaca durasi file...</span>
                  ) : totalMediaDuration > 0 ? (
                    `Durasi: ${formatDuration(totalMediaDuration)} • Ukuran: ${(
                      (selectedFile?.size || 0) /
                      (1024 * 1024)
                    ).toFixed(1)} MB`
                  ) : (
                    'Pilih file kompilasi / album audio dari komputer Anda'
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSlicing}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition shrink-0 active:scale-95"
            >
              {selectedFile ? 'Ganti File' : 'Pilih File Audio'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.weba"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'text'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Format Teks Timestamp</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'list'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Daftar Lagu ({tracks.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadSample}
              className="text-[11px] text-amber-400 hover:text-amber-300 transition flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3 h-3" />
              <span>Contoh Format</span>
            </button>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tab 1: Textarea Timestamp Input */}
          {activeTab === 'text' && (
            <div className="space-y-2">
              <label
                htmlFor="timestamp-textarea"
                className="text-xs font-semibold text-zinc-300 flex items-center justify-between"
              >
                <span>Tempel Daftar Timestamp:</span>
                <span className="text-[11px] text-zinc-500">Mendukung format [00:00] Judul atau 00:00 Judul</span>
              </label>
              <textarea
                id="timestamp-textarea"
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`00:00 Intro\n03:15 Song One\n07:42 Song Two\n11:20 Outro`}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl p-3 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <span>
                  Terdeteksi:{' '}
                  <strong className="text-amber-300 font-mono">{tracks.length}</strong> track lagu
                </span>
                {tracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="text-amber-400 hover:underline font-semibold"
                  >
                    Lihat Daftar Hasil ➔
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Tracklist Table */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="hover:text-white flex items-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pilih Semua</span>
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="hover:text-white flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Batal Semua</span>
                  </button>
                </div>
                <span>
                  Dipilih: <strong className="text-white font-mono">{selectedTracks.length}</strong> /{' '}
                  {tracks.length}
                </span>
              </div>

              {tracks.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                  Belum ada timestamp yang dimasukkan.{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('text')}
                    className="text-amber-400 hover:underline font-bold"
                  >
                    Tulis atau tempel timestamp di sini
                  </button>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      onClick={() => handleToggleTrack(t.id)}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition ${
                        t.selected
                          ? 'bg-amber-500/10 border-amber-500/40 text-white'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            t.selected
                              ? 'bg-amber-500 border-amber-500 text-black'
                              : 'border-zinc-700 bg-zinc-800'
                          }`}
                        >
                          {t.selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-mono text-zinc-500 text-[11px] w-5">
                          {(idx + 1).toString().padStart(2, '0')}.
                        </span>
                        <span className="font-semibold text-white truncate">{t.title}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-zinc-400">
                        <span>
                          {t.startTimeFormatted} - {t.endTimeFormatted}
                        </span>
                        <span className="text-amber-300 font-bold">
                          ({formatDuration(t.duration)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Slicing Progress Animation */}
          {isSlicing && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-amber-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Memotong ({sliceProgress.current} / {sliceProgress.total}): {sliceProgress.name}
                  </span>
                </span>
                <span className="font-mono text-zinc-400">
                  {Math.round((sliceProgress.current / sliceProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-150"
                  style={{
                    width: `${Math.round((sliceProgress.current / sliceProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSlicing}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
          >
            Batal
          </button>

          <button
            type="button"
            id="start-slicing-btn"
            onClick={handleProcessSplits}
            disabled={isSlicing || selectedTracks.length === 0 || !selectedFile}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 shadow-lg shadow-amber-500/20 disabled:opacity-40 transition flex items-center gap-2 active:scale-95"
          >
            <Scissors className="w-4 h-4 fill-current" />
            <span>
              {isSlicing
                ? 'Sedang Memotong Audio...'
                : `Potong & Masukkan ke Antrean (${selectedTracks.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
