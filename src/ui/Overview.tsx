import { useState } from 'react';
import {
  AlertOctagon,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Snowflake,
} from 'lucide-react';
import type { BatchResult, FrozenVersion, RejectionRecord, Violation } from '../types';
import { formatDate } from './shared';

interface Props {
  precheck: BatchResult;
  draftVersion: number;
  isDirty: boolean;
  latest: FrozenVersion | null;
  lastRejection: RejectionRecord | null;
  onApprove: (reason: string) => void;
  onReject: () => void;
}

const CODE_LABEL: Record<Violation['code'], string> = {
  ARTIFACT_NOTICE_MISSING: '运行产物缺许可证声明',
  RUNTIME_LICENSE_MISSING: '运行依赖缺许可证',
  DEV_ON_RUNTIME_ARTIFACT: '开发依赖进入运行产物',
  SCOPE_PATH_CONFLICT: '同路径范围冲突',
};

function ViolationTable({ violations }: { violations: Violation[] }) {
  return (
    <div className="violation-table">
      <div className="vtr vth">
        <span>产物</span>
        <span>路径</span>
        <span>违反规则</span>
        <span>原值</span>
      </div>
      {violations.map((v, i) => (
        <div className="vtr" key={`${v.code}-${v.artifactId}-${v.path}-${i}`}>
          <span className="v-art">
            <AlertOctagon size={13} />
            <b>{v.artifactName}</b>
          </span>
          <span className="v-path" title={v.path}>
            {v.path}
          </span>
          <span className="v-rule">
            <i>{CODE_LABEL[v.code]}</i>
            <small>{v.detail}</small>
          </span>
          <span className="v-original">{v.original}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview({
  precheck,
  draftVersion,
  isDirty,
  latest,
  lastRejection,
  onApprove,
  onReject,
}: Props) {
  const [reason, setReason] = useState('');
  const nextNumber = latest ? latest.number + 1 : 1;
  const reasonMissing = isDirty && latest !== null && !reason.trim();

  const submit = () => {
    if (!precheck.ok || reasonMissing) return;
    onApprove(reason.trim());
    setReason('');
  };

  return (
    <div className="overview">
      <section className="card gate-card">
        <div className="card-head">
          <div>
            <h2>
              <ClipboardCheck size={16} /> 整批核对与范围冻结
            </h2>
            <p>
              基于当前草稿核对全部 {precheck.depCount} 个依赖、
              {precheck.runtimeArtifactCount} 个运行产物；通过后冻结为 v{nextNumber}。
            </p>
          </div>
          <div className={`gate-pill ${precheck.ok ? 'pass' : 'reject'}`}>
            {precheck.ok ? <CheckCircle2 size={14} /> : <Ban size={14} />}
            {precheck.ok ? '预检通过' : `预检拒绝 · ${precheck.violations.length} 项`}
          </div>
        </div>

        <ul className="rule-list">
          <li className={precheck.violations.some((v) => v.code === 'ARTIFACT_NOTICE_MISSING') ? 'bad' : 'good'}>
            运行产物必须登记许可证声明（NOTICE / LICENSE 汇总路径）
          </li>
          <li className={precheck.violations.some((v) => v.code === 'RUNTIME_LICENSE_MISSING') ? 'bad' : 'good'}>
            进入运行产物的依赖必须填写许可证原值
          </li>
          <li className={precheck.violations.some((v) => v.code === 'DEV_ON_RUNTIME_ARTIFACT') ? 'bad' : 'good'}>
            开发依赖（dev）不得挂载到运行产物
          </li>
          <li className={precheck.violations.some((v) => v.code === 'SCOPE_PATH_CONFLICT') ? 'bad' : 'good'}>
            同一（产物，路径）不得既标开发又标运行
          </li>
        </ul>

        {precheck.ok && (
          <div className="freeze-box">
            {!isDirty ? (
              <div className="pass-note" style={{ padding: '4px 0' }}>
                <Snowflake size={15} /> 草稿与{latest ? ` v${latest.number} ` : ''}冻结基线一致，无需新建版本。
              </div>
            ) : (
              <>
                <label>
                  版本原因 {latest && <em>（调整已冻结范围，必须填写原因）</em>}
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={
                      latest
                        ? '例如：移除误挂到 aurora-web 的 typescript 开发依赖'
                        : '初次冻结可留空'
                    }
                  />
                </label>
                <button className="primary" onClick={submit} disabled={reasonMissing}>
                  <Snowflake size={15} /> 核对通过，冻结 v{nextNumber}
                </button>
                {reasonMissing && (
                  <small className="form-error">调整已冻结范围时必须填写版本原因。</small>
                )}
              </>
            )}
          </div>
        )}

        {!precheck.ok && (
          <div className="reject-banner">
            <Ban size={15} />
            <div>
              <b>整批拒绝：{precheck.violations.length} 项冲突，范围未冻结。</b>
              <span>请按「产物 / 路径 / 原值」逐项修正草稿后重新核对。</span>
            </div>
            <button className="reject-btn" onClick={onReject}>
              提交核对并留档拒绝
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>预检结果（实时草稿）</h2>
            <p>该结果随草稿即时变化，尚未触发冻结。</p>
          </div>
        </div>
        {precheck.ok ? (
          <div className="pass-note">
            <CheckCircle2 size={15} />
            全部规则通过
            {isDirty ? `，可冻结为 v${nextNumber}。` : '，草稿与最新冻结版本一致。'}
          </div>
        ) : (
          <ViolationTable violations={precheck.violations} />
        )}
      </section>

      {lastRejection && lastRejection.violations.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>上次提交拒绝记录</h2>
              <p>
                {formatDate(lastRejection.at)} 的整批拒绝明细，列明产物、路径与原值。
                {precheck.ok && '（当前草稿已修正全部冲突，可重新冻结）'}
              </p>
            </div>
          </div>
          <ViolationTable violations={lastRejection.violations} />
        </section>
      )}

      <section className="card baseline-card">
        <div className="card-head">
          <div>
            <h2>当前冻结基线</h2>
            <p>通过后范围即冻结；调整只能以「带原因的新版本」追加。</p>
          </div>
        </div>
        {latest ? (
          <div className="baseline">
            <div className="baseline-ver">
              <Snowflake size={15} /> v{latest.number}
            </div>
            <div className="baseline-body">
              <b>{latest.reason || '（初次冻结）'}</b>
              <small>
                冻结于 {formatDate(latest.createdAt)} · 草稿基线为 v{draftVersion}
                {isDirty && <em className="dirty-tag">有未冻结变更</em>}
              </small>
            </div>
          </div>
        ) : (
          <div className="pass-note">
            <Info size={15} /> 尚无冻结版本，首次核对通过后将生成 v1。
          </div>
        )}
      </section>
    </div>
  );
}
