import { formatDuration } from './audioEngine';

export interface ParsedTrack {
  id: string;
  trackNumber: number;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  startTimeFormatted: string;
  endTimeFormatted: string;
  selected: boolean;
}

/**
 * Converts HH:MM:SS or MM:SS to seconds
 */
export function timeStringToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Formats seconds to HH:MM:SS or MM:SS
 */
export function secondsToTimeString(totalSec: number, forceHours = false): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0 || forceHours) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Clean up title: strips unwanted track numbers (e.g. "26. Love Me Not" -> "Love Me Not")
 * and trailing or leading punctuation.
 */
export function cleanTrackTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();
  // Strip leading track numbers like "01. ", "1 - ", "26. "
  cleaned = cleaned.replace(/^\d+[\.\-\)]\s*/, '');
  // Strip leading / trailing dashes, pipes, colons
  cleaned = cleaned.replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '').trim();
  return cleaned || 'Untitled Track';
}

/**
 * Parse raw text containing timestamp lines like:
 * "00:00:00 Still Into You (WENNAZ 'HIPDUT' Edit)"
 * "00:02:08 One Time (WENNAZ 'HIPDUT' Edit)"
 * "[02:08] Song Title"
 * "Song Title - 02:08"
 */
export function parseTimestampsFromText(
  text: string,
  totalMediaDuration?: number
): ParsedTrack[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const rawTracks: { title: string; startTime: number }[] = [];

  // Regex patterns for timestamp matching:
  // Pattern 1: Timestamp at the start of the line (e.g. "00:02:08 Title" or "1. [02:08] Title")
  const startPattern = /^(?:(?:\d+[\.\-\)]\s*)?(?:\[|\()?(\d{1,2}:[0-5]?\d:[0-5]\d|[0-5]?\d:[0-5]\d)(?:\]|\))?)\s*[-–—|:]*\s*(.*)$/;

  // Pattern 2: Timestamp at the end of the line (e.g. "Title - 00:02:08" or "Title [02:08]")
  const endPattern = /^(.*?)\s*[-–—|:]*\s*(?:\[|\()?(\d{1,2}:[0-5]?\d:[0-5]\d|[0-5]?\d:[0-5]\d)(?:\]|\))?\s*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check Pattern 1: Timestamp at beginning
    const startMatch = line.match(startPattern);
    if (startMatch && startMatch[1]) {
      const timeStr = startMatch[1];
      const title = cleanTrackTitle(startMatch[2]);
      const startTime = timeStringToSeconds(timeStr);
      rawTracks.push({ title, startTime });
      continue;
    }

    // Check Pattern 2: Timestamp at end
    const endMatch = line.match(endPattern);
    if (endMatch && endMatch[2]) {
      const timeStr = endMatch[2];
      const title = cleanTrackTitle(endMatch[1]);
      const startTime = timeStringToSeconds(timeStr);
      rawTracks.push({ title, startTime });
      continue;
    }
  }

  if (rawTracks.length === 0) return [];

  // Sort by startTime
  rawTracks.sort((a, b) => a.startTime - b.startTime);

  // Remove duplicate start times
  const uniqueTracks: { title: string; startTime: number }[] = [];
  for (const t of rawTracks) {
    if (
      uniqueTracks.length === 0 ||
      uniqueTracks[uniqueTracks.length - 1].startTime !== t.startTime
    ) {
      uniqueTracks.push(t);
    }
  }

  // Build final ParsedTrack objects with endTime and duration
  const tracks: ParsedTrack[] = [];
  for (let i = 0; i < uniqueTracks.length; i++) {
    const cur = uniqueTracks[i];
    let endTime: number;

    if (i < uniqueTracks.length - 1) {
      endTime = uniqueTracks[i + 1].startTime;
    } else {
      endTime =
        totalMediaDuration && totalMediaDuration > cur.startTime
          ? totalMediaDuration
          : cur.startTime + 180; // default 3 min if end is unknown
    }

    const duration = Math.max(0, endTime - cur.startTime);

    tracks.push({
      id: `track-${i + 1}-${cur.startTime}`,
      trackNumber: i + 1,
      title: cur.title || `Track ${i + 1}`,
      startTime: cur.startTime,
      endTime,
      duration,
      startTimeFormatted: secondsToTimeString(cur.startTime),
      endTimeFormatted: secondsToTimeString(endTime),
      selected: true,
    });
  }

  return tracks;
}

/**
 * Slice an AudioBuffer into a new AudioBuffer between startSec and endSec
 */
export function sliceAudioBuffer(
  sourceBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  audioCtx: AudioContext | OfflineAudioContext
): AudioBuffer {
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;
  const totalDuration = sourceBuffer.duration;

  const clampedStart = Math.max(0, Math.min(startSec, totalDuration));
  const clampedEnd = Math.max(clampedStart, Math.min(endSec, totalDuration));

  const startFrame = Math.floor(clampedStart * sampleRate);
  const endFrame = Math.floor(clampedEnd * sampleRate);
  const frameCount = Math.max(1, endFrame - startFrame);

  const slicedBuffer = audioCtx.createBuffer(numChannels, frameCount, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const srcData = sourceBuffer.getChannelData(ch);
    const subData = srcData.subarray(startFrame, endFrame);
    slicedBuffer.copyToChannel(subData, ch, 0);
  }

  return slicedBuffer;
}
