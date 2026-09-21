import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

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
          res.status(500).json({ error: "Gagal mengonversi audio: " + errOutput });
        }
      });
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
