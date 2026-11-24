import type { Meta } from './meta'

// 작업 주체: 누가 이 단계를 진행하는가
export type Owner = 'ai' | 'human'
export const OWNER_LABEL: Record<Owner, string> = { ai: 'AI', human: '사람' }

export const COLUMNS = [
  { id: 'plan', label: '기획' },
  { id: 'verify', label: '검증' },
  { id: 'produce', label: '제작' },
  { id: 'render', label: '편집·렌더' },
  { id: 'publish', label: '후반·게시' },
  { id: 'done', label: '게시 완료' },
] as const
export type ColumnId = (typeof COLUMNS)[number]['id']

// 에피소드 폴더에서 읽어 온 내용
export interface EpisodeFiles {
  slug: string
  files: string[] // 에피소드 폴더 기준 상대 경로
  meta: Meta
  metaError?: string
  script?: string
  research?: string
}

export interface Signal {
  done: boolean
  detail?: string
}

export interface Step {
  id: string
  label: string
  owner: Owner
  column: Exclude<ColumnId, 'done'>
  hint: string
  // 파일 상태로 판정할 수 있으면 auto, 사람이 체크해야 하면 manual
  auto?: (ep: EpisodeFiles, ctx: Derived) => Signal
  // 이 단계가 끝나기 전에는 다음 단계를 진행하면 안 되는 관문
  gate?: boolean
}

export interface Derived {
  factNumbers: Set<number>
  refNumbers: number[]
  missingRefs: number[]
  placeholderCount: number
  scriptChars: number
}

const has = (ep: EpisodeFiles, re: RegExp, min = 1) => ep.files.filter((f) => re.test(f)).length >= min
const count = (ep: EpisodeFiles, re: RegExp) => ep.files.filter((f) => re.test(f)).length

export function parseFactNumbers(research?: string): Set<number> {
  const out = new Set<number>()
  if (!research) return out
  for (const line of research.split(/\r?\n/)) {
    const m = line.match(/^\s*\|\s*(\d+)\s*\|/)
    if (m) out.add(Number(m[1]))
  }
  return out
}

export function parseRefNumbers(script?: string): number[] {
  if (!script) return []
  const out: number[] = []
  for (const m of script.matchAll(/\[근거:\s*([^\]]+)\]/g)) {
    for (const n of m[1].matchAll(/\d+/g)) out.push(Number(n[0]))
  }
  return out
}

