const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// ─── App Initialization ───────────────────────────────────────────────
const app = express();
const BUILD_VERSION = 'v2-supabase-images';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// ─── Database Connection ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

// ─── Middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Lazy DB Init (cold start safe) ──────────────────────────────────
let dbInitialized = false;

async function initDB() {
  if (dbInitialized) return;

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Products table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Cart table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_cart (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES ecommerce_01_users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES ecommerce_01_products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, product_id)
    )
  `);

  // Orders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES ecommerce_01_users(id) ON DELETE CASCADE,
      total_amount INTEGER NOT NULL,
      shipping_name VARCHAR(100) NOT NULL,
      shipping_phone VARCHAR(20) NOT NULL,
      shipping_address TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      payment_key VARCHAR(200),
      toss_order_id VARCHAR(200),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Order Items table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecommerce_01_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES ecommerce_01_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      product_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL
    )
  `);

  // Seed products if table is empty
  const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM ecommerce_01_products');

  if (rows[0].cnt === 0) {
    await pool.query(`
      INSERT INTO ecommerce_01_products (name, price, description, category, image_url) VALUES
      ('다마스커스 셰프 나이프', 89000, '프로 셰프도 인정하는 67겹 다마스커스 강철 나이프. 날카로운 절삭력과 아름다운 물결 무늬가 특징입니다.', '칼/도마류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/01-damascus-chef-knife.png'),
      ('산토쿠 나이프', 65000, '일본식 만능 칼. 채소, 고기, 생선 모든 재료를 정밀하게 다룰 수 있습니다.', '칼/도마류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/02-santoku-knife.png'),
      ('빵 나이프 (세레이티드)', 45000, '바게트부터 식빵까지, 빵을 부스러기 없이 깔끔하게 자르는 톱니 나이프.', '칼/도마류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/03-bread-knife.png'),
      ('아카시아 원목 도마', 38000, '천연 아카시아 원목으로 제작. 칼날 손상을 최소화하며 항균 효과가 있습니다.', '칼/도마류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/04-acacia-board.png'),
      ('대나무 도마 3종 세트', 29000, '크기별 3종 세트. 가볍고 위생적인 대나무 소재로 용도별 사용이 편리합니다.', '칼/도마류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/05-bamboo-board-set.png'),
      ('무쇠 주물 냄비 22cm', 128000, '전통 방식으로 제작한 무쇠 냄비. 열 보존력이 뛰어나 찌개와 조림에 최적입니다.', '냄비/팬류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/06-cast-iron-pot.png'),
      ('스테인리스 소스팬 18cm', 78000, '3중 바닥 스테인리스 소스팬. 소스, 수프, 데치기에 만능으로 활용됩니다.', '냄비/팬류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/07-stainless-saucepan.png'),
      ('논스틱 프라이팬 28cm', 55000, '기름 없이도 눌어붙지 않는 프리미엄 코팅. 가벼우면서도 내구성이 뛰어납니다.', '냄비/팬류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/08-nonstick-pan.png'),
      ('에나멜 더치오븐', 149000, '오븐에서 식탁까지. 아름다운 컬러의 에나멜 코팅으로 요리와 서빙을 한번에.', '냄비/팬류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/09-enamel-dutch-oven.png'),
      ('구리 바닥 스킬렛', 95000, '구리 바닥으로 열전도율 극대화. 스테이크와 팬 요리에 프로의 결과를 선사합니다.', '냄비/팬류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/10-copper-skillet.png'),
      ('올리브우드 주걱 세트', 25000, '천연 올리브 나무로 만든 주걱 4종 세트. 냄비를 긁지 않아 코팅팬에 안심.', '주방소품류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/11-olive-spatula-set.png'),
      ('스테인리스 계량컵 세트', 18000, '정밀 눈금의 계량컵/스푼 8종 세트. 베이킹과 요리의 정확한 계량을 도와줍니다.', '주방소품류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/12-measuring-cups.png'),
      ('실리콘 주방 집게', 12000, '내열 실리콘 팁으로 코팅 표면을 보호. 파스타, 샐러드, 그릴 요리에 필수.', '주방소품류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/13-silicone-tongs.png'),
      ('세라믹 양념통 4종 세트', 35000, '밀폐 뚜껑과 대나무 받침의 세라믹 양념통. 소금, 후추, 허브를 신선하게 보관.', '주방소품류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/14-ceramic-spice-jars.png'),
      ('린넨 앞치마', 32000, '프리미엄 린넨 소재의 앞치마. 편안한 착용감과 세련된 디자인으로 요리가 즐거워집니다.', '주방소품류', 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products/15-linen-apron.png')
    `);
    console.log('Seeded 15 kitchen products');
  }

  // Always ensure image URLs point to Supabase Storage
  const STORAGE_BASE = 'https://xwzcqjyjblsoatcohojl.supabase.co/storage/v1/object/public/ecommerce-products';
  const imageMap = [
    ['다마스커스 셰프 나이프', '01-damascus-chef-knife.png'],
    ['산토쿠 나이프', '02-santoku-knife.png'],
    ['빵 나이프 (세레이티드)', '03-bread-knife.png'],
    ['아카시아 원목 도마', '04-acacia-board.png'],
    ['대나무 도마 3종 세트', '05-bamboo-board-set.png'],
    ['무쇠 주물 냄비 22cm', '06-cast-iron-pot.png'],
    ['스테인리스 소스팬 18cm', '07-stainless-saucepan.png'],
    ['논스틱 프라이팬 28cm', '08-nonstick-pan.png'],
    ['에나멜 더치오븐', '09-enamel-dutch-oven.png'],
    ['구리 바닥 스킬렛', '10-copper-skillet.png'],
    ['올리브우드 주걱 세트', '11-olive-spatula-set.png'],
    ['스테인리스 계량컵 세트', '12-measuring-cups.png'],
    ['실리콘 주방 집게', '13-silicone-tongs.png'],
    ['세라믹 양념통 4종 세트', '14-ceramic-spice-jars.png'],
    ['린넨 앞치마', '15-linen-apron.png'],
  ];
  for (const [name, file] of imageMap) {
    await pool.query(
      'UPDATE ecommerce_01_products SET image_url = $1 WHERE name = $2 AND (image_url IS NULL OR image_url NOT LIKE $3)',
      [`${STORAGE_BASE}/${file}`, name, `${STORAGE_BASE}%`]
    );
  }

  dbInitialized = true;
  console.log('Database initialized');
}

