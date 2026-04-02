import { useTodos, PAGE_SIZE } from './hooks/useTodos.ts';
import { AddTodoForm } from './components/AddTodoForm.tsx';
import { TodoList } from './components/TodoList.tsx';
import { Pagination } from './components/Pagination.tsx';
import { CacheBadge } from './components/CacheBadge.tsx';

export function App() {
  const {
    todos, total, totalPages, page,
    loading, error,
    durationMs, fromCache,
    goToPage, addTodo, toggleTodo, removeTodo,
  } = useTodos();

  const pageStart = (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.title}>Todo App</h1>
          <p style={styles.subtitle}>
            Powered by{' '}
            <code style={styles.code}>@emstack/lite-request</code>
            {' '}+{' '}
            <a href="https://jsonplaceholder.typicode.com" target="_blank" rel="noopener" style={styles.link}>
              JSONPlaceholder
            </a>
          </p>
          <p style={styles.adapterBadge}>
            RetryAdapter · CacheAdapter · MemoryCacheStore
          </p>
        </header>

        <AddTodoForm onAdd={addTodo} />

        {error && (
          <div style={styles.errorBanner}>
            <span>{error}</span>
            <button onClick={() => goToPage(page)} style={styles.retryBtn}>Retry</button>
          </div>
        )}

        <div style={styles.toolbar}>
          {total > 0 && !loading && (
            <span style={styles.pageInfo}>
              {pageStart}–{pageEnd} of {total}
            </span>
          )}
          {durationMs !== null && !loading && (
            <CacheBadge fromCache={fromCache} durationMs={durationMs} />
          )}
        </div>

        {loading ? (
          <div style={styles.spinner}>Loading…</div>
        ) : (
          <TodoList todos={todos} onToggle={toggleTodo} onDelete={removeTodo} />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPage={goToPage}
        />

        <p style={styles.cacheHint}>
          Navigate between pages — revisited pages load instantly from cache (⚡).
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    background: '#f5f5f5',
  } as const,
  card: {
    width: '100%',
    maxWidth: 620,
    background: '#fff',
    borderRadius: 12,
    padding: '32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  } as const,
  header: {
    marginBottom: 24,
  } as const,
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 6,
  } as const,
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  } as const,
  adapterBadge: {
    fontSize: 11,
    color: '#2563eb',
    fontFamily: 'monospace',
    background: '#eff6ff',
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 4,
  } as const,
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
  } as const,
  link: {
    color: 'inherit',
  } as const,
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#b91c1c',
  } as const,
  retryBtn: {
    background: 'none',
    border: '1px solid #b91c1c',
    color: '#b91c1c',
    borderRadius: 4,
    padding: '3px 10px',
    cursor: 'pointer',
    fontSize: 13,
  } as const,
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginBottom: 10,
  } as const,
  pageInfo: {
    fontSize: 13,
    color: '#6b7280',
  } as const,
  spinner: {
    textAlign: 'center' as const,
    padding: 40,
    color: '#9ca3af',
    fontSize: 16,
  },
  cacheHint: {
    marginTop: 16,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center' as const,
  } as const,
};
