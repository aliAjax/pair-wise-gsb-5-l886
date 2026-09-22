import { useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Package,
  PackagePlus,
  Trash2,
} from 'lucide-react';
import type {
  Artifact,
  Dependency,
  ImportMethod,
  Membership,
  ScopeKind,
} from '../types';
import { IMPORT_METHODS, KindBadge, ScopeBadge } from './shared';
import { uid } from '../storage/storage';
import type { Violation } from '../types';

interface Props {
  dependencies: Dependency[];
  artifacts: Artifact[];
  violations: Violation[];
  onChange: (dependencies: Dependency[]) => void;
}

const emptyDep = (artifacts: Artifact[]): Dependency => ({
  id: uid(),
  packageName: '',
  version: '',
  importMethod: 'npm',
  purpose: '',
  license: '',
  memberships: artifacts.length
    ? [{ artifactId: artifacts[0].id, path: '', scope: 'runtime' }]
    : [],
});

export default function Dependencies({
  dependencies,
  artifacts,
  violations,
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => dependencies[0]?.id ?? null,
  );
  const selected = dependencies.find((d) => d.id === selectedId) ?? null;

  const patch = (id: string, p: Partial<Dependency>) =>
    onChange(dependencies.map((d) => (d.id === id ? { ...d, ...p } : d)));

  const patchMembership = (
    dep: Dependency,
    index: number,
    p: Partial<Membership>,
  ) =>
    patch(dep.id, {
      memberships: dep.memberships.map((m, i) => (i === index ? { ...m, ...p } : m)),
    });

  const addDep = () => {
    const d = emptyDep(artifacts);
    onChange([...dependencies, d]);
    setSelectedId(d.id);
  };

  const removeDep = (id: string) => {
    const next = dependencies.filter((d) => d.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  const depViolations = (depId: string) =>
    violations.filter((v) => v.depId === depId);

  return (
    <div className="split">
      <section className="card list-card">
        <div className="card-head">
          <div>
            <h2>
              <Boxes size={16} /> 依赖登记
            </h2>
            <p>每个依赖登记包名、引入方式、用途与所属产物。</p>
          </div>
          <button className="primary small" onClick={addDep}>
            <PackagePlus size={14} /> 新增依赖
          </button>
        </div>
        <div className="item-list">
          {dependencies.length === 0 && (
            <div className="empty-hint">还没有依赖，点击「新增依赖」开始登记。</div>
          )}
          {dependencies.map((d) => {
            const issues = depViolations(d.id);
            return (
              <button
                key={d.id}
                className={`item ${d.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(d.id)}
              >
                <span className="item-icon">
                  <Package size={15} />
                </span>
                <span className="item-main">
                  <b>
                    {d.packageName.trim() || '（未命名依赖）'} <em>{d.version || ''}</em>
                  </b>
                  <small>
                    {d.importMethod} · {d.memberships.length} 个产物归属
                  </small>
                </span>
                {!d.license.trim() && (
                  <span className="warn-dot" title="许可证原值为空" />
                )}
                {issues.length > 0 && (
                  <AlertTriangle size={14} className="warn-icon" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card editor-card">
        {!selected ? (
          <div className="empty-hint">从左侧选择一个依赖进行编辑。</div>
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>{selected.packageName.trim() || '新依赖'}</h2>
              <button
                className="ghost danger"
                onClick={() => removeDep(selected.id)}
              >
                <Trash2 size={14} /> 删除
              </button>
            </div>

            <div className="form-grid">
              <label>
                包名
                <input
                  value={selected.packageName}
                  placeholder="例如 lodash-es"
                  onChange={(e) => patch(selected.id, { packageName: e.target.value })}
                />
              </label>
              <label>
                版本
                <input
                  value={selected.version}
                  placeholder="例如 4.17.21"
                  onChange={(e) => patch(selected.id, { version: e.target.value })}
                />
              </label>
              <label>
                引入方式
                <select
                  value={selected.importMethod}
                  onChange={(e) =>
                    patch(selected.id, { importMethod: e.target.value as ImportMethod })
                  }
                >
                  {IMPORT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className={!selected.license.trim() ? 'field-warn' : ''}>
                许可证原值
                <input
                  value={selected.license}
                  placeholder="例如 MIT / Apache-2.0 / GPL-3.0"
                  onChange={(e) => patch(selected.id, { license: e.target.value })}
                />
                {!selected.license.trim() && (
                  <small className="form-error">
                    该依赖若进入运行产物，整批核对将被拒绝。
                  </small>
                )}
              </label>
              <label className="span-2">
                用途
                <input
                  value={selected.purpose}
                  placeholder="说明该依赖在产物中的用途"
                  onChange={(e) => patch(selected.id, { purpose: e.target.value })}
                />
              </label>
            </div>

            <div className="memberships-head">
              <h3>所属产物与范围</h3>
              <span>同一依赖可进入多个产物；开发依赖不得挂到运行产物。</span>
            </div>

            <div className="membership-rows">
              {selected.memberships.length === 0 && (
                <div className="empty-hint">尚未归属任何产物。</div>
              )}
              {selected.memberships.map((m, i) => {
                const artifact = artifacts.find((a) => a.id === m.artifactId);
                const rowIssues = depViolations(selected.id).filter(
                  (v) => v.path === m.path,
                );
                return (
                  <div
                    className={`membership-row ${rowIssues.length ? 'has-issue' : ''}`}
                    key={`${m.artifactId}-${i}`}
                  >
                    <select
                      value={m.artifactId}
                      onChange={(e) =>
                        patchMembership(selected, i, { artifactId: e.target.value })
                      }
                    >
                      {artifacts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    {artifact && <KindBadge kind={artifact.kind} />}
                    <input
                      className="path-input"
                      value={m.path}
                      placeholder="产物内路径，如 node_modules/lodash-es"
                      onChange={(e) => patchMembership(selected, i, { path: e.target.value })}
                    />
                    <div className="seg">
                      <button
                        className={m.scope === 'runtime' ? 'on runtime' : ''}
                        onClick={() =>
                          patchMembership(selected, i, { scope: 'runtime' as ScopeKind })
                        }
                      >
                        运行
                      </button>
                      <button
                        className={m.scope === 'dev' ? 'on dev' : ''}
                        onClick={() =>
                          patchMembership(selected, i, { scope: 'dev' as ScopeKind })
                        }
                      >
                        开发
                      </button>
                    </div>
                    <ScopeBadge scope={m.scope} />
                    <button
                      className="ghost icon-btn"
                      title="移除该归属"
                      onClick={() =>
                        patch(selected.id, {
                          memberships: selected.memberships.filter((_, j) => j !== i),
                        })
                      }
                    >
                      ×
                    </button>
                    {rowIssues.length > 0 && (
                      <div className="row-issues">
                        {rowIssues.map((v, j) => (
                          <span key={j}>
                            <AlertTriangle size={12} /> {v.rule}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              className="outline small"
              disabled={artifacts.length === 0}
              onClick={() =>
                patch(selected.id, {
                  memberships: [
                    ...selected.memberships,
                    {
                      artifactId: artifacts[0]?.id ?? '',
                      path: selected.packageName
                        ? `node_modules/${selected.packageName}`
                        : '',
                      scope: 'runtime',
                    },
                  ],
                })
              }
            >
              + 添加到另一个产物
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
