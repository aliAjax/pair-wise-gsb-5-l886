// 存储层：只管 localStorage 读写与初始种子，不参与范围计算
import type { PersistedState } from '../types';
import { clone } from '../scope/scope';

const STORAGE_KEY = 'license-lens-scope-v1';

export const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const seed = (): PersistedState => {
  const web = 'seed-web-app';
  const cli = 'seed-cli-tool';
  const build = 'seed-build-image';

  const version1Artifacts = [
    {
      id: web,
      name: 'aurora-web',
      kind: 'runtime' as const,
      version: '3.2.0',
      licenseNoticePath: 'dist/NOTICE.txt',
    },
    {
      id: cli,
      name: 'aurora-cli',
      kind: 'runtime' as const,
      version: '1.0.4',
      licenseNoticePath: 'cli-bundle/licenses.md',
    },
    {
      id: build,
      name: 'ci-build-image',
      kind: 'build' as const,
      version: '2026.09',
      licenseNoticePath: '',
    },
  ];

  const version1Dependencies = [
    {
      id: 'dep-react',
      packageName: 'react',
      version: '18.3.1',
      importMethod: 'npm' as const,
      purpose: 'Web 端 UI 框架',
      license: 'MIT',
      memberships: [
        { artifactId: web, path: 'node_modules/react', scope: 'runtime' as const },
      ],
    },
    {
      id: 'dep-reactdom',
      packageName: 'react-dom',
      version: '18.3.1',
      importMethod: 'npm' as const,
      purpose: 'React DOM 渲染器',
      license: 'MIT',
      memberships: [
        { artifactId: web, path: 'node_modules/react-dom', scope: 'runtime' as const },
      ],
    },
    {
      id: 'dep-legacy',
      packageName: 'legacy-parser',
      version: '2.1.0',
      importMethod: '手动引入' as const,
      purpose: '旧版报文解析（CLI 内嵌）',
      license: 'GPL-3.0',
      memberships: [
        { artifactId: cli, path: 'vendor/legacy-parser', scope: 'runtime' as const },
      ],
    },
    {
      id: 'dep-typescript',
      packageName: 'typescript',
      version: '5.5.4',
      importMethod: 'npm' as const,
      purpose: '类型检查与构建',
      license: 'Apache-2.0',
      memberships: [
        { artifactId: build, path: 'node_modules/typescript', scope: 'dev' as const },
      ],
    },
  ];

  const createdAt = '2026-09-20T02:00:00.000Z';

  return {
    versions: [
      {
        number: 1,
        reason: '初次冻结：发布 aurora-web 3.2 前锁定运行范围',
        createdAt,
        artifacts: version1Artifacts,
        dependencies: version1Dependencies,
      },
    ],
    // 当前草稿相对 v1 的待核对变更：误把 typescript 挂到了运行产物
    draft: {
      artifacts: clone(version1Artifacts),
      dependencies: clone(version1Dependencies).map((d) =>
        d.id === 'dep-typescript'
          ? {
              ...d,
              memberships: [
                ...d.memberships,
                { artifactId: web, path: 'node_modules/typescript', scope: 'dev' },
              ],
            }
          : d,
      ),
    },
    lastRejection: null,
  };
};

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.draft && Array.isArray(parsed.versions)) return parsed;
    }
  } catch {
    // 损坏的存储视为无缓存
  }
  return seed();
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): PersistedState {
  const fresh = seed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}
