const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dangun-01-secret-key';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const STORAGE_BUCKET = 'dangun-products';

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dangun_01_products (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES dangun_01_users(id) ON DELETE CASCADE,
      title VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(50) NOT NULL DEFAULT '기타',
      status VARCHAR(20) NOT NULL DEFAULT '판매중',
      images JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  dbInitialized = true;
  console.log('DB tables ready');
}

// Middleware
app.use(express.json({ limit: '5mb' }));

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

// --- Supabase Storage Init ---
let storageReady = false;
async function initStorage() {
  if (storageReady || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`, {
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY },
    });
    if (!res.ok) {
      await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: STORAGE_BUCKET, name: STORAGE_BUCKET, public: true }),
      });
      console.log('Storage bucket created:', STORAGE_BUCKET);
    }
    storageReady = true;
  } catch (err) {
    console.error('Storage init error:', err.message);
  }
}

// --- Upload API ---
app.post('/api/upload', auth, async (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ success: false, message: 'Storage not configured' });
    }
    await initStorage();

    const { image } = req.body;
    if (!image) return res.status(400).json({ success: false, message: '이미지가 필요합니다' });

    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ success: false, message: '올바른 이미지 형식이 아닙니다' });

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': `image/${matches[1]}`,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error('Supabase upload error:', errText);
      return res.status(500).json({ success: false, message: '이미지 업로드 실패' });
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filename}`;
    res.json({ success: true, data: { url: publicUrl } });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

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

// --- Product API ---

app.get('/api/products', async (req, res) => {
  try {
    const { category, status, user_id } = req.query;
    let query = `
      SELECT p.*, u.nickname, u.location
      FROM dangun_01_products p
      JOIN dangun_01_users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (category && category !== '전체') {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }
    if (user_id) {
      params.push(parseInt(user_id));
      query += ` AND p.user_id = $${params.length}`;
    }
    query += ' ORDER BY p.created_at DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Products list error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nickname, u.location, u.profile_image
       FROM dangun_01_products p
       JOIN dangun_01_users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Product get error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.post('/api/products', auth, async (req, res) => {
  try {
    const { title, description, price, category, images } = req.body;
    if (!title || price === undefined || price === null) {
      return res.status(400).json({ success: false, message: '제목과 가격을 입력해주세요' });
    }
    const result = await pool.query(
      `INSERT INTO dangun_01_products (user_id, title, description, price, category, images)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, title, description || '', parseInt(price), category || '기타', JSON.stringify(images || [])]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Product create error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM dangun_01_products WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다' });
    }
    if (check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '수정 권한이 없습니다' });
    }
    const { title, description, price, category, status, images } = req.body;
    const result = await pool.query(
      `UPDATE dangun_01_products SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        category = COALESCE($4, category),
        status = COALESCE($5, status),
        images = COALESCE($6, images),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *`,
      [title, description, price !== undefined ? parseInt(price) : null, category, status, images ? JSON.stringify(images) : null, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Product update error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  try {
    const check = await pool.query('SELECT user_id FROM dangun_01_products WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: '상품을 찾을 수 없습니다' });
    }
    if (check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다' });
    }
    await pool.query('DELETE FROM dangun_01_products WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: '삭제되었습니다' });
  } catch (err) {
    console.error('Product delete error:', err.message);
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
