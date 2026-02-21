if (require.main === module) {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'lueur-ecommerce-secret-key';

const KAKAO_REST_API_KEY = (process.env.KAKAO_REST_API_KEY || '').trim();
const KAKAO_CLIENT_SECRET = (process.env.KAKAO_CLIENT_SECRET || '').trim();
const KAKAO_REDIRECT_URI = (process.env.KAKAO_REDIRECT_URI || '').trim();

const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

// Lazy DB initialization
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE,
      password VARCHAR(255),
      nickname VARCHAR(50) NOT NULL,
      email VARCHAR(100),
      phone VARCHAR(20),
      profile_image TEXT,
      kakao_id VARCHAR(100) UNIQUE,
      provider VARCHAR(20) NOT NULL DEFAULT 'local',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Add profile_image column if missing (for existing tables)
  await pool.query(`
    ALTER TABLE ecommerce_01_users ADD COLUMN IF NOT EXISTS profile_image TEXT
  `).catch(() => {});
  dbInitialized = true;
  console.log('DB tables ready');
}

// Middleware
app.use(express.json({ limit: '5mb' }));

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

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, nickname: user.nickname, provider: user.provider },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    profile_image: user.profile_image,
    provider: user.provider,
    created_at: user.created_at,
  };
}

// --- Auth API ---

// Register (local)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, nickname, email, phone } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ success: false, message: '아이디, 비밀번호, 닉네임을 모두 입력해주세요' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '비밀번호는 6자 이상이어야 합니다' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO ecommerce_01_users (username, password, nickname, email, phone, provider)
       VALUES ($1, $2, $3, $4, $5, 'local')
       RETURNING *`,
      [username, hashed, nickname, email || null, phone || null]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ success: true, data: { token, user: sanitizeUser(user) } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 존재하는 아이디입니다' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// Login (local)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요' });
    }
    const result = await pool.query(
      'SELECT * FROM ecommerce_01_users WHERE username = $1 AND provider = $2',
      [username, 'local']
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다' });
    }
    const token = generateToken(user);
    res.json({ success: true, data: { token, user: sanitizeUser(user) } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// Kakao OAuth callback
app.get('/api/auth/kakao/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect('/#/login?error=카카오 인증에 실패했습니다');
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        ...(KAKAO_CLIENT_SECRET && { client_secret: KAKAO_CLIENT_SECRET }),
        redirect_uri: KAKAO_REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    console.log('Kakao token response:', JSON.stringify(tokenData));
    console.log('Used client_id:', KAKAO_REST_API_KEY);
    console.log('Used redirect_uri:', KAKAO_REDIRECT_URI);
    if (!tokenData.access_token) {
      console.error('Kakao token error:', tokenData);
      return res.redirect('/#/login?error=' + encodeURIComponent(tokenData.error_description || '카카오 토큰 발급에 실패했습니다'));
    }

    // Get user info
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const kakaoUser = await userRes.json();
    const kakaoId = String(kakaoUser.id);
    const kakaoNickname = kakaoUser.properties?.nickname || '카카오 사용자';
    const kakaoEmail = kakaoUser.kakao_account?.email || null;
    const kakaoProfileImage = kakaoUser.properties?.profile_image || null;

    // Find or create user
    let result = await pool.query(
      'SELECT * FROM ecommerce_01_users WHERE kakao_id = $1',
      [kakaoId]
    );

    let user;
    if (result.rows.length > 0) {
      // Update nickname and profile image on each login
      const updateResult = await pool.query(
        `UPDATE ecommerce_01_users SET nickname = $1, profile_image = COALESCE($2, profile_image), email = COALESCE($3, email) WHERE kakao_id = $4 RETURNING *`,
        [kakaoNickname, kakaoProfileImage, kakaoEmail, kakaoId]
      );
      user = updateResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO ecommerce_01_users (nickname, email, profile_image, kakao_id, provider)
         VALUES ($1, $2, $3, $4, 'kakao')
         RETURNING *`,
        [kakaoNickname, kakaoEmail, kakaoProfileImage, kakaoId]
      );
      user = insertResult.rows[0];
    }

    const jwtToken = generateToken(user);
    res.redirect(`/#/kakao-callback?token=${jwtToken}`);
  } catch (err) {
    console.error('Kakao callback error:', err.message);
    res.redirect('/#/login?error=카카오 로그인 처리 중 오류가 발생했습니다');
  }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ecommerce_01_users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
    }
    res.json({ success: true, data: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error('Me error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// Update profile
app.put('/api/auth/profile', auth, async (req, res) => {
  try {
    const { nickname, email, phone } = req.body;
    const result = await pool.query(
      `UPDATE ecommerce_01_users SET
        nickname = COALESCE($1, nickname),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone)
      WHERE id = $4
      RETURNING *`,
      [nickname, email, phone, req.user.id]
    );
    res.json({ success: true, data: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, message: '서버 오류' });
  }
});

// Kakao config (public - only returns redirect URI for frontend)
app.get('/api/auth/kakao/config', (_req, res) => {
  if (!KAKAO_REST_API_KEY || !KAKAO_REDIRECT_URI) {
    return res.json({ success: true, data: { enabled: false } });
  }
  res.json({
    success: true,
    data: {
      enabled: true,
      clientId: KAKAO_REST_API_KEY,
      redirectUri: KAKAO_REDIRECT_URI,
    },
  });
});

// Privacy policy page (required by Kakao)
app.get('/api/privacy', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>개인정보처리방침 - LUEUR</title><style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8}h1{font-size:20px}h2{font-size:16px;margin-top:24px}p{font-size:14px}</style></head><body><h1>개인정보처리방침</h1><p>LUEUR(이하 "서비스")는 이용자의 개인정보를 중요시하며, 개인정보보호법을 준수합니다.</p><h2>1. 수집하는 개인정보</h2><p>회원가입 시: 아이디, 비밀번호, 닉네임, 이메일(선택)<br/>카카오 로그인 시: 카카오 계정 닉네임, 이메일(선택)</p><h2>2. 개인정보의 이용 목적</h2><p>서비스 제공 및 회원 관리, 본인 확인</p><h2>3. 개인정보의 보유 및 파기</h2><p>회원 탈퇴 시 즉시 파기합니다.</p><h2>4. 문의</h2><p>개인정보 관련 문의는 서비스 내 고객센터를 이용해주세요.</p></body></html>`);
});

// SPA fallback
if (require.main === module) {
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
