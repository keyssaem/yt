import type { Storage } from './storage'
import { parseMeta, serializeMeta, type Meta } from './meta'
import type { EpisodeFiles } from './stages'

const EP_RE = /^episodes\/([^/]+)\/(.+)$/

// 미디어(오디오·렌더)는 데이터 저장소에 올리지 않는다. scripts/data-sync.mjs 가 남긴
// 목록 파일로 배포본에서도 TTS·렌더 단계를 자동 판정한다.
const MEDIA_MANIFEST = '.media.json'

function parseMediaManifest(text?: string): string[] {
  if (!text) return []
  try {
    const data = JSON.parse(text) as { files?: { path: string }[] }
    return (data.files ?? []).map((f) => f.path).filter((p) => typeof p === 'string')
  } catch {
    return []
  }
}

export async function loadEpisodes(storage: Storage): Promise<EpisodeFiles[]> {
  const paths = await storage.listPaths()
  const bySlug = new Map<string, string[]>()
  for (const p of paths) {
    const m = p.match(EP_RE)
    if (!m) continue
    if (!bySlug.has(m[1])) bySlug.set(m[1], [])
    bySlug.get(m[1])!.push(m[2])
  }
  const slugs = [...bySlug.keys()].sort()
  return Promise.all(
    slugs.map(async (slug) => {
      const listed = bySlug.get(slug)!
      const get = async (name: string) =>
        listed.includes(name) ? (await storage.read(`episodes/${slug}/${name}`))?.text : undefined
      const [metaText, script, research, mediaText] = await Promise.all([
        get('meta.json'),
        get('script.md'),
        get('research.md'),
        get(MEDIA_MANIFEST),
      ])
      const { meta, error } = parseMeta(metaText)
      const files = [...new Set([...listed.filter((f) => f !== MEDIA_MANIFEST), ...parseMediaManifest(mediaText)])]
      return { slug, files, meta, metaError: error, script, research }
    }),
  )
}

export async function saveMeta(storage: Storage, slug: string, meta: Meta, message: string) {
  const path = `episodes/${slug}/meta.json`
  const current = await storage.read(path)
  await storage.write(path, serializeMeta(meta), { sha: current?.sha, message })
}

// 폴더 규칙: epNN_slug (영문 소문자·숫자·하이픈)
export function nextSlug(existing: string[], slugPart: string) {
  const nums = existing.map((s) => Number(s.match(/^ep(\d+)/)?.[1] ?? 0))
  const n = String(Math.max(0, ...nums) + 1).padStart(2, '0')
  const clean = slugPart.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
  return `ep${n}_${clean}`
}
