import { useState, type FormEvent } from 'react';

interface Props {
  onAdd: (title: string) => void;
}

export function AddTodoForm({ onAdd }: Props) {
  const [title, setTitle] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={styles.input}
      />
      <button type="submit" style={styles.button} disabled={!title.trim()}>
        Add
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
  } as const,
  input: {
    flex: 1,
    padding: '10px 14px',
    fontSize: 15,
    border: '1px solid #d0d0d0',
    borderRadius: 6,
    outline: 'none',
  } as const,
  button: {
    padding: '10px 20px',
    fontSize: 15,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
  } as const,
};
