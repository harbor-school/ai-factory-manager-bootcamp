import { db } from "@/lib/db";
import { todos } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { TodoForm } from "@/components/todo-form";
import { TodoItem } from "@/components/todo-item";

export const dynamic = "force-dynamic";

export default async function Home() {
  const allTodos = await db.select().from(todos).orderBy(desc(todos.createdAt));

  const total = allTodos.length;
  const done = allTodos.filter((t) => t.completed).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Todo</h1>
          {total > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              {done} of {total} completed
            </p>
          )}
        </div>

        <div className="space-y-4">
          <TodoForm />

          <div className="space-y-2">
            {allTodos.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No todos yet. Add one above!
              </p>
            ) : (
              allTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  id={todo.id}
                  title={todo.title}
                  completed={todo.completed}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
