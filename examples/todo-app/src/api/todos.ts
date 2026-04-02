import { HttpError, NetworkError, TimeoutError } from '@emstack/lite-request';
import { api } from './client.ts';

export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
}

export type NewTodo = Omit<Todo, 'id'>;

export interface FetchTodosResult {
  todos: Todo[];
  /** Total number of todos across all pages (from X-Total-Count header). */
  total: number;
  /** Wall-clock time in ms for the request. Sub-10ms indicates a cache hit. */
  durationMs: number;
}

export async function fetchTodos(page: number, pageSize: number): Promise<FetchTodosResult> {
  const t0 = performance.now();
  const res = await api.get<Todo[]>('/todos', {
    params: { _page: page, _limit: pageSize },
  });
  const todos = await res.json();
  const durationMs = Math.round(performance.now() - t0);
  // JSONPlaceholder sends X-Total-Count on paginated requests
  const total = parseInt(res.headers['x-total-count'] ?? '200', 10);
  return { todos, total, durationMs };
}

export async function createTodo(data: NewTodo): Promise<Todo> {
  const res = await api.post<Todo, NewTodo>('/todos', data);
  return res.json();
}

export async function updateTodo(id: number, data: Partial<Todo>): Promise<Todo> {
  const res = await api.patch<Todo, Partial<Todo>>(`/todos/${id}`, data);
  return res.json();
}

export async function deleteTodo(id: number): Promise<void> {
  await api.delete(`/todos/${id}`);
}

export function classifyError(err: unknown): string {
  if (err instanceof TimeoutError) return `Request timed out after ${err.timeout}ms`;
  if (err instanceof NetworkError) return 'Network error — check your connection';
  if (err instanceof HttpError)    return `Server error ${err.status}: ${err.message}`;
  if (err instanceof Error)        return err.message;
  return 'An unexpected error occurred';
}
