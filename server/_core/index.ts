import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { validateDownloadToken, recordTokenUsage } from "../emailDelivery";
import { storageGetSignedUrl } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ── Public signed download endpoint ──────────────────────────────────────────────────
  // Validates HMAC-SHA256 signature, expiry, and download limit before
  // redirecting to a presigned S3 GET URL. No auth cookie required —
  // the token IS the credential. Safe to embed in emails.
  app.get("/api/download/:token", async (req, res) => {
    const { token } = req.params as { token: string };
    try {
      const result = await validateDownloadToken(token);

      if (!result.valid) {
        const messages: Record<string, string> = {
          not_found: "This download link is invalid or has already been used.",
          expired: "This download link has expired. Please visit your Order History to generate a new one.",
          limit_exceeded: "This download link has reached its maximum use limit. Please visit your Order History to generate a new one.",
          tampered: "This download link has been tampered with and cannot be used.",
        };
        const msg = messages[result.reason] ?? "Invalid download link.";
        return res.status(410).send(`<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Download Link Expired</title><style>body{font-family:sans-serif;background:#060f1e;color:#f0e6c8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:40px;max-width:480px;text-align:center}h1{color:#c9a84c}p{color:#8a9bb5;line-height:1.6}a{color:#c9a84c}</style></head><body><div class='box'><h1>&#128274; Link Unavailable</h1><p>${msg}</p><a href='/profile'>Go to Order History →</a></div></body></html>`);
      }

      const { record, book } = result;

      if (!book.fileKey) {
        return res.status(404).send("Book file not found.");
      }

      // Increment download counter before redirecting
      await recordTokenUsage(record.id, record.downloadCount);

      // Get a fresh presigned S3 URL (valid for 15 minutes)
      const s3Url = await storageGetSignedUrl(book.fileKey);

      // Set content-disposition so browser downloads with the correct filename
      const fileName = book.fileName || `${book.title}.pdf`;
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/"/g, "'")}"`); 
      res.setHeader("X-Book-Hash", book.fileHash || "");
      res.setHeader("X-Download-Remaining", String(record.maxDownloads - record.downloadCount - 1));

      return res.redirect(302, s3Url);
    } catch (err) {
      console.error("[download] Error processing token:", err);
      return res.status(500).send("An error occurred processing your download.");
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
