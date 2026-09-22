// License Lens —— 领域类型定义（范围计算层，不依赖 React / DOM / 存储）

/** 范围标记：运行 / 开发。同一值同时用于「产物性质」「依赖性质」「路径标记」 */
export type Scope = 'runtime' | 'development';

/** 产物（构建输出），例如站点产物、构建链 */
export interface Product {
  id: string;
  name: string;
  kind: Scope;
}

/** 一条「依赖挂进某产物」的归属记录：路径 + 在该路径上的原始标记 */
export interface Assignment {
  productId: string;
  /** 依赖进入该产物的路径，如 src/main.tsx */
  path: string;
  /** 原值：该路径登记为运行还是开发 */
  scope: Scope;
}

/** 依赖登记：包名、引入方式、用途、许可证、性质，以及所属产物（可多个） */
export interface Dependency {
  id: string;
  /** 包名 */
  name: string;
  version: string;
  /** 引入方式 */
  introducedBy: string;
  /** 用途 */
  purpose: string;
  /** 许可证声明，空字符串表示缺声明 */
  license: string;
  /** 依赖性质：运行依赖 / 开发依赖（对应 dependencies / devDependencies） */
  kind: Scope;
  /** 所属产物，同一依赖可进入多个产物 */
  assignments: Assignment[];
}

/** 一整批登记：产物 + 依赖，核对与冻结的最小单位 */
export interface RegistryState {
  products: Product[];
  dependencies: Dependency[];
}

export type ViolationCode =
  | 'MISSING_LICENSE'
  | 'DEV_DEP_ON_RUNTIME_PRODUCT'
  | 'PATH_SCOPE_CONFLICT';

/** 整批核对的一条不符项：必须列明产物、路径与原值 */
export interface Violation {
  code: ViolationCode;
  productId: string;
  productName: string;
  path: string;
  dependencyNames: string[];
  /** 原值（登记时实际写入的内容） */
  values: string[];
  detail: string;
}

/** 冻结后的带原因版本，parentId 串成版本链 */
export interface FrozenVersion {
  id: string; // v1, v2 ...
  sequence: number;
  parentId: string | null;
  /** 调整原因 */
  reason: string;
  createdAt: string;
  /** 冻结时刻的完整快照，保证刷新后依赖与产物仍与该版本一致 */
  snapshot: RegistryState;
}

/** localStorage 持久化形状 */
export interface ConsoleStore {
  versions: FrozenVersion[];
  headId: string | null;
  /** 基于 head 的调整草稿；null 表示当前没有在途调整 */
  draft: RegistryState | null;
}
