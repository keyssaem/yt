// 개발 서버 전용: 작업실 폴더의 episodes/ · bible/ 를 직접 읽고 쓴다.
// 배포 빌드에는 포함되지 않는다(apply: 'serve').
import type { Plugin } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'

const ALLOWED = ['episodes/', 'bible/']

function resolveSafe(root: string, rel: string): string {
  const clean = rel.replace(/\\/g, '/').replace(/^\/+/, '')
  if (clean.split('/').includes('..') || !ALLOWED.some((p) => clean.startsWith(p))) {
    throw new Error(`허용되지 않은 경로: ${rel}`)
  }
  const abs = path.resolve(root, clean)
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error(`허용되지 않은 경로: ${rel}`)
  return abs
}

async function walk(root: string, dir: string, out: string[]) {
  let entries
  try {
    entries = await fs.readdir(path.join(root, dir), { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) await walk(root, rel, out)
    else out.push(rel)
  }
}

export function localFsPlugin(): Plugin {
  const root = path.resolve(process.env.STUDIO_ROOT ?? path.resolve(__dirname, '..', '..'))
  return {
    name: 'studio-local-fs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fs', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x')
        const send = (code: number, body: unknown) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }
        try {
          if (url.pathname === '/list' && req.method === 'GET') {
            const paths: string[] = []
            for (const p of ALLOWED) await walk(root, p.slice(0, -1), paths)
            return send(200, { paths })
          }
          if (url.pathname === '/read' && req.method === 'GET') {
            const abs = resolveSafe(root, url.searchParams.get('path') ?? '')
            const text = await fs.readFile(abs, 'utf8')
            return send(200, { text })
          }
          if (url.pathname === '/write' && req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const c of req) chunks.push(c as Buffer)
            const { path: rel, content } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const abs = resolveSafe(root, rel)
            await fs.mkdir(path.dirname(abs), { recursive: true })
            await fs.writeFile(abs, content, 'utf8')
            return send(200, { ok: true })
          }
          send(404, { error: 'not found' })
        } catch (e) {
          const err = e as NodeJS.ErrnoException
          send(err.code === 'ENOENT' ? 404 : 400, { error: err.message })
        }
      })
    },
  }
}
