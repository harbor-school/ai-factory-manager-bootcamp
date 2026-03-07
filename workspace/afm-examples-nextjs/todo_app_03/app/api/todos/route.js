import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pool = await getPool();
  const result = await pool.query(
    'SELECT id, title, completed, created_at FROM todo_app_03_todos WHERE user_id = $1 ORDER BY created_at DESC',
    [user.id]
  );

  return NextResponse.json({ todos: result.rows });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: '할 일을 입력해주세요' }, { status: 400 });
  }

  const pool = await getPool();
  const result = await pool.query(
    'INSERT INTO todo_app_03_todos (user_id, title) VALUES ($1, $2) RETURNING id, title, completed, created_at',
    [user.id, title.trim()]
  );

  return NextResponse.json({ todo: result.rows[0] }, { status: 201 });
}
