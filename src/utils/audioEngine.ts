import { AudioSettings, FolderConfig, NamingStyle, OutputAudioFormat, ReverbType } from '../types';

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
 * Decode an ArrayBuffer or File into an AudioBuffer
 */
export async function decodeAudioFile(fileOrBlob: Blob | File | ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  let arrayBuffer: ArrayBuffer;
  if (fileOrBlob instanceof ArrayBuffer) {
    arrayBuffer = fileOrBlob;
  } else {
    arrayBuffer = await fileOrBlob.arrayBuffer();
  }

  // Use promise-based decodeAudioData
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Generate a synthetic Impulse Response for Convolution Reverb
 * with acoustic damping and speedUp-aware decay scaling
 */
function createReverbImpulse(
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
 * Transparent soft-saturation curve for WaveShaperNode.
 * Allows true loudness amplification (+3dB, +6dB, +12dB) while softly rounding off peaks
 * to prevent harsh digital clipping, without the squashing effect of a brickwall compressor.
 */
function createSoftSaturationNode(ctx: BaseAudioContext): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const nSamples = 65536;
  const curve = new Float32Array(nSamples);

  for (let i = 0; i < nSamples; i++) {
    const x = (i / (nSamples / 2)) - 1; // -1 to +1
    // Linear / 100% transparent for normal amplitudes up to 0.75
    if (Math.abs(x) <= 0.75) {
      curve[i] = x;
    } else {
      // Smooth hyperbolic tangent saturation curve softly rounding off peaks up to 0.99
      const sign = Math.sign(x);
      const excess = Math.abs(x) - 0.75;
      curve[i] = sign * (0.75 + 0.24 * Math.tanh(excess * 2.5));
    }
  }

  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
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
  // Direct mathematical decibel gain: +6dB ≈ 2x amplitude, -6dB ≈ 0.5x amplitude
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
    // Balance dry/wet so reverb is audible and clearly atmospheric
    wetGain.gain.value = wetAmount * 1.5;
    dryGain.gain.value = Math.max(0.15, 1 - wetAmount * 0.45);

    source.connect(gainNode);

    // Split amplified signal into dry and reverberant wet paths
    gainNode.connect(dryGain);
    gainNode.connect(convolver);
    convolver.connect(wetGain);
  } else {
    source.connect(gainNode);
  }

  // 4. Fade In & Fade Out Automation
  const fadeGainNode = offlineCtx.createGain();
  const effFadeInSec = settings.fadeInEnabled && settings.fadeInDuration > 0
    ? Math.min(settings.fadeInDuration / speedUpFactor, totalDuration / 2)
    : 0;
  const effFadeOutSec = settings.fadeOutEnabled && settings.fadeOutDuration > 0
    ? Math.min(settings.fadeOutDuration / speedUpFactor, totalDuration / 2)
    : 0;

  // Apply Fade In ramp from 0 to 1
  if (effFadeInSec > 0.001) {
    fadeGainNode.gain.setValueAtTime(0.0001, 0);
    fadeGainNode.gain.linearRampToValueAtTime(1.0, effFadeInSec);
  } else {
    fadeGainNode.gain.setValueAtTime(1.0, 0);
  }

  // Apply Fade Out ramp from 1 to 0 at the end of audio
  if (effFadeOutSec > 0.001) {
    const fadeOutStart = Math.max(effFadeInSec, totalDuration - effFadeOutSec);
    fadeGainNode.gain.setValueAtTime(1.0, fadeOutStart);
    fadeGainNode.gain.linearRampToValueAtTime(0.0001, totalDuration);
  }

  // Connect wet/dry or direct gain into fadeGainNode
  if (wetGain && dryGain) {
    wetGain.connect(fadeGainNode);
    dryGain.connect(fadeGainNode);
  } else {
    gainNode.connect(fadeGainNode);
  }

  // 5. Output Stage & Anti-Clipping Protection
  // If preserveQuality is enabled, use musical soft-saturation (tanh curve) to prevent
  // digital wrap-around clipping while FULLY ALLOWING amplified loudness (+3dB to +18dB)
  // without any squashing compressor pumping.
  if (settings.preserveQuality) {
    const saturator = createSoftSaturationNode(offlineCtx);
    fadeGainNode.connect(saturator);
    saturator.connect(offlineCtx.destination);
  } else {
    fadeGainNode.connect(offlineCtx.destination);
  }

  onProgress?.(50);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  onProgress?.(85);

  // Encode to 16-bit PCM WAV
  const wavBlob = audioBufferToWav(renderedBuffer);
  onProgress?.(85);

  let oggBlob: Blob | undefined;
  let mainBlob = wavBlob;

  if (settings.outputFormat === 'ogg') {
    try {
      oggBlob = await convertWavToOgg(wavBlob);
      mainBlob = oggBlob;
    } catch (e) {
      console.warn('Fallback ke WAV karena konversi OGG gagal:', e);
      mainBlob = wavBlob;
    }
  }

  onProgress?.(100);

  return { processedBuffer: renderedBuffer, wavBlob, oggBlob, mainBlob };
}

