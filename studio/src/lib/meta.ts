import { z } from 'zod'

// 영상 길이 기준 (CLAUDE.md '영상 길이')
export const SERIES = {
  '만약에': { minMin: 15, maxMin: 18, color: '#E8B04B' },
  '멸종 리포트': { minMin: 10, maxMin: 14, color: '#D9775B' },
  '인물 분석': { minMin: 10, maxMin: 12, color: '#7FB2C9' },
  '빠른 만약에': { minMin: 8, maxMin: 10, color: '#B6A6D9' },
} as const
export type SeriesName = keyof typeof SERIES
export const SERIES_NAMES = Object.keys(SERIES) as SeriesName[]

export const MetaSchema = z.object({
  title: z.string().default(''),
  series: z.enum(SERIES_NAMES as [SeriesName, ...SeriesName[]]).default('만약에'),
  dueDate: z.string().optional(),
  publishDate: z.string().optional(),
  priority: z.enum(['높음', '보통', '낮음']).default('보통'),
  // 보드에서 손으로 옮긴 열. 없으면 파일 상태로 자동 판정한다.
  columnOverride: z.string().optional(),
  // 수동 체크: 단계 id → 완료 시각(ISO)
  checks: z.record(z.string(), z.string()).default({}),
  notes: z.string().default(''),
})
export type Meta = z.infer<typeof MetaSchema>

export function parseMeta(text: string | undefined): { meta: Meta; error?: string } {
  if (!text) return { meta: MetaSchema.parse({}) }
  try {
    const r = MetaSchema.safeParse(JSON.parse(text))
    if (r.success) return { meta: r.data }
    return { meta: MetaSchema.parse({}), error: 'meta.json 형식 오류: ' + r.error.issues[0]?.message }
  } catch {
    return { meta: MetaSchema.parse({}), error: 'meta.json 을 JSON 으로 읽을 수 없습니다' }
  }
}

export function serializeMeta(meta: Meta) {
  return JSON.stringify(meta, null, 2) + '\n'
}
