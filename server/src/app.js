import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import router from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// ── CORS Configuration ──
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

// ── Rate Limiters (Security Hardening) ──
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth requests, please try again in 15 minutes.' }
});

const sosTriggerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 SOS triggers per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many emergency triggers initiated. Please try again shortly.' }
});

// Apply specific rate limits
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/sos/trigger', sosTriggerLimiter);
app.use('/api', generalApiLimiter);

// ── Serve local uploads (fallback when Cloudinary is not configured) ──
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ──
app.get('/', (req, res) =>
  res.json({ success: true, message: 'LifeSave – SDEC API is running', version: '1.0.0' })
);

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    database: dbStatus
  });
});

// ── All API routes (single mount point) ──
app.use('/api', router);

// ── 404 handler ──
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

// ── Global error handler ──
app.use(errorHandler);

export default app;
