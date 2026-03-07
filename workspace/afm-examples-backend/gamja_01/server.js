// ============================================================
// gamja_01 - Daangn Market Clone Backend (server.js)
// ============================================================

const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ------------------------------------------------------------
// 1. App initialization & configuration
// ------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const DEMO_ENABLED = (process.env.DEMO_SEED || '').trim() === 'true';

// ------------------------------------------------------------
// 1b. Supabase Storage configuration
// ------------------------------------------------------------
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const STORAGE_BUCKET = 'gamja01-images';

let storageReady = false;

async function initStorage() {
  if (storageReady || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
      },
    });
    if (!res.ok) {
      // 버킷이 없을 때 Supabase는 404가 아닌 400을 반환할 수 있으므로 !res.ok로 체크
      const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: STORAGE_BUCKET,
          name: STORAGE_BUCKET,
          public: true,
        }),
      });
      if (createRes.ok) {
        console.log('Storage bucket created:', STORAGE_BUCKET);
      } else {
        const errText = await createRes.text();
        console.error('Failed to create bucket:', errText);
      }
    }
    storageReady = true;
  } catch (err) {
    console.error('Storage init error:', err.message);
  }
}

// ------------------------------------------------------------
// 2. Database connection (Supabase PostgreSQL via pooler)
// ------------------------------------------------------------
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

// ------------------------------------------------------------
// 3. Lazy DB init (cold-start safe for serverless)
// ------------------------------------------------------------
let dbInitialized = false;

