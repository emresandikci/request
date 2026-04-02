import { useState, useEffect, useCallback } from 'react';
import {
  fetchTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  classifyError,
} from '../api/todos.ts';
import type { Todo } from '../api/todos.ts';

export const PAGE_SIZE = 10;
// Cache hits complete in < 5 ms (synchronous map lookup + Response reconstruction).
// Real network requests take at least 50 ms even on fast connections.
const CACHE_HIT_THRESHOLD_MS = 10;

interface State {
  todos: Todo[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
  durationMs: number | null;
  fromCache: boolean;
}

export function useTodos() {
  const [state, setState] = useState<State>({
    todos: [],
    total: 0,
    page: 1,
    loading: true,
    error: null,
    durationMs: null,
    fromCache: false,
  });

  const load = useCallback(async (page: number) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { todos, total, durationMs } = await fetchTodos(page, PAGE_SIZE);
      setState(s => ({
        ...s,
        todos,
        total,
        page,
        loading: false,
        durationMs,
        fromCache: durationMs < CACHE_HIT_THRESHOLD_MS,
      }));
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: classifyError(err) }));
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  const goToPage = useCallback((page: number) => { void load(page); }, [load]);

  const addTodo = useCallback(async (title: string) => {
    try {
      const created = await createTodo({ userId: 1, title, completed: false });
      setState(s => ({ ...s, todos: [created, ...s.todos] }));
    } catch (err) {
      setState(s => ({ ...s, error: classifyError(err) }));
    }
  }, []);

  const toggleTodo = useCallback(async (todo: Todo) => {
    try {
      const updated = await updateTodo(todo.id, { completed: !todo.completed });
      setState(s => ({
        ...s,
        todos: s.todos.map(t => (t.id === todo.id ? { ...t, completed: updated.completed } : t)),
      }));
    } catch (err) {
      setState(s => ({ ...s, error: classifyError(err) }));
    }
  }, []);

  const removeTodo = useCallback(async (id: number) => {
    try {
      await deleteTodo(id);
      setState(s => ({ ...s, todos: s.todos.filter(t => t.id !== id) }));
    } catch (err) {
      setState(s => ({ ...s, error: classifyError(err) }));
    }
  }, []);

  const totalPages = Math.ceil(state.total / PAGE_SIZE);

  return { ...state, totalPages, goToPage, addTodo, toggleTodo, removeTodo };
}
