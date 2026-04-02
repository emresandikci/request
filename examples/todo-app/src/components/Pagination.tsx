interface Props {
  page: number;
  totalPages: number;
  loading: boolean;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, loading, onPage }: Props) {
  if (totalPages <= 1) return null;

  // Show a window of up to 5 page numbers centred around current page
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(page - half, totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav style={styles.nav} aria-label="Pagination">
      <PageButton label="«" title="First page" disabled={page === 1 || loading} onClick={() => onPage(1)} />
      <PageButton label="‹" title="Previous page" disabled={page === 1 || loading} onClick={() => onPage(page - 1)} />

      {start > 1 && <span style={styles.ellipsis}>…</span>}

      {pages.map(p => (
        <PageButton
          key={p}
          label={String(p)}
          active={p === page}
          disabled={loading}
          onClick={() => onPage(p)}
        />
      ))}

      {end < totalPages && <span style={styles.ellipsis}>…</span>}

      <PageButton label="›" title="Next page" disabled={page === totalPages || loading} onClick={() => onPage(page + 1)} />
      <PageButton label="»" title="Last page" disabled={page === totalPages || loading} onClick={() => onPage(totalPages)} />
    </nav>
  );
}

interface PageButtonProps {
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function PageButton({ label, title, active = false, disabled = false, onClick }: PageButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-current={active ? 'page' : undefined}
      style={{
        ...styles.btn,
        background: active ? '#2563eb' : 'transparent',
        color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
        borderColor: active ? '#2563eb' : '#e5e7eb',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 700 : 400,
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 20,
  } as const,
  btn: {
    minWidth: 34,
    height: 34,
    padding: '0 6px',
    fontSize: 14,
    border: '1px solid',
    borderRadius: 6,
    transition: 'all 0.1s',
  } as const,
  ellipsis: {
    fontSize: 14,
    color: '#9ca3af',
    padding: '0 4px',
  } as const,
};