async function initDB() {
  if (dbInitialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamja_01_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      nickname VARCHAR(100) NOT NULL,
      profile_image TEXT,
      manner_temp DECIMAL(3,1) DEFAULT 36.5,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      location_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamja_01_products (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES gamja_01_users(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price INTEGER DEFAULT 0,
      price_suggestion BOOLEAN DEFAULT false,
      is_free BOOLEAN DEFAULT false,
      category VARCHAR(100),
      status VARCHAR(20) DEFAULT '판매중',
      images JSONB DEFAULT '[]',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      location_name VARCHAR(255),
      view_count INTEGER DEFAULT 0,
      is_demo BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Add is_demo column for existing tables that don't have it yet
  await pool.query(`
    ALTER TABLE gamja_01_products ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
  `);

  // Likes table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamja_01_likes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES gamja_01_users(id),
      product_id INTEGER REFERENCES gamja_01_products(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    );
  `);

  // Chat rooms table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamja_01_chat_rooms (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES gamja_01_products(id),
      buyer_id INTEGER REFERENCES gamja_01_users(id),
      seller_id INTEGER REFERENCES gamja_01_users(id),
      last_message TEXT,
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(product_id, buyer_id)
    );
  `);

  // Messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamja_01_messages (
      id SERIAL PRIMARY KEY,
      room_id INTEGER REFERENCES gamja_01_chat_rooms(id),
      sender_id INTEGER REFERENCES gamja_01_users(id),
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  dbInitialized = true;
  console.log('Database tables initialized');
}

// ------------------------------------------------------------
// 3b. Demo seed (controlled by DEMO_SEED env var)
// ------------------------------------------------------------
let demoSeeded = false;

async function seedDemoData() {
  if (demoSeeded) return;
  if (!DEMO_ENABLED) {
    demoSeeded = true;
    return;
  }

  // Check if demo data already exists
  const check = await pool.query('SELECT COUNT(*) FROM gamja_01_products WHERE is_demo = true');
  if (parseInt(check.rows[0].count, 10) > 0) {
    console.log('Demo data already exists, skipping seed');
    demoSeeded = true;
    return;
  }

  console.log('Seeding demo data...');

  const passwordHash = bcrypt.hashSync('demo1234', 10);

  // Create 3 demo users (ON CONFLICT DO NOTHING)
  const demoUsers = [
    { nickname: '강남맘', email: 'demo1@test.com', manner_temp: 38.2, lat: 37.4979, lng: 127.0276, location: '서울 강남구 역삼동' },
    { nickname: '서초대디', email: 'demo2@test.com', manner_temp: 40.1, lat: 37.4919, lng: 127.0097, location: '서울 서초구 서초동' },
    { nickname: '송파거래왕', email: 'demo3@test.com', manner_temp: 42.5, lat: 37.5133, lng: 127.1001, location: '서울 송파구 잠실동' },
  ];

  const userIds = [];
  for (const u of demoUsers) {
    const result = await pool.query(
      `INSERT INTO gamja_01_users (email, password_hash, nickname, manner_temp, latitude, longitude, location_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [u.email, passwordHash, u.nickname, u.manner_temp, u.lat, u.lng, u.location]
    );

    if (result.rows.length > 0) {
      userIds.push(result.rows[0].id);
    } else {
      // User already existed, fetch their id
      const existing = await pool.query('SELECT id FROM gamja_01_users WHERE email = $1', [u.email]);
      userIds.push(existing.rows[0].id);
    }
  }

  // Demo products (user_idx maps to userIds array)
  const demoProducts = [
    {
      user_idx: 0,
      title: '맥북 프로 14인치 M3 Pro 급처',
      description: '맥북 프로 14인치 M3 Pro 칩 탑재 모델입니다. 2024년 1월 구매, AppleCare+ 2026년까지 보장. 박스, 충전기 풀 구성. 기스 하나 없이 깨끗합니다. 직거래 가능합니다.',
      price: 2200000, price_suggestion: true, is_free: false,
      category: '디지털기기', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/PJQLdNqMXoTMQR5FkpJZU_Rx0XMieV.jpg"]',
      lat: 37.4989, lng: 127.0287, location_name: '서울 강남구 역삼동',
      days_ago: 1, view_count: 87
    },
    {
      user_idx: 0,
      title: '다이슨 에어랩 멀티 스타일러 컴플리트',
      description: '다이슨 에어랩 컴플리트 세트입니다. 구매한 지 6개월 되었고 거의 사용 안 했어요. 모든 어태치먼트 포함, 정품 박스 있습니다.',
      price: 450000, price_suggestion: true, is_free: false,
      category: '생활가전', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/sA46EPCxXqcnrehtH4Bqg_9Fue16tB.jpg"]',
      lat: 37.4950, lng: 127.0300, location_name: '서울 강남구 역삼동',
      days_ago: 2, view_count: 45
    },
    {
      user_idx: 1,
      title: '이케아 말름 서랍장 6칸 화이트',
      description: '이케아 말름 6칸 서랍장 화이트 컬러입니다. 2년 사용했고 상태 양호합니다. 직접 와서 가져가셔야 해요. 해체 도와드립니다.',
      price: 80000, price_suggestion: false, is_free: false,
      category: '가구/인테리어', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/Io6NU_5tU7EaoaKCyu1Xo_0hp88ZlU.jpg"]',
      lat: 37.4925, lng: 127.0110, location_name: '서울 서초구 서초동',
      days_ago: 3, view_count: 32
    },
    {
      user_idx: 1,
      title: '스토케 익스플로리 유모차 + 캐리콧',
      description: '스토케 익스플로리 V6 유모차와 캐리콧 세트입니다. 아이가 커서 내놓습니다. 생활기스 있지만 기능 문제 전혀 없어요. 레인커버, 모기장 포함.',
      price: 350000, price_suggestion: true, is_free: false,
      category: '유아동', status: '예약중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/bHnv_vAWMGCglz-64cQWL_Lt1XJm2y.jpg"]',
      lat: 37.4900, lng: 127.0070, location_name: '서울 서초구 방배동',
      days_ago: 4, view_count: 120
    },
    {
      user_idx: 0,
      title: '제주 유기농 한라봉 5kg 나눔',
      description: '시어머니 제주도에서 한라봉 박스로 보내주셨는데 양이 너무 많아서 나눔합니다. 5kg 정도 있어요. 강남역 근처에서 가져가세요!',
      price: 0, price_suggestion: false, is_free: true,
      category: '생활/가공식품', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/Q7z0anJjGWzm0UXdRVb16_raqtJJKO.jpg"]',
      lat: 37.4979, lng: 127.0276, location_name: '서울 강남구 역삼동',
      days_ago: 1, view_count: 150
    },
    {
      user_idx: 2,
      title: '나이키 에어맥스 270 화이트 270mm',
      description: '나이키 에어맥스 270 화이트 컬러, 270mm입니다. 3번 정도 신었고 밑창 깨끗합니다. 정품이고 영수증 있어요.',
      price: 85000, price_suggestion: false, is_free: false,
      category: '스포츠/레저', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/7n-vR-D5yXcXAG8yQTpSO_nASnQdnI.jpg"]',
      lat: 37.5010, lng: 127.0450, location_name: '서울 강남구 삼성동',
      days_ago: 5, view_count: 68
    },
    {
      user_idx: 0,
      title: '자라 핸드메이드 울 코트 베이지 M',
      description: '자라 핸드메이드 울 블렌드 코트입니다. 사이즈 M, 베이지 컬러. 한 시즌 입었고 드라이클리닝 완료 상태예요. 핏 예쁩니다.',
      price: 65000, price_suggestion: true, is_free: false,
      category: '여성의류', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7d/d2crS1QMiJDukE1XyF4B0_Hf6R94fg.jpg"]',
      lat: 37.5205, lng: 127.0410, location_name: '서울 강남구 청담동',
      days_ago: 2, view_count: 93
    },
    {
      user_idx: 2,
      title: '노스페이스 1996 눕시 패딩 블랙 L',
      description: '노스페이스 1996 레트로 눕시 자켓 블랙 L 사이즈입니다. 지난 겨울 구매해서 한 시즌 착용했습니다. 세탁 완료, 보풀 없음.',
      price: 180000, price_suggestion: false, is_free: false,
      category: '남성의류', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7e/874aD4gdKzXTV118kPGk0_hHZWDuI5.jpg"]',
      lat: 37.5185, lng: 127.0340, location_name: '서울 강남구 압구정동',
      days_ago: 3, view_count: 55
    },
    {
      user_idx: 2,
      title: '닌텐도 스위치 OLED + 젤다 티어스',
      description: '닌텐도 스위치 OLED 화이트 모델입니다. 젤다의 전설: 티어스 오브 더 킹덤 칩 포함. 조이콘 상태 양호, 독 포함 풀세트입니다.',
      price: 280000, price_suggestion: true, is_free: false,
      category: '게임/취미', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7e/GU0HPAOdtweEM42uCiNDp_y1QDQR0x.jpg"]',
      lat: 37.4860, lng: 127.0070, location_name: '서울 서초구 방배동',
      days_ago: 6, view_count: 142
    },
    {
      user_idx: 0,
      title: 'SK-II 피테라 에센스 230ml 미개봉',
      description: 'SK-II 피테라 에센스 230ml 정품 미개봉 새상품입니다. 면세점에서 구매했고 사용 기한 2027년. 선물 받았는데 쓰는 제품이 있어서 팝니다.',
      price: 155000, price_suggestion: false, is_free: false,
      category: '뷰티/미용', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7e/2HUB9ZQjdXnIeyboJvnt1_N0V7f0iU.jpg"]',
      lat: 37.5133, lng: 127.1001, location_name: '서울 송파구 잠실동',
      days_ago: 4, view_count: 78
    },
    {
      user_idx: 2,
      title: '코베아 고스트 플러스 캠핑 텐트',
      description: '코베아 고스트 플러스 텐트입니다. 4인용, 3회 사용. 그라운드시트, 이너텐트, 폴대 모두 포함. 캠핑 안 하게 되어서 판매합니다.',
      price: 320000, price_suggestion: true, is_free: false,
      category: '스포츠/레저', status: '거래완료',
      images: '["https://v3b.fal.media/files/b/0a8fbc7e/Qw31JL_bxwmY7WG-KuKR9_9XJrTTi9.jpg"]',
      lat: 37.5050, lng: 127.1100, location_name: '서울 송파구 문정동',
      days_ago: 7, view_count: 5
    },
    {
      user_idx: 1,
      title: '아이패드 에어 5세대 64GB 스페이스그레이',
      description: '아이패드 에어 5세대 WiFi 64GB입니다. M1 칩 탑재, 구매 1년 되었고 케이스 사용해서 외관 깨끗합니다. 애플펜슬 2세대 포함.',
      price: 520000, price_suggestion: true, is_free: false,
      category: '디지털기기', status: '판매중',
      images: '["https://v3b.fal.media/files/b/0a8fbc7e/bg0t_JHZgdgDskdShGeTU_701ysOOe.jpg"]',
      lat: 37.5550, lng: 126.9260, location_name: '서울 마포구 합정동',
      days_ago: 5, view_count: 110
    },
  ];

  for (const p of demoProducts) {
    await pool.query(
      `INSERT INTO gamja_01_products
        (user_id, title, description, price, price_suggestion, is_free, category, status, images, latitude, longitude, location_name, view_count, is_demo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, true, NOW() - INTERVAL '${p.days_ago} days', NOW() - INTERVAL '${p.days_ago} days')`,
      [
        userIds[p.user_idx],
        p.title,
        p.description,
        p.price,
        p.price_suggestion,
        p.is_free,
        p.category,
        p.status,
        p.images,
        p.lat,
        p.lng,
        p.location_name,
        p.view_count,
      ]
    );
  }

  console.log(`Demo seed complete: ${demoUsers.length} users, ${demoProducts.length} products`);
  demoSeeded = true;
}

// ------------------------------------------------------------
// 4. Middleware
// ------------------------------------------------------------
app.use(cors());
// 이미지 base64를 JSON body로 받으므로 5mb로 설정 (Vercel 서버리스 한계: 4.5MB)
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

// DB init + demo seed middleware for all /api routes
app.use('/api', async (_req, _res, next) => {
  try {
    await initDB();
    await seedDemoData();
    next();
  } catch (err) {
    console.error('DB init error:', err);
    _res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// ------------------------------------------------------------
// 5. Auth middleware helper
// ------------------------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Helper: generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Helper: sanitize user object (strip password_hash)
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

// ============================================================
// 6. IMAGE UPLOAD ROUTE
// ============================================================

// POST /api/upload — Supabase Storage에 이미지 업로드 (auth required)
app.post('/api/upload', authMiddleware, async (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ success: false, message: 'Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.' });
    }
    await initStorage();

    const { image } = req.body; // base64 data URL (e.g. "data:image/jpeg;base64,...")
    if (!image) {
      return res.status(400).json({ success: false, message: '이미지가 필요합니다' });
    }

    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, message: '올바른 이미지 형식이 아닙니다 (data URL 필요)' });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filename}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': `image/${matches[1]}`,
        },
        body: buffer,
      }
    );

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

// ============================================================
// 7. AUTH ROUTES
// ============================================================

// POST /api/auth/signup — 회원가입
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ success: false, message: 'email, password, nickname are required' });
    }

    // Check for existing user
    const existing = await pool.query('SELECT id FROM gamja_01_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO gamja_01_users (email, password_hash, nickname)
       VALUES ($1, $2, $3)
       RETURNING id, email, nickname, manner_temp, created_at`,
      [email, password_hash, nickname]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const result = await pool.query('SELECT * FROM gamja_01_users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gamja_01_users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/location
app.put('/api/auth/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, location_name } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    await pool.query(
      `UPDATE gamja_01_users SET latitude = $1, longitude = $2, location_name = $3 WHERE id = $4`,
      [latitude, longitude, location_name || null, req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ success: false, message: 'Server error updating location' });
  }
});

// ============================================================
// 8. PRODUCT ROUTES
// ============================================================

// GET /api/products — list with optional filters (category, search, status, geo)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, status, lat, lng, radius } = req.query;

    let query = `
      SELECT p.*, u.nickname AS seller_nickname, u.manner_temp AS seller_manner_temp,
        (SELECT COUNT(*) FROM gamja_01_likes WHERE product_id = p.id) AS like_count
      FROM gamja_01_products p
      JOIN gamja_01_users u ON p.user_id = u.id
    `;
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Filter out demo products when DEMO_SEED is not enabled
    if (!DEMO_ENABLED) {
      conditions.push('p.is_demo = false');
    }

    if (category) {
      conditions.push(`p.category = $${paramIdx++}`);
      params.push(category);
    }

    if (search) {
      conditions.push(`(p.title ILIKE $${paramIdx} OR p.description ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (status) {
      conditions.push(`p.status = $${paramIdx++}`);
      params.push(status);
    }

    // Haversine distance filter
    if (lat && lng && radius) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      conditions.push(`
        (6371 * acos(
          cos(radians($${paramIdx})) * cos(radians(p.latitude))
          * cos(radians(p.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(p.latitude))
        )) <= $${paramIdx + 2}
      `);
      params.push(latNum, lngNum, radiusKm);
      paramIdx += 3;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching products' });
  }
});

// GET /api/products/user/:userId — products by a specific user
// NOTE: This must be defined BEFORE /api/products/:id to avoid "user" being parsed as an id
app.get('/api/products/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const demoFilter = !DEMO_ENABLED ? 'AND p.is_demo = false' : '';
    const result = await pool.query(
      `SELECT p.*, u.nickname AS seller_nickname, u.manner_temp AS seller_manner_temp
       FROM gamja_01_products p
       JOIN gamja_01_users u ON p.user_id = u.id
       WHERE p.user_id = $1 ${demoFilter}
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('Get user products error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching user products' });
  }
});

// GET /api/products/:id — single product detail (increments view_count)
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Increment view_count
    await pool.query(
      `UPDATE gamja_01_products SET view_count = view_count + 1 WHERE id = $1`,
      [id]
    );

    // Fetch product with seller info, like_count, and chat_count
    const result = await pool.query(
      `SELECT p.*,
        u.nickname AS seller_nickname,
        u.manner_temp AS seller_manner_temp,
        u.profile_image AS seller_profile_image,
        u.location_name AS seller_location_name,
        (SELECT COUNT(*) FROM gamja_01_likes WHERE product_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM gamja_01_chat_rooms WHERE product_id = p.id) AS chat_count
       FROM gamja_01_products p
       JOIN gamja_01_users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = result.rows[0];

    res.json({ success: true, product });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching product' });
  }
});

// POST /api/products — create new product (auth required)
app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const {
      title, description, price, price_suggestion,
      is_free, category, images, latitude, longitude, location_name
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const result = await pool.query(
      `INSERT INTO gamja_01_products
        (user_id, title, description, price, price_suggestion, is_free, category, images, latitude, longitude, location_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.user.id,
        title,
        description || null,
        price || 0,
        price_suggestion || false,
        is_free || false,
        category || null,
        JSON.stringify(images || []),
        latitude || null,
        longitude || null,
        location_name || null
      ]
    );

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, message: 'Server error creating product' });
  }
});

