import { AudioSettings, FolderConfig, NamingStyle, OutputAudioFormat, ReverbType } from '../types';
import { createOggEncoder } from 'wasm-media-encoders';

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Strips ID3v2 metadata frames (including heavy APIC album art images) from an MP3 ArrayBuffer.
 * This allows browser AudioContext.decodeAudioData to parse pure MP3 audio frames directly
 * without crashing or overflowing buffer limits on large cover images.
 */
export function stripId3v2Tag(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  // Check for 'ID3' header (bytes 0-2: 'I', 'D', '3')
  if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // ID3v2 tag size is encoded in bytes 6-9 as a 28-bit syncsafe integer
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);

    const headerPlusTagSize = 10 + tagSize;
    if (headerPlusTagSize < bytes.length) {
      // Return buffer slice starting right after the ID3 tag (where MPEG audio frames begin)
      return buffer.slice(headerPlusTagSize);
    }
  }
  return buffer;
}

/**
 * Decode an ArrayBuffer or File into an AudioBuffer.
 * If browser decodeAudioData fails (frequently caused by large embedded album art/cover images,
 * video thumbnail tracks, or non-standard container metadata), automatically strips the cover art
 * and decodes via FFmpeg server backend!
 */
export async function decodeAudioFile(fileOrBlob: Blob | File | ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  let arrayBuffer: ArrayBuffer;
  if (fileOrBlob instanceof ArrayBuffer) {
    arrayBuffer = fileOrBlob;
  } else {
    arrayBuffer = await fileOrBlob.arrayBuffer();
  }

  // 1. Client-side ID3 stripping: instantly removes heavy album covers (APIC frames) in 0ms
  const strippedBuffer = stripId3v2Tag(arrayBuffer);
  try {
    return await ctx.decodeAudioData(strippedBuffer.slice(0));
  } catch (firstErr) {
    // If strippedBuffer was tried and failed, try original once if different
    if (strippedBuffer !== arrayBuffer) {
      try {
        return await ctx.decodeAudioData(arrayBuffer.slice(0));
      } catch {
        // Continue to server fallback
      }
    }

    console.warn(
      'Browser decodeAudioData gagal (kemungkinan format non-standar atau cover art berat). Menjalankan server strip-cover fallback...',
      firstErr
    );

    // 2. Server Fallback: Strip cover art/video and re-encode to clean PCM WAV via server FFmpeg
    try {
      const response = await fetch('/api/audio/strip-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server decode error (${response.status})`);
      }

      const cleanWavBuffer = await response.arrayBuffer();
      // Decode the clean, cover-free WAV in the browser AudioContext
      return await ctx.decodeAudioData(cleanWavBuffer);
    } catch (fallbackErr) {
      console.error('Semua metode decode audio gagal:', fallbackErr);
      throw new Error(
        'Gagal membaca file audio. Format file rusak atau cover art tidak dapat diproses.'
      );
    }
  }
}

/**
 * Generate a synthetic Impulse Response for Convolution Reverb
 * with acoustic damping and speedUp-aware decay scaling
 */
export function createReverbImpulse(
  ctx: BaseAudioContext,
  reverbType: ReverbType,
  decaySeconds: number,
  speedUpFactor: number = 1
): AudioBuffer | null {
  if (reverbType === 'none' || decaySeconds <= 0.05) return null;

  const sampleRate = ctx.sampleRate;
  // Scale decay duration according to speedUp factor so that when Roblox plays it
  // at 1/speedUp (robloxPlaybackSpeed), the perceived decay matches decaySeconds!
  const effectiveDecay = Math.max(0.08, decaySeconds / Math.max(0.1, speedUpFactor));

  let duration = effectiveDecay;
  let decayFactor = 3.0;

  switch (reverbType) {
    case 'room':
      duration = Math.min(effectiveDecay, 1.6 / speedUpFactor);
      decayFactor = 4.2;
      break;
    case 'hall':
      duration = Math.min(Math.max(effectiveDecay, 1.2 / speedUpFactor), 3.8 / speedUpFactor);
      decayFactor = 2.8;
      break;
    case 'cathedral':
      duration = Math.min(Math.max(effectiveDecay, 2.0 / speedUpFactor), 6.0 / speedUpFactor);
      decayFactor = 1.9;
      break;
    case 'space':
      duration = Math.min(Math.max(effectiveDecay, 3.0 / speedUpFactor), 9.0 / speedUpFactor);
      decayFactor = 1.3;
      break;
  }

  const length = Math.max(256, Math.floor(sampleRate * duration));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  // Acoustic multi-tap reflection with progressive high-frequency air damping
  let filterL = 0;
  let filterR = 0;
  for (let i = 0; i < length; i++) {
    const n = i / length;
    const envelope = Math.exp(-n * decayFactor);
    // Dynamic low-pass damping: early reflections have higher frequencies, late tail gets warm
    const damping = 0.28 + 0.65 * (1 - n);
    const whiteL = (Math.random() * 2 - 1) * envelope;
    const whiteR = (Math.random() * 2 - 1) * envelope;

    filterL = filterL * (1 - damping) + whiteL * damping;
    filterR = filterR * (1 - damping) + whiteR * damping;

    left[i] = filterL;
    right[i] = filterR;
  }

  return impulse;
}

