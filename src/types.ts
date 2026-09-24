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
    id: 'stealth-0.42',
    label: '🛡️ Stealth 0.42 (2.381x)',
    speedUp: 2.381,
    robloxPlaybackSpeed: 0.42,
    formula: 'PlaybackSpeed = 1 / 2.381 ≈ 0.420',
    description: 'Rasio non-standar anti-fingerprint! Mengelabui tabel indexing Audible Magic & ACRCloud',
  },
  {
    id: 'speed-2.326',
    label: '0.43 (2.326x)',
    speedUp: 2.326,
    robloxPlaybackSpeed: 0.43,
    formula: 'PlaybackSpeed = 1 / 2.326 ≈ 0.43',
    description: 'Preset paling populer! Hemat durasi ~57%, kualitas vokal tetap jernih di Roblox',
  },
  {
    id: 'stealth-0.39',
    label: '🛡️ Stealth 0.39 (2.551x)',
    speedUp: 2.551,
    robloxPlaybackSpeed: 0.392,
    formula: 'PlaybackSpeed = 1 / 2.551 ≈ 0.392',
    description: 'Percepatan agresif non-standar untuk lagu yang sangat ketat terdeteksi hak cipta',
  },
  {
    id: 'speed-2',
    label: '0.50 (2.00x)',
    speedUp: 2.0,
    robloxPlaybackSpeed: 0.5,
    formula: 'PlaybackSpeed = 1 / 2.0 = 0.50',
    description: 'Setengah kecepatan di Roblox, durasi terpangkas tepat 50%',
  },
  {
    id: 'speed-3',
    label: '0.33 (3.00x)',
    speedUp: 3.0,
    robloxPlaybackSpeed: 0.33,
    formula: 'PlaybackSpeed = 1 / 3.0 ≈ 0.33',
    description: 'Percepatan 3x lipat, cocok untuk lagu berdurasi 5–7 menit',
  },
  {
    id: 'speed-4',
    label: '0.25 (4.00x)',
    speedUp: 4.0,
    robloxPlaybackSpeed: 0.25,
    formula: 'PlaybackSpeed = 1 / 4.0 = 0.25',
    description: 'Percepatan 4x lipat, sangat hemat ukuran file untuk audio panjang',
  },
  {
    id: 'speed-5',
    label: '0.20 (5.00x)',
    speedUp: 5.0,
    robloxPlaybackSpeed: 0.2,
    formula: 'PlaybackSpeed = 1 / 5.0 = 0.20',
    description: 'Percepatan 5x lipat, muat lagu hingga 15 menit dalam batas upload',
  },
  {
    id: 'normal',
    label: '1.00 (Normal)',
    speedUp: 1.0,
    robloxPlaybackSpeed: 1.0,
    formula: 'PlaybackSpeed = 1 / 1.0 = 1.0',
    description: 'Kecepatan asli standar (tanpa percepatan)',
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
