import { useState } from 'react';
import { Boxes, FileCog, Layers, Plus, Trash2 } from 'lucide-react';
import type { Artifact, ArtifactKind, Dependency, Violation } from '../types';
import { KindBadge } from './shared';
import { uid } from '../storage/storage';

interface Props {
  artifacts: Artifact[];
  dependencies: Dependency[];
  violations: Violation[];
  onArtifactsChange: (artifacts: Artifact[]) => void;
  onDependenciesChange: (dependencies: Dependency[]) => void;
}

export default function Artifacts({
  artifacts,
  dependencies,
  violations,
  onArtifactsChange,
  onDependenciesChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => artifacts[0]?.id ?? null,
  );
  const selected = artifacts.find((a) => a.id === selectedId) ?? null;

  const patch = (id: string, p: Partial<Artifact>) =>
    onArtifactsChange(artifacts.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const add = () => {
    const a: Artifact = {
      id: uid(),
      name: '',
      kind: 'runtime',
      version: '1.0.0',
      licenseNoticePath: '',
    };
    onArtifactsChange([...artifacts, a]);
    setSelectedId(a.id);
  };

  const remove = (id: string) => {
    onArtifactsChange(artifacts.filter((a) => a.id !== id));
    onDependenciesChange(
      dependencies.map((d) => ({
        ...d,
        memberships: d.memberships.filter((m) => m.artifactId !== id),
      })),
    );
    if (selectedId === id) {
      const next = artifacts.filter((a) => a.id !== id);
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const memberCount = (id: string) =>
    new Set(
      dependencies
        .filter((d) => d.memberships.some((m) => m.artifactId === id))
        .map((d) => d.id),
    ).size;

  const runtimeMembers = (id: string) => {
    const ids = new Set(
      dependencies.flatMap((d) =>
        d.memberships.some((m) => m.artifactId === id && m.scope === 'runtime')
          ? [d.id]
          : [],
      ),
    );
    return dependencies.filter((d) => ids.has(d.id));
  };

  return (
    <div className="split">
      <section className="card list-card">
        <div className="card-head">
          <div>
            <h2>
              <Layers size={16} /> 产物登记
            </h2>
            <p>运行产物必须登记许可证声明路径。</p>
          </div>
          <button className="primary small" onClick={add}>
            <Plus size={14} /> 新增产物
          </button>
        </div>
        <div className="item-list">
          {artifacts.length === 0 && (
            <div className="empty-hint">还没有产物。</div>
          )}
          {artifacts.map((a) => {
            const issues = violations.filter((v) => v.artifactId === a.id);
            return (
              <button
                key={a.id}
                className={`item ${a.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(a.id)}
              >
                <span className="item-icon">
                  <FileCog size={15} />
                </span>
                <span className="item-main">
                  <b>{a.name.trim() || '（未命名产物）'} <em>{a.version}</em></b>
                  <small>
                    <KindBadge kind={a.kind} /> · {memberCount(a.id)} 个依赖
                  </small>
                </span>
                {issues.length > 0 && <span className="issue-count">{issues.length}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card editor-card">
        {!selected ? (
          <div className="empty-hint">从左侧选择一个产物进行编辑。</div>
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>{selected.name.trim() || '新产物'}</h2>
              <button className="ghost danger" onClick={() => remove(selected.id)}>
                <Trash2 size={14} /> 删除
              </button>
            </div>

            <div className="form-grid">
              <label>
                产物名称
                <input
                  value={selected.name}
                  placeholder="例如 aurora-web"
                  onChange={(e) => patch(selected.id, { name: e.target.value })}
                />
              </label>
              <label>
                产物版本
                <input
                  value={selected.version}
                  onChange={(e) => patch(selected.id, { version: e.target.value })}
                />
              </label>
              <label className="span-2">
                产物类型
                <div className="seg wide">
                  <button
                    className={selected.kind === 'runtime' ? 'on runtime' : ''}
                    onClick={() => patch(selected.id, { kind: 'runtime' as ArtifactKind })}
                  >
                    运行产物（对外分发）
                  </button>
                  <button
                    className={selected.kind === 'build' ? 'on dev' : ''}
                    onClick={() => patch(selected.id, { kind: 'build' as ArtifactKind })}
                  >
                    开发 / 构建产物
                  </button>
                </div>
              </label>
              <label
                className={`span-2 ${
                  selected.kind === 'runtime' && !selected.licenseNoticePath.trim()
                    ? 'field-warn'
                    : ''
                }`}
              >
                许可证声明路径（NOTICE / LICENSE 汇总）
                <input
                  value={selected.licenseNoticePath}
                  placeholder="例如 dist/NOTICE.txt"
                  onChange={(e) =>
                    patch(selected.id, { licenseNoticePath: e.target.value })
                  }
                />
                {selected.kind === 'runtime' && !selected.licenseNoticePath.trim() && (
                  <small className="form-error">
                    运行产物缺少许可证声明，整批核对将被拒绝。
                  </small>
                )}
              </label>
            </div>

            <div className="memberships-head">
              <h3>运行范围依赖（{runtimeMembers(selected.id).length}）</h3>
              <span>
                <Boxes size={12} /> 许可证清单将在冻结版本中汇总这些依赖。
              </span>
            </div>
            <div className="chip-list">
              {runtimeMembers(selected.id).length === 0 && (
                <span className="empty-hint inline">该产物没有运行依赖。</span>
              )}
              {runtimeMembers(selected.id).map((d) => (
                <span className="dep-chip" key={d.id}>
                  {d.packageName} <em>{d.version}</em>
                  {d.license.trim() ? <i>{d.license}</i> : <i className="missing">缺失</i>}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
