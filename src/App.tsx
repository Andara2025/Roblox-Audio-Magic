import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  AudioSettings,
  FolderConfig,
  QueueItem,
  RobloxSpeedPreset,
  ROBLOX_SPEED_PRESETS,
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
import { TimestampSplitModal, SlicedTrackResult } from './components/TimestampSplitModal';
import { YouTubeVideoInfo } from './utils/youtubeService';
import {
  SlidersHorizontal,
  Headphones,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

const DEFAULT_SETTINGS: AudioSettings = {
  speedUp: 2.326,
  robloxPlaybackSpeed: 0.43,
  outputFormat: 'ogg', // Default: OGG Vorbis (~90% lebih ringan, format resmi Roblox)
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
      folderName: 'Roblox_Audio_Output',
      namingStyle: 'clean', // Default: clean, neat, not too long (e.g. Song_0.43.ogg)
      includeEffectsInName: false,
      customPrefix: '',
    };
  });
  const [selectedDirectoryHandle, setSelectedDirectoryHandle] = useState<any | null>(null);
  const [selectedDirectoryName, setSelectedDirectoryName] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Timestamp Splitting Modal State
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitOptions, setSplitOptions] = useState<{
    youtubeInfo?: YouTubeVideoInfo | null;
    youtubeUrl?: string;
    localFile?: File | null;
  }>({});

  // Audio Player State
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [activePlayingType, setActivePlayingType] = useState<'original' | 'processed' | null>(null);
  const [showFormulaExplainer, setShowFormulaExplainer] = useState(true);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
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
        setSelectedDirectoryName(handle.name);
        showNotification(`Folder komputer terhubung: ${handle.name}`, 'success');
      } else {
        showNotification('Browser Anda tidak mendukung pemilihan folder langsung. File akan diunduh dengan struktur folder rapi.', 'info');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Directory selection error:', err);
        showNotification('Gagal mengakses folder atau izin dibatalkan', 'error');
      }
    }
  };

  const handleClearDirectory = () => {
    setSelectedDirectoryHandle(null);
    setSelectedDirectoryName(null);
    showNotification('Pilihan folder komputer dilepas', 'info');
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
                  errorMessage: 'Gagal membaca format file audio.',
                }
              : q
          )
        );
      }
    }
  };

  // Add YouTube audio to queue
  const handleYouTubeAudioLoaded = async (
    blob: Blob,
    title: string,
    duration: number,
    thumbnail?: string
  ) => {
    const id = `yt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const originalFileName = `${title.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.mp3`;
    const outputFileName = generateOutputName(originalFileName, settings, settings.outputFormat, folderConfig);

    const newItem: QueueItem = {
      id,
      source: 'youtube',
      title,
      originalFileName,
      fileSize: blob.size,
      duration,
      status: 'decoding',
      progress: 0,
      settings: { ...settings },
      originalBlob: blob,
      outputFileName,
      thumbnail,
      createdAt: Date.now(),
    };

    setQueue((prev) => [...prev, newItem]);
    showNotification(`Audio YouTube "${title}" berhasil masuk antrean!`, 'success');

    try {
      const buffer = await decodeAudioFile(blob);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === newItem.id
            ? {
                ...q,
                originalBuffer: buffer,
                duration: buffer.duration,
                status: 'idle',
              }
            : q
        )
      );
    } catch (err: unknown) {
      console.error('Decode error for YouTube audio', err);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === newItem.id
            ? {
                ...q,
                status: 'error',
                errorMessage: 'Gagal mendecode stream audio YouTube.',
              }
            : q
        )
      );
    }
  };

  // Open timestamp split modal
  const handleOpenSplitModal = (options: {
    youtubeInfo?: YouTubeVideoInfo | null;
    youtubeUrl?: string;
    localFile?: File | null;
  }) => {
    setSplitOptions(options);
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
        source: res.thumbnail ? 'youtube' : 'upload',
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
        thumbnail: res.thumbnail,
        createdAt: Date.now() + idx,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    showNotification(`Berhasil memecah & menambahkan ${results.length} lagu ke antrean!`, 'success');
  };

  // Process a single item
  const processItemById = async (id: string, currentQueue = queue) => {
    const item = currentQueue.find((q) => q.id === id);
    if (!item) return;

    let buffer = item.originalBuffer;
    if (!buffer && item.originalBlob) {
      setQueue((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'decoding' } : q))
      );
      try {
        buffer = await decodeAudioFile(item.originalBlob);
      } catch (e: unknown) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? { ...q, status: 'error', errorMessage: 'Gagal decode audio.' }
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
              outputFileName: generateOutputName(q.originalFileName, q.settings),
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
                processedBuffer,
                processedBlob: mainBlob,
                wavBlob,
                oggBlob,
                processedSize: mainBlob.size,
                processedUrl,
                processedDuration: processedBuffer.duration,
                outputFileName: generateOutputName(q.originalFileName, q.settings),
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

    for (const item of queue) {
      await processItemById(item.id);
    }

    setIsProcessingAll(false);
    showNotification('Semua audio di antrean berhasil diproses!', 'success');
  };

  // Apply current global settings to all queue items
  const handleApplyToAllQueue = () => {
    setQueue((prev) =>
      prev.map((item) => ({
        ...item,
        settings: { ...settings },
        outputFileName: generateOutputName(
          item.originalFileName,
          settings,
          settings.outputFormat,
          folderConfig
        ),
        // If it was ready, prompt re-processing
        status: item.status === 'ready' ? 'idle' : item.status,
      }))
    );
    showNotification('Pengaturan berhasil diterapkan ke semua item antrean', 'success');
  };

  // Update a single item's settings
  const handleUpdateItemSettings = (id: string, newSettings: AudioSettings) => {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              settings: newSettings,
              outputFileName: generateOutputName(
                q.originalFileName,
                newSettings,
                newSettings.outputFormat,
                folderConfig
              ),
              status: q.status === 'ready' ? 'idle' : q.status,
            }
          : q
      )
    );
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
          showNotification('Mengonversi ke OGG Vorbis ringan...', 'info');
          const ogg = await convertWavToOgg(item.wavBlob);
          item.oggBlob = ogg;
          blobToDownload = ogg;
        } catch (e) {
          console.warn('Gagal konversi ke OGG:', e);
          showNotification('Gagal mengonversi ke OGG, mengunduh WAV', 'error');
          blobToDownload = item.wavBlob;
        }
      }
    } else if (targetFormat === 'wav') {
      blobToDownload = item.wavBlob || item.processedBlob;
    }

    if (!blobToDownload) return;

    const fileName = generateOutputName(item.originalFileName, item.settings, targetFormat, folderConfig);

    // If direct directory handle was selected by user
    if (selectedDirectoryHandle) {
      try {
        let targetDir = selectedDirectoryHandle;
        const subfolderName = (folderConfig.folderName || 'Roblox_Audio_Output').trim();
        if (subfolderName) {
          targetDir = await selectedDirectoryHandle.getDirectoryHandle(subfolderName, { create: true });
        }
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blobToDownload);
        await writable.close();
        showNotification(`Tersimpan langsung ke folder "${selectedDirectoryName}/${subfolderName}/${fileName}"`, 'success');
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
    const folderName = (folderConfig.folderName || 'Roblox_Audio_Output').trim();
    showNotification(`Mengompres ${readyItems.length} audio ke dalam folder "${folderName}" di ZIP...`, 'info');

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
- Speed-up: 4.0x   -> Sound.PlaybackSpeed = 0.25
- Speed-up: 6.0x   -> Sound.PlaybackSpeed = 0.17
- Speed-up: 8.57x  -> Sound.PlaybackSpeed = 0.12
Formula: PlaybackSpeed = 1 / Speed-Up

Dibuat dengan Audio Manipulator Tool.
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
          showNotification(`File ZIP langsung tersimpan di folder: ${selectedDirectoryName}/${zipFileName}`, 'success');
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-28">
      {/* Toast Notification */}
      {notification && (
        <div
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3 border ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-slate-900/95 text-slate-200 border-slate-700'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {notification.type === 'info' && <Sparkles className="w-4 h-4 text-blue-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* App Header */}
      <header className="border-b border-slate-850 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg text-white tracking-tight">Audio Manipulator</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  Roblox Speed & FX Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manipulasi Playback Speed, Amplify Gain, Reverb, dan Konversi YouTube ke MP3
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFormulaExplainer(!showFormulaExplainer)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-red-400" />
              <span>{showFormulaExplainer ? 'Sembunyikan Formula' : 'Panduan Formula Roblox'}</span>
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
              setSettings((prev) => ({
                ...prev,
                speedUp: preset.speedUp,
                robloxPlaybackSpeed: preset.robloxPlaybackSpeed,
              }));
              showNotification(`Preset ${preset.label} dipilih (Roblox PlaybackSpeed: ${preset.robloxPlaybackSpeed})`, 'info');
            }}
            onCustomSpeedChange={(speedUp: number) => {
              const robloxVal = parseFloat((1 / Math.max(0.01, speedUp)).toFixed(4));
              setSettings((prev) => ({
                ...prev,
                speedUp,
                robloxPlaybackSpeed: robloxVal,
              }));
            }}
          />
        )}

        {/* Audio Input: Single / Multiple File Upload & YouTube to MP3 */}
        <AudioInputSection
          onFilesSelected={handleFilesSelected}
          onYouTubeAudioLoaded={handleYouTubeAudioLoaded}
          onOpenSplitModal={handleOpenSplitModal}
          queueCount={queue.length}
        />

        {/* Global Controls: Playback Speed, Amplify, Reverb Filters */}
        <GlobalControls
          settings={settings}
          onChangeSettings={setSettings}
          onApplyToAllQueue={handleApplyToAllQueue}
          onProcessAll={handleProcessAll}
          isProcessing={isProcessingAll}
          queueCount={queue.length}
        />

        {/* Output Folder & Clean File Naming Settings */}
        <FolderAndNamingSettings
          folderConfig={folderConfig}
          onChangeFolderConfig={handleUpdateFolderConfig}
          outputFormat={settings.outputFormat}
          selectedDirectoryHandle={selectedDirectoryHandle}
          onSelectDirectory={handleSelectDirectory}
          onClearDirectory={handleClearDirectory}
          selectedDirectoryName={selectedDirectoryName}
        />

        {/* Output & Queue List: Clear metadata, individual & bulk download, preview */}
        <QueueList
          queue={queue}
          folderName={folderConfig.folderName}
          selectedDirectoryName={selectedDirectoryName}
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

      {/* Timestamp Split Modal (Playlist / Mix / Compilation) */}
      <TimestampSplitModal
        isOpen={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        youtubeInfo={splitOptions.youtubeInfo}
        youtubeUrl={splitOptions.youtubeUrl}
        localFile={splitOptions.localFile}
        onTracksSplitted={handleTracksSplitted}
      />
    </div>
  );
}
