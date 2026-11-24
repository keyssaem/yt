import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useStudio } from '../lib/StudioContext'
import { COLUMNS, type ColumnId, type EpisodeStatus, type Owner } from '../lib/stages'
import { OwnerBadge, Progress, SeriesDot } from '../components/badges'
import NewEpisode from '../components/NewEpisode'

type Filter = 'all' | Owner

export default function Board() {
  const { storage, episodes, updateMeta, loading } = useStudio()
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const counts = useMemo(() => {
    const c = { human: 0, ai: 0 }
    for (const e of episodes) if (e.next) c[e.next.step.owner]++
    return c
  }, [episodes])

  if (!storage) {
    return (
      <div className="p-6 max-w-xl">
        <p className="text-muted mb-3">저장소가 연결되지 않았습니다.</p>
        <Link to="/settings" className="text-accent underline">GitHub 저장소 연결하기</Link>
      </div>
    )
  }

  const visible = episodes.filter((e) => filter === 'all' || e.next?.step.owner === filter)

  const onDragEnd = (ev: DragEndEvent) => {
    const slug = String(ev.active.id)
    const to = ev.over?.id as ColumnId | undefined
    const ep = episodes.find((e) => e.ep.slug === slug)
    if (!ep || !to || to === ep.column) return
    const label = COLUMNS.find((c) => c.id === to)!.label
    void updateMeta(
      slug,
      (m) => ({ ...m, columnOverride: to === ep.autoColumn ? undefined : to }),
      `${slug}: 보드 열 이동 → ${label}`,
    )
  }

  const chip = (f: Filter, label: string) => (
    <button
      onClick={() => setFilter(f)}
      className={`px-3 py-1.5 rounded-full text-sm border ${filter === f ? 'border-accent text-text bg-elev2' : 'border-line text-muted hover:text-text'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {chip('all', `전체 ${episodes.length}`)}
        {chip('human', `사람 차례 ${counts.human}`)}
        {chip('ai', `AI 차례 ${counts.ai}`)}
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto px-3 py-1.5 rounded-md text-sm bg-accent text-bg font-semibold"
        >
          + 새 에피소드
        </button>
      </div>
      {adding && <NewEpisode onDone={() => setAdding(false)} />}

      {!loading && episodes.length === 0 && (
        <p className="text-muted text-sm mb-4">episodes/ 폴더에 에피소드가 없습니다. 새 에피소드를 만들어 보세요.</p>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4">
          <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3 min-w-max lg:min-w-0">
            {COLUMNS.map((col) => (
              <Column key={col.id} id={col.id} label={col.label} items={visible.filter((e) => e.column === col.id)} />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  )
}

function Column({ id, label, items }: { id: ColumnId; label: string; items: EpisodeStatus[] }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border p-2.5 min-h-[50vh] transition-colors ${isOver ? 'border-accent bg-elev2' : 'border-line bg-elev'}`}
    >
      <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold">
        {label}
        <span className="text-dim font-normal">{items.length}</span>
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((e) => (
          <Card key={e.ep.slug} status={e} />
        ))}
      </div>
    </section>
  )
}

function Card({ status }: { status: EpisodeStatus }) {
  const { ep, next, progress, warnings, column, autoColumn } = status
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ep.slug })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const due = ep.meta.dueDate
  const overdue = due && column !== 'done' && due < new Date().toISOString().slice(0, 10)

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/ep/${ep.slug}`)}
      className={`rounded-md border border-line bg-bg p-3 cursor-pointer hover:border-dim select-none ${isDragging ? 'opacity-80 shadow-lg z-10 relative' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <SeriesDot series={ep.meta.series} />
        {ep.meta.priority === '높음' && <span className="text-[11px] text-warn">우선</span>}
      </div>
      <h3 className="font-semibold leading-snug mb-0.5">{ep.meta.title || '(제목 없음)'}</h3>
      <p className="text-[11px] text-dim mb-2.5">{ep.slug}</p>

      {next ? (
        <div className="flex items-center gap-1.5 text-sm mb-2.5">
          <OwnerBadge owner={next.step.owner} />
          <span className="truncate">{next.step.label}</span>
        </div>
      ) : (
        <p className="text-sm text-ok mb-2.5">모든 단계 완료</p>
      )}
      <Progress value={progress} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted">
        {due && <span className={overdue ? 'text-warn' : ''}>마감 {due}</span>}
        {column !== autoColumn && <span>수동 배치</span>}
        {warnings.length > 0 && <span className="text-warn">경고 {warnings.length}</span>}
      </div>
    </article>
  )
}