// PUT /api/products/:id — update product (auth required, owner only)
app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await pool.query('SELECT user_id FROM gamja_01_products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    // Build dynamic SET clause from provided fields
    const allowedFields = [
      'title', 'description', 'price', 'price_suggestion',
      'is_free', 'category', 'images', 'latitude', 'longitude', 'location_name'
    ];

    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'images') {
          value = JSON.stringify(value);
        }
        setClauses.push(`${field} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    params.push(id);
    const query = `UPDATE gamja_01_products SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`;

    const result = await pool.query(query, params);
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, message: 'Server error updating product' });
  }
});

// PATCH /api/products/:id/status — change product status (auth required, owner only)
app.patch('/api/products/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['판매중', '예약중', '거래완료'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Verify ownership
    const existing = await pool.query('SELECT user_id FROM gamja_01_products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    const result = await pool.query(
      `UPDATE gamja_01_products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
});

// DELETE /api/products/:id — delete product (auth required, owner only)
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const existing = await pool.query('SELECT user_id FROM gamja_01_products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    // Delete related data first (likes, messages in chat rooms, chat rooms)
    await pool.query('DELETE FROM gamja_01_likes WHERE product_id = $1', [id]);
    await pool.query(
      `DELETE FROM gamja_01_messages WHERE room_id IN (SELECT id FROM gamja_01_chat_rooms WHERE product_id = $1)`,
      [id]
    );
    await pool.query('DELETE FROM gamja_01_chat_rooms WHERE product_id = $1', [id]);
    await pool.query('DELETE FROM gamja_01_products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting product' });
  }
});

