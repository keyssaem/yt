import type { Storage } from './storage'
import { parseMeta, serializeMeta, type Meta } from './meta'
import type { EpisodeFiles } from './stages'

const EP_RE = /^episodes\/([^/]+)\/(.+)$/

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
      const files = bySlug.get(slug)!
      const get = async (name: string) =>
        files.includes(name) ? (await storage.read(`episodes/${slug}/${name}`))?.text : undefined
      const [metaText, script, research] = await Promise.all([get('meta.json'), get('script.md'), get('research.md')])
      const { meta, error } = parseMeta(metaText)
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
