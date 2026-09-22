import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  History,
  Layers,
  RotateCcw,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import type {
  Dependency,
  FrozenVersion,
  PersistedState,
  RejectionRecord,
} from './types';
import type { Artifact } from './types';
import { clone, evaluateBatch, freezeVersion, summarizeByArtifact } from './scope/scope';
import { loadState, resetState, saveState } from './storage/storage';
import Overview from './ui/Overview';
import Dependencies from './ui/Dependencies';
import Artifacts from './ui/Artifacts';
import Versions from './ui/Versions';

type View = 'gate' | 'deps' | 'artifacts' | 'versions';

/** 草稿是否与某冻结版本完全一致（刷新后依赖、产物和版本链一致的判据） */
function matchesVersion(draft: PersistedState['draft'], v: FrozenVersion | null): boolean {
  if (!v) return false;
  return (
    JSON.stringify({ artifacts: draft.artifacts, dependencies: draft.dependencies }) ===
    JSON.stringify({ artifacts: v.artifacts, dependencies: v.dependencies })
  );
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [view, setView] = useState<View>('gate');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => saveState(state), [state]);

  const latest = state.versions[state.versions.length - 1] ?? null;
  const precheck = useMemo(
    () => evaluateBatch(state.draft),
    [state.draft],
  );
  const isDirty = !matchesVersion(state.draft, latest);
  // 草稿匹配的基线版本号
  const draftVersion = useMemo(() => {
    for (let i = state.versions.length - 1; i >= 0; i--) {
      if (matchesVersion(state.draft, state.versions[i])) {
        return state.versions[i].number;
      }
    }
    return latest ? latest.number : 0;
  }, [state.draft, state.versions, latest]);

  const updateDraft = (patch: Partial<PersistedState['draft']>) =>
    setState((s) => ({ ...s, draft: { ...s.draft, ...patch } }));

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const approve = (reason: string) => {
    const result = evaluateBatch(state.draft);
    if (!result.ok) {
      const rejection: RejectionRecord = { at: new Date().toISOString(), violations: result.violations };
      setState((s) => ({ ...s, lastRejection: rejection }));
      return;
    }
    setState((s) => {
      const v = freezeVersion(s.draft, s.versions, reason);
      return { ...s, versions: [...s.versions, v], lastRejection: null };
    });
    flash(`范围已冻结：v${(latest?.number ?? 0) + 1}`);
  };

  const reject = () => {
    const result = evaluateBatch(state.draft);
    if (result.ok) return;
    setState((s) => ({
      ...s,
      lastRejection: { at: new Date().toISOString(), violations: result.violations },
    }));
    flash('整批拒绝已留档，范围未冻结');
  };

  const checkout = (v: FrozenVersion) => {
    setState((s) => ({
      ...s,
      draft: { artifacts: clone(v.artifacts), dependencies: clone(v.dependencies) },
    }));
    setView('deps');
    flash(`已载入 v${v.number} 作为草稿，保存调整将生成带原因的新版本`);
  };

  const hardReset = () => {
    if (!window.confirm('恢复为初始演示数据？当前登记与版本链会被覆盖。')) return;
    const fresh = resetState();
    setState(fresh);
    setSelectedVersion(null);
    setView('gate');
  };

  const summary = useMemo(() => summarizeByArtifact(state.draft), [state.draft]);
  const runtimeDepCount = new Set(
    summary.flatMap((s) => s.runtime.map((d) => d.id)),
  ).size;

  const nav: { key: View; label: string; icon: typeof Boxes; badge?: number; danger?: boolean }[] = [
    { key: 'gate', label: '核对台', icon: ClipboardCheck },
    { key: 'deps', label: '依赖登记', icon: Boxes, badge: state.draft.dependencies.length },
    { key: 'artifacts', label: '产物登记', icon: Layers, badge: state.draft.artifacts.length },
    { key: 'versions', label: '版本链', icon: History, badge: state.versions.length },
  ];

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={18} />
          </div>
          <div>
            <b>License Lens</b>
            <small>SCOPE CONSOLE</small>
          </div>
        </div>
        <div className="nav-title">WORKSPACE</div>
        {nav.map((n) => (
          <button
            key={n.key}
            className={`nav ${view === n.key ? 'active' : ''}`}
            onClick={() => setView(n.key)}
          >
            <n.icon size={16} />
            {n.label}
            {n.badge !== undefined && <span>{n.badge}</span>}
          </button>
        ))}
        <div className="aside-bottom">
          <div className="mini-card">
            <Snowflake size={16} />
            <div>
              <b>
                {latest ? `冻结基线 v${latest.number}` : '尚无冻结版本'}
              </b>
              <small>
                {isDirty ? '草稿有未冻结变更' : '草稿与版本链一致'}
                {precheck.ok ? ' · 核对通过' : ` · ${precheck.violations.length} 项冲突`}
              </small>
            </div>
          </div>
          {!precheck.ok && (
            <button className="nav nav-alert" onClick={() => setView('gate')}>
              <AlertTriangle size={16} />
              整批冲突待处理
              <span className="red">{precheck.violations.length}</span>
            </button>
          )}
          <button className="nav reset-nav" onClick={hardReset}>
            <RotateCcw size={15} /> 重置演示数据
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">
              WORKSPACE / <b>PRODUCT ATTRIBUTION &amp; RUNTIME SCOPE</b>
            </div>
            <h1>产物归属与运行范围核对台</h1>
            <p>
              登记每个依赖的包名、引入方式、用途与所属产物；整批核对通过后冻结范围。
            </p>
          </div>
          <div className="head-actions">
            <div className={`status-chip ${precheck.ok ? 'ok' : 'bad'}`}>
              {precheck.ok ? (
                <>
                  <Snowflake size={14} /> {isDirty ? '预检通过 · 待冻结' : '范围已一致'}
                </>
              ) : (
                <>
                  <AlertTriangle size={14} /> 整批拒绝 · {precheck.violations.length} 项
                </>
              )}
            </div>
          </div>
        </header>

        <section className="summary">
          <div>
            <span>登记依赖</span>
            <b>{state.draft.dependencies.length}</b>
            <small>可归属多个产物</small>
          </div>
          <div>
            <span>运行产物</span>
            <b className="teal">{state.draft.artifacts.filter((a) => a.kind === 'runtime').length}</b>
            <small>覆盖 {runtimeDepCount} 个运行依赖</small>
          </div>
          <div>
            <span>冻结版本</span>
            <b>{state.versions.length}</b>
            <small>
              {latest ? `最新 v${latest.number}` : '尚未冻结'}
            </small>
          </div>
          <div>
            <span>核对状态</span>
            <b className={precheck.ok ? 'teal' : 'red'}>
              {precheck.ok ? '通过' : `${precheck.violations.length} 项冲突`}
            </b>
            <small>{isDirty ? '草稿已偏离基线' : `与 v${draftVersion || '—'} 一致`}</small>
          </div>
        </section>

        {view === 'gate' && (
          <Overview
            precheck={precheck}
            draftVersion={draftVersion}
            isDirty={isDirty}
            latest={latest}
            lastRejection={state.lastRejection}
            onApprove={approve}
            onReject={reject}
          />
        )}
        {view === 'deps' && (
          <Dependencies
            dependencies={state.draft.dependencies}
            artifacts={state.draft.artifacts}
            violations={precheck.violations}
            onChange={(deps: Dependency[]) => updateDraft({ dependencies: deps })}
          />
        )}
        {view === 'artifacts' && (
          <Artifacts
            artifacts={state.draft.artifacts}
            dependencies={state.draft.dependencies}
            violations={precheck.violations}
            onArtifactsChange={(arts: Artifact[]) => updateDraft({ artifacts: arts })}
            onDependenciesChange={(deps: Dependency[]) => updateDraft({ dependencies: deps })}
          />
        )}
        {view === 'versions' && (
          <Versions
            versions={state.versions}
            selectedId={selectedVersion}
            onSelect={setSelectedVersion}
            onCheckout={checkout}
          />
        )}

        {notice && <div className="toast">{notice}</div>}
      </main>
    </div>
  );
}
