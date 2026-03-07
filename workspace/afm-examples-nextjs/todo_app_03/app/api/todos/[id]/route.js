import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function PATCH(request, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const pool = await getPool();

  const result = await pool.query(
    'UPDATE todo_app_03_todos SET completed = NOT completed WHERE id = $1 AND user_id = $2 RETURNING id, title, completed, created_at',
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: '할 일을 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json({ todo: result.rows[0] });
}

export async function DELETE(request, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const pool = await getPool();

  const result = await pool.query(
    'DELETE FROM todo_app_03_todos WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: '할 일을 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
