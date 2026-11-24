import { NavLink, Route, Routes } from 'react-router-dom'
import { useStudio } from './lib/StudioContext'
import Board from './pages/Board'
import EpisodePage from './pages/Episode'
import Settings from './pages/Settings'

export default function App() {
  const { storage, loading, reload, error } = useStudio()
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm ${isActive ? 'bg-elev2 text-text' : 'text-muted hover:text-text'}`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <span className="font-bold tracking-tight">제작 작업실</span>
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>보드</NavLink>
          <NavLink to="/settings" className={link}>연결</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span>{storage ? storage.label : '저장소 미연결'}</span>
          {storage && (
            <button onClick={() => void reload()} className="px-2 py-1 rounded border border-line hover:text-text">
              {loading ? '불러오는 중…' : '새로고침'}
            </button>
          )}
        </div>
      </header>
      {error && <div className="px-4 sm:px-6 py-2 text-sm bg-warn/15 text-warn border-b border-warn/30">{error}</div>}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/ep/:slug" element={<EpisodePage />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
