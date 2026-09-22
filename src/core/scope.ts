// License Lens —— 范围计算：纯函数，无副作用，可独立测试
import type {
  Assignment,
  ConsoleStore,
  Dependency,
  FrozenVersion,
  Product,
  RegistryState,
  Scope,
  Violation,
  ViolationCode,
} from './types';

/** 「产物 + 路径」桶键的分隔符，路径内不会出现的控制字符 */
const KEY_SEP = String.fromCharCode(1);

export const SCOPE_LABEL: Record<Scope, string> = {
  runtime: '运行',
  development: '开发',
};

/** 引入方式选项（固定枚举，页面与逻辑共用） */
export const INTRO_OPTIONS = ['npm dependencies', 'npm devDependencies', 'CDN 引入', '手动引入'] as const;

export const VIOLATION_META: Record<
  ViolationCode,
  { title: string; description: string }
> = {
  MISSING_LICENSE: {
    title: '运行产物缺许可证声明',
    description: '进入运行产物的依赖必须填写许可证声明，否则整批拒绝。',
  },
  DEV_DEP_ON_RUNTIME_PRODUCT: {
    title: '开发依赖挂到运行产物',
    description: '开发依赖不得归属到运行产物，即便其路径被标为开发也不允许。',
  },
  PATH_SCOPE_CONFLICT: {
    title: '同一路径既标开发又标运行',
    description: '同一产物下同一路径只能有一种范围标记，原值冲突即整批拒绝。',
  },
};

function displayName(d: Dependency | undefined): string {
  return d && d.name.trim() ? d.name.trim() : '（未命名依赖）';
}

interface AssignmentContext {
  dep: Dependency;
  assignment: Assignment;
}

/**
 * 核对整批登记。返回不符项列表；为空表示通过、允许冻结。
 * 三条硬规则，命中任意一条都整批拒绝：
 *  1. 运行产物的路径上出现缺许可证声明的依赖；
 *  2. 开发依赖（含未挂任何运行产物的性质）挂到运行产物；
 *  3. 同一产物同一路径既标开发又标运行。
 * 另含悬挂引用（产物已删除但归属未清理）的防护，按开发依赖处理。
 */
