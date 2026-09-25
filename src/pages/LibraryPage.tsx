import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import GameSettingsModal from '../components/GameSettingsModal'
import { getApiErrorMessage, libraryApi, soloApi, type GameSettings, type SavedWord } from '../lib/api'

export default function LibraryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<SavedWord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPracticeSettings, setShowPracticeSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await libraryApi.list(search)
      setItems(response.data.data)
      setError(null)
    } catch (reason) {
      setError(getApiErrorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { void load() }, [load])

  const remove = async (id: number) => {
    try {
      await libraryApi.remove(id)
      setItems((saved) => saved.filter((entry) => entry.id !== id))
    } catch (reason) {
      setError(getApiErrorMessage(reason))
    }
  }

  const startPractice = async (settings: GameSettings) => {
    const response = await soloApi.start({ source: 'library', ...settings })
    const data = response.data.data as { session_id: number }
    navigate(`/solo/${data.session_id}`, { state: response.data.data })
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="container library-page">
        <div className="library-heading">
          <div><span className="eyebrow">ÔN TẬP CỦA BẠN</span><h1 className="font-display">Thư viện từ vựng</h1><p>Lưu từ trong các trận đấu và luyện lại theo nhịp của bạn.</p></div>
          <button className="btn btn-primary" disabled={!items.length} onClick={() => setShowPracticeSettings(true)}>Luyện các từ đã lưu</button>
        </div>
        <div className="library-search"><input className="form-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm từ hoặc nghĩa..." /><span>{items.length} từ</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="inline-loading"><span className="spinner" /></div> : items.length === 0 ? (
          <div className="card empty-state"><span>☆</span><h2>Thư viện đang trống</h2><p>Lưu một từ ngay trong trận đấu để từ đó xuất hiện tại đây.</p><button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Về trang chủ</button></div>
        ) : (
          <div className="library-grid">{items.map((entry) => (
            <article className="card library-word-card" key={entry.id}>
              <div className="library-word-title"><h2 className="font-display">{entry.word.term}</h2><button className="icon-button danger-icon" onClick={() => void remove(entry.id)} aria-label={`Bỏ lưu ${entry.word.term}`}>×</button></div>
              <p>{entry.word.definition}</p>
              {entry.word.example && <blockquote>{entry.word.example}</blockquote>}
              {entry.word.context_sentence && <div className="context-hint"><span>Ngữ cảnh</span>{entry.word.context_sentence}</div>}
            </article>
          ))}</div>
        )}
      </main>
      {showPracticeSettings && <GameSettingsModal
        mode="solo"
        wordSet={{ id: 0, title: 'Thư viện cá nhân', word_count: items.length }}
        onClose={() => setShowPracticeSettings(false)}
        onStart={startPractice}
      />}
    </div>
  )
}