// ============================================================
// 9. LIKE (찜) ROUTES
// ============================================================

// POST /api/products/:id/like — 찜 토글 (auth required)
app.post('/api/products/:id/like', authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;

    // Check if product exists
    const productCheck = await pool.query('SELECT id FROM gamja_01_products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if already liked
    const existing = await pool.query(
      'SELECT id FROM gamja_01_likes WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    let liked;
    if (existing.rows.length > 0) {
      // Unlike
      await pool.query('DELETE FROM gamja_01_likes WHERE user_id = $1 AND product_id = $2', [userId, productId]);
      liked = false;
    } else {
      // Like
      await pool.query(
        'INSERT INTO gamja_01_likes (user_id, product_id) VALUES ($1, $2)',
        [userId, productId]
      );
      liked = true;
    }

    // Get updated like count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM gamja_01_likes WHERE product_id = $1',
      [productId]
    );
    const likeCount = parseInt(countResult.rows[0].count, 10);

    res.json({ success: true, liked, likeCount });
  } catch (err) {
    console.error('Like toggle error:', err);
    res.status(500).json({ success: false, message: 'Server error toggling like' });
  }
});

// GET /api/likes — 내가 찜한 상품 ID 목록 (auth required)
app.get('/api/likes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT product_id FROM gamja_01_likes WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    const likedProductIds = result.rows.map(row => row.product_id);
    res.json({ success: true, likedProductIds });
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching likes' });
  }
});

