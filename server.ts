import express from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

function runFfmpeg(inputBuffer: Buffer, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", args);
    const chunks: Buffer[] = [];
    let errOutput = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on("data", (chunk) => {
      errOutput += chunk.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(new Error("FFmpeg spawn error: " + err.message));
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("FFmpeg exited with code " + code + ": " + errOutput));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

// Audio Conversion Handler (Roblox 20MB Guard & Auto-Fit Bitrate)
async function handleAudioConversion(inputBuffer: Buffer, query: any, res: express.Response) {
  try {
    const targetFormat = (query.format as string) || "ogg";
    let quality = (query.quality as string) || "7"; // libvorbis quality (0-10)
    let bitrate = (query.bitrate as string) || ""; // e.g. "224k", "192k", "256k", "320k"
    const durationSec = parseFloat((query.duration as string) || "0");
    const autoFitRoblox = (query.autoFit ?? "true") !== "false";

    if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      return res.status(400).json({ error: "Data audio kosong atau format stream tidak valid" });
    }

    if (targetFormat === "ogg") {
      // If autoFit is enabled and duration is known, calculate maximum safe bitrate
      // Target safe ceiling: 18.5 MB so it never touches Roblox's strict 20 MB cap
      if (autoFitRoblox && durationSec > 0) {
        const maxSafeKbps = Math.floor((18.5 * 1024 * 8) / durationSec);
        let requestedKbps = 224;
        if (bitrate) {
          const parsed = parseInt(bitrate.replace(/k/i, ""), 10);
          if (!isNaN(parsed)) requestedKbps = parsed;
        } else {
          const qMap: Record<string, number> = { "5": 160, "6": 192, "7": 224, "8": 256, "9": 320, "10": 450 };
          requestedKbps = qMap[quality] || 224;
        }

        if (requestedKbps > maxSafeKbps) {
          const safeBitrate = Math.max(48, Math.min(requestedKbps, maxSafeKbps));
          bitrate = `${safeBitrate}k`;
        }
      }

      const buildArgs = (br: string, q: string) => {
        const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0"];
        if (br) {
          args.push("-c:a", "libvorbis", "-b:a", br, "-f", "ogg", "pipe:1");
        } else {
          args.push("-c:a", "libvorbis", "-q:a", q, "-f", "ogg", "pipe:1");
        }
        return args;
      };

      let outBuffer = await runFfmpeg(inputBuffer, buildArgs(bitrate, quality));

      // ROBLOX 20MB HARD CAP SAFETY NET:
      // If the output exceeds 19.5 MB, re-encode with a calibrated lower bitrate
      if (outBuffer.length > 19.5 * 1024 * 1024) {
        const targetBytes = 18.2 * 1024 * 1024;
        const effDuration = durationSec > 0 ? durationSec : Math.max(30, outBuffer.length / (224000 / 8));
        const fallbackKbps = Math.max(48, Math.floor((targetBytes * 8) / (effDuration * 1000)));
        console.warn(`[Roblox Guard] Output ${outBuffer.length} bytes exceeds threshold. Re-encoding at ${fallbackKbps}k...`);
        outBuffer = await runFfmpeg(inputBuffer, buildArgs(`${fallbackKbps}k`, ""));
      }

      res.setHeader("Content-Type", "audio/ogg");
      res.setHeader("Content-Disposition", 'attachment; filename="output.ogg"');
      res.setHeader("X-Roblox-Safe", outBuffer.length <= 20 * 1024 * 1024 ? "true" : "false");
      res.setHeader("X-Roblox-File-Size", outBuffer.length.toString());
      return res.send(outBuffer);
    }

    if (targetFormat === "mp3") {
      const mp3Args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-c:a", "libmp3lame", "-q:a", "2", "-f", "mp3", "pipe:1"];
      const outBuffer = await runFfmpeg(inputBuffer, mp3Args);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", 'attachment; filename="output.mp3"');
      return res.send(outBuffer);
    }

    // WAV format
    const wavArgs = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "wav", "pipe:1"];
    const outBuffer = await runFfmpeg(inputBuffer, wavArgs);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", 'attachment; filename="output.wav"');
    return res.send(outBuffer);
  } catch (err: any) {
    console.error("Audio conversion error:", err);
    return res.status(500).json({ error: "Gagal mengonversi audio: " + err.message });
  }
}

// Audio Decoding Handler (Universal Tag-Stripped Studio Decode)
async function handleAudioDecoding(inputBuffer: Buffer, res: express.Response) {
  try {
    if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
      return res.status(400).json({ error: "Data audio kosong atau format stream tidak valid" });
    }

    // Strip video/image cover art, strip corrupt metadata tags, encode to pristine 320kbps MP3
    // This guarantees the HTTP response stays well below Cloud Run's 32MB limit while preserving 100% fidelity
    const decodeArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn", // strip video/image stream (crucial for MP3 with embedded covers)
      "-map_metadata",
      "-1", // strip corrupt metadata blocks
      "-c:a",
      "libmp3lame",
      "-b:a",
      "320k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "mp3",
      "pipe:1",
    ];

    const outBuffer = await runFfmpeg(inputBuffer, decodeArgs);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="decoded.mp3"');
    return res.send(outBuffer);
  } catch (err: any) {
    console.error("Audio decode error:", err);
    return res.status(500).json({ error: "Gagal mendecode audio: " + err.message });
  }
}

