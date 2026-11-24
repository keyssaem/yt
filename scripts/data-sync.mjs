#!/usr/bin/env node
// 채널 데이터(CLAUDE.md, bible/, docs/, episodes/, shorts/)를 비공개 저장소와 동기화한다.
//
// 같은 작업실 폴더를 두 저장소가 나눠 쓴다.
//   .git       → 공개 저장소 (앱·템플릿 코드)
//   .git-data  → 비공개 데이터 저장소 (채널 문서·에피소드)
// 공개 저장소의 .gitignore 가 데이터 경로를 무시하므로, 여기서는 add -f 로 경로를 지정해 올린다.
//
// 사용: node scripts/data-sync.mjs ["커밋 메시지"]
//   1) 에피소드별 미디어 목록(.media.json) 갱신  2) 로컬 변경 커밋
//   3) 원격 변경(웹앱에서 저장한 것) 받아 합치기  4) 푸시

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GIT_DIR = path.join(ROOT, '.git-data')
const REMOTE = process.env.DATA_REMOTE ?? 'https://github.com/keyssaem/yt-data.git'
const BRANCH = 'main'

const DATA_PATHS = ['CLAUDE.md', 'bible', 'docs', 'episodes', 'shorts']
const MEDIA_EXT = ['mp4', 'mov', 'webm', 'wav', 'mp3', 'm4a', 'flac', 'ogg']
const EXCLUDES = [
  '**/node_modules/**',
  '**/audio/**',
  '**/render/**',
  ...MEDIA_EXT.map((e) => `**/*.${e}`),
].map((g) => `:(exclude,glob)${g}`)

function git(args, opts = {}) {
  return execFileSync('git', [`--git-dir=${GIT_DIR}`, `--work-tree=${ROOT}`, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  })
}
function tryGit(args) {
  try {
    return { ok: true, out: git(args) }
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? e.message) }
  }
}

function ensureRepo() {
  if (fs.existsSync(GIT_DIR)) return
  console.log('· 데이터 저장소 초기화 (.git-data)')
  git(['init', '-q', '-b', BRANCH])
  git(['remote', 'add', 'origin', REMOTE])
  git(['config', 'core.autocrlf', 'false'])
}

// 미디어는 저장소에 올리지 않는 대신, 배포된 앱이 단계 완료를 판정할 수 있도록 목록만 남긴다
function writeMediaManifests() {
  const epRoot = path.join(ROOT, 'episodes')
  if (!fs.existsSync(epRoot)) return
  const isMedia = (rel) =>
    /^(audio|render)\//.test(rel) || MEDIA_EXT.some((e) => rel.toLowerCase().endsWith(`.${e}`))
  for (const slug of fs.readdirSync(epRoot)) {
    const dir = path.join(epRoot, slug)
    if (!fs.statSync(dir).isDirectory()) continue
    const files = []
    const walk = (rel) => {
      for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue
        const r = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) walk(r)
        else if (isMedia(r)) files.push({ path: r, size: fs.statSync(path.join(dir, r)).size })
      }
    }
    walk('')
    files.sort((a, b) => a.path.localeCompare(b.path))
    const target = path.join(dir, '.media.json')
    const next = JSON.stringify({ files }, null, 2) + '\n'
    const prev = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
    if (files.length === 0 && !prev) continue
    if (prev !== next) fs.writeFileSync(target, next)
  }
}

function commitLocal(message) {
  const paths = DATA_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)))
  git(['add', '-A', '-f', '--', ...paths, ...EXCLUDES])
  const staged = git(['diff', '--cached', '--name-only']).trim()
  if (!staged) {
    console.log('· 로컬 변경 없음')
    return
  }
  console.log(`· 로컬 변경 ${staged.split('\n').length}개 커밋`)
  git(['commit', '-q', '-m', message])
}

const hasHead = () => tryGit(['rev-parse', '--verify', '-q', 'HEAD']).ok

// 원격을 받아 온다. 이 컴퓨터에 아직 커밋이 없으면(새 컴퓨터) 원격을 기준점으로 삼는다.
function fetchRemote() {
  const fetched = tryGit(['fetch', '-q', 'origin', BRANCH])
  if (!fetched.ok) {
    if (/couldn't find remote ref/i.test(fetched.out)) {
      console.log('· 원격이 비어 있음 → 첫 푸시')
      return false
    }
    throw new Error(`원격을 가져오지 못했습니다. 저장소가 있는지, 권한이 있는지 확인하세요.\n${fetched.out}`)
  }
  if (!hasHead()) {
    // 작업 폴더 파일은 건드리지 않고 기준점만 원격으로 맞춘다
    git(['reset', '-q', `origin/${BRANCH}`])
  }
  return true
}

function syncRemote(remoteExists) {
  if (remoteExists) {
    const r = tryGit(['rebase', '-q', `origin/${BRANCH}`])
    if (!r.ok) {
      throw new Error(
        [
          '원격(웹앱에서 저장한 내용)과 로컬 변경이 같은 줄에서 충돌합니다.',
          '충돌 파일을 고친 뒤 다음을 실행하세요:',
          '  git --git-dir=.git-data --work-tree=. add <파일>',
          '  git --git-dir=.git-data --work-tree=. rebase --continue',
          '',
          r.out,
        ].join('\n'),
      )
    }
  }
  if (hasHead()) git(['push', '-q', '-u', 'origin', BRANCH], { inherit: true })
}

try {
  const message = process.argv[2] ?? `데이터 동기화 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
  ensureRepo()
  const remoteExists = fetchRemote()
  writeMediaManifests()
  commitLocal(message)
  syncRemote(remoteExists)
  console.log('✓ 동기화 완료')
} catch (e) {
  console.error('✗ ' + e.message)
  process.exit(1)
}
