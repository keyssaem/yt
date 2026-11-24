import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createStorage, type Storage } from './storage'
import { loadEpisodes, saveMeta } from './episodes'
import { evaluate, type EpisodeStatus } from './stages'
import type { Meta } from './meta'

interface StudioState {
  storage: Storage | null
  setStorage: (s: Storage | null) => void
  episodes: EpisodeStatus[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  updateMeta: (slug: string, patch: (m: Meta) => Meta, message: string) => Promise<void>
}

const Ctx = createContext<StudioState | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const [storage, setStorage] = useState<Storage | null>(() => createStorage())
  const [episodes, setEpisodes] = useState<EpisodeStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!storage) return
    setLoading(true)
    setError(null)
    try {
      setEpisodes((await loadEpisodes(storage)).map(evaluate))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [storage])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateMeta = useCallback(
    async (slug: string, patch: (m: Meta) => Meta, message: string) => {
      if (!storage) return
      const target = episodes.find((e) => e.ep.slug === slug)
      if (!target) return
      const next = patch(target.ep.meta)
      // 화면을 먼저 바꾸고, 실패하면 되돌린다
      setEpisodes((list) => list.map((e) => (e.ep.slug === slug ? evaluate({ ...e.ep, meta: next }) : e)))
      try {
        await saveMeta(storage, slug, next, message)
        if (!target.ep.files.includes('meta.json')) await reload()
      } catch (e) {
        setError((e as Error).message)
        await reload()
      }
    },
    [storage, episodes, reload],
  )

  const value = useMemo(
    () => ({ storage, setStorage, episodes, loading, error, reload, updateMeta }),
    [storage, episodes, loading, error, reload, updateMeta],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStudio() {
  const v = useContext(Ctx)
  if (!v) throw new Error('StudioProvider 밖에서 사용됨')
  return v
}