// ============================================================
// 10. CHAT ROUTES
// ============================================================

// POST /api/chat/rooms — 채팅방 생성 또는 기존 반환 (auth required)
app.post('/api/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const { productId, sellerId } = req.body;
    const buyerId = req.user.id;

    if (!productId || !sellerId) {
      return res.status(400).json({ success: false, message: 'productId and sellerId are required' });
    }

    // Buyer cannot chat with themselves
    if (buyerId === sellerId) {
      return res.status(400).json({ success: false, message: 'Cannot create chat room with yourself' });
    }

    // Check if product exists
    const productCheck = await pool.query('SELECT id FROM gamja_01_products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if room already exists
    const existing = await pool.query(
      'SELECT * FROM gamja_01_chat_rooms WHERE product_id = $1 AND buyer_id = $2',
      [productId, buyerId]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, room: existing.rows[0] });
    }

    // Create new room
    const result = await pool.query(
      `INSERT INTO gamja_01_chat_rooms (product_id, buyer_id, seller_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [productId, buyerId, sellerId]
    );

    res.status(201).json({ success: true, room: result.rows[0] });
  } catch (err) {
    console.error('Create chat room error:', err);
    res.status(500).json({ success: false, message: 'Server error creating chat room' });
  }
});

// GET /api/chat/rooms — 내 채팅방 목록 (auth required)
app.get('/api/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        cr.id,
        cr.product_id,
        cr.buyer_id,
        cr.seller_id,
        cr.last_message,
        cr.last_message_at,
        cr.created_at,
        p.title AS product_title,
        p.images AS product_images,
        buyer.nickname AS buyer_nickname,
        seller.nickname AS seller_nickname,
        (SELECT COUNT(*) FROM gamja_01_messages m
         WHERE m.room_id = cr.id AND m.sender_id != $1 AND m.is_read = false) AS unread_count
       FROM gamja_01_chat_rooms cr
       JOIN gamja_01_products p ON cr.product_id = p.id
       JOIN gamja_01_users buyer ON cr.buyer_id = buyer.id
       JOIN gamja_01_users seller ON cr.seller_id = seller.id
       WHERE cr.buyer_id = $1 OR cr.seller_id = $1
       ORDER BY cr.last_message_at DESC`,
      [userId]
    );

    // Transform rows to include other_nickname and product_image
    const rooms = result.rows.map(row => {
      const isBuyer = row.buyer_id === userId;
      const images = row.product_images || [];
      const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : null;

      return {
        id: row.id,
        product_id: row.product_id,
        product_title: row.product_title,
        product_image: firstImage,
        buyer_id: row.buyer_id,
        seller_id: row.seller_id,
        other_nickname: isBuyer ? row.seller_nickname : row.buyer_nickname,
        last_message: row.last_message,
        last_message_at: row.last_message_at,
        unread_count: parseInt(row.unread_count, 10),
        created_at: row.created_at,
      };
    });

    res.json({ success: true, rooms });
  } catch (err) {
    console.error('Get chat rooms error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching chat rooms' });
  }
});

