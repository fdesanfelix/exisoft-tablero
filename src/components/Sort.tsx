import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
  request: (k: K) => void;
}

// Hook genérico. `getValue` extrae el valor a comparar (puede ser computado).
export function useSort<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number | null | undefined,
  defaultKey: K | null = null,
  defaultDir: SortDir = 'asc',
): { sorted: T[]; sort: SortState<K> } {
  const [key, setKey] = useState<K | null>(defaultKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    if (!key) return items;
    return [...items].sort((a, b) => {
      const va = getValue(a, key);
      const vb = getValue(b, key);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [items, key, dir, getValue]);

  const sort: SortState<K> = {
    key, dir,
    request: (k: K) => {
      if (k === key) setDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setKey(k); setDir('asc'); }
    },
  };
  return { sorted, sort };
}

// <SortableTh field="cliente" sort={sort}>Cliente</SortableTh>
export function SortableTh<K extends string>({
  field, sort, children, style,
}: { field: K; sort: SortState<K>; children: React.ReactNode; style?: React.CSSProperties }) {
  const active = sort.key === field;
  const arrow = !active ? '⇅' : sort.dir === 'asc' ? '↑' : '↓';
  return (
    <th
      style={{ ...style, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => sort.request(field)}
      title="Ordenar"
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{ opacity: active ? 1 : .45, fontSize: 9 }}>{arrow}</span>
      </span>
    </th>
  );
}
