const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'todo-app-01-secret-key';

// DB Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Table initialization
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_app_01_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todo_app_01_todos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES todo_app_01_users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('DB tables ready');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// --- Auth API ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO todo_app_01_users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashed]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, user: { id: user.id, username: user.username } } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    const result = await pool.query(
      'SELECT * FROM todo_app_01_users WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, data: { token, user: { id: user.id, username: user.username } } });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// --- Todo API (auth required) ---

app.get('/api/todos', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM todo_app_01_todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/todos', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Title required' });
    }
    const result = await pool.query(
      'INSERT INTO todo_app_01_todos (user_id, title) VALUES ($1, $2) RETURNING *',
      [req.user.id, title]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/todos/:id', auth, async (req, res) => {
  try {
    const { title, completed } = req.body;
    const result = await pool.query(
      `UPDATE todo_app_01_todos SET
        title = COALESCE($1, title),
        completed = COALESCE($2, completed)
      WHERE id = $3 AND user_id = $4 RETURNING *`,
      [title, completed, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM todo_app_01_todos WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Todo not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB init failed:', err.message);
    process.exit(1);
  });
