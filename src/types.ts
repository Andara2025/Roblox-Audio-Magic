export type ReverbType = 'none' | 'room' | 'hall' | 'cathedral' | 'space';

export interface RobloxSpeedPreset {
  id: string;
  label: string;
  speedUp: number;
  robloxPlaybackSpeed: number;
  formula: string;
  description: string;
}

export const ROBLOX_SPEED_PRESETS: RobloxSpeedPreset[] = [
  {
    id: 'normal',
    label: 'Normal (1x)',
    speedUp: 1.0,
    robloxPlaybackSpeed: 1.0,
    formula: 'PlaybackSpeed = 1 / 1.0 = 1.0',
    description: 'Kecepatan asli standar (tanpa percepatan)',
  },
  {
    id: 'speed-2.326',
    label: '2.326x Speed-up',
    speedUp: 2.326,
    robloxPlaybackSpeed: 0.43,
    formula: 'PlaybackSpeed = 1 / 2.326 ≈ 0.43',
    description: 'Set Sound.PlaybackSpeed = 0.43 di Roblox untuk putar normal',
  },
  {
    id: 'speed-4',
    label: '4x Speed-up',
    speedUp: 4.0,
    robloxPlaybackSpeed: 0.25,
    formula: 'PlaybackSpeed = 1 / 4.0 = 0.25',
    description: 'Set Sound.PlaybackSpeed = 0.25 di Roblox untuk putar normal',
  },
  {
    id: 'speed-6',
    label: '6x Speed-up',
    speedUp: 6.0,
    robloxPlaybackSpeed: 0.17,
    formula: 'PlaybackSpeed = 1 / 6.0 ≈ 0.17',
    description: 'Set Sound.PlaybackSpeed = 0.17 di Roblox untuk putar normal',
  },
  {
    id: 'speed-8.57',
    label: '8.57x Speed-up',
    speedUp: 8.57,
    robloxPlaybackSpeed: 0.12,
    formula: 'PlaybackSpeed = 1 / 8.57 ≈ 0.12',
    description: 'Set Sound.PlaybackSpeed = 0.12 di Roblox untuk putar normal',
  },
];

export type OutputAudioFormat = 'ogg' | 'wav';

export type NamingStyle = 'clean' | 'roblox' | 'detailed' | 'original';

export interface FolderConfig {
  folderName: string; // default e.g. "Roblox_Audio_Output"
  namingStyle: NamingStyle; // 'clean' = Judul_0.43.ogg, 'roblox' = Judul_Roblox0.43.ogg, 'detailed' = Judul_[...].ogg, 'original' = Judul.ogg
  includeEffectsInName: boolean; // whether to append amplify or reverb tags
  customPrefix: string; // optional prefix e.g. "Roblox_" or empty
}

export interface AudioSettings {
  speedUp: number;
  robloxPlaybackSpeed: number;
  outputFormat: OutputAudioFormat; // default 'ogg' (lightweight) vs 'wav' (lossless)
  // 'resample' = Roblox method (increases pitch & speed, so Roblox 0.xx PlaybackSpeed restores original pitch)
  // 'timestretch' = pitch-preserved speedup
  pitchMode: 'resample' | 'timestretch';
  amplifyDb: number; // 0 = normal, +3dB, -3dB, etc.
  preserveQuality: boolean; // limiter & soft-clipping protection
  reverbType: ReverbType;
  reverbMix: number; // 0.0 - 1.0
  reverbDecay: number; // in seconds
  fadeInEnabled: boolean; // on/off toggle
  fadeInDuration: number; // in seconds (e.g. 2.0s)
  fadeOutEnabled: boolean; // on/off toggle
  fadeOutDuration: number; // in seconds (e.g. 3.0s)
}

export type QueueItemStatus = 'idle' | 'decoding' | 'processing' | 'ready' | 'error';

export interface QueueItem {
  id: string;
  source: 'upload' | 'youtube';
  title: string;
  originalFileName: string;
  fileSize: number;
  duration: number; // in seconds
  status: QueueItemStatus;
  progress: number; // 0 - 100
  errorMessage?: string;
  settings: AudioSettings;
  originalBuffer?: AudioBuffer;
  originalBlob?: Blob;
  originalUrl?: string;
  processedBuffer?: AudioBuffer;
  processedBlob?: Blob;
  wavBlob?: Blob;
  oggBlob?: Blob;
  processedSize?: number;
  processedUrl?: string;
  processedDuration?: number;
  outputFileName: string;
  thumbnail?: string;
  createdAt: number;
}
