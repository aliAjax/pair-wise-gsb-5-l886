// License Lens —— 页面层：产物 / 依赖登记弹窗
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Assignment, Dependency, Product, Scope } from '../core/types';
import { INTRO_OPTIONS, SCOPE_LABEL } from '../core/scope';
import { createId } from '../core/scope';

interface ProductModalProps {
  initial: Product | null;
  onCancel: () => void;
  onSave: (product: Product) => void;
}

export function ProductModal({ initial, onCancel, onSave }: ProductModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<Scope>(initial?.kind ?? 'runtime');

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{initial ? '编辑产物' : '登记产物'}</h2>
          <button className="icon-btn" onClick={onCancel}><X size={17} /></button>
        </div>
        <label className="field">
          产物名称
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：站点产物（dist）"
          />
        </label>
        <label className="field">
          产物性质
          <select value={kind} onChange={(e) => setKind(e.target.value as Scope)}>
            <option value="runtime">运行产物（随版本分发）</option>
            <option value="development">开发产物（仅构建期）</option>
          </select>
        </label>
        <p className="modal-hint">产物性质改变后会重新核对全部归属；开发依赖永远不能挂到运行产物。</p>
        <div className="modal-actions">
          <button className="outline" onClick={onCancel}>取消</button>
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({ id: initial?.id ?? createId('prod'), name: name.trim(), kind })
            }
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

interface DependencyModalProps {
  initial: Dependency | null;
  products: Product[];
  onCancel: () => void;
  onSave: (dependency: Dependency) => void;
}

type AssignmentRow = { key: string; productId: string; path: string; scope: Scope };

function toRows(dep: Dependency | null): AssignmentRow[] {
  if (!dep || dep.assignments.length === 0) {
    return [{ key: createId('row'), productId: '', path: '', scope: 'runtime' }];
  }
  return dep.assignments.map((a) => ({
    key: createId('row'),
    productId: a.productId,
    path: a.path,
    scope: a.scope,
  }));
}

export function DependencyModal({ initial, products, onCancel, onSave }: DependencyModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [version, setVersion] = useState(initial?.version ?? '');
  const [introducedBy, setIntroducedBy] = useState(initial?.introducedBy ?? INTRO_OPTIONS[0]);
  const [purpose, setPurpose] = useState(initial?.purpose ?? '');
  const [license, setLicense] = useState(initial?.license ?? '');
  const [kind, setKind] = useState<Scope>(initial?.kind ?? 'runtime');
  const [rows, setRows] = useState<AssignmentRow[]>(() => toRows(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const updateRow = (key: string, patch: Partial<AssignmentRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!name.trim()) return setError('包名必填。');
    const assignments: Assignment[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.productId || !row.path.trim()) {
        return setError('每条所属产物记录都必须选择产物并填写进入路径；空行请删除。');
      }
      const bucket = `${row.productId} ${row.path.trim()}`;
      if (seen.has(bucket)) return setError('同一产物下同一路径不能重复登记。');
      seen.add(bucket);
      assignments.push({ productId: row.productId, path: row.path.trim(), scope: row.scope });
    }
    onSave({
      id: initial?.id ?? createId('dep'),
      name: name.trim(),
      version: version.trim(),
      introducedBy,
      purpose: purpose.trim(),
      license: license.trim(),
      kind,
      assignments,
    });
  };

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{initial ? '编辑依赖登记' : '登记依赖'}</h2>
          <button className="icon-btn" onClick={onCancel}><X size={17} /></button>
        </div>

        <div className="form-grid">
          <label className="field">
            包名 *
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 react" />
          </label>
          <label className="field">
            版本
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="例如 18.3.1" />
          </label>
          <label className="field">
            引入方式
            <select value={introducedBy} onChange={(e) => setIntroducedBy(e.target.value)}>
              {INTRO_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
            </select>
          </label>
          <label className="field">
            依赖性质 *
            <select
              value={kind}
              onChange={(e) => {
                const next = e.target.value as Scope;
                setKind(next);
                // 性质联动：开发依赖不会以运行路径进入产物
                if (next === 'development')
                  setRows((rs) => rs.map((r) => ({ ...r, scope: 'development' })));
              }}
            >
              <option value="runtime">运行依赖（dependencies）</option>
              <option value="development">开发依赖（devDependencies）</option>
            </select>
          </label>
          <label className="field span-2">
            用途
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="这个依赖在产物里承担什么职责" />
          </label>
          <label className="field span-2">
            许可证声明{kind === 'runtime' ? ' *（进入运行产物必填）' : '（开发依赖可留空）'}
            <input
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="例如 MIT / Apache-2.0；留空即缺声明"
              className={!license.trim() && kind === 'runtime' ? 'input-warn' : ''}
            />
          </label>
        </div>

        <div className="rows-head">
          <b>所属产物与进入路径</b>
          <span>同一依赖可进入多个产物</span>
        </div>
        <div className="assignment-rows">
          <div className="row-th"><span>产物</span><span>进入路径</span><span>路径标记</span><span /></div>
          {rows.map((row) => {
            const product = products.find((p) => p.id === row.productId);
            const scopeLocked = kind === 'development';
            return (
              <div className="row-line" key={row.key}>
                <select value={row.productId} onChange={(e) => updateRow(row.key, { productId: e.target.value })}>
                  <option value="">选择产物…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}（{SCOPE_LABEL[p.kind]}）</option>
                  ))}
                </select>
                <input
                  value={row.path}
                  onChange={(e) => updateRow(row.key, { path: e.target.value })}
                  placeholder="例如 src/main.tsx"
                />
                <select
                  value={row.scope}
                  disabled={scopeLocked}
                  title={scopeLocked ? '开发依赖的路径只能标记为开发' : undefined}
                  onChange={(e) => updateRow(row.key, { scope: e.target.value as Scope })}
                >
                  <option value="runtime">运行</option>
                  <option value="development">开发</option>
                </select>
                <button
                  className="icon-btn danger"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  <Trash2 size={15} />
                </button>
                {product && kind === 'development' && product.kind === 'runtime' && (
                  <small className="row-error">开发依赖不得挂到运行产物，核对将拒绝。</small>
                )}
              </div>
            );
          })}
        </div>
        <button className="ghost" onClick={() => setRows((rs) => [...rs, { key: createId('row'), productId: '', path: '', scope: kind === 'development' ? 'development' : 'runtime' }])}>
          <Plus size={14} /> 再挂一个产物
        </button>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="outline" onClick={onCancel}>取消</button>
          <button className="primary" onClick={submit}>保存登记</button>
        </div>
      </div>
    </div>
  );
}
