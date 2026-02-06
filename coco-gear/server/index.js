import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import authRoutes from './routes/auth.js';
import kitRoutes from './routes/kits.js';
import typeRoutes from './routes/types.js';
import componentRoutes from './routes/components.js';
import locationRoutes from './routes/locations.js';
import departmentRoutes from './routes/departments.js';
import personnelRoutes from './routes/personnel.js';
import consumableRoutes from './routes/consumables.js';
import assetRoutes from './routes/assets.js';
import reservationRoutes from './routes/reservations.js';
import maintenanceRoutes from './routes/maintenance.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import reportRoutes from './routes/reports.js';
import { authMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

// ─── Middleware ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS for development (Vite dev server on :5173)
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }));
}

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── File upload setup ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  },
});

// ─── Photo upload endpoint ───
app.post('/api/upload', authMiddleware, upload.array('photos', 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  const files = req.files.map(f => ({
    filename: f.filename,
    originalName: f.originalname,
    size: f.size,
    url: `/uploads/${f.filename}`,
  }));
  res.json({ files });
});

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/consumables', consumableRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);

// ─── Health check ───
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// ─── Serve frontend in production ───
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// ─── Error handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Ensure a default admin user exists ───
async function ensureDefaultUser() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const pin = await bcrypt.hash('password', 10);
      const user = await prisma.user.create({
        data: {
          name: 'Admin',
          title: 'System Administrator',
          role: 'super',
          pin,
        },
      });
      console.log('');
      console.log('══════════════════════════════════════════════');
      console.log('  No users found — created default admin user');
      console.log('  Name:     Admin');
      console.log('  Password: password');
      console.log('  Role:     super');
      console.log('  ** Change this password after first login **');
      console.log('══════════════════════════════════════════════');
      console.log('');
    }
  } catch (err) {
    console.error('Failed to check/create default user:', err.message);
  }
}

// ─── Start ───
ensureDefaultUser().then(() => {
  app.listen(PORT, () => {
    console.log(`COCO Gear server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

export default app;
