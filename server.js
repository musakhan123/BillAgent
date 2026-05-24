require('dotenv').config();

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { analyzeBill } = require('./src/agent');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── Multer ────────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpe?g|png|webp|gif|pdf)$/i;
    allowed.test(path.extname(file.originalname))
      ? cb(null, true)
      : cb(new Error('Only JPG, PNG, WebP, GIF, or PDF files are allowed.'));
  },
});

// ── POST /analyze ─────────────────────────────────────────────────────────────
app.post('/analyze', upload.single('bill'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Use field name "bill".' });
  }

  try {
    const result = await analyzeBill(req.file.path);
    fs.unlink(req.file.path, () => {});
    if (result.error) return res.status(500).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: err.message });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bijli Agent running → http://localhost:${PORT}`);
});
//