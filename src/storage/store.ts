// License Lens —— 存储层：localStorage 读写。不含范围计算，不依赖页面。
import type { ConsoleStore, RegistryState } from '../core/types';
import { cloneState, validateStore } from '../core/scope';

const STORAGE_KEY = 'license-lens-console-v1';

export const EMPTY_STORE: ConsoleStore = { versions: [], headId: null, draft: null };

/** 读取持久化的核对台；数据损坏或缺失时回空存储 */
export function loadStore(): ConsoleStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed: unknown = JSON.parse(raw);
    const checked = validateStore(parsed);
    return checked ?? EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

/** 整存整取：版本链 + head + 在途草稿一起写入，保证刷新后三者一致 */
export function saveStore(store: ConsoleStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用时静默失败：冻结与核对均以内存为准，仅刷新不保留
  }
}

/** 仅更新在途草稿（调整中的每次编辑调用） */
export function saveDraft(store: ConsoleStore, draft: RegistryState): ConsoleStore {
  const next: ConsoleStore = { ...store, draft: cloneState(draft) };
  saveStore(next);
  return next;
}

/** 丢弃在途草稿，回到 head 冻结态 */
export function discardDraft(store: ConsoleStore): ConsoleStore {
  const next: ConsoleStore = { ...store, draft: null };
  saveStore(next);
  return next;
}
