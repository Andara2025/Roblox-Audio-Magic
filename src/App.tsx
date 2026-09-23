import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  AudioSettings,
  FolderConfig,
  QueueItem,
  RobloxSpeedPreset,
} from './types';
import {
  decodeAudioFile,
  processAudio,
  generateOutputName,
  convertWavToOgg,
} from './utils/audioEngine';
import { RobloxFormulaCard } from './components/RobloxFormulaCard';
import { AudioInputSection } from './components/AudioInputSection';
import { GlobalControls } from './components/GlobalControls';
import { FolderAndNamingSettings } from './components/FolderAndNamingSettings';
import { QueueList } from './components/QueueList';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { LivePreviewPlayer } from './components/LivePreviewPlayer';
import { TimestampSplitModal, SlicedTrackResult } from './components/TimestampSplitModal';
import {
  Headphones,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Zap,
  Activity,
  ShieldCheck,
} from 'lucide-react';

const DEFAULT_SETTINGS: AudioSettings = {
  speedUp: 2.326,
  robloxPlaybackSpeed: 0.43,
  outputFormat: 'ogg', // Default: OGG Vorbis (~90% lebih ringan, lolos batas 20MB Roblox)
  oggQuality: 7, // Standar Emas Roblox 224 kbps (Jernih kristal, bebas kompresi cempreng, ukuran hanya ~2.5 - 4MB, 100% lolos batas 20MB Roblox)
  pitchMode: 'resample',
  amplifyDb: 0,
  preserveQuality: true,
  reverbType: 'none',
  reverbMix: 0.25,
  reverbDecay: 1.8,
  fadeInEnabled: false,
  fadeInDuration: 2.0,
  fadeOutEnabled: false,
  fadeOutDuration: 3.0,
  remasterProfile: 'none',
  remasterIntensity: 0.7,
  autoFitRobloxLimit: true,
};