export function derive(ep: EpisodeFiles): Derived {
  const factNumbers = parseFactNumbers(ep.research)
  const refNumbers = parseRefNumbers(ep.script)
  const missingRefs = [...new Set(refNumbers.filter((n) => !factNumbers.has(n)))]
  const placeholderCount = (ep.script?.match(/\[직접 작성\]/g) ?? []).length
  // 내레이션 글자 수(대략): 마커·마크다운 기호 제거 후 공백 제외
  const scriptChars = (ep.script ?? '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/[\s*_>#|-]/g, '').length
  return { factNumbers, refNumbers, missingRefs, placeholderCount, scriptChars }
}

const AUDIO = /^audio\/.+\.(wav|mp3|m4a|flac|ogg)$/i
const IMAGE = /^thumbnail\/.+\.(png|jpe?g|webp)$/i
const VIDEO = /^render\/.+\.(mp4|mov|webm)$/i

// CLAUDE.md 에피소드 워크플로를 그대로 단계로 옮긴 것
export const STEPS: Step[] = [
  { id: 'topic', label: '주제 확정', owner: 'human', column: 'plan', hint: 'meta.json 제목',
    auto: (ep) => ({ done: ep.meta.title.trim().length > 0 }) },
  { id: 'research', label: '리서치 팩트 표', owner: 'ai', column: 'plan', hint: 'research.md',
    auto: (_ep, d) => ({ done: d.factNumbers.size > 0, detail: `팩트 ${d.factNumbers.size}개` }) },
  { id: 'outline', label: '구성안 3개 중 선택', owner: 'human', column: 'plan', hint: 'AI가 3안을 만들고 사람이 고른다' },
  { id: 'script', label: '대본 초안', owner: 'ai', column: 'plan', hint: 'script.md',
    auto: (ep, d) => ({ done: !!ep.script, detail: ep.script ? `약 ${Math.round(d.scriptChars / 320)}분 분량` : undefined }) },
  { id: 'factcheck', label: '팩트체크', owner: 'human', column: 'verify', hint: '[근거: n번] 확인, 미확인 표시',
    auto: (ep, d) => ({
      done: false,
      detail: !ep.script ? undefined : d.missingRefs.length ? `표에 없는 근거 번호: ${d.missingRefs.join(', ')}` : `근거 참조 ${d.refNumbers.length}개 모두 표에 있음`,
    }) },
  { id: 'writing', label: '사유·마지막 질문 직접 작성', owner: 'human', column: 'verify', hint: '[직접 작성] 자리 채우기',
    auto: (ep, d) => ({ done: !!ep.script && d.placeholderCount === 0, detail: ep.script ? `남은 [직접 작성] ${d.placeholderCount}개` : undefined }) },
  { id: 'tts', label: '음성 생성 (TTS)', owner: 'ai', column: 'produce', hint: 'audio/',
    auto: (ep) => ({ done: has(ep, AUDIO), detail: `오디오 ${count(ep, AUDIO)}개` }) },
  { id: 'scenes', label: 'scenes.json 구성', owner: 'ai', column: 'produce', hint: '실제 음성 길이 기준 싱크',
    auto: (ep) => ({ done: ep.files.includes('scenes.json') }) },
  { id: 'firstRender', label: '1장 렌더', owner: 'ai', column: 'produce', hint: 'render/ 첫 장면 묶음',
    auto: (ep) => ({ done: has(ep, VIDEO) }) },
  { id: 'firstRenderOk', label: '1장 렌더 승인', owner: 'human', column: 'produce', hint: '확인 전 전체 렌더 금지', gate: true },
  { id: 'fullRender', label: '전체 렌더', owner: 'ai', column: 'render', hint: 'render/final*.mp4',
    auto: (ep) => ({ done: has(ep, /^render\/final[^/]*\.(mp4|mov)$/i) }) },
  { id: 'renderReview', label: '최종 영상 검수', owner: 'human', column: 'render', hint: '자막·싱크·출처 표기·가상 인물 고지' },
  { id: 'thumbnails', label: '썸네일 시안 4종', owner: 'ai', column: 'publish', hint: 'thumbnail/',
    auto: (ep) => ({ done: count(ep, IMAGE) >= 4, detail: `시안 ${count(ep, IMAGE)}/4` }) },
  { id: 'thumbnailPick', label: '썸네일 확정', owner: 'human', column: 'publish', hint: '실존 인물 사진 없는지 확인' },
  { id: 'upload', label: 'upload.md 작성', owner: 'ai', column: 'publish', hint: '제목·설명란·챕터·출처·고지·태그',
    auto: (ep) => ({ done: ep.files.includes('upload.md') }) },
  { id: 'shorts', label: '쇼츠 3개', owner: 'ai', column: 'publish', hint: '40~55초' },
  { id: 'publishCheck', label: '게시 전 최종 확인·예약', owner: 'human', column: 'publish', hint: '체크리스트 전부 통과' },
]

export interface StepState {
  step: Step
  done: boolean
  source: 'auto' | 'manual' | 'none'
  detail?: string
  checkedAt?: string
}

export interface EpisodeStatus {
  ep: EpisodeFiles
  derived: Derived
  steps: StepState[]
  next?: StepState
  column: ColumnId
  autoColumn: ColumnId
  progress: number
  warnings: string[]
}

export function evaluate(ep: EpisodeFiles): EpisodeStatus {
  const d = derive(ep)
  const steps: StepState[] = STEPS.map((step) => {
    const sig = step.auto?.(ep, d)
    const checkedAt = ep.meta.checks[step.id]
    if (sig?.done) return { step, done: true, source: 'auto', detail: sig.detail }
    if (checkedAt) return { step, done: true, source: 'manual', detail: sig?.detail, checkedAt }
    return { step, done: false, source: 'none', detail: sig?.detail }
  })
  const next = steps.find((s) => !s.done)
  const autoColumn: ColumnId = next ? next.step.column : 'done'
  const valid = COLUMNS.some((c) => c.id === ep.meta.columnOverride)
  const column = valid ? (ep.meta.columnOverride as ColumnId) : autoColumn

  const warnings: string[] = []
  if (ep.metaError) warnings.push(ep.metaError)
  if (d.missingRefs.length) warnings.push(`표에 없는 근거 번호 ${d.missingRefs.join(', ')}`)
  const gateIdx = steps.findIndex((s) => s.step.id === 'firstRenderOk')
  if (!steps[gateIdx].done && steps.slice(gateIdx + 1).some((s) => s.done && s.step.owner === 'ai' && s.step.column === 'render')) {
    warnings.push('1장 렌더 승인 전에 전체 렌더가 진행됨')
  }
  if (column === 'done' && d.placeholderCount > 0) warnings.push('[직접 작성]이 남은 채 게시 완료로 표시됨')

  return {
    ep,
    derived: d,
    steps,
    next,
    column,
    autoColumn,
    progress: steps.filter((s) => s.done).length / steps.length,
    warnings,
  }
}
