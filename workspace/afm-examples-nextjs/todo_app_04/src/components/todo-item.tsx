"use client";

import { toggleTodo, deleteTodo } from "@/lib/actions";

interface TodoItemProps {
  id: number;
  title: string;
  completed: boolean;
}

export function TodoItem({ id, title, completed }: TodoItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 group hover:border-gray-300 transition-colors">
      <form action={() => toggleTodo(id)} className="flex items-center">
        <button type="submit" className="flex items-center justify-center">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              completed
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-green-400"
            }`}
          >
            {completed && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>
      </form>

      <span className={`flex-1 text-sm ${completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
        {title}
      </span>

      <form action={() => deleteTodo(id)}>
        <button
          type="submit"
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </form>
    </div>
  );
}
