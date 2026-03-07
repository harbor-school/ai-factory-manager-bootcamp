// ============================================================
// server.js - Todo App Backend with PostgreSQL
// ============================================================

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// ------------------------------------------------------------
// 1. App initialization and configuration
// ------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || '').trim(),
  ssl: { rejectUnauthorized: false },
});

// ------------------------------------------------------------
// 2. Database initialization (lazy init pattern)
// ------------------------------------------------------------
let dbInitialized = false;

async function initDB() {
  if (dbInitialized) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS todo_app_01_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS todo_app_01_todos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES todo_app_01_users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    dbInitialized = true;
    console.log('Database tables initialized successfully.');
  } finally {
    client.release();
  }
}

// ------------------------------------------------------------
// 3. Middleware setup
// ------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// DB init middleware - ensures tables exist before any /api call
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

// ------------------------------------------------------------
// 4. Auth middleware
// ------------------------------------------------------------
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// ------------------------------------------------------------
// 5. Auth routes
// ------------------------------------------------------------

// POST /api/register - Create a new user
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM todo_app_01_users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO todo_app_01_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      data: { user: { id: user.id, email: user.email, created_at: user.created_at }, token },
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// POST /api/login - Authenticate and return JWT
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, created_at FROM todo_app_01_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      data: { user: { id: user.id, email: user.email, created_at: user.created_at }, token },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// ------------------------------------------------------------
// 6. Todo CRUD routes (all require auth)
// ------------------------------------------------------------

// GET /api/todos - List all todos for the authenticated user
app.get('/api/todos', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, completed, created_at FROM todo_app_01_todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get todos error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch todos' });
  }
});

// POST /api/todos - Create a new todo
app.post('/api/todos', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const result = await pool.query(
      'INSERT INTO todo_app_01_todos (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at',
      [req.user.id, title.trim()]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create todo error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create todo' });
  }
});

// PATCH /api/todos/:id - Update a todo (title and/or completed)
app.patch('/api/todos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    // Verify ownership
    const existing = await pool.query(
      'SELECT id FROM todo_app_01_todos WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      }
      updates.push(`title = $${paramIndex++}`);
      values.push(title.trim());
    }

    if (completed !== undefined) {
      updates.push(`completed = $${paramIndex++}`);
      values.push(Boolean(completed));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(id);
    values.push(req.user.id);

    const result = await pool.query(
      `UPDATE todo_app_01_todos SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING id, title, completed, created_at`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update todo error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update todo' });
  }
});

// DELETE /api/todos/:id - Delete a todo
app.delete('/api/todos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM todo_app_01_todos WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }

    res.json({ success: true, data: { id: Number(id) }, message: 'Todo deleted' });
  } catch (err) {
    console.error('Delete todo error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete todo' });
  }
});

// ------------------------------------------------------------
// 7. Error handling middleware
// ------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ------------------------------------------------------------
// 8. Server startup (dual-mode: local + Vercel serverless)
// ------------------------------------------------------------
if (require.main === module) {
  initDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err.message);
      process.exit(1);
    });
}

module.exports = app;
