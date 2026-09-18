"use client";

import { useRef, useState, useTransition } from "react";
import { addTask, toggleTask, deleteTask } from "@/app/dashboard/actions";
import type { Task } from "@/lib/types";

export function TaskList({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;

    const optimistic: Task = {
      id: `temp-${Date.now()}`,
      user_id: "",
      title,
      done: false,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, optimistic]);
    formRef.current?.reset();

    startTransition(async () => {
      await addTask(formData);
    });
  }

  function handleToggle(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    );
    startTransition(async () => {
      await toggleTask(task.id, !task.done);
    });
  }

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await deleteTask(taskId);
    });
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-3">
      <form ref={formRef} action={handleAdd} className="flex gap-2">
        <input
          name="title"
          placeholder="Add a task…"
          className="flex-1 rounded-md border border-surface-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-acacia-gold text-acacia-black px-3 py-2 text-sm font-semibold"
        >
          Add
        </button>
      </form>

      {pending.length === 0 && done.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing on your list.</p>
      )}

      <ul className="space-y-1.5">
        {pending.map((task) => (
          <li key={task.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => handleToggle(task)}
            />
            <span className="text-sm flex-1">{task.title}</span>
            <button
              onClick={() => handleDelete(task.id)}
              className="text-xs text-red-600 opacity-0 group-hover:opacity-100"
            >
              Remove
            </button>
          </li>
        ))}
        {done.map((task) => (
          <li key={task.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => handleToggle(task)}
            />
            <span className="text-sm flex-1 line-through text-muted-foreground">
              {task.title}
            </span>
            <button
              onClick={() => handleDelete(task.id)}
              className="text-xs text-red-600 opacity-0 group-hover:opacity-100"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
