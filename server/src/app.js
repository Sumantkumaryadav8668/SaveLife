import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// ── CORS ──
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Body parsers ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Simple cookie parser (no extra dependency) ──
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const [key, ...val] = cookie.split('=');
      if (key) req.cookies[key.trim()] = val.join('=').trim();
    });
  }
  next();
});

// ── Serve local uploads (fallback when Cloudinary is not configured) ──
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ──
app.get('/', (req, res) =>
  res.json({ success: true, message: 'LifeSave – SDEC API is running', version: '1.0.0' })
);

// ── All API routes (single mount point) ──
app.use('/api', router);

// ── 404 handler ──
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

// ── Global error handler ──
app.use(errorHandler);

export default app;