/**
 * Perform simple pitch-preserving time stretch via Phase Vocoder / Granular WSOLA
 */
function timeStretchBuffer(sourceBuffer: AudioBuffer, rate: number): AudioBuffer {
  if (Math.abs(rate - 1.0) < 0.01) return sourceBuffer;

  const numChannels = sourceBuffer.numberOfChannels;
  const sampleRate = sourceBuffer.sampleRate;
  const inLength = sourceBuffer.length;
  const outLength = Math.max(1, Math.floor(inLength / rate));

  const ctx = getAudioContext();
  const stretchedBuffer = ctx.createBuffer(numChannels, outLength, sampleRate);

  const windowSize = Math.floor(sampleRate * 0.04); // 40ms window
  const hopOut = Math.floor(windowSize / 2);
  const hopIn = Math.floor(hopOut * rate);

  // Hann window
  const win = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const inData = sourceBuffer.getChannelData(ch);
    const outData = stretchedBuffer.getChannelData(ch);

    let inPos = 0;
    let outPos = 0;

    while (outPos + windowSize < outLength && inPos + windowSize < inLength) {
      for (let i = 0; i < windowSize; i++) {
        outData[outPos + i] += inData[inPos + i] * win[i];
      }
      outPos += hopOut;
      inPos += hopIn;
    }
  }

  return stretchedBuffer;
}

/**
 * Process Audio Buffer using Web Audio API OfflineAudioContext
 */
