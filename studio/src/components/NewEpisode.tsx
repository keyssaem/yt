import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudio } from '../lib/StudioContext'
import { SERIES_NAMES, MetaSchema, serializeMeta, type SeriesName } from '../lib/meta'
import { nextSlug } from '../lib/episodes'

const RESEARCH_TEMPLATE = `# 리서치

| 번호 | 주장 | 근거(요약) | 출처명 | 날짜 | 링크 | 신뢰도 |
|---|---|---|---|---|---|---|
`

export default function NewEpisode({ onDone }: { onDone: () => void }) {
  const { storage, episodes, reload } = useStudio()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [slugPart, setSlugPart] = useState('')
  const [series, setSeries] = useState<SeriesName>('만약에')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const slug = nextSlug(episodes.map((e) => e.ep.slug), slugPart)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storage || !title.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const meta = MetaSchema.parse({ title: title.trim(), series, dueDate: dueDate || undefined })
      await storage.write(`episodes/${slug}/meta.json`, serializeMeta(meta), { message: `${slug}: 에피소드 생성` })
      await storage.write(`episodes/${slug}/research.md`, RESEARCH_TEMPLATE, { message: `${slug}: 리서치 표 틀` })
      await reload()
      onDone()
      navigate(`/ep/${slug}`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 rounded-lg border border-line bg-elev p-4 grid gap-3 sm:grid-cols-2 max-w-3xl">
      <label className="grid gap-1 text-sm sm:col-span-2">
        <span className="text-muted">주제(제목 가설)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="만약에 ○○이 사라진다면" required />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">폴더 이름(영문)</span>
        <input value={slugPart} onChange={(e) => setSlugPart(e.target.value)} placeholder="no-school" />
        <span className="text-[11px] text-dim">episodes/{slug}</span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">시리즈</span>
        <select value={series} onChange={(e) => setSeries(e.target.value as SeriesName)}>
          {SERIES_NAMES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">마감일</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <div className="flex items-end gap-2">
        <button disabled={busy} className="px-4 py-2 rounded-md bg-accent text-bg font-semibold disabled:opacity-50">
          {busy ? '만드는 중…' : '만들기'}
        </button>
        <button type="button" onClick={onDone} className="px-3 py-2 text-muted">취소</button>
      </div>
      {err && <p className="text-warn text-sm sm:col-span-2">{err}</p>}
    </form>
  )
}
