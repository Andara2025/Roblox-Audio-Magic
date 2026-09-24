import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Route: Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Convert Audio (e.g. WAV -> OGG Vorbis for Roblox)
  // Strips any attached cover art/video stream (-vn -sn) to keep file lightweight and avoid encoder failure
  app.post(
    "/api/audio/convert",
    express.raw({ type: ["audio/*", "application/octet-stream"], limit: "150mb" }),
    (req, res) => {
      const targetFormat = (req.query.format as string) || "ogg";
      const quality = (req.query.quality as string) || "8"; // default 8 (256kbps)
      const bitrate = (req.query.bitrate as string) || ""; // e.g. "256k", "320k", "224k"

      if (!req.body || (req.body as Buffer).length === 0) {
        return res.status(400).json({ error: "Data audio kosong" });
      }

      const ffmpegArgs = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn", // Drop embedded album art / thumbnail video stream
        "-sn", // Drop subtitle streams
        "-map_metadata",
        "-1", // Clear heavy ID3 tags and embedded images
      ];

      if (targetFormat === "ogg") {
        if (bitrate) {
          ffmpegArgs.push("-c:a", "libvorbis", "-b:a", bitrate, "-f", "ogg", "pipe:1");
        } else {
          ffmpegArgs.push("-c:a", "libvorbis", "-q:a", quality, "-f", "ogg", "pipe:1");
        }
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

      ffmpeg.stdin.on("error", (err) => {
        console.warn("FFmpeg convert stdin error:", err.message);
      });

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
          res.status(500).json({ error: "Gagal mengonversi audio: " + errOutput });
        }
      });
    }
  );

  // API Route: Strip heavy cover art / video and extract clean PCM WAV
  // Solves browser decodeAudioData crash on files with large embedded cover art (APIC/ID3)
  app.post(
    "/api/audio/strip-cover",
    express.raw({ type: ["audio/*", "application/octet-stream"], limit: "150mb" }),
    (req, res) => {
      if (!req.body || (req.body as Buffer).length === 0) {
        return res.status(400).json({ error: "Data audio kosong" });
      }

      const ffmpegArgs = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn", // Strip cover art image
        "-sn",
        "-map",
        "0:a:0?", // Select primary audio stream only
        "-f",
        "wav",
        "pipe:1",
      ];

      const ffmpeg = spawn("ffmpeg", ffmpegArgs);
      const chunks: Buffer[] = [];

      ffmpeg.stdin.on("error", (err) => {
        console.warn("FFmpeg strip-cover stdin error:", err.message);
      });

      ffmpeg.stdout.on("data", (chunk) => {
        chunks.push(chunk);
      });

      let errOutput = "";
      ffmpeg.stderr.on("data", (chunk) => {
        errOutput += chunk.toString();
      });

      ffmpeg.on("error", (err) => {
        console.error("FFmpeg decode spawn error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Gagal decode audio: " + err.message });
        }
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0 && !res.headersSent) {
          console.error("FFmpeg strip-cover exited with code", code, errOutput);
          return res.status(500).json({ error: "Gagal mengekstrak audio: " + errOutput });
        }

        const fullBuffer = Buffer.concat(chunks);
        // Fix RIFF and data chunk sizes in WAV header so browser AudioContext doesn't reject it
        if (fullBuffer.length > 44 && fullBuffer.toString("ascii", 0, 4) === "RIFF") {
          fullBuffer.writeUInt32LE(fullBuffer.length - 8, 4);
          const dataIdx = fullBuffer.indexOf("data");
          if (dataIdx !== -1 && dataIdx + 8 <= fullBuffer.length) {
            fullBuffer.writeUInt32LE(fullBuffer.length - (dataIdx + 8), dataIdx + 4);
          }
        }

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", fullBuffer.length.toString());
        res.send(fullBuffer);
      });

      ffmpeg.stdin.write(req.body);
      ffmpeg.stdin.end();
    }
  );

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
