import type { Todo } from '../api/todos.ts';

interface Props {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onDelete: (id: number) => void;
}

export function TodoItem({ todo, onToggle, onDelete }: Props) {
  return (
    <li style={styles.item}>
      <button
        onClick={() => onToggle(todo)}
        style={{
          ...styles.checkbox,
          background: todo.completed ? '#2563eb' : 'transparent',
          borderColor: todo.completed ? '#2563eb' : '#9ca3af',
        }}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {todo.completed && <span style={styles.checkmark}>✓</span>}
      </button>
      <span
        style={{
          ...styles.title,
          textDecoration: todo.completed ? 'line-through' : 'none',
          color: todo.completed ? '#9ca3af' : '#1a1a1a',
        }}
      >
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        style={styles.deleteBtn}
        aria-label="Delete todo"
      >
        ✕
      </button>
    </li>
  );
}

const styles = {
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: 8,
  } as const,
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    border: '2px solid',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  } as const,
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1,
  } as const,
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 1.4,
  } as const,
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: 16,
    padding: '2px 4px',
    borderRadius: 4,
    flexShrink: 0,
  } as const,
};