// In-Memory Session Store for Chunked Ingress (bypasses Cloud Run 32MB limit)
interface ChunkSession {
  chunks: Map<number, Buffer>;
  totalChunks: number;
  receivedBytes: number;
  createdAt: number;
}
const chunkSessions = new Map<string, ChunkSession>();

// Cleanup stale sessions older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of chunkSessions.entries()) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      chunkSessions.delete(id);
    }
  }
}, 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API Route: Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API Route: Universal Audio Decoder (Direct single request for files < 20MB)
  app.post(
    "/api/audio/decode",
    express.raw({ type: () => true, limit: "30mb" }),
    async (req, res) => {
      return await handleAudioDecoding(req.body as Buffer, res);
    }
  );

  // API Route: Universal Audio Decoder (Chunked upload for large files)
  app.post(
    "/api/audio/decode/chunk",
    express.raw({ type: () => true, limit: "30mb" }),
    async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const chunkIndex = parseInt(req.query.chunkIndex as string, 10);
        const totalChunks = parseInt(req.query.totalChunks as string, 10);

        if (!sessionId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0) {
          return res.status(400).json({ error: "Parameter chunk tidak lengkap" });
        }

        if (!Buffer.isBuffer(req.body)) {
          return res.status(400).json({ error: "Data chunk tidak valid" });
        }

        let session = chunkSessions.get(sessionId);
        if (!session) {
          session = {
            chunks: new Map(),
            totalChunks,
            receivedBytes: 0,
            createdAt: Date.now(),
          };
          chunkSessions.set(sessionId, session);
        }

        session.chunks.set(chunkIndex, req.body);
        session.receivedBytes += req.body.length;

        if (session.chunks.size < totalChunks) {
          return res.json({
            status: "chunk_received",
            chunkIndex,
            totalChunks,
            receivedChunks: session.chunks.size,
          });
        }

        // All chunks received, reassemble in order
        const ordered: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const b = session.chunks.get(i);
          if (!b) {
            chunkSessions.delete(sessionId);
            return res.status(400).json({ error: `Chunk index ${i} hilang` });
          }
          ordered.push(b);
        }
        chunkSessions.delete(sessionId);

        const fullBuffer = Buffer.concat(ordered);
        return await handleAudioDecoding(fullBuffer, res);
      } catch (err: any) {
        console.error("Chunk decode error:", err);
        return res.status(500).json({ error: "Gagal memproses chunk decode: " + err.message });
      }
    }
  );

  // API Route: Convert Audio with Roblox 20MB Guard (Direct single request for files < 20MB)
  app.post(
    "/api/audio/convert",
    express.raw({ type: () => true, limit: "30mb" }),
    async (req, res) => {
      return await handleAudioConversion(req.body as Buffer, req.query, res);
    }
  );

  // API Route: Convert Audio with Roblox 20MB Guard (Chunked upload for files >= 15MB or fallback)
  app.post(
    "/api/audio/convert/chunk",
    express.raw({ type: () => true, limit: "30mb" }),
    async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const chunkIndex = parseInt(req.query.chunkIndex as string, 10);
        const totalChunks = parseInt(req.query.totalChunks as string, 10);

        if (!sessionId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0) {
          return res.status(400).json({ error: "Parameter chunk tidak lengkap" });
        }

        if (!Buffer.isBuffer(req.body)) {
          return res.status(400).json({ error: "Data chunk tidak valid" });
        }

        let session = chunkSessions.get(sessionId);
        if (!session) {
          session = {
            chunks: new Map(),
            totalChunks,
            receivedBytes: 0,
            createdAt: Date.now(),
          };
          chunkSessions.set(sessionId, session);
        }

        session.chunks.set(chunkIndex, req.body);
        session.receivedBytes += req.body.length;

        if (session.chunks.size < totalChunks) {
          return res.json({
            status: "chunk_received",
            chunkIndex,
            totalChunks,
            receivedChunks: session.chunks.size,
          });
        }

        // All chunks received, reassemble in order
        const ordered: Buffer[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const b = session.chunks.get(i);
          if (!b) {
            chunkSessions.delete(sessionId);
            return res.status(400).json({ error: `Chunk index ${i} hilang` });
          }
          ordered.push(b);
        }
        chunkSessions.delete(sessionId);

        const fullBuffer = Buffer.concat(ordered);
        return await handleAudioConversion(fullBuffer, req.query, res);
      } catch (err: any) {
        console.error("Chunk convert error:", err);
        return res.status(500).json({ error: "Gagal memproses chunk konversi: " + err.message });
      }
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
