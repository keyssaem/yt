// 저장소 추상화: 파일이 원본이다.
// - local: 개발 서버(npm run dev)에서 작업실 폴더를 직접 읽고 쓴다.
// - github: 배포본에서 private 저장소를 GitHub API로 읽고 쓴다(커밋으로 남는다).

export interface FileRef {
  text: string
  sha?: string
}

export interface Storage {
  kind: 'local' | 'github'
  label: string
  listPaths(): Promise<string[]>
  read(path: string): Promise<FileRef | null>
  write(path: string, text: string, opts: { sha?: string; message: string }): Promise<void>
}

export interface GithubConfig {
  owner: string
  repo: string
  branch: string
  token: string
}

const CFG_KEY = 'studio.github'

export function loadGithubConfig(): GithubConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    return raw ? (JSON.parse(raw) as GithubConfig) : null
  } catch {
    return null
  }
}

export function saveGithubConfig(cfg: GithubConfig | null) {
  try {
    if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
    else localStorage.removeItem(CFG_KEY)
  } catch {
    /* 저장 불가 환경 무시 */
  }
}

const ALLOWED = ['episodes/', 'bible/']

class LocalStorageAdapter implements Storage {
  kind = 'local' as const
  label = '로컬 폴더 (개발 서버)'
  async listPaths() {
    const r = await fetch('/__fs/list')
    if (!r.ok) throw new Error('로컬 파일 목록을 읽지 못했습니다')
    return ((await r.json()) as { paths: string[] }).paths
  }
  async read(path: string) {
    const r = await fetch(`/__fs/read?path=${encodeURIComponent(path)}`)
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`읽기 실패: ${path}`)
    return { text: ((await r.json()) as { text: string }).text }
  }
  async write(path: string, text: string) {
    const r = await fetch('/__fs/write', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: text }),
    })
    if (!r.ok) throw new Error(`쓰기 실패: ${path}`)
  }
}

function b64ToUtf8(b64: string) {
  const bin = atob(b64.replace(/\n/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}
function utf8ToB64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

class GithubStorageAdapter implements Storage {
  kind = 'github' as const
  label: string
  constructor(private cfg: GithubConfig) {
    this.label = `GitHub ${cfg.owner}/${cfg.repo}@${cfg.branch}`
  }
  private async api(path: string, init?: RequestInit) {
    return fetch(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.headers ?? {}),
      },
    })
  }
  async listPaths() {
    const r = await this.api(`/git/trees/${encodeURIComponent(this.cfg.branch)}?recursive=1`)
    if (!r.ok) throw new Error(`GitHub 목록 실패 (${r.status})`)
    const data = (await r.json()) as { tree: { path: string; type: string }[] }
    return data.tree
      .filter((t) => t.type === 'blob' && ALLOWED.some((p) => t.path.startsWith(p)))
      .map((t) => t.path)
  }
  async read(path: string) {
    const r = await this.api(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(this.cfg.branch)}`)
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`GitHub 읽기 실패 (${r.status}): ${path}`)
    const data = (await r.json()) as { content: string; sha: string }
    return { text: b64ToUtf8(data.content), sha: data.sha }
  }
  async write(path: string, text: string, opts: { sha?: string; message: string }) {
    const r = await this.api(`/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: opts.message,
        content: utf8ToB64(text),
        branch: this.cfg.branch,
        ...(opts.sha ? { sha: opts.sha } : {}),
      }),
    })
    if (r.status === 409) throw new Error('다른 곳에서 먼저 수정되었습니다. 새로고침 후 다시 저장하세요.')
    if (!r.ok) throw new Error(`GitHub 저장 실패 (${r.status}): ${path}`)
  }
}

export function createStorage(): Storage | null {
  if (import.meta.env.DEV) return new LocalStorageAdapter()
  const cfg = loadGithubConfig()
  return cfg ? new GithubStorageAdapter(cfg) : null
}

export function createGithubStorage(cfg: GithubConfig): Storage {
  return new GithubStorageAdapter(cfg)
}