export default function App() {
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [folderConfig, setFolderConfig] = useState<FolderConfig>(() => {
    try {
      const saved = localStorage.getItem('audio_manipulator_folder_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      folderName: 'Roblox Audio Output',
      namingStyle: 'clean', // Default: clean, e.g. Artist - Song.ogg (no underscores or weird symbols)
      includeEffectsInName: false,
      customPrefix: '',
    };
  });
  const [selectedDirectoryHandle, setSelectedDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Timestamp Splitting Modal State
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitLocalFile, setSplitLocalFile] = useState<File | null>(null);

  // Audio Player State
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [activePlayingType, setActivePlayingType] = useState<'original' | 'processed' | null>(null);
  const [showFormulaExplainer, setShowFormulaExplainer] = useState(true);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Master settings update that automatically synchronizes to queue items
  const handleUpdateMasterSettings = (
    newSettingsOrFn: AudioSettings | ((prev: AudioSettings) => AudioSettings)
  ) => {
    setSettings((prev) => {
      const nextSettings =
        typeof newSettingsOrFn === 'function' ? newSettingsOrFn(prev) : newSettingsOrFn;

      // Automatically sync all queue items that do NOT have individual custom overrides
      setQueue((prevQueue) =>
        prevQueue.map((item) => {
          if (item.hasCustomSettings) return item;
          return {
            ...item,
            settings: { ...nextSettings },
            outputFileName: generateOutputName(
              item.originalFileName,
              nextSettings,
              nextSettings.outputFormat,
              folderConfig
            ),
            needsReProcess: item.status === 'ready',
          };
        })
      );

      return nextSettings;
    });
  };

  // Update folder configuration and refresh queue item names
  const handleUpdateFolderConfig = (newConfig: FolderConfig) => {
    setFolderConfig(newConfig);
    try {
      localStorage.setItem('audio_manipulator_folder_config', JSON.stringify(newConfig));
    } catch {
      // ignore
    }
    // Update existing items in queue with the new clean name format
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        outputFileName: generateOutputName(
          item.originalFileName,
          item.settings,
          item.settings.outputFormat,
          newConfig
        ),
      }))
    );
  };

  // Select computer folder via modern File System Access API
  const handleSelectDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        setSelectedDirectoryHandle(handle);
        showNotification(`Folder komputer terhubung: ${handle.name}`, 'success');
      } else {
        showNotification(
          'Browser Anda tidak mendukung pemilihan folder langsung. File akan diunduh dengan struktur folder rapi.',
          'info'
        );
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection error:', err);
        showNotification('Gagal mengakses folder atau izin dibatalkan', 'error');
      }
    }
  };

  // Add files to queue
  const handleFilesSelected = async (files: File[]) => {
    const newItems: QueueItem[] = files.map((file) => {
      const id = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const outputFileName = generateOutputName(file.name, settings, settings.outputFormat, folderConfig);
      return {
        id,
        source: 'upload',
        title: file.name.replace(/\.[^/.]+$/, ''),
        originalFileName: file.name,
        fileSize: file.size,
        duration: 0,
        status: 'decoding',
        progress: 0,
        settings: { ...settings },
        originalBlob: file,
        outputFileName,
        createdAt: Date.now(),
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    showNotification(`${files.length} file audio ditambahkan ke antrean`, 'info');

    // Decode each file's audio buffer in background
    for (const item of newItems) {
      try {
        const buffer = await decodeAudioFile(item.originalBlob!);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  originalBuffer: buffer,
                  duration: buffer.duration,
                  status: 'idle',
                  errorMessage: undefined,
                }
              : q
          )
        );
      } catch (err: unknown) {
        console.error('Decode error for', item.originalFileName, err);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'error',
                  errorMessage:
                    (err as Error)?.message ||
                    'Gagal membaca format file audio. Pastikan file tidak rusak.',
                }
              : q
          )
        );
      }
    }
  };

  // Open timestamp split modal
  const handleOpenSplitModal = (options: { localFile?: File | null }) => {
    setSplitLocalFile(options.localFile || null);
    setSplitModalOpen(true);
  };

  // Callback when tracks are sliced via TimestampSplitModal
  const handleTracksSplitted = (results: SlicedTrackResult[]) => {
    if (results.length === 0) return;

    const newItems: QueueItem[] = results.map((res, idx) => {
      const id = `split-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const outputFileName = generateOutputName(
        res.originalFileName,
        settings,
        settings.outputFormat,
        folderConfig
      );

      return {
        id,
        source: 'split',
        title: res.title,
        originalFileName: res.originalFileName,
        fileSize: res.blob.size,
        duration: res.duration,
        status: 'idle', // already decoded buffer in memory!
        progress: 0,
        settings: { ...settings },
        originalBlob: res.blob,
        originalBuffer: res.buffer,
        outputFileName,
        createdAt: Date.now() + idx,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    showNotification(`Berhasil memotong & menambahkan ${results.length} lagu ke antrean!`, 'success');
  };

  // Process a single item
  const processItemById = async (id: string, currentQueue = queue) => {
    const item = currentQueue.find((q) => q.id === id);
    if (!item) return;

    let buffer = item.originalBuffer;
    if (!buffer && item.originalBlob) {
      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'decoding', errorMessage: undefined } : q))
      );
      try {
        const decoded = await decodeAudioFile(item.originalBlob);
        buffer = decoded;
        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? {
                  ...q,
                  originalBuffer: decoded,
                  duration: decoded.duration,
                  errorMessage: undefined,
                }
              : q
          )
        );
      } catch (err: unknown) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status: 'error',
                  errorMessage: (err as Error)?.message || 'Gagal decode audio.',
                }
              : q
          )
        );
        return;
      }
    }

    if (!buffer) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, status: 'error', errorMessage: 'Buffer audio tidak tersedia.' }
            : q
        )
      );
      return;
    }

    // Set status to processing
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: 'processing',
              progress: 10,
              outputFileName: generateOutputName(q.originalFileName, q.settings, q.settings.outputFormat, folderConfig),
            }
          : q
      )
    );

    try {
      const { processedBuffer, wavBlob, oggBlob, mainBlob } = await processAudio(
        buffer,
        item.settings,
        (percent) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === id ? { ...q, progress: percent } : q))
          );
        }
      );

      const processedUrl = URL.createObjectURL(mainBlob);

      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: 'ready',
                progress: 100,
                needsReProcess: false,
                processedBuffer,
                processedBlob: mainBlob,
                wavBlob,
                oggBlob,
                processedSize: mainBlob.size,
                processedUrl,
                processedDuration: processedBuffer.duration,
                outputFileName: generateOutputName(q.originalFileName, q.settings, q.settings.outputFormat, folderConfig),
              }
            : q
        )
      );
    } catch (err: unknown) {
      console.error('Processing error:', err);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: 'error',
                errorMessage: (err as Error).message || 'Gagal memproses audio.',
              }
            : q
        )
      );
    }
  };

  // Process all items in queue sequentially
  const handleProcessAll = async () => {
    if (queue.length === 0 || isProcessingAll) return;
    setIsProcessingAll(true);
    showNotification(`Memulai pemrosesan ${queue.length} audio...`, 'info');

    // Ensure all items without custom settings are synced with latest master settings
    const targetQueue: QueueItem[] = queue.map((item) => ({
      ...item,
      settings: item.hasCustomSettings ? item.settings : { ...settings },
      outputFileName: generateOutputName(
        item.originalFileName,
        item.hasCustomSettings ? item.settings : settings,
        (item.hasCustomSettings ? item.settings : settings).outputFormat,
        folderConfig
      ),
    }));
    setQueue(targetQueue);

    for (const item of targetQueue) {
      await processItemById(item.id, targetQueue);
    }

    setIsProcessingAll(false);
    showNotification('Semua audio di antrean berhasil diproses!', 'success');
  };

  // Apply current global settings to all queue items and re-process them immediately
  const handleApplyToAllQueue = async () => {
    if (queue.length === 0) {
      showNotification('Antrean kosong, tidak ada file untuk diterapkan', 'info');
      return;
    }

    const updatedQueue: QueueItem[] = queue.map((item) => ({
      ...item,
      settings: { ...settings },
      hasCustomSettings: false,
      needsReProcess: false,
      outputFileName: generateOutputName(
        item.originalFileName,
        settings,
        settings.outputFormat,
        folderConfig
      ),
      status: 'idle' as const,
    }));

    setQueue(updatedQueue);
    showNotification(`Menerapkan parameter & memproses ulang ${updatedQueue.length} audio...`, 'info');

    setIsProcessingAll(true);
    for (const item of updatedQueue) {
      await processItemById(item.id, updatedQueue);
    }
    setIsProcessingAll(false);
    showNotification('Semua audio di antrean berhasil diperbarui dan diproses ulang!', 'success');
  };

  // Update a single item's settings (marks it as custom-overridden)
  const handleUpdateItemSettings = (id: string, newSettings: AudioSettings) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              settings: newSettings,
              hasCustomSettings: true,
              needsReProcess: q.status === 'ready',
              outputFileName: generateOutputName(
                q.originalFileName,
                newSettings,
                newSettings.outputFormat,
                folderConfig
              ),
            }
          : q
      )
    );
  };

  // Reset a single item's settings back to master settings
  const handleResetItemSettings = (id: string) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              settings: { ...settings },
              hasCustomSettings: false,
              needsReProcess: q.status === 'ready',
              outputFileName: generateOutputName(
                q.originalFileName,
                settings,
                settings.outputFormat,
                folderConfig
              ),
            }
          : q
      )
    );
    showNotification('Pengaturan track berhasil disinkronkan kembali dengan Master Setting', 'info');
  };

  // Delete item from queue
  const handleDeleteItem = (id: string) => {
    if (activePlayingId === id) {
      setActivePlayingId(null);
      setActivePlayingType(null);
    }
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  // Clear all queue
  const handleClearAll = () => {
    setActivePlayingId(null);
    setActivePlayingType(null);
    setQueue([]);
    showNotification('Seluruh antrean telah dikosongkan', 'info');
  };

  // Download individual processed item with format choice (OGG or WAV)
  const handleDownloadItem = async (item: QueueItem, format?: 'ogg' | 'wav') => {
    if (!item.processedBlob && !item.wavBlob) {
      showNotification('Audio belum selesai diproses', 'error');
      return;
    }

    const targetFormat = format || item.settings.outputFormat || 'ogg';
    let blobToDownload: Blob | undefined = item.processedBlob;

    if (targetFormat === 'ogg') {
      if (item.oggBlob) {
        blobToDownload = item.oggBlob;
      } else if (item.wavBlob) {
        try {
          showNotification('Mengonversi ke OGG Vorbis (Roblox Safe < 20MB)...', 'info');
          const ogg = await convertWavToOgg(
            item.wavBlob,
            item.settings.oggQuality ?? 7,
            item.processedDuration || item.duration,
            item.settings.autoFitRobloxLimit ?? true
          );
          item.oggBlob = ogg;
          blobToDownload = ogg;
        } catch (e) {
          console.warn('Gagal konversi ke OGG:', e);
          showNotification(`Gagal konversi ke OGG: ${(e as Error).message}. File tidak diunduh sebagai WAV untuk mencegah penolakan 20MB Roblox.`, 'error');
          return;
        }
      }
    } else if (targetFormat === 'wav') {
      blobToDownload = item.wavBlob || item.processedBlob;
      if (blobToDownload && blobToDownload.size > 20 * 1024 * 1024) {
        showNotification(`Peringatan: File WAV berukuran ${(blobToDownload.size / (1024 * 1024)).toFixed(1)}MB akan ditolak oleh batas 20MB Roblox! Sebaiknya gunakan format OGG Vorbis.`, 'error');
      }
    }

    if (!blobToDownload) return;

    const fileName = generateOutputName(item.originalFileName, item.settings, targetFormat, folderConfig);

    // If direct directory handle was selected by user
    if (selectedDirectoryHandle) {
      try {
        let targetDir = selectedDirectoryHandle;
        const subfolderName = (folderConfig.folderName || 'Roblox Audio Output').trim();
        if (subfolderName) {
          targetDir = await selectedDirectoryHandle.getDirectoryHandle(subfolderName, { create: true });
        }
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blobToDownload);
        await writable.close();
        showNotification(
          `Tersimpan langsung ke folder "${selectedDirectoryHandle.name}/${subfolderName}/${fileName}"`,
          'success'
        );
        return;
      } catch (err) {
        console.warn('Direct disk save failed, using standard browser download', err);
      }
    }

    const url = URL.createObjectURL(blobToDownload);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showNotification(`Berhasil mengunduh: ${fileName}`, 'success');
  };

  // Download all ready items as a single ZIP archive organized in custom folder
  const handleDownloadAllZip = async () => {
    const readyItems = queue.filter((q) => q.status === 'ready' && q.processedBlob);
    if (readyItems.length === 0) {
      showNotification('Tidak ada file audio yang siap diunduh', 'error');
      return;
    }

    setIsDownloadingZip(true);
    const folderName = (folderConfig.folderName || 'Roblox Audio Output').trim();
    showNotification(
      `Mengompres ${readyItems.length} audio ke dalam folder "${folderName}" di ZIP...`,
      'info'
    );

    try {
      const zip = new JSZip();
      const targetFolder = zip.folder(folderName);

      for (const item of readyItems) {
        const itemFileName = generateOutputName(
          item.originalFileName,
          item.settings,
          item.settings.outputFormat,
          folderConfig
        );
        targetFolder!.file(itemFileName, item.processedBlob!);
      }

      // Add a helpful README text file explaining Roblox formula & settings
      const readmeText = `========================================================
AUDIO MANIPULATOR - HASIL BATCH AUDIO ROBLOX
Folder: ${folderName}
========================================================

Petunjuk Penggunaan di Roblox:
Audio di dalam folder ini telah dipercepat menggunakan rasio Speed-Up.
Untuk mengembalikan suara ke kecepatan & nada normal di dalam game Roblox:

1. Upload file audio ini ke Asset Manager Roblox.
2. Masukkan ke dalam objek Sound di Roblox Studio.
3. Atur properti:
   Sound.PlaybackSpeed = (lihat angka Roblox pada nama file)

Tabel Preset Roblox:
- Speed-up: 2.326x -> Sound.PlaybackSpeed = 0.43
- Speed-up: 2.0x   -> Sound.PlaybackSpeed = 0.50
- Speed-up: 3.0x   -> Sound.PlaybackSpeed = 0.33
- Speed-up: 4.0x   -> Sound.PlaybackSpeed = 0.25
- Speed-up: 5.0x   -> Sound.PlaybackSpeed = 0.20
Formula: PlaybackSpeed = 1 / Speed-Up

Dibuat dengan BindStudio Audio Editor.
`;
      targetFolder!.file('PETUNJUK_ROBLOX.txt', readmeText);

      const content = await zip.generateAsync({ type: 'blob' });
      const zipFileName = `${folderName}_Batch_${Date.now()}.zip`;

      if (selectedDirectoryHandle) {
        try {
          const fileHandle = await selectedDirectoryHandle.getFileHandle(zipFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          showNotification(
            `File ZIP langsung tersimpan di folder: ${selectedDirectoryHandle.name}/${zipFileName}`,
            'success'
          );
          return;
        } catch (err) {
          console.warn('Direct zip save failed, falling back to browser download', err);
        }
      }

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      showNotification(`File ZIP (${folderName}) berhasil diunduh!`, 'success');
    } catch (err: unknown) {
      console.error('ZIP generation error:', err);
      showNotification('Gagal membuat file ZIP', 'error');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Toggle playback
  const handleTogglePlay = (id: string, type: 'original' | 'processed') => {
    if (activePlayingId === id && activePlayingType === type) {
      // Close player
      setActivePlayingId(null);
      setActivePlayingType(null);
    } else {
      setActivePlayingId(id);
      setActivePlayingType(type);
    }
  };

  const activePlayingItem = queue.find((q) => q.id === activePlayingId);
  const readyCount = queue.filter((q) => q.status === 'ready').length;

  return (
    <div className="min-h-screen bg-[#090a10] text-slate-100 flex flex-col font-sans pb-32">
      {/* Toast Notification */}
      {notification && (
        <div
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3 border backdrop-blur-xl ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/40'
              : 'bg-zinc-900/95 text-zinc-200 border-zinc-700/60 shadow-black/40'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {notification.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Modern High-End Studio Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-red-600/30 shrink-0 ring-1 ring-white/20">
              <Headphones className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  BindStudio Audio Editor
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                  Roblox Studio Edition
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Passes 20MB Cap
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                PlaybackSpeed Resampling, Gain Amplifikasi, Reverb Studio, Timestamp Splitter & Batch OGG
              </p>
            </div>
          </div>

          {/* Quick Stats & Formula Toggle */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0 flex-wrap">
            {queue.length > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-mono">
                  {readyCount}/{queue.length} Siap
                </span>
              </div>
            )}

            <button
              type="button"
              id="toggle-formula-guide-btn"
              onClick={() => setShowFormulaExplainer(!showFormulaExplainer)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <HelpCircle className="w-3.5 h-3.5 text-red-400" />
              <span>{showFormulaExplainer ? 'Tutup Panduan' : 'Panduan Formula'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Roblox Formula & Speed Presets Card */}
        {showFormulaExplainer && (
          <RobloxFormulaCard
            activeSpeedUp={settings.speedUp}
            onSelectPreset={(preset: RobloxSpeedPreset) => {
              handleUpdateMasterSettings((prev) => ({
                ...prev,
                speedUp: preset.speedUp,
                robloxPlaybackSpeed: preset.robloxPlaybackSpeed,
              }));
              showNotification(
                `Preset ${preset.label} dipilih (Roblox PlaybackSpeed: ${preset.robloxPlaybackSpeed})`,
                'info'
              );
            }}
            onCustomSpeedChange={(speedUp: number) => {
              const robloxVal = parseFloat((1 / Math.max(0.01, speedUp)).toFixed(4));
              handleUpdateMasterSettings((prev) => ({
                ...prev,
                speedUp,
                robloxPlaybackSpeed: robloxVal,
              }));
            }}
          />
        )}

        {/* Audio Input: Single / Multiple Local File Upload & Timestamp Slicer */}
        <AudioInputSection
          onFilesSelected={handleFilesSelected}
          onOpenSplitModal={handleOpenSplitModal}
          queueCount={queue.length}
        />

        {/* Global Controls: Playback Speed, Amplify, Reverb Filters, Fades */}
        <GlobalControls
          settings={settings}
          onChangeSettings={handleUpdateMasterSettings}
          onApplyToAllQueue={handleApplyToAllQueue}
          onProcessAll={handleProcessAll}
          isProcessing={isProcessingAll}
          queueCount={queue.length}
        />

        {/* Live Audition / Preview Remaster & DSP Settings BEFORE processing */}
        {queue.length > 0 && (
          <LivePreviewPlayer
            queue={queue}
            settings={settings}
          />
        )}

        {/* Output Folder & Clean File Naming Settings */}
        <FolderAndNamingSettings
          config={folderConfig}
          onChangeConfig={handleUpdateFolderConfig}
          directFolderHandle={selectedDirectoryHandle}
          onRequestSelectFolder={handleSelectDirectory}
        />

        {/* Queue List: Clear metadata, individual & bulk download, preview */}
        <QueueList
          queue={queue}
          folderName={folderConfig.folderName}
          selectedDirectoryName={selectedDirectoryHandle?.name || null}
          onProcessItem={processItemById}
          onDeleteItem={handleDeleteItem}
          onClearAll={handleClearAll}
          onDownloadItem={handleDownloadItem}
          onDownloadAllZip={handleDownloadAllZip}
          isDownloadingZip={isDownloadingZip}
          activePlayingId={activePlayingId}
          activePlayingType={activePlayingType}
          onTogglePlay={handleTogglePlay}
          onUpdateItemSettings={handleUpdateItemSettings}
          onResetItemSettings={handleResetItemSettings}
        />
      </main>

      {/* Persistent Bottom Audio Player Bar */}
      {activePlayingItem && activePlayingType && (
        <AudioPlayerBar
          item={activePlayingItem}
          type={activePlayingType}
          onClose={() => {
            setActivePlayingId(null);
            setActivePlayingType(null);
          }}
          onToggleType={(newType) => setActivePlayingType(newType)}
          onDownload={handleDownloadItem}
        />
      )}

      {/* Local Timestamp Split Modal */}
      <TimestampSplitModal
        isOpen={splitModalOpen}
        onClose={() => {
          setSplitModalOpen(false);
          setSplitLocalFile(null);
        }}
        localFile={splitLocalFile}
        onTracksSplitted={handleTracksSplitted}
      />
    </div>
  );
}
