import type { ArtifactKind, ImportMethod, ScopeKind } from '../types';

export const IMPORT_METHODS: ImportMethod[] = ['npm', 'CDN', '手动引入', 'Git 子模块'];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ScopeBadge({ scope }: { scope: ScopeKind }) {
  return (
    <span className={`badge scope-${scope}`}>
      {scope === 'runtime' ? '运行' : '开发'}
    </span>
  );
}

export function KindBadge({ kind }: { kind: ArtifactKind }) {
  return (
    <span className={`badge kind-${kind}`}>{kind === 'runtime' ? '运行产物' : '开发产物'}</span>
  );
}
