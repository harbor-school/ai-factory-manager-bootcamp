// Setup script: create table + enable Realtime
// Run: node setup_db.js

const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || '';

async function setup() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected to database');

  // 1. Create table if not exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS todo_app_02_todos (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      text TEXT NOT NULL,
      done BOOLEAN DEFAULT false,
      user_id UUID NOT NULL REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('Table todo_app_02_todos ready');

  // 2. Enable RLS
  await client.query(`ALTER TABLE todo_app_02_todos ENABLE ROW LEVEL SECURITY;`);
  console.log('RLS enabled');

  // 3. Create RLS policies (ignore if exists)
  const policies = [
    { name: 'Users can view own todos', op: 'SELECT', check: 'user_id = auth.uid()' },
    { name: 'Users can insert own todos', op: 'INSERT', check: 'user_id = auth.uid()' },
    { name: 'Users can update own todos', op: 'UPDATE', check: 'user_id = auth.uid()' },
    { name: 'Users can delete own todos', op: 'DELETE', check: 'user_id = auth.uid()' },
  ];

  for (const p of policies) {
    try {
      const using = p.op === 'INSERT' ? `WITH CHECK (${p.check})` : `USING (${p.check})`;
      await client.query(`CREATE POLICY "${p.name}" ON todo_app_02_todos FOR ${p.op} TO authenticated ${using};`);
      console.log(`Policy created: ${p.name}`);
    } catch (e) {
      if (e.code === '42710') console.log(`Policy exists: ${p.name}`);
      else throw e;
    }
  }

  // 4. Enable Realtime on the table
  try {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE todo_app_02_todos;`);
    console.log('Realtime enabled on todo_app_02_todos');
  } catch (e) {
    if (e.message.includes('already member')) console.log('Realtime already enabled');
    else throw e;
  }

  await client.end();
  console.log('Done!');
}

setup().catch(e => { console.error(e); process.exit(1); });
