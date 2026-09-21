import express from "express";
import path from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";
import { Innertube } from "youtubei.js";

function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

let innertubeInstance: Innertube | null = null;
async function getInnertube(): Promise<Innertube> {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({
      retrieve_player: true,
      generate_session_locally: true,
    });
  }
  return innertubeInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Convert Audio (e.g. WAV -> OGG Vorbis for Roblox)
  app.post(
    "/api/audio/convert",
    express.raw({ type: ["audio/*", "application/octet-stream"], limit: "150mb" }),
    (req, res) => {
      const targetFormat = (req.query.format as string) || "ogg";
      const quality = (req.query.quality as string) || "5"; // libvorbis -q:a 5 is ~160kbps, clear & light

      if (!req.body || (req.body as Buffer).length === 0) {
        return res.status(400).json({ error: "Data audio kosong" });
      }

      const ffmpegArgs = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
      ];

      if (targetFormat === "ogg") {
        ffmpegArgs.push("-c:a", "libvorbis", "-q:a", quality, "-f", "ogg", "pipe:1");
        res.setHeader("Content-Type", "audio/ogg");
        res.setHeader("Content-Disposition", 'attachment; filename="output.ogg"');
      } else if (targetFormat === "mp3") {
        ffmpegArgs.push("-c:a", "libmp3lame", "-q:a", "2", "-f", "mp3", "pipe:1");
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Disposition", 'attachment; filename="output.mp3"');
      } else {
        ffmpegArgs.push("-f", "wav", "pipe:1");
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Disposition", 'attachment; filename="output.wav"');
      }

      const ffmpeg = spawn("ffmpeg", ffmpegArgs);

      ffmpeg.stdin.write(req.body);
      ffmpeg.stdin.end();

      ffmpeg.stdout.pipe(res);

      let errOutput = "";
      ffmpeg.stderr.on("data", (chunk) => {
        errOutput += chunk.toString();
      });

      ffmpeg.on("error", (err) => {
        console.error("FFmpeg spawn error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Gagal menjalankan konversi audio: " + err.message });
        }
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0 && !res.headersSent) {
          console.error("FFmpeg exited with code", code, errOutput);
          res.status(500).json({ error: "Gagal mengonversi audio ke OGG: " + errOutput });
        }
      });
    }
  );

  // API Route: YouTube Video Info
  app.get("/api/youtube/info", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "URL YouTube diperlukan" });
    }

    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: "URL YouTube tidak valid atau ID video tidak ditemukan" });
    }

    try {
      const yt = await getInnertube();
      const info = await yt.getInfo(videoId);
      const details = info.basic_info;

      const title = details.title || `YouTube Audio (${videoId})`;
      const author = details.author || "YouTube";
      const duration = details.duration || 0;
      const thumbnail =
        details.thumbnail?.[details.thumbnail.length - 1]?.url ||
        details.thumbnail?.[0]?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const description = details.short_description || "";

      return res.json({
        id: videoId,
        title,
        author,
        duration,
        thumbnail,
        description,
        chapters: [],
      });
    } catch (err: unknown) {
      console.error("Error fetching YouTube info with Innertube:", err);

      // Fallback 1: Attempt oEmbed public API (never blocked by anti-bot)
      try {
        const oembedRes = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          if (oembed && oembed.title) {
            return res.json({
              id: videoId,
              title: oembed.title,
              author: oembed.author_name || "YouTube",
              duration: 0,
              thumbnail:
                oembed.thumbnail_url ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              description: "",
              chapters: [],
            });
          }
        }
      } catch (oembedErr) {
        console.error("oEmbed fallback error:", oembedErr);
      }

      // Fallback 2: Basic fallback with video ID thumbnail
      return res.json({
        id: videoId,
        title: `YouTube Audio (${videoId})`,
        author: "YouTube",
        duration: 0,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        description: "",
        chapters: [],
      });
    }
  });

  // API Route: YouTube Audio Stream / Download
  app.get("/api/youtube/stream", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "URL YouTube diperlukan" });
    }

    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      return res.status(400).json({ error: "URL YouTube tidak valid atau ID video tidak ditemukan" });
    }

    try {
      const yt = await getInnertube();

      // Get clean title for downloaded filename
      let title = `youtube_${videoId}`;
      try {
        const basic = await yt.getBasicInfo(videoId);
        if (basic?.basic_info?.title) {
          title = basic.basic_info.title.replace(/[^a-zA-Z0-9_\- ]/g, "_") || title;
        }
      } catch {
        // fallback to default title
      }

      // Try client types with IOS first (bypasses bot checks completely), then fallbacks
      const clientCandidates = ["IOS", "TV_EMBEDDED", "WEB_EMBEDDED", "VISIONOS"];
      let webStream: any = null;
      let lastClientError: any = null;

      for (const client of clientCandidates) {
        try {
          webStream = await yt.download(videoId, {
            type: "audio",
            quality: "best",
            client: client as any,
          });
          if (webStream) {
            break;
          }
        } catch (clientErr: any) {
          lastClientError = clientErr;
          console.warn(`[YouTube.js] Client ${client} failed:`, clientErr?.message || clientErr);
        }
      }

      if (!webStream) {
        throw new Error(
          lastClientError?.message || "Tidak dapat memutar audio dari format video ini"
        );
      }

      const nodeStream = Readable.fromWeb(webStream as any);

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(title)}.mp3"`);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");

      // Transcode through FFmpeg to standard MP3 192k
      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-f",
        "mp3",
        "pipe:1",
      ]);

      nodeStream.pipe(ffmpeg.stdin);

      ffmpeg.stdin.on("error", () => {
        // Ignore EPIPE when ffmpeg stdout finishes or disconnects
      });

      nodeStream.on("error", (err) => {
        console.error("Node audio stream error:", err);
        ffmpeg.kill();
      });

      ffmpeg.stdout.pipe(res);

      let ffmpegStderr = "";
      ffmpeg.stderr.on("data", (chunk) => {
        ffmpegStderr += chunk.toString();
      });

      ffmpeg.on("error", (err) => {
        console.error("FFmpeg spawn error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Gagal memproses audio: " + err.message });
        }
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0 && !res.headersSent) {
          console.error("FFmpeg error output:", ffmpegStderr);
          res.status(500).json({ error: "Gagal memproses stream audio: " + ffmpegStderr });
        }
      });

      req.on("close", () => {
        try {
          ffmpeg.kill();
        } catch {
          // ignore
        }
      });
    } catch (err: unknown) {
      console.error("YouTube download error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Gagal mengunduh audio: " + ((err as Error).message || "Unknown error"),
        });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