// GET /api/chat/unread — 전체 읽지 않은 메시지 수 (auth required)
app.get('/api/chat/unread', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT COUNT(*) FROM gamja_01_messages m
       JOIN gamja_01_chat_rooms cr ON m.room_id = cr.id
       WHERE m.sender_id != $1 AND m.is_read = false
         AND (cr.buyer_id = $1 OR cr.seller_id = $1)`,
      [userId]
    );

    const unreadCount = parseInt(result.rows[0].count, 10);
    res.json({ success: true, unreadCount });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching unread count' });
  }
});

// GET /api/chat/rooms/:roomId/messages — 메시지 목록 (auth required)
app.get('/api/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Verify room exists and user is a participant
    const roomCheck = await pool.query(
      'SELECT * FROM gamja_01_chat_rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const room = roomCheck.rows[0];
    if (room.buyer_id !== userId && room.seller_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not a participant of this chat room' });
    }

    // Mark other person's messages as read
    await pool.query(
      `UPDATE gamja_01_messages SET is_read = true
       WHERE room_id = $1 AND sender_id != $2 AND is_read = false`,
      [roomId, userId]
    );

    // Fetch messages with sender nickname
    const result = await pool.query(
      `SELECT m.id, m.sender_id, u.nickname AS sender_nickname, m.content, m.is_read, m.created_at
       FROM gamja_01_messages m
       JOIN gamja_01_users u ON m.sender_id = u.id
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC`,
      [roomId]
    );

    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching messages' });
  }
});

// POST /api/chat/rooms/:roomId/messages — 메시지 전송 (auth required)
app.post('/api/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    // Verify room exists and user is a participant
    const roomCheck = await pool.query(
      'SELECT * FROM gamja_01_chat_rooms WHERE id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const room = roomCheck.rows[0];
    if (room.buyer_id !== userId && room.seller_id !== userId) {
      return res.status(403).json({ success: false, message: 'Not a participant of this chat room' });
    }

    // Insert message
    const result = await pool.query(
      `INSERT INTO gamja_01_messages (room_id, sender_id, content)
       VALUES ($1, $2, $3) RETURNING id, sender_id, content, is_read, created_at`,
      [roomId, userId, content.trim()]
    );

    // Update last_message in chat room
    await pool.query(
      `UPDATE gamja_01_chat_rooms SET last_message = $1, last_message_at = NOW() WHERE id = $2`,
      [content.trim(), roomId]
    );

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
});

// ============================================================
// 11. SPA fallback — serve index.html for non-API routes
// ============================================================
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// 12. Error handling middleware
// ============================================================
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ============================================================
// 13. Start server (local) / Export app (Vercel serverless)
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
