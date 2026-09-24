export type ReverbType = 'none' | 'room' | 'hall' | 'cathedral' | 'space';

export type RemasterProfile = 'none' | 'clarity' | 'bass_punch' | 'vocal_air' | 'loudness_war';

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
    id: 'speed-0.70',
    label: '✨ Roblox 0.70 (1.429x) - Teruji Lolos',
    speedUp: 1.429,
    robloxPlaybackSpeed: 0.7,
    formula: 'PlaybackSpeed = 1 / 1.429 ≈ 0.70',
    description: 'Roblox PlaybackSpeed 0.70 (Speed 1.429x + Pitch +4) - Pengaturan default teruji 100% lolos moderasi Roblox',
  },
  {
    id: 'speed-4',
    label: '⚡ Custom 4.00x (Roblox 0.25)',
    speedUp: 4.0,
    robloxPlaybackSpeed: 0.25,
    formula: 'PlaybackSpeed = 1 / 4.0 = 0.25',
    description: 'Percepatan 4x lipat, memangkas durasi hingga 75% untuk lagu panjang',
  },
];

export type OutputAudioFormat = 'ogg' | 'wav';

export type NamingStyle = 'clean' | 'roblox' | 'detailed' | 'original';

export interface FolderConfig {
  folderName: string; // default e.g. "Roblox Audio Output"
  namingStyle: NamingStyle; // 'clean' = Artis - Judul.ogg, 'roblox' = Artis - Judul (PBS 0.43).ogg, 'detailed' = Artis - Judul (2.33x PBS 0.43).ogg, 'original' = Judul Asli.ogg
  includeEffectsInName: boolean; // whether to append amplify or reverb tags
  customPrefix: string; // optional prefix e.g. "RBX" or empty
}

export interface AudioSettings {
  speedUp: number;
  robloxPlaybackSpeed: number;
  outputFormat: OutputAudioFormat; // default 'ogg' (lightweight) vs 'wav' (lossless)
  oggQuality: number; // 5 = 160kbps, 7 = 224kbps, 8 = 256kbps, 9 = 320kbps (High-End Studio), 10 = ~500kbps (Max Lossless-grade)
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
  remasterProfile?: RemasterProfile;
  remasterIntensity?: number;
  autoFitRobloxLimit?: boolean; // Otomatis turunkan bitrate jika audio panjang agar file selalu < 19.5MB
  // Trimming / Intro Cut (Anti-Bot Zero-Anchor Disruption)
  trimStartSec?: number; // Mulai audio di detik ke-X (cth: 12 detik untuk membuang intro asli)
  trimEndSec?: number; // Berhenti di detik ke-Y (opsional)
  // Pitch Shift Custom Mode & Semitones
  pitchShiftSemitones?: number; // Fine semitone adjustment (-12 to +12)
  // Anti-Copyright Stealth Fingerprint Disruption Suite
  antiCopyrightStealth?: boolean; // Master toggle Acoustic Fingerprint Protection
  pitchDetuneCents?: number; // Micro pitch shift (-100 to +250 cents, default +45 cents)
  haasStereoWide?: boolean; // Haas 3.8ms delay & phase dispersion (hancurkan mono-sum fingerprint)
  harmonicWarmth?: boolean; // Analog tape saturation (menghasilkan overtone baru yang tidak ada di rekaman asli)
  spectralDither?: boolean; // Masking noise floor (-48dB) untuk mengacaukan hash matriks Fourier
  leadInSilenceSec?: number; // Pre-roll jeda hening / ambient di awal file (menggeser koordinat waktu t0 pemindai)
  centerMasking?: boolean; // Redam vokal center mono dan lebarkan side stereo agar profil spektral vokal berubah
  vinylTextureMask?: boolean; // Tekstur analog vinyl / tape crackle (-28dB) yang menghancurkan matriks konstelasi FFT
  tapeFlutter?: boolean; // Micro-LFO tape flutter (modulasi pitch dinamis ±12 cents)
}

export interface IntroConfig {
  enabled: boolean;
  file: File | null;
  fileName: string;
  buffer: AudioBuffer | null;
  duration: number;
  gapDuration: number; // pause between intro and song in seconds (e.g. 0 to 2s, default 0.2s)
  volumePercent: number; // 100% default
  applyIntroSpeedUp: boolean; // whether intro itself is speeded up or kept at normal original speed (default: false)
}

export type QueueItemStatus = 'idle' | 'decoding' | 'processing' | 'ready' | 'error';

export interface QueueItem {
  id: string;
  source: 'upload' | 'split';
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
  hasIntroApplied?: boolean;
  processedBuffer?: AudioBuffer;
  processedBlob?: Blob;
  wavBlob?: Blob;
  oggBlob?: Blob;
  processedSize?: number;
  processedUrl?: string;
  processedDuration?: number;
  outputFileName: string;
  thumbnail?: string;
  hasCustomSettings?: boolean; // true if specifically customized via drawer
  needsReProcess?: boolean; // true if settings were modified after last process
  createdAt: number;
}