export async function processAudio(
  inputBuffer: AudioBuffer,
  settings: AudioSettings,
  onProgress?: (percent: number) => void
): Promise<{
  processedBuffer: AudioBuffer;
  wavBlob: Blob;
  oggBlob?: Blob;
  mainBlob: Blob;
}> {
  onProgress?.(10);

  const sampleRate = inputBuffer.sampleRate;
  const speedUp = Math.max(0.1, settings.speedUp);
  const isResample = settings.pitchMode === 'resample';

  let workBuffer = inputBuffer;

  if (!isResample && speedUp !== 1.0) {
    // Pitch-preserved time stretch
    onProgress?.(25);
    workBuffer = timeStretchBuffer(inputBuffer, speedUp);
  }

  // Calculate output duration
  const speedUpFactor = isResample ? speedUp : 1.0;
  const baseDuration = isResample ? workBuffer.duration / speedUp : workBuffer.duration;
  const extraTail = settings.reverbType !== 'none'
    ? Math.min(settings.reverbDecay / speedUpFactor, 5.0)
    : 0.05;
  const totalDuration = baseDuration + extraTail;
  const totalFrames = Math.max(1, Math.ceil(totalDuration * sampleRate));

  const offlineCtx = new OfflineAudioContext(
    workBuffer.numberOfChannels,
    totalFrames,
    sampleRate
  );

  // 1. Audio Source
  const source = offlineCtx.createBufferSource();
  source.buffer = workBuffer;

  if (isResample) {
    source.playbackRate.value = speedUp;
  }

  // 2. Gain / Amplify node
  // Direct mathematical decibel gain: linearGain = 10^(dB / 20)
  // +3 dB  => 1.41x, +6 dB => 2.00x, +12 dB => 3.98x
  // -6 dB  => 0.50x, -12 dB => 0.25x
  const gainNode = offlineCtx.createGain();
  const linearGain = Math.pow(10, settings.amplifyDb / 20);
  gainNode.gain.value = linearGain;

  // 3. Reverb Processing (Acoustic convolution with Roblox speed-up calibration)
  const impulse = createReverbImpulse(
    offlineCtx,
    settings.reverbType,
    settings.reverbDecay,
    speedUpFactor
  );
  let wetGain: GainNode | null = null;
  let dryGain: GainNode | null = null;

  if (impulse && settings.reverbMix > 0.01) {
    const convolver = offlineCtx.createConvolver();
    convolver.buffer = impulse;
    convolver.normalize = true;

    wetGain = offlineCtx.createGain();
    dryGain = offlineCtx.createGain();

    const wetAmount = Math.min(Math.max(settings.reverbMix, 0), 1);
    wetGain.gain.value = wetAmount * 0.75;
    dryGain.gain.value = 1.0; // Maintain 100% full dry volume so audio does not drop in loudness

    source.connect(gainNode);

    // Split amplified signal into dry and reverberant wet paths
    gainNode.connect(dryGain);
    gainNode.connect(convolver);
    convolver.connect(wetGain);

    dryGain.connect(offlineCtx.destination);
    wetGain.connect(offlineCtx.destination);
  } else {
    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
  }

  onProgress?.(50);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  onProgress?.(75);

  const numChannels = renderedBuffer.numberOfChannels;
  const totalSamples = renderedBuffer.length;

  // 4. Sample-Level Anti-Clipping Soft Limiter for Amplified Volume (+dB)
  // Allows true high loudness without digital wrap-around cracking or harsh square waves
  if (settings.amplifyDb > 0) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = renderedBuffer.getChannelData(ch);
      for (let i = 0; i < totalSamples; i++) {
        const s = channelData[i];
        if (s > 0.95) {
          const excess = s - 0.95;
          channelData[i] = 0.95 + 0.048 * Math.tanh(excess * 1.5);
        } else if (s < -0.95) {
          const excess = -s - 0.95;
          channelData[i] = -(0.95 + 0.048 * Math.tanh(excess * 1.5));
        }
      }
    }
  }

  // 5. Sample-Level Fade In (Guaranteed 100% applied from true 0.0 silence to 1.0 volume)
  if (settings.fadeInEnabled && settings.fadeInDuration > 0) {
    const fadeInSec = Math.min(settings.fadeInDuration, renderedBuffer.duration / 2);
    const fadeInSamples = Math.floor(fadeInSec * sampleRate);
    if (fadeInSamples > 0) {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = renderedBuffer.getChannelData(ch);
        for (let i = 0; i < fadeInSamples; i++) {
          // Half-cosine smooth fade curve (starts at 0.0, curves smoothly up to 1.0)
          const factor = 0.5 * (1 - Math.cos((i / fadeInSamples) * Math.PI));
          channelData[i] *= factor;
        }
      }
    }
  }

  // 6. Sample-Level Fade Out (Guaranteed 100% applied from 1.0 volume to true 0.0 silence at the end)
  if (settings.fadeOutEnabled && settings.fadeOutDuration > 0) {
    const fadeOutSec = Math.min(settings.fadeOutDuration, renderedBuffer.duration / 2);
    const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);
    if (fadeOutSamples > 0) {
      const startSample = totalSamples - fadeOutSamples;
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = renderedBuffer.getChannelData(ch);
        for (let i = 0; i < fadeOutSamples; i++) {
          // Half-cosine smooth fade curve (starts at 1.0, curves smoothly down to 0.0)
          const factor = 0.5 * (1 + Math.cos((i / fadeOutSamples) * Math.PI));
          channelData[startSample + i] *= factor;
        }
      }
    }
  }

  onProgress?.(85);

  // Encode to 16-bit PCM WAV (intermediate rendered audio)
  const wavBlob = audioBufferToWav(renderedBuffer);
  onProgress?.(88);

  let oggBlob: Blob | undefined;
  let mainBlob = wavBlob;

  if (settings.outputFormat === 'ogg') {
    try {
      let targetQuality = settings.oggQuality ?? 8;
      if (settings.autoFitRobloxLimit ?? true) {
        targetQuality = calculateRobloxSafeQuality(renderedBuffer.duration, targetQuality);
      }

      onProgress?.(90);
      // Fast client-side WebAssembly Vorbis encoding in browser memory (0 network upload, 0 risk of 413 error!)
      oggBlob = await encodeAudioBufferToOgg(renderedBuffer, targetQuality, (encProgress) => {
        onProgress?.(90 + Math.floor(encProgress * 0.09));
      });
      mainBlob = oggBlob;
    } catch (wasmErr) {
      console.warn('Browser WASM OGG encoding failed, trying convertWavToOgg fallback...', wasmErr);
      try {
        oggBlob = await convertWavToOgg(
          wavBlob,
          settings.oggQuality ?? 8,
          renderedBuffer.duration,
          settings.autoFitRobloxLimit ?? true
        );
        mainBlob = oggBlob;
      } catch (fallbackErr) {
        console.error('Konversi OGG gagal total:', fallbackErr);
        throw new Error(
          `Gagal mengonversi ke OGG Vorbis: ${(fallbackErr as Error).message}. File WAV mentah (${formatFileSize(wavBlob.size)}) akan melebihi batas 20MB Roblox!`
        );
      }
    }
  }

  onProgress?.(100);

  return { processedBuffer: renderedBuffer, wavBlob, oggBlob, mainBlob };
}

