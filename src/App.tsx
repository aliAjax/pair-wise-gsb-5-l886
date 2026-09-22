import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  History,
  Lock,
  PencilRuler,
  RotateCcw,
  Search,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import type { ConsoleStore, Dependency, FrozenVersion, Product, RegistryState } from './core/types';
import {
  cloneState,
  computeProductViews,
  freezeVersion,
  startAdjustment,
  validateBatch,
} from './core/scope';
import { SEED_STATE } from './core/seed';
import { discardDraft, loadStore, saveDraft, saveStore } from './storage/store';
import { DependencyModal, ProductModal } from './ui/Modals';
import { RegistryView } from './ui/RegistryView';
import { RejectionPanel, VersionsPanel } from './ui/Panels';

type ModalState =
  | { kind: 'none' }
  | { kind: 'product'; product: Product | null }
  | { kind: 'dependency'; dependency: Dependency | null };

export default function App() {
  const initialRef = useRef<ConsoleStore | null>(null);
  // store：冻结版本链 + head；draft：在途调整。两者整存整取，刷新后一致
  const [store, setStore] = useState<ConsoleStore>(() => {
    const loaded = loadStore();
    initialRef.current = loaded;
    return loaded;
  });
  const [draft, setDraft] = useState<RegistryState | null>(() => {
    const initial = initialRef.current;
    return initial && (initial.draft || initial.headId)
      ? (initial.draft ?? null)
      : cloneState(SEED_STATE);
  });
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');

  // 初次挂载：无任何持久化时，把种子写入在途草稿
  useEffect(() => {
    if (store.versions.length === 0 && !store.draft) {
      const seeded: ConsoleStore = { versions: [], headId: null, draft: cloneState(SEED_STATE) };
      setStore(seeded);
      saveStore(seeded);
      setDraft(cloneState(SEED_STATE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const head: FrozenVersion | null = store.versions.find((v) => v.id === store.headId) ?? null;
  const viewingVersion: FrozenVersion | null =
    store.versions.find((v) => v.id === viewingVersionId) ?? null;
  // 页面展示顺序：历史版本只读快照 > 在途调整草稿 > 当前 head 冻结快照
  const activeState: RegistryState | null =
    viewingVersion?.snapshot ?? draft ?? head?.snapshot ?? null;
  // 只有在途草稿可编辑；查看历史版本或停留在已冻结范围时均为只读
  const readOnly = !draft || viewingVersion !== null;
  const adjusting = !!draft && !viewingVersion;

  // 范围计算（纯函数）：每次草稿变更都重新核对
  const violations = useMemo(
    () => (activeState ? validateBatch(activeState) : []),
    [activeState],
  );
  const passed = violations.length === 0;

  const stats = useMemo(() => {
    if (!activeState) return null;
    const views = computeProductViews(activeState);
    const runtimeProducts = activeState.products.filter((p) => p.kind === 'runtime').length;
    const devDeps = activeState.dependencies.filter((d) => d.kind === 'development').length;
    const runtimeEntries = views
      .filter((v) => v.kind === 'runtime')
      .reduce((n, v) => n + v.entries.length, 0);
    return {
      products: activeState.products.length,
      runtimeProducts,
      deps: activeState.dependencies.length,
      devDeps,
      runtimeEntries,
    };
  }, [activeState]);

  // —— 草稿变更：只写在途草稿，冻结版本永不受影响 ——
  const mutateDraft = (recipe: (s: RegistryState) => RegistryState) => {
    if (!draft) return;
    const next = recipe(draft);
    setDraft(next);
    setStore((s) => saveDraft(s, next));
  };

  const upsertProduct = (product: Product) =>
    mutateDraft((s) => {
      const exists = s.products.some((p) => p.id === product.id);
      return {
        ...s,
        products: exists
          ? s.products.map((p) => (p.id === product.id ? product : p))
          : [...s.products, product],
      };
    });

  const removeProduct = (product: Product) =>
    mutateDraft((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== product.id),
      dependencies: s.dependencies.map((d) => ({
        ...d,
        assignments: d.assignments.filter((a) => a.productId !== product.id),
      })),
    }));

  const upsertDependency = (dependency: Dependency) =>
    mutateDraft((s) => {
      const exists = s.dependencies.some((d) => d.id === dependency.id);
      return {
        ...s,
        dependencies: exists
          ? s.dependencies.map((d) => (d.id === dependency.id ? dependency : d))
          : [...s.dependencies, dependency],
      };
    });

  const removeDependency = (dependency: Dependency) =>
    mutateDraft((s) => ({
      ...s,
      dependencies: s.dependencies.filter((d) => d.id !== dependency.id),
    }));

  // —— 冻结：只有核对通过才允许，且必须带原因（首版除外，原因写默认） ——
  const canFreeze = !!draft && passed && !readOnly;
  const doFreeze = () => {
    if (!draft || !passed) return;
    const finalReason = reason.trim() || (store.versions.length === 0 ? '首批登记，核对通过' : '');
    if (!finalReason.trim()) return;
    const next = freezeVersion(store, draft, finalReason);
    saveStore(next);
    setStore(next);
    setDraft(null);
    setReason('');
  };

  // 通过后冻结范围；调整只能新建带原因版本
  const beginAdjustment = () => {
    const next = startAdjustment(store);
    if (!next) return;
    setDraft(next);
    setStore((s) => saveDraft(s, next));
    setViewingVersionId(null);
    setReason('');
  };

  const cancelAdjustment = () => {
    const next = discardDraft(store);
    setStore(next);
    setDraft(null);
  };

  const resetToSeed = () => {
    // 仅用于无版本时放弃首批草稿重新载入样板
    if (store.versions.length > 0) return;
    const seed = cloneState(SEED_STATE);
    setDraft(seed);
    setStore((s) => saveDraft(s, seed));
  };

  const filteredViolations = query.trim()
    ? violations.filter((v) =>
        `${v.productName}${v.path}${v.dependencyNames.join('')}${v.code}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : violations;

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18} /></div>
          <div><b>License Lens</b><small>scope &amp; attribution console</small></div>
        </div>
        <div className="nav-title">核对台</div>
        <div className="nav active"><Lock size={15} /> 冻结范围 <span>{head?.id ?? '—'}</span></div>
        <div className="nav"><PencilRuler size={15} /> 在途调整 <span className={adjusting ? 'teal' : ''}>{adjusting ? '进行中' : '无'}</span></div>
        <div className="nav"><History size={15} /> 版本链 <span>{store.versions.length}</span></div>
        <div className="aside-bottom">
          <div className="mini-card">
            <Snowflake size={16} />
            <div>
              <b>规则即闸门</b>
              <small>缺声明 · 开发挂运行 · 路径双标，任一命中整批拒绝</small>
            </div>
          </div>
          <div className="mini-card subtle">
            <ShieldCheck size={15} />
            <div>
              <b>分层，不加依赖</b>
              <small>范围计算 / 存储 / 页面各自独立</small>
            </div>
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">LICENSE LENS / <b>PRODUCT ATTRIBUTION &amp; RUNTIME SCOPE</b></div>
            <h1>产物归属与运行范围核对台</h1>
            <p>登记每个依赖的包名、引入方式、用途与所属产物；核对通过才冻结，调整只产生带原因的新版本。</p>
          </div>
          <div className="head-actions">
            {readOnly && head && (
              <button className="primary" onClick={beginAdjustment}>
                <PencilRuler size={15} />调整范围（新建版本）
              </button>
            )}
            {!head && !adjusting && (
              <button className="outline" onClick={resetToSeed}><RotateCcw size={15} />重载样板</button>
            )}
            {readOnly && viewingVersion && (
              <button className="outline" onClick={() => setViewingVersionId(null)}>
                <Eye size={15} />回到当前范围 {head?.id ?? ''}
              </button>
            )}
          </div>
        </header>

        {readOnly && activeState && (
          <section className="readonly-banner">
            <Lock size={16} />
            <div>
              <b>{viewingVersion ? `只读查看 ${viewingVersion.id}` : `当前冻结范围 ${head?.id ?? ''}`}</b>
              <span>
                {viewingVersion
                  ? `调整原因：${viewingVersion.reason}；快照已冻结，不接受修改。`
                  : '范围已冻结。如需改动请发起调整，核对通过后生成带原因的新版本。'}
              </span>
            </div>
          </section>
        )}

        {adjusting && (
          <section className={passed ? 'gate ok' : 'gate bad'}>
            <div className="gate-status">
              {passed ? <Check size={17} /> : <AlertTriangle size={17} />}
              <div>
                <b>{passed ? '整批核对通过，可以冻结' : '整批核对未通过，拒绝冻结'}</b>
                <small>
                  {store.versions.length === 0 ? '首批登记核对' : `基于 ${head?.id} 的调整`} ·
                  {' '}{violations.length} 项不符
                </small>
              </div>
            </div>
            <div className="gate-actions">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="填写本次调整原因（必填）"
                disabled={!passed}
              />
              <button className="outline" onClick={cancelAdjustment}>放弃调整</button>
              <button className="primary" disabled={!canFreeze || (!reason.trim() && store.versions.length > 0)} onClick={doFreeze}>
                <Snowflake size={15} /> 冻结为 v{store.versions.length + 1}
              </button>
            </div>
          </section>
        )}

        <section className="summary">
          <div><span>产物</span><b>{stats?.products ?? 0}</b><small>{stats?.runtimeProducts ?? 0} 个运行产物</small></div>
          <div><span>依赖登记</span><b>{stats?.deps ?? 0}</b><small>{stats?.devDeps ?? 0} 个开发依赖</small></div>
          <div><span>进入运行路径</span><b className="teal">{stats?.runtimeEntries ?? 0}</b><small>必须具备许可证声明</small></div>
          <div>
            <span>核对结果</span>
            <b className={passed ? 'teal' : 'red'}>{passed ? '通过' : `${violations.length} 项拒绝`}</b>
            <small>{head ? `当前冻结 ${head.id}` : '尚未冻结'}</small>
          </div>
        </section>

        {violations.length > 0 && (
          <div className="reject-tools">
            <div className="search">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选不符项：产物 / 路径 / 包名" />
            </div>
          </div>
        )}
        <RejectionPanel violations={filteredViolations} />

        {activeState && (
          <RegistryView
            state={activeState}
            violations={violations}
            readOnly={readOnly}
            onAddProduct={() => setModal({ kind: 'product', product: null })}
            onEditProduct={(p) => setModal({ kind: 'product', product: p })}
            onRemoveProduct={(p) => removeProduct(p)}
            onAddDependency={() => setModal({ kind: 'dependency', dependency: null })}
            onEditDependency={(d) => setModal({ kind: 'dependency', dependency: d })}
            onRemoveDependency={(d) => removeDependency(d)}
          />
        )}

        <div className="bottom-grid">
          <VersionsPanel
            versions={store.versions}
            headId={store.headId}
            viewingId={viewingVersionId}
            onView={(id) => { setViewingVersionId(id); setModal({ kind: 'none' }); }}
            onBackToHead={() => setViewingVersionId(null)}
          />
          <section className="card rules-card">
            <div className="card-head">
              <div className="card-title"><ShieldCheck size={16} /><div><h2>核对规则</h2><p>任一命中即整批拒绝，不产生冻结版本</p></div></div>
            </div>
            <ul className="rules">
              <li><BanMark />运行产物上的依赖缺许可证声明——列明产物、路径、原值。</li>
              <li><BanMark />开发依赖（devDependencies）不得挂到任何运行产物。</li>
              <li><BanMark />同一产物同一路径既标开发又标运行。</li>
              <li><CheckMark />同一依赖可以进入多个产物，每条路径单独登记原值。</li>
              <li><CheckMark />核对通过后范围冻结；任何调整都只能新建带原因版本。</li>
              <li><CheckMark />版本链含完整快照，刷新页面后依赖、产物与版本链保持一致。</li>
            </ul>
          </section>
        </div>

        {modal.kind === 'product' && (
          <ProductModal
            initial={modal.product}
            onCancel={() => setModal({ kind: 'none' })}
            onSave={(p) => { upsertProduct(p); setModal({ kind: 'none' }); }}
          />
        )}
        {modal.kind === 'dependency' && draft && (
          <DependencyModal
            initial={modal.dependency}
            products={draft.products}
            onCancel={() => setModal({ kind: 'none' })}
            onSave={(d) => { upsertDependency(d); setModal({ kind: 'none' }); }}
          />
        )}
      </main>
    </div>
  );
}

function BanMark() {
  return <i className="rule-mark bad"><AlertTriangle size={12} /></i>;
}
function CheckMark() {
  return <i className="rule-mark ok"><Check size={12} /></i>;
}