export function validateBatch(state: RegistryState): Violation[] {
  const products = new Map<string, Product>();
  state.products.forEach((p) => products.set(p.id, p));
  const violations: Violation[] = [];

  const push = (
    code: ViolationCode,
    productId: string,
    productName: string,
    path: string,
    contexts: AssignmentContext[],
  ) => {
    violations.push({
      code,
      productId,
      productName,
      path,
      dependencyNames: contexts.map(({ dep }) => displayName(dep)),
      values: contexts.map(
        ({ dep, assignment }) =>
          `${displayName(dep)} → ${SCOPE_LABEL[assignment.scope]}（依赖性质：${SCOPE_LABEL[dep.kind]}${dep.license.trim() ? `，许可证：${dep.license.trim()}` : '，许可证：缺声明'}）`,
      ),
      detail: VIOLATION_META[code].description,
    });
  };

  // 按「产物 + 路径」汇聚全部登记
  const buckets = new Map<string, AssignmentContext[]>();
  for (const dep of state.dependencies) {
    for (const assignment of dep.assignments) {
      const key = `${assignment.productId}${KEY_SEP}${assignment.path.trim()}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push({ dep, assignment });
      else buckets.set(key, [{ dep, assignment }]);
    }
  }

  for (const [key, contexts] of buckets) {
    const [productId, path] = key.split(KEY_SEP);
    const product = products.get(productId);
    const productName = product ? product.name : '（已删除产物）';
    const scopes = new Set(contexts.map((c) => c.assignment.scope));

    // 规则 3：同一路径既标开发又标运行
    if (scopes.has('runtime') && scopes.has('development')) {
      push('PATH_SCOPE_CONFLICT', productId, productName, path, contexts);
    }

    for (const { dep, assignment } of contexts) {
      const reachesRuntime = product ? product.kind === 'runtime' : false;
      // 悬挂引用（产物不存在）按最保守口径：视作可能落到运行产物处理
      const effectiveRuntime = product ? reachesRuntime : true;

      // 规则 2：开发依赖不得挂到运行产物
      if (dep.kind === 'development' && effectiveRuntime) {
        push('DEV_DEP_ON_RUNTIME_PRODUCT', productId, productName, path, [
          { dep, assignment },
        ]);
      }

      // 规则 1：运行产物（含路径标运行）上的依赖缺许可证声明
      if (effectiveRuntime && assignment.scope === 'runtime' && !dep.license.trim()) {
        push('MISSING_LICENSE', productId, productName, path, [
          { dep, assignment },
        ]);
      }
    }
  }

  // 稳定排序，拒绝清单顺序可预期
  const order: Record<ViolationCode, number> = {
    MISSING_LICENSE: 0,
    DEV_DEP_ON_RUNTIME_PRODUCT: 1,
    PATH_SCOPE_CONFLICT: 2,
  };
  violations.sort((a, b) => {
    if (a.productName !== b.productName) return a.productName < b.productName ? -1 : 1;
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    if (order[a.code] !== order[b.code]) return order[a.code] - order[b.code];
    return a.dependencyNames.join(',') < b.dependencyNames.join(',') ? -1 : 1;
  });
  return violations;
}

export interface ProductView extends Product {
  entries: {
    dependency: Dependency;
    assignment: Assignment;
  }[];
}

/** 从登记状态计算「产物视角」的归属清单（供页面渲染，不做校验判断） */
export function computeProductViews(state: RegistryState): ProductView[] {
  return state.products.map((product) => {
    const entries: ProductView['entries'] = [];
    for (const dep of state.dependencies) {
      for (const assignment of dep.assignments) {
        if (assignment.productId === product.id) entries.push({ dependency: dep, assignment });
      }
    }
    entries.sort((a, b) => {
      if (a.assignment.path !== b.assignment.path)
        return a.assignment.path < b.assignment.path ? -1 : 1;
      return a.dependency.name < b.dependency.name ? -1 : 1;
    });
    return { ...product, entries };
  });
}

/** 一个依赖是否真正进入运行产物（性质 + 归属双重判断） */
export function isRuntimeDependency(dep: Dependency, state: RegistryState): boolean {
  if (dep.kind === 'development') return false;
  return dep.assignments.some((a) => {
    const product = state.products.find((p) => p.id === a.productId);
    return product && product.kind === 'runtime';
  });
}

/** 冻结当前草稿为带原因的新版本 */
export function freezeVersion(
  store: ConsoleStore,
  draft: RegistryState,
  reason: string,
  now: Date = new Date(),
): ConsoleStore {
  const sequence = store.versions.length + 1;
  const version: FrozenVersion = {
    id: `v${sequence}`,
    sequence,
    parentId: store.headId,
    reason: reason.trim(),
    createdAt: now.toISOString(),
    snapshot: cloneState(draft),
  };
  return {
    versions: [...store.versions, version],
    headId: version.id,
    draft: null,
  };
}

/** 基于 head 快照建立调整草稿；没有 head 时返回 null（应由初始批次流程处理） */
export function startAdjustment(store: ConsoleStore): RegistryState | null {
  const head = store.versions.find((v) => v.id === store.headId);
  return head ? cloneState(head.snapshot) : null;
}

/** 校验 localStorage 读出的数据形状与版本链一致性，损坏则回空 */
export function validateStore(raw: unknown): ConsoleStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<ConsoleStore>;
  if (!Array.isArray(s.versions) || typeof s.headId !== 'string' && s.headId !== null)
    return null;
  let expectedParent: string | null = null;
  for (let i = 0; i < s.versions.length; i++) {
    const v = s.versions[i];
    if (!v || v.id !== `v${i + 1}` || v.sequence !== i + 1 || v.parentId !== expectedParent)
      return null;
    if (!v.snapshot || !Array.isArray(v.snapshot.products) || !Array.isArray(v.snapshot.dependencies))
      return null;
    expectedParent = v.id;
  }
  if (s.versions.length === 0 && s.headId !== null) return null;
  if (s.versions.length > 0 && !s.versions.some((v) => v.id === s.headId)) return null;
  if (s.draft !== null && typeof s.draft !== 'object') return null;
  return {
    versions: s.versions as FrozenVersion[],
    headId: s.headId,
    draft: (s.draft as RegistryState | null) ?? null,
  };
}

/** 深拷贝，避免草稿改动污染已冻结快照 */
export function cloneState(state: RegistryState): RegistryState {
  return JSON.parse(JSON.stringify(state)) as RegistryState;
}

let idCounter = 0;
/** 生成简单唯一 id（前缀 + 时间 + 计数器），不引入 uuid 等依赖 */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}
