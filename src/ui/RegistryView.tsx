// License Lens —— 页面层：登记总览（产物 / 依赖 / 产物视角范围）
import { Boxes, FileCode2, Layers3, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Dependency, Product, RegistryState, Violation } from '../core/types';
import { computeProductViews, SCOPE_LABEL } from '../core/scope';

interface RegistryViewProps {
  state: RegistryState;
  violations: Violation[];
  readOnly: boolean;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onRemoveProduct: (product: Product) => void;
  onAddDependency: () => void;
  onEditDependency: (dependency: Dependency) => void;
  onRemoveDependency: (dependency: Dependency) => void;
}

/** 找出与某条「产物+路径」登记相关的不符项，用于行内标红 */
function violationKey(v: Violation): string {
  return `${v.productId} ${v.path}`;
}

export function RegistryView({
  state,
  violations,
  readOnly,
  onAddProduct,
  onEditProduct,
  onRemoveProduct,
  onAddDependency,
  onEditDependency,
  onRemoveDependency,
}: RegistryViewProps) {
  const views = computeProductViews(state);
  const flagged = new Set(violations.map(violationKey));

  return (
    <div className="registry">
      {/* 产物登记 */}
      <section className="card">
        <div className="card-head">
          <div className="card-title"><Boxes size={16} /><div><h2>产物登记</h2><p>构建输出及其性质：运行 / 开发</p></div></div>
          <button className="outline small" disabled={readOnly} onClick={onAddProduct}><Plus size={14} />登记产物</button>
        </div>
        <div className="grid-table products-table">
          <div className="gt-row gt-th"><span>产物</span><span>性质</span><span>挂入依赖数</span><span /></div>
          {state.products.map((product) => {
            const count = state.dependencies.reduce(
              (n, d) => n + d.assignments.filter((a) => a.productId === product.id).length,
              0,
            );
            return (
              <div className="gt-row" key={product.id}>
                <span className="strong">{product.name}</span>
                <span><i className={`pill ${product.kind}`}>{SCOPE_LABEL[product.kind]}</i></span>
                <span className="muted">{count}</span>
                <span className="row-actions">
                  <button className="icon-btn" title="编辑" disabled={readOnly} onClick={() => onEditProduct(product)}><Pencil size={14} /></button>
                  <button className="icon-btn danger" title="删除" disabled={readOnly} onClick={() => onRemoveProduct(product)}><Trash2 size={14} /></button>
                </span>
              </div>
            );
          })}
          {state.products.length === 0 && <p className="empty-hint">还没有产物，先登记一个运行或开发产物。</p>}
        </div>
      </section>

      {/* 依赖登记 */}
      <section className="card">
        <div className="card-head">
          <div className="card-title"><FileCode2 size={16} /><div><h2>依赖登记</h2><p>包名 · 引入方式 · 用途 · 所属产物（可多个）</p></div></div>
          <button className="outline small" disabled={readOnly} onClick={onAddDependency}><PackagePlus size={14} />登记依赖</button>
        </div>
        <div className="grid-table deps-table">
          <div className="gt-row gt-th">
            <span>包名</span><span>版本</span><span>引入方式</span><span>用途</span><span>性质</span><span>许可证</span><span>所属产物</span><span />
          </div>
          {state.dependencies.map((dep) => (
            <div className="gt-row" key={dep.id}>
              <span className="strong">{dep.name}</span>
              <span className="muted mono">{dep.version || '—'}</span>
              <span className="muted small-text">{dep.introducedBy}</span>
              <span className="muted small-text">{dep.purpose || '—'}</span>
              <span><i className={`pill ${dep.kind}`}>{SCOPE_LABEL[dep.kind]}</i></span>
              <span>{dep.license.trim()
                ? <i className="license-pill">{dep.license}</i>
                : <i className="license-pill missing">缺声明</i>}</span>
              <span className="assign-cell">
                {dep.assignments.length === 0 && <em className="muted">未挂产物</em>}
                {dep.assignments.map((a, i) => {
                  const product = state.products.find((p) => p.id === a.productId);
                  const hot = flagged.has(`${a.productId} ${a.path.trim()}`);
                  return (
                    <i className={`assign-tag ${hot ? 'hot' : ''}`} key={i}>
                      {product?.name ?? '已删除产物'} <b>·</b> <span className="mono">{a.path}</span> <b>·</b> {SCOPE_LABEL[a.scope]}
                    </i>
                  );
                })}
              </span>
              <span className="row-actions">
                <button className="icon-btn" title="编辑" disabled={readOnly} onClick={() => onEditDependency(dep)}><Pencil size={14} /></button>
                <button className="icon-btn danger" title="删除" disabled={readOnly} onClick={() => onRemoveDependency(dep)}><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
          {state.dependencies.length === 0 && <p className="empty-hint">还没有依赖登记。</p>}
        </div>
      </section>

      {/* 产物视角：范围计算结果 */}
      <section className="card">
        <div className="card-head">
          <div className="card-title"><Layers3 size={16} /><div><h2>产物归属与运行范围</h2><p>范围计算结果：按产物聚合每个进入路径与原值</p></div></div>
        </div>
        <div className="product-views">
          {views.map((view) => (
            <div className={`pv-block ${view.kind}`} key={view.id}>
              <div className="pv-head">
                <b>{view.name}</b>
                <i className={`pill ${view.kind}`}>{SCOPE_LABEL[view.kind]}产物</i>
                <span className="muted">{view.entries.length} 条进入路径</span>
              </div>
              {view.entries.length === 0 && <p className="empty-hint">暂无依赖进入此产物。</p>}
              <ul className="pv-list">
                {view.entries.map(({ dependency, assignment }, i) => {
                  const hot = flagged.has(`${view.id} ${assignment.path.trim()}`);
                  return (
                    <li className={hot ? 'hot' : ''} key={`${dependency.id}-${i}`}>
                      <span className="mono pv-path">{assignment.path}</span>
                      <span className="pv-dep">{dependency.name}</span>
                      <i className={`pill ${assignment.scope}`}>{SCOPE_LABEL[assignment.scope]}</i>
                      <span className="muted small-text">{dependency.license.trim() || '缺声明'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