/**
 * Convert WAV Blob to OGG Vorbis via server FFmpeg
 */
export async function convertWavToOgg(wavBlob: Blob): Promise<Blob> {
  const res = await fetch('/api/audio/convert?format=ogg&quality=5', {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav',
    },
    body: wavBlob,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal konversi ke OGG (Status ${res.status})`);
  }

  return await res.blob();
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
 * Strips unnecessary file extensions (.mp3, .wav, .m4a, .ogg) from the title,
 * removes clutter such as YouTube noise tags like "[Official Video]" or "(Lyrics)",
 * and removes illegal filesystem characters.
 */
export function sanitizeBaseName(rawName: string): string {
  let clean = rawName
    // Remove all trailing extensions (.mp3, .wav, .ogg, .m4a, .webm, etc.)
    .replace(/\.(mp3|wav|ogg|m4a|webm|flac|aac)$/i, '')
    // Remove bracketed YouTube noise like [Official Video], (Audio), [HD], etc.
    .replace(/\[(official|video|audio|lyrics|hd|4k|hq|remastered|mv)[^\]]*\]/gi, '')
    .replace(/\((official|video|audio|lyrics|hd|4k|hq|remastered|mv)[^)]*\)/gi, '')
    // Replace dangerous filesystem characters with clean underscores
    .replace(/[<>:"/\\|?*]/g, '_')
    // Collapse multiple underscores/spaces
    .replace(/[\s_]+/g, '_')
    .trim()
    .replace(/^_+|_+$/g, '');

  return clean || 'Audio_Roblox';
}

/**
 * Generate output file name with neat, tidy formatting options
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
  const prefix = folderConfig?.customPrefix && folderConfig.customPrefix.trim() !== ''
    ? `${folderConfig.customPrefix.trim()}_`
    : '';

  // Optional effect suffix if requested by user
  const effectParts: string[] = [];
  if (folderConfig?.includeEffectsInName) {
    if (settings.amplifyDb !== 0) {
      effectParts.push(`${settings.amplifyDb > 0 ? '+' : ''}${settings.amplifyDb}dB`);
    }
    if (settings.reverbType !== 'none') {
      effectParts.push(`rev-${settings.reverbType}`);
    }
    if (settings.fadeInEnabled) {
      effectParts.push(`fi${settings.fadeInDuration}s`);
    }
    if (settings.fadeOutEnabled) {
      effectParts.push(`fo${settings.fadeOutDuration}s`);
    }
  }
  const effectSuffix = effectParts.length > 0 ? `_${effectParts.join('_')}` : '';

  switch (style) {
    case 'clean':
      // Very clean & compact: e.g. "SongTitle_0.43.ogg" (Directly shows Roblox PlaybackSpeed)
      return `${prefix}${cleanBase}_${settings.robloxPlaybackSpeed}${effectSuffix}.${ext}`;

    case 'roblox':
      // Clear Roblox Studio tag: e.g. "SongTitle_Roblox0.43.ogg"
      return `${prefix}${cleanBase}_Roblox${settings.robloxPlaybackSpeed}${effectSuffix}.${ext}`;

    case 'original':
      // Minimalist original title: e.g. "SongTitle.ogg"
      return `${prefix}${cleanBase}${effectSuffix}.${ext}`;

    case 'detailed':
    default: {
      // Detailed format with full tags
      const speedTag = `speed${settings.speedUp}x`;
      const robloxTag = `roblox${settings.robloxPlaybackSpeed}`;
      const ampTag = settings.amplifyDb === 0 ? 'amp0dB' : `amp${settings.amplifyDb > 0 ? '+' : ''}${settings.amplifyDb}dB`;
      const revTag = settings.reverbType !== 'none' ? `_rev-${settings.reverbType}` : '';
      const fadeTag = (settings.fadeInEnabled ? `_fi${settings.fadeInDuration}s` : '') +
                      (settings.fadeOutEnabled ? `_fo${settings.fadeOutDuration}s` : '');
      return `${prefix}${cleanBase}_[${speedTag}_${robloxTag}_${ampTag}${revTag}${fadeTag}].${ext}`;
    }
  }
}