/**
 * Roblox Strict Upload Limit Constants
 */
export const ROBLOX_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // Strictly 20 MB

/**
 * Calculate the highest safe Vorbis quality so that the output file strictly stays < 19.5 MB for Roblox
 */
export function calculateRobloxSafeQuality(durationSeconds: number, targetQuality: number = 8): number {
  if (durationSeconds <= 0) return targetQuality;
  const maxSafeBytes = 19 * 1024 * 1024;
  for (let q = targetQuality; q >= 5; q--) {
    const estimated = estimateAudioFileSize(durationSeconds, 1.0, 'ogg', q);
    if (estimated <= maxSafeBytes) {
      return q;
    }
  }
  return 5; // Minimum quality (160k), fits up to ~15 minutes under 20MB
}

/**
 * Map quality number to explicit Vorbis bitrate string
 */
export function getBitrateString(quality: number = 8): string {
  switch (quality) {
    case 5:
      return '160k';
    case 6:
      return '192k';
    case 7:
      return '224k';
    case 8:
      return '256k'; // Hi-Fi Studio Recommended
    case 9:
      return '320k'; // Ultra High Quality
    case 10:
      return '450k';
    default:
      return '256k';
  }
}

/**
 * Encode an AudioBuffer directly to OGG Vorbis using WebAssembly in browser memory.
 * Completely eliminates HTTP 413 Payload Too Large errors because no massive uncompressed
 * WAV file needs to be transmitted over the network!
 */
export async function encodeAudioBufferToOgg(
  buffer: AudioBuffer,
  quality: number = 8,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const encoder = await createOggEncoder();

  // Clamp quality between 1 and 10
  const clampedQuality = Math.max(1, Math.min(10, quality));

  encoder.configure({
    sampleRate,
    channels: (numChannels === 1 ? 1 : 2) as 1 | 2,
    vbrQuality: clampedQuality,
  });

  const channelsData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelsData.push(buffer.getChannelData(ch));
  }

  const numSamples = buffer.length;
  const chunkSize = 32768;
  const chunks: BlobPart[] = [];

  for (let offset = 0; offset < numSamples; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, numSamples);
    const channelSlices = channelsData.map((data) => data.subarray(offset, end));
    const chunk = encoder.encode(channelSlices);
    if (chunk && chunk.length > 0) {
      const copy = new Uint8Array(chunk.length);
      copy.set(chunk);
      chunks.push(copy);
    }
    if (onProgress) {
      onProgress(Math.round((offset / numSamples) * 100));
    }
  }

  const finalChunk = encoder.finalize();
  if (finalChunk && finalChunk.length > 0) {
    const copy = new Uint8Array(finalChunk.length);
    copy.set(finalChunk);
    chunks.push(copy);
  }

  if (onProgress) {
    onProgress(100);
  }

  return new Blob(chunks, { type: 'audio/ogg' });
}

/**
 * Estimate output file size in bytes based on duration, speedup, format and quality
 */
