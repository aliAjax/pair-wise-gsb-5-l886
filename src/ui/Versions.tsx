import { useMemo, useState } from 'react';
import {
  ChevronDown,
  Download,
  GitBranch,
  History,
  Lock,
  RotateCcw,
  Snowflake,
} from 'lucide-react';
import type { FrozenVersion } from '../types';
import { buildNoticeReport, summarizeByArtifact } from '../scope/scope';
import { formatDate, KindBadge, ScopeBadge } from './shared';

interface Props {
  versions: FrozenVersion[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** 以某个冻结版本覆盖当前草稿（生成待调整的新草稿） */
  onCheckout: (v: FrozenVersion) => void;
}

function download(filename: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function VersionSnapshot({ version }: { version: FrozenVersion }) {
  const summary = useMemo(
    () => summarizeByArtifact({ artifacts: version.artifacts, dependencies: version.dependencies }),
    [version],
  );
  return (
    <div className="snapshot">
      {summary.map((s) => (
        <div className="snap-artifact" key={s.artifactId}>
          <div className="snap-head">
            <b>{s.artifactName}</b>
            <KindBadge kind={s.kind} />
            {s.kind === 'runtime' && (
              <span className="notice-path">
                声明：
                {version.artifacts.find((a) => a.id === s.artifactId)?.licenseNoticePath ||
                  '（空）'}
              </span>
            )}
          </div>
          <div className="snap-cols">
            <div>
              <h4>
                <ScopeBadge scope="runtime" /> {s.runtime.length}
              </h4>
              {s.runtime.map((d) => (
                <div className="snap-dep" key={`r-${d.id}`}>
                  <span>{d.packageName}</span> <em>{d.version}</em>{' '}
                  <i className={d.license ? '' : 'missing'}>
                    {d.license || '许可证缺失'}
                  </i>
                </div>
              ))}
            </div>
            <div>
              <h4>
                <ScopeBadge scope="dev" /> {s.dev.length}
              </h4>
              {s.dev.map((d) => (
                <div className="snap-dep" key={`d-${d.id}`}>
                  <span>{d.packageName}</span> <em>{d.version}</em>{' '}
                  <i>{d.license}</i>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Versions({ versions, selectedId, onSelect, onCheckout }: Props) {
  const [expanded, setExpanded] = useState<number | null>(
    selectedId ?? versions[versions.length - 1]?.number ?? null,
  );
  const current =
    versions.find((v) => v.number === (selectedId ?? expanded)) ?? null;

  const exportReport = (v: FrozenVersion) =>
    download(`license-lens-v${v.number}-notice.md`, buildNoticeReport(v));

  return (
    <div className="split">
      <section className="card list-card">
        <div className="card-head">
          <div>
            <h2>
              <History size={16} /> 版本链
            </h2>
            <p>已冻结的范围不可变，调整只追加带原因的新版本。</p>
          </div>
        </div>
        <div className="version-chain">
          {versions.length === 0 && (
            <div className="empty-hint">尚无冻结版本，先到核对台通过整批核对。</div>
          )}
          {[...versions].reverse().map((v, idx) => (
            <button
              key={v.number}
              className={`v-item ${current?.number === v.number ? 'selected' : ''}`}
              onClick={() => {
                onSelect(v.number);
                setExpanded(v.number);
              }}
            >
              <span className="v-rail">
                <Snowflake size={13} />
              </span>
              <span className="v-main">
                <b>
                  v{v.number}
                  {idx === 0 && <em className="latest-tag">最新</em>}
                </b>
                <small>{v.reason || '（初次冻结）'}</small>
                <small className="v-time">{formatDate(v.createdAt)}</small>
              </span>
              <ChevronDown
                size={14}
                className={expanded === v.number ? 'rot' : ''}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="card editor-card">
        {!current ? (
          <div className="empty-hint">选择左侧版本查看冻结时的依赖、产物与版本链内容。</div>
        ) : (
          <div className="editor">
            <div className="editor-head">
              <h2>
                <Lock size={15} /> 冻结范围 v{current.number}
              </h2>
              <div className="head-btns">
                <button className="outline small" onClick={() => exportReport(current)}>
                  <Download size={14} /> 导出许可证清单
                </button>
                <button className="ghost small" onClick={() => onCheckout(current)}>
                  <RotateCcw size={14} /> 以此版本调整（建草稿）
                </button>
              </div>
            </div>
            <div className="frozen-meta">
              <div>
                <GitBranch size={13} /> 冻结原因
                <b>{current.reason || '（初次冻结）'}</b>
              </div>
              <div>
                <Snowflake size={13} /> 冻结时间
                <b>{formatDate(current.createdAt)}</b>
              </div>
              <div>
                <Lock size={13} /> 内容
                <b>
                  {current.artifacts.length} 个产物 · {current.dependencies.length} 个依赖
                </b>
              </div>
            </div>
            <VersionSnapshot version={current} />
          </div>
        )}
      </section>
    </div>
  );
}
