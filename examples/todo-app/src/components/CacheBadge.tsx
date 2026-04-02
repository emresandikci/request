interface Props {
  fromCache: boolean;
  durationMs: number;
}

export function CacheBadge({ fromCache, durationMs }: Props) {
  return (
    <span
      title={fromCache
        ? `Served from CacheAdapter in ${durationMs}ms — no network request was made`
        : `Fetched from network in ${durationMs}ms — response is now cached for 60s`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 12,
        background: fromCache ? '#f0fdf4' : '#eff6ff',
        color: fromCache ? '#15803d' : '#1d4ed8',
        border: `1px solid ${fromCache ? '#bbf7d0' : '#bfdbfe'}`,
        cursor: 'default',
      }}
    >
      <span>{fromCache ? '⚡' : '🌐'}</span>
      {fromCache ? `cache hit · ${durationMs}ms` : `network · ${durationMs}ms`}
    </span>
  );
}
