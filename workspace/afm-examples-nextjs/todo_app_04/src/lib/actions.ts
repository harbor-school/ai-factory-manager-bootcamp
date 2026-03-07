"use server";

import { db } from "./db";
import { todos } from "./schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addTodo(formData: FormData) {
  const title = formData.get("title") as string;
  if (!title?.trim()) return;

  await db.insert(todos).values({ title: title.trim() });
  revalidatePath("/");
}

export async function toggleTodo(id: number) {
  const [todo] = await db.select().from(todos).where(eq(todos.id, id));
  if (!todo) return;

  await db.update(todos).set({ completed: !todo.completed }).where(eq(todos.id, id));
  revalidatePath("/");
}

export async function deleteTodo(id: number) {
  await db.delete(todos).where(eq(todos.id, id));
  revalidatePath("/");
}