// DB init middleware for /api routes
app.use('/api', async (_req, _res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB init error:', err);
    _res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// ─── Auth Helper ──────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// ─── Auth Middleware ──────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다' });
  }
}

// ─── Cart Helper ─────────────────────────────────────────────────────
async function getCartForUser(userId) {
  const { rows } = await pool.query(`
    SELECT c.id, c.product_id, c.quantity,
           p.name, p.price, p.image_url, p.category
    FROM ecommerce_01_cart c
    JOIN ecommerce_01_products p ON c.product_id = p.id
    WHERE c.user_id = $1
    ORDER BY c.created_at ASC
  `, [userId]);
  return rows;
}

// ─── Auth Routes ──────────────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'email, password, name are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    // Check duplicate email
    const existing = await pool.query('SELECT id FROM ecommerce_01_users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password and insert
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO ecommerce_01_users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, password_hash, name]
    );

    const user = rows[0];
    const token = generateToken(user);

    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const { rows } = await pool.query('SELECT * FROM ecommerce_01_users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    res.json({ success: true, data: { user: safeUser, token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Version Check ────────────────────────────────────────────────────
app.get('/api/version', (_req, res) => res.json({ version: BUILD_VERSION }));

// ─── Product Routes (Public) ──────────────────────────────────────────

// GET /api/products - list all, optional ?category= filter
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;

    let query = 'SELECT id, name, price, description, category, image_url, created_at FROM ecommerce_01_products';
    const params = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY id ASC';

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/products/:id - single product detail
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT id, name, price, description, category, image_url, created_at FROM ecommerce_01_products WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Cart Routes (auth required) ─────────────────────────────────────

// GET /api/cart - Get user's cart with product details
app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    const cart = await getCartForUser(req.user.id);
    res.json({ success: true, data: cart });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/cart/count - Get cart item count for badge
app.get('/api/cart/count', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0)::int AS count FROM ecommerce_01_cart WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: { count: rows[0].count } });
  } catch (err) {
    console.error('Get cart count error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/cart - Add item to cart
app.post('/api/cart', authMiddleware, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'product_id and quantity (>= 1) are required' });
    }

    // Verify product exists
    const productCheck = await pool.query('SELECT id FROM ecommerce_01_products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Upsert: insert or add to existing quantity
    await pool.query(`
      INSERT INTO ecommerce_01_cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = ecommerce_01_cart.quantity + EXCLUDED.quantity
    `, [req.user.id, product_id, quantity]);

    const cart = await getCartForUser(req.user.id);
    res.status(201).json({ success: true, data: cart });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/cart/:id - Update cart item quantity
app.patch('/api/cart/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ success: false, message: 'quantity is required' });
    }

    // Verify cart item belongs to user
    const cartCheck = await pool.query(
      'SELECT id FROM ecommerce_01_cart WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (cartCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    if (quantity <= 0) {
      // Delete if quantity is 0 or negative
      await pool.query('DELETE FROM ecommerce_01_cart WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    } else {
      await pool.query(
        'UPDATE ecommerce_01_cart SET quantity = $1 WHERE id = $2 AND user_id = $3',
        [quantity, id, req.user.id]
      );
    }

    const cart = await getCartForUser(req.user.id);
    res.json({ success: true, data: cart });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/cart/:id - Remove item from cart
app.delete('/api/cart/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify cart item belongs to user
    const cartCheck = await pool.query(
      'SELECT id FROM ecommerce_01_cart WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (cartCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    await pool.query('DELETE FROM ecommerce_01_cart WHERE id = $1 AND user_id = $2', [id, req.user.id]);

    const cart = await getCartForUser(req.user.id);
    res.json({ success: true, data: cart });
  } catch (err) {
    console.error('Delete cart item error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Order Routes (auth required) ────────────────────────────────────

// POST /api/orders - Create order from cart
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { shipping_name, shipping_phone, shipping_address, toss_order_id } = req.body;

    // Validate required fields
    if (!shipping_name || !shipping_phone || !shipping_address || !toss_order_id) {
      return res.status(400).json({
        success: false,
        message: 'shipping_name, shipping_phone, shipping_address, toss_order_id are required',
      });
    }

    // Get cart items with product details
    const cartItems = await getCartForUser(req.user.id);
    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: '장바구니가 비어있습니다' });
    }

    // Calculate total amount
    const total_amount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Insert order
    const { rows: orderRows } = await pool.query(`
      INSERT INTO ecommerce_01_orders (user_id, total_amount, shipping_name, shipping_phone, shipping_address, toss_order_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [req.user.id, total_amount, shipping_name, shipping_phone, shipping_address, toss_order_id]);

    const order = orderRows[0];

    // Insert order items (snapshot product name and price)
    const orderItems = [];
    for (const item of cartItems) {
      const { rows: itemRows } = await pool.query(`
        INSERT INTO ecommerce_01_order_items (order_id, product_id, product_name, product_price, quantity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [order.id, item.product_id, item.name, item.price, item.quantity]);
      orderItems.push(itemRows[0]);
    }

    // Clear user's cart
    await pool.query('DELETE FROM ecommerce_01_cart WHERE user_id = $1', [req.user.id]);

    res.status(201).json({ success: true, data: { ...order, items: orderItems } });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/orders - List user's orders
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { rows: orders } = await pool.query(
      'SELECT * FROM ecommerce_01_orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    // Attach items to each order
    for (const order of orders) {
      const { rows: items } = await pool.query(
        'SELECT * FROM ecommerce_01_order_items WHERE order_id = $1',
        [order.id]
      );
      order.items = items;
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/orders/:id - Get order detail
app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: orderRows } = await pool.query(
      'SELECT * FROM ecommerce_01_orders WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderRows[0];
    const { rows: items } = await pool.query(
      'SELECT * FROM ecommerce_01_order_items WHERE order_id = $1',
      [order.id]
    );
    order.items = items;

    res.json({ success: true, data: order });
  } catch (err) {
    console.error('Get order detail error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── TossPayments Confirmation Route ─────────────────────────────────

// POST /api/payments/confirm - Confirm payment with TossPayments
app.post('/api/payments/confirm', authMiddleware, async (req, res) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
      return res.status(400).json({ success: false, message: 'paymentKey, orderId, amount are required' });
    }

    // Call TossPayments API
    const secretKey = process.env.TOSS_SECRET_KEY || '';
    const basicAuth = Buffer.from(secretKey + ':').toString('base64');

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      return res.status(tossRes.status).json({
        success: false,
        message: tossData.message || 'Payment confirmation failed',
        data: tossData,
      });
    }

    // Update order status to paid
    await pool.query(
      `UPDATE ecommerce_01_orders
       SET status = 'paid', payment_key = $1
       WHERE toss_order_id = $2 AND user_id = $3`,
      [paymentKey, orderId, req.user.id]
    );

    res.json({ success: true, data: tossData });
  } catch (err) {
    console.error('Payment confirm error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── SPA Fallback ─────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Server Start / Vercel Export ─────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
