// 领域模型：依赖登记、产物登记、冻结版本与核对结果

/** 引入方式 */
export type ImportMethod = 'npm' | 'CDN' | '手动引入' | 'Git 子模块';

/** 依赖在某产物中的范围：运行 / 开发 */
export type ScopeKind = 'runtime' | 'dev';

/** 产物类型：运行产物 / 开发（构建）产物 */
export type ArtifactKind = 'runtime' | 'build';

/** 一条「依赖 → 产物」的挂载记录 */
export interface Membership {
  artifactId: string;
  /** 产物内路径，例如 node_modules/react、vendor/legacy-parser */
  path: string;
  scope: ScopeKind;
}

/** 依赖登记：包名、引入方式、用途、许可证、所属产物（可多个） */
export interface Dependency {
  id: string;
  packageName: string;
  version: string;
  importMethod: ImportMethod;
  purpose: string;
  /** 许可证原值；空字符串表示未声明 */
  license: string;
  memberships: Membership[];
}

/** 产物登记 */
export interface Artifact {
  id: string;
  name: string;
  kind: ArtifactKind;
  version: string;
  /** 许可证声明（NOTICE / LICENSE 汇总）存放路径 */
  licenseNoticePath: string;
}

export type ViolationCode =
  | 'ARTIFACT_NOTICE_MISSING'
  | 'RUNTIME_LICENSE_MISSING'
  | 'DEV_ON_RUNTIME_ARTIFACT'
  | 'SCOPE_PATH_CONFLICT';

/** 整批核对拒绝时的单条问题：列明产物、路径和原值 */
export interface Violation {
  code: ViolationCode;
  rule: string;
  artifactId: string;
  artifactName: string;
  path: string;
  depId?: string;
  depName?: string;
  /** 触发规则的原始值 */
  original: string;
  detail: string;
}

export interface BatchResult {
  ok: boolean;
  violations: Violation[];
  depCount: number;
  runtimeArtifactCount: number;
}

/** 冻结后的不可变范围版本 */
export interface FrozenVersion {
  number: number;
  reason: string;
  createdAt: string;
  artifacts: Artifact[];
  dependencies: Dependency[];
}

export interface Draft {
  artifacts: Artifact[];
  dependencies: Dependency[];
}

export interface RejectionRecord {
  at: string;
  violations: Violation[];
}

export interface PersistedState {
  draft: Draft;
  versions: FrozenVersion[];
  lastRejection: RejectionRecord | null;
}
