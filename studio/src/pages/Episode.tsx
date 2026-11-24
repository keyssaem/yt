import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStudio } from '../lib/StudioContext'
import { COLUMNS, type StepState } from '../lib/stages'
import { SERIES, SERIES_NAMES, type Meta, type SeriesName } from '../lib/meta'
import { OwnerBadge, Progress, SeriesDot } from '../components/badges'

export default function EpisodePage() {
  const { slug = '' } = useParams()
  const { episodes, updateMeta, loading } = useStudio()
  const status = episodes.find((e) => e.ep.slug === slug)
  const [tab, setTab] = useState<'script' | 'research' | 'files'>('script')

  if (!status) return <p className="p-6 text-muted">{loading ? '불러오는 중…' : `에피소드 ${slug} 를 찾을 수 없습니다.`}</p>

  const { ep, steps, derived, warnings, progress, next } = status
  const series = SERIES[ep.meta.series]
  const estMin = derived.scriptChars / 320

  const setMeta = (patch: Partial<Meta>, msg: string) => updateMeta(slug, (m) => ({ ...m, ...patch }), `${slug}: ${msg}`)

  const toggle = (s: StepState) => {
    const checks = { ...ep.meta.checks }
    if (checks[s.step.id]) delete checks[s.step.id]
    else checks[s.step.id] = new Date().toISOString()
    void updateMeta(slug, (m) => ({ ...m, checks }), `${slug}: ${s.step.label} ${checks[s.step.id] ? '완료' : '완료 취소'}`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <Link to="/" className="text-sm text-muted hover:text-text">← 보드</Link>

      <div className="mt-3 mb-5">
        <SeriesDot series={ep.meta.series} />
        <h1 className="text-2xl font-bold mt-1">{ep.meta.title || '(제목 없음)'}</h1>
        <p className="text-xs text-dim mt-1">episodes/{ep.slug}</p>
        <div className="mt-3 max-w-md"><Progress value={progress} /></div>
        {next && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            다음 할 일 <OwnerBadge owner={next.step.owner} /> <strong>{next.step.label}</strong>
          </p>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="mb-5 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm text-warn list-disc pl-6">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section>
          {COLUMNS.filter((c) => c.id !== 'done').map((col) => (
            <div key={col.id} className="mb-5">
              <h2 className="text-sm font-semibold text-muted mb-2">{col.label}</h2>
              <ul className="rounded-lg border border-line divide-y divide-line bg-elev">
                {steps.filter((s) => s.step.column === col.id).map((s) => (
                  <StepRow key={s.step.id} s={s} onToggle={() => toggle(s)} isNext={next?.step.id === s.step.id} />
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside className="grid gap-4 content-start">
          <div className="rounded-lg border border-line bg-elev p-4 grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="text-muted">제목</span>
              <input defaultValue={ep.meta.title} onBlur={(e) => e.target.value !== ep.meta.title && setMeta({ title: e.target.value }, '제목 수정')} />
            </label>
            <label className="grid gap-1">
              <span className="text-muted">시리즈</span>
              <select value={ep.meta.series} onChange={(e) => setMeta({ series: e.target.value as SeriesName }, '시리즈 변경')}>
                {SERIES_NAMES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1">
                <span className="text-muted">마감일</span>
                <input type="date" value={ep.meta.dueDate ?? ''} onChange={(e) => setMeta({ dueDate: e.target.value || undefined }, '마감일 변경')} />
              </label>
              <label className="grid gap-1">
                <span className="text-muted">게시 예정</span>
                <input type="date" value={ep.meta.publishDate ?? ''} onChange={(e) => setMeta({ publishDate: e.target.value || undefined }, '게시일 변경')} />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-muted">우선순위</span>
              <select value={ep.meta.priority} onChange={(e) => setMeta({ priority: e.target.value as Meta['priority'] }, '우선순위 변경')}>
                <option>높음</option><option>보통</option><option>낮음</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-muted">메모</span>
              <textarea rows={3} defaultValue={ep.meta.notes} onBlur={(e) => e.target.value !== ep.meta.notes && setMeta({ notes: e.target.value }, '메모 수정')} />
            </label>
          </div>

          <div className="rounded-lg border border-line bg-elev p-4 text-sm grid gap-1.5">
            <Row k="팩트 표" v={`${derived.factNumbers.size}개`} />
            <Row k="근거 참조" v={`${derived.refNumbers.length}개`} warn={derived.missingRefs.length > 0} />
            <Row k="[직접 작성] 남음" v={`${derived.placeholderCount}개`} warn={derived.placeholderCount > 0} />
            <Row
              k="예상 길이 (320자/분)"
              v={ep.script ? `${estMin.toFixed(1)}분 / 목표 ${series.minMin}~${series.maxMin}분` : '-'}
              warn={!!ep.script && (estMin < series.minMin || estMin > series.maxMin)}
            />
          </div>
        </aside>
      </div>

      <section className="mt-4">
        <div className="flex gap-1 border-b border-line mb-3">
          {(['script', 'research', 'files'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t ? 'border-accent text-text' : 'border-transparent text-muted'}`}>
              {{ script: '대본', research: '리서치', files: `파일 ${ep.files.length}` }[t]}
            </button>
          ))}
        </div>
        {tab === 'script' && <Preview text={ep.script} empty="script.md 가 아직 없습니다." />}
        {tab === 'research' && <Preview text={ep.research} empty="research.md 가 아직 없습니다." />}
        {tab === 'files' && (
          <ul className="text-sm font-mono text-muted grid gap-0.5">
            {[...ep.files].sort().map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
      </section>
    </div>
  )
}

function StepRow({ s, onToggle, isNext }: { s: StepState; onToggle: () => void; isNext: boolean }) {
  const autoDone = s.source === 'auto'
  return (
    <li className={`flex items-start gap-3 px-3 py-2.5 ${isNext ? 'bg-elev2' : ''}`}>
      <input
        type="checkbox"
        className="mt-1 accent-[var(--color-accent)] w-4 h-4 shrink-0"
        checked={s.done}
        disabled={autoDone}
        onChange={onToggle}
        title={autoDone ? '파일 상태로 자동 완료됨' : '눌러서 완료 표시'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <OwnerBadge owner={s.step.owner} />
          <span className={s.done ? 'text-muted line-through decoration-dim' : ''}>{s.step.label}</span>
          {s.step.gate && <span className="text-[11px] text-warn border border-warn/40 rounded px-1">관문</span>}
          {autoDone && <span className="text-[11px] text-ok">자동</span>}
        </div>
        <p className="text-xs text-dim mt-0.5">
          {s.step.hint}
          {s.detail && <span className="text-muted"> · {s.detail}</span>}
        </p>
      </div>
    </li>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={warn ? 'text-warn' : ''}>{v}</span>
    </div>
  )
}

function Preview({ text, empty }: { text?: string; empty: string }) {
  if (!text) return <p className="text-sm text-muted">{empty}</p>
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\[근거:[^\]]*\]/g, (m) => `<mark class="bg-fact/20 text-fact rounded px-0.5">${m}</mark>`)
    .replace(/\[직접 작성\]/g, (m) => `<mark class="bg-accent/20 text-accent rounded px-0.5">${m}</mark>`)
    .replace(/미확인/g, (m) => `<mark class="bg-warn/20 text-warn rounded px-0.5">${m}</mark>`)
  return (
    <pre
      className="whitespace-pre-wrap break-words text-sm leading-relaxed rounded-lg border border-line bg-elev p-4 max-h-[70vh] overflow-auto font-sans"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
