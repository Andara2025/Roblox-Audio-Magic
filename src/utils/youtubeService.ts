export interface YouTubeChapter {
  title: string;
  start_time: number;
}

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  description?: string;
  chapters?: YouTubeChapter[];
}

export function isValidYouTubeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const pattern = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?.*v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  return pattern.test(url.trim());
}

export function extractYouTubeId(url: string): string | null {
  const match = url.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export async function fetchYouTubeInfo(url: string): Promise<YouTubeVideoInfo> {
  const trimmed = url.trim();
  const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Gagal mengambil info YouTube (Status: ${res.status})`);
  }
  return await res.json();
}

export async function downloadYouTubeAudio(
  url: string,
  onProgress?: (receivedBytes: number) => void
): Promise<{ blob: Blob; fileName: string }> {
  const trimmed = url.trim();
  const res = await fetch(`/api/youtube/stream?url=${encodeURIComponent(trimmed)}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Gagal mengunduh audio YouTube (Status: ${res.status})`);
  }

  // Determine filename from Content-Disposition header if available
  const disposition = res.headers.get('Content-Disposition');
  let fileName = 'youtube_audio.mp3';
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      fileName = match[1];
    }
  }

  const blob = await res.blob();
  return { blob, fileName };
}
