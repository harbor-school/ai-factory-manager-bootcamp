const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dangun-01-secret-key';

const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

// Lazy DB initialization
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dangun_01_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(50) NOT NULL,
      location VARCHAR(100) DEFAULT '서울시 강남구',
      profile_image TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  dbInitialized = true;
  console.log('DB tables ready');
}

// Middleware
app.use(express.json());

// Serve static files only in local dev (Vercel handles this via builds config)
if (require.main === module) {
  app.use(express.static(path.join(__dirname)));
}

app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB init failed:', err.message);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다' });
  }
}

// --- Auth API ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ success: false, message: '아이디, 비밀번호, 닉네임을 모두 입력해주세요' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO dangun_01_users (username, password, nickname) VALUES ($1, $2, $3) RETURNING id, username, nickname, location',
      [username, hashed, nickname]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, user } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요' });
    }
    const result = await pool.query('SELECT * FROM dangun_01_users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, nickname: user.nickname }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, nickname: user.nickname, location: user.location, profile_image: user.profile_image },
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, nickname, location, profile_image, created_at FROM dangun_01_users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.put('/api/auth/profile', auth, async (req, res) => {
  try {
    const { nickname, location } = req.body;
    const result = await pool.query(
      `UPDATE dangun_01_users SET
        nickname = COALESCE($1, nickname),
        location = COALESCE($2, location)
      WHERE id = $3
      RETURNING id, username, nickname, location, profile_image`,
      [nickname, location, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// SPA fallback -- only in local dev (Vercel uses rewrites in vercel.json)
if (require.main === module) {
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