export function estimateAudioFileSize(
  durationSeconds: number,
  speedUp: number = 2.326,
  format: OutputAudioFormat = 'ogg',
  quality: number = 7
): number {
  const effectiveSec = Math.max(1, durationSeconds / Math.max(0.1, speedUp));
  if (format === 'wav') {
    // 44100 Hz, 16-bit (2 bytes), stereo (2 channels) = 176,400 bytes/sec
    return Math.round(effectiveSec * 176400) + 44;
  }
  // OGG Vorbis estimation
  const kbpsMap: Record<number, number> = { 5: 160, 6: 192, 7: 224, 8: 256, 9: 320, 10: 450 };
  const kbps = kbpsMap[quality] || 224;
  const bytesPerSec = (kbps * 1000) / 8;
  return Math.round(effectiveSec * bytesPerSec) + 4096; // Vorbis page headers
}

/**
 * Get Roblox upload compliance status for any given file size
 */
export function getRobloxSafetyStatus(sizeBytes: number): {
  isSafe: boolean;
  isNearLimit: boolean;
  percent: number;
  label: string;
} {
  const percent = Math.round((sizeBytes / ROBLOX_MAX_FILE_SIZE_BYTES) * 100);
  if (sizeBytes > ROBLOX_MAX_FILE_SIZE_BYTES) {
    return {
      isSafe: false,
      isNearLimit: false,
      percent,
      label: `Melebihi Batas 20MB (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB - Ditolak Roblox!)`,
    };
  }
  if (sizeBytes > 18 * 1024 * 1024) {
    return {
      isSafe: true,
      isNearLimit: true,
      percent,
      label: `Mendekati Batas 20MB (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB / 20 MB • ${percent}%)`,
    };
  }
  return {
    isSafe: true,
    isNearLimit: false,
    percent,
    label: `Aman Roblox (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB / 20 MB • ${percent}%)`,
  };
}

/**
 * Convert WAV Blob to OGG Vorbis via WebAssembly (in-browser) or server FFmpeg fallback.
 * Solves 413 Payload Too Large by encoding directly in browser memory.
 */
export async function convertWavToOgg(
  wavBlob: Blob,
  quality: number = 8,
  durationSeconds?: number,
  autoFitRobloxLimit: boolean = true
): Promise<Blob> {
  let effectiveQuality = quality;
  if (autoFitRobloxLimit && durationSeconds) {
    effectiveQuality = calculateRobloxSafeQuality(durationSeconds, quality);
  }

  // 1. Primary path: decode WAV in browser and encode with WebAssembly
  // This bypasses the 32MB Cloud Run HTTP payload limit completely!
  try {
    const ctx = getAudioContext();
    const arrayBuffer = await wavBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return await encodeAudioBufferToOgg(audioBuffer, effectiveQuality);
  } catch (wasmErr) {
    console.warn('WASM encode on WAV blob failed, trying server fallback...', wasmErr);
  }

  // 2. Server fallback path: only if WAV is small enough to pass Cloud Run (< 30MB)
  if (wavBlob.size > 30 * 1024 * 1024) {
    throw new Error(
      `File WAV (${formatFileSize(wavBlob.size)}) terlalu besar untuk diunggah ke server konversi (limit 30MB Cloud Run). Harap gunakan browser modern.`
    );
  }

  const bitrateStr = getBitrateString(effectiveQuality);
  const res = await fetch(
    `/api/audio/convert?format=ogg&quality=${encodeURIComponent(effectiveQuality)}&bitrate=${encodeURIComponent(bitrateStr)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
      },
      body: wavBlob,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal konversi ke OGG (Status ${res.status})`);
  }

  const resultBlob = await res.blob();
  if (resultBlob.size === 0) {
    throw new Error('Hasil konversi OGG kosong');
  }

  return resultBlob;
}

/**
 * Encode an AudioBuffer to a valid RIFF 16-bit stereo/mono WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;
  const byteLength = length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + byteLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // Write ASCII helper
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length minus RIFF identifier & length field */
  view.setUint32(4, 36 + byteLength, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, byteLength, true);

  // Write interleaved 16-bit PCM samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Soft clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Format seconds into mm:ss
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format bytes into human readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Sanitize and clean up raw file names:
 * - Strips unnecessary file extensions (.mp3, .wav, .m4a, .ogg, etc.)
 * - Removes clutter such as YouTube tags like "[Official Video]" or "(Lyrics)"
 * - Removes unwanted underscores '_' and replaces with clean readable spaces
 * - Preserves artist and song name naturally (e.g. "Alan Walker - Faded")
 * - Removes illegal filesystem characters
 */
