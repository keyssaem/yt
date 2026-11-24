import { useState } from 'react'
import { useStudio } from '../lib/StudioContext'
import { createGithubStorage, loadGithubConfig, saveGithubConfig, type GithubConfig } from '../lib/storage'

const DEFAULTS: Omit<GithubConfig, 'token'> = { owner: 'keyssaem', repo: 'yt-data', branch: 'main' }

export default function Settings() {
  const { storage, setStorage } = useStudio()
  const saved = loadGithubConfig()
  const [cfg, setCfg] = useState<GithubConfig>(saved ?? { ...DEFAULTS, token: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const field = (k: keyof GithubConfig, label: string, type = 'text') => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        autoComplete="off"
        value={cfg[k]}
        onChange={(e) => setCfg({ ...cfg, [k]: e.target.value.trim() })}
      />
    </label>
  )

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const s = createGithubStorage(cfg)
      const paths = await s.listPaths()
      saveGithubConfig(cfg)
      setStorage(s)
      setMsg({ ok: true, text: `연결됨 · episodes/·bible/ 파일 ${paths.length}개` })
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const disconnect = () => {
    saveGithubConfig(null)
    setCfg({ ...DEFAULTS, token: '' })
    if (storage?.kind === 'github') setStorage(null)
    setMsg({ ok: true, text: '이 브라우저에서 토큰을 지웠습니다.' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-1">저장소 연결</h1>
      <p className="text-sm text-muted mb-5">
        현재: {storage ? storage.label : '없음'}.
        {import.meta.env.DEV && ' 개발 서버에서는 작업실 폴더를 직접 읽습니다. 아래에서 GitHub로 바꿀 수 있습니다.'}
      </p>

      <form onSubmit={connect} className="grid gap-3 rounded-lg border border-line bg-elev p-4">
        <div className="grid grid-cols-3 gap-2">
          {field('owner', '소유자')}
          {field('repo', '저장소')}
          {field('branch', '브랜치')}
        </div>
        {field('token', 'Fine-grained 개인 액세스 토큰', 'password')}
        <p className="text-xs text-dim leading-relaxed">
          GitHub → Settings → Developer settings → Fine-grained tokens에서 이 저장소 하나만 선택하고,
          권한은 <b>Contents: Read and write</b> 하나만 주세요. 토큰은 이 브라우저의 localStorage에만 저장되며
          GitHub API 외에는 어디로도 보내지 않습니다.
        </p>
        <div className="flex gap-2">
          <button disabled={busy || !cfg.token} className="px-4 py-2 rounded-md bg-accent text-bg font-semibold disabled:opacity-50">
            {busy ? '확인 중…' : '연결'}
          </button>
          {saved && (
            <button type="button" onClick={disconnect} className="px-3 py-2 text-muted hover:text-warn">
              토큰 지우기
            </button>
          )}
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-warn'}`}>{msg.text}</p>}
      </form>
    </div>
  )
}
