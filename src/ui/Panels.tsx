// License Lens —— 页面层：核对结果与冻结版本链
import { Ban, GitBranch, History, Lock, ShieldX, TriangleAlert } from 'lucide-react';
import type { FrozenVersion, Violation } from '../core/types';
import { VIOLATION_META } from '../core/scope';

const CODE_ICON: Record<Violation['code'], typeof Ban> = {
  MISSING_LICENSE: Ban,
  DEV_DEP_ON_RUNTIME_PRODUCT: ShieldX,
  PATH_SCOPE_CONFLICT: TriangleAlert,
};

export function RejectionPanel({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;
  return (
    <section className="reject">
      <div className="reject-head">
        <ShieldX size={18} />
        <div>
          <h2>整批核对未通过 · {violations.length} 项不符</h2>
          <p>范围已被拒绝冻结。请按下列「产物 / 路径 / 原值」逐项修正后重新核对。</p>
        </div>
        <span className="reject-badge">整批拒绝</span>
      </div>
      <div className="reject-list">
        {violations.map((v, i) => {
          const Icon = CODE_ICON[v.code];
          return (
            <article className="violation" key={`${v.code}-${v.productId}-${v.path}-${i}`}>
              <div className="violation-icon"><Icon size={16} /></div>
              <div className="violation-body">
                <div className="violation-title">
                  <b>{VIOLATION_META[v.code].title}</b>
                  <span className="violation-code">{v.code}</span>
                </div>
                <dl className="violation-fields">
                  <div><dt>产物</dt><dd>{v.productName}</dd></div>
                  <div><dt>路径</dt><dd className="mono">{v.path}</dd></div>
                  <div>
                    <dt>原值</dt>
                    <dd>
                      {v.values.map((value, j) => (
                        <span className="original" key={j}>{value}</span>
                      ))}
                    </dd>
                  </div>
                </dl>
                <p className="violation-detail">{v.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface VersionsPanelProps {
  versions: FrozenVersion[];
  headId: string | null;
  viewingId: string | null;
  onView: (id: string) => void;
  onBackToHead: () => void;
}

export function VersionsPanel({ versions, headId, viewingId, onView, onBackToHead }: VersionsPanelProps) {
  const chain = [...versions].reverse();
  return (
    <section className="versions">
      <div className="versions-head">
        <div><History size={15} /><b>冻结版本链</b></div>
        <span className="muted">{versions.length} 个冻结范围</span>
      </div>
      {chain.length === 0 && <p className="muted empty-hint">尚无冻结版本——首批核对通过后，范围即冻结为 v1。</p>}
      <ol className="version-chain">
        {chain.map((v) => {
          const isHead = v.id === headId;
          const isViewing = v.id === viewingId;
          return (
            <li key={v.id} className={isViewing ? 'version viewing' : ''}>
              <button className="version-main" onClick={() => onView(v.id)}>
                <span className={isHead ? 'version-lock head' : 'version-lock'}>
                  <Lock size={12} />
                </span>
                <span className="version-info">
                  <b>{v.id}{isHead && <em>当前范围</em>}</b>
                  <small>{v.reason || '（未填写原因）'}</small>
                  <small className="muted">
                    <GitBranch size={11} />
                    基于 {v.parentId ?? '—'} · {new Date(v.createdAt).toLocaleString('zh-CN')}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {viewingId && viewingId !== headId && (
        <button className="ghost full" onClick={onBackToHead}>回到当前范围 {headId ?? ''}</button>
      )}
    </section>
  );
}