export function sanitizeBaseName(rawName: string): string {
  let clean = rawName
    // Remove all trailing extensions (.mp3, .wav, .ogg, .m4a, .webm, etc.)
    .replace(/\.(mp3|wav|ogg|m4a|webm|flac|aac|opus)$/gi, '')
    // Remove bracketed YouTube noise like [Official Video], (Audio), [HD], [Lyrics], etc.
    .replace(/\[(official|video|audio|lyrics|hd|4k|hq|remastered|mv|clip|music video|visualizer)[^\]]*\]/gi, '')
    .replace(/\((official|video|audio|lyrics|hd|4k|hq|remastered|mv|clip|music video|visualizer)[^)]*\)/gi, '')
    // Remove track number prefixes like "01. ", "01 - ", "01 "
    .replace(/^\d{1,3}[\s.\-_]+/, '')
    // Strip previous speed tags if file was already processed before (e.g. _0.43 or (PBS 0.43))
    .replace(/[\s\-_]+(0\.\d{1,4}|roblox[\d.]*)$/gi, '')
    // Replace underscores with clean normal spaces
    .replace(/_/g, ' ')
    // Replace dangerous filesystem characters with clean space
    .replace(/[<>:"/\\|?*]/g, ' ')
    // Normalize dashes and spaces between Artist - Title
    .replace(/\s*-\s*/g, ' - ')
    // Collapse multiple consecutive spaces
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s\-.]+|[\s\-.]+$/g, '');

  return clean || 'Audio Roblox';
}

/**
 * Generate output file name with clean, readable, Roblox-friendly formatting.
 * Avoids raw numeric suffixes like "_0.43.ogg" that trigger Roblox Asset Manager
 * to rename files to just "43".
 */
export function generateOutputName(
  originalFileName: string,
  settings: AudioSettings,
  forcedFormat?: OutputAudioFormat,
  folderConfig?: Partial<FolderConfig>
): string {
  const cleanBase = sanitizeBaseName(originalFileName);
  const ext = forcedFormat || settings.outputFormat || 'ogg';
  const style: NamingStyle = folderConfig?.namingStyle || 'clean';
  
  let prefix = '';
  if (folderConfig?.customPrefix && folderConfig.customPrefix.trim() !== '') {
    const trimmed = folderConfig.customPrefix.trim().replace(/_/g, ' ');
    prefix = /[\s\-]$/.test(trimmed) ? `${trimmed} ` : `${trimmed} - `;
  }

  // Optional effect suffix if requested by user (human-readable, no underscores)
  const effectParts: string[] = [];
  if (folderConfig?.includeEffectsInName) {
    if (settings.amplifyDb !== 0) {
      effectParts.push(`${settings.amplifyDb > 0 ? '+' : ''}${settings.amplifyDb}dB`);
    }
    if (settings.reverbType !== 'none') {
      effectParts.push(`Reverb ${settings.reverbType}`);
    }
    if (settings.fadeInEnabled) {
      effectParts.push(`FadeIn ${settings.fadeInDuration}s`);
    }
    if (settings.fadeOutEnabled) {
      effectParts.push(`FadeOut ${settings.fadeOutDuration}s`);
    }
  }
  const effectSuffix = effectParts.length > 0 ? ` (${effectParts.join(', ')})` : '';

  switch (style) {
    case 'clean':
      // Standar Roblox yang bersih: "Artis - Lagu.ogg"
      // Tanpa tanda underscore, tanpa simbol aneh, tidak akan di-rename jadi 43 oleh Roblox
      return `${prefix}${cleanBase}${effectSuffix}.${ext}`;

    case 'roblox':
      // Dengan PlaybackSpeed yang rapi dalam kurung: "Artis - Lagu (PBS 0.43).ogg"
      return `${prefix}${cleanBase} (PBS ${settings.robloxPlaybackSpeed})${effectSuffix}.${ext}`;

    case 'detailed':
      // Detail lengkap yang tetap terbaca: "Artis - Lagu (2.33x PBS 0.43).ogg"
      return `${prefix}${cleanBase} (${settings.speedUp}x PBS ${settings.robloxPlaybackSpeed})${effectSuffix}.${ext}`;

    case 'original':
    default:
      // Judul asli tanpa modifikasi apapun selain pembersihan karakter berbahaya
      return `${prefix}${cleanBase}${effectSuffix}.${ext}`;
  }
}
