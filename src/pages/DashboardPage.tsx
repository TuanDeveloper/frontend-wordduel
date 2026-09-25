import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { wordApi, roomApi, type WordSet } from '../lib/api'
import Navbar from '../components/Navbar'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [wordSets, setWordSets] = useState<WordSet[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const fetchWordSets = useCallback(async () => {
    try {
      const res = await wordApi.listWordSets()
      setWordSets(res.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWordSets()
  }, [fetchWordSets])

  const handleCreateRoom = async (wordSetId: number) => {
    try {
      const res = await roomApi.create(wordSetId)
      navigate(`/room/${res.data.data.code}`)
    } catch (err: unknown) {
      alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không thể tạo phòng')
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinError(null)
    try {
      await roomApi.join(joinCode.trim().toUpperCase())
      navigate(`/room/${joinCode.trim().toUpperCase()}`)
    } catch {
      setJoinError('Không tìm thấy phòng hoặc phòng đã bắt đầu')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleDeleteWordSet = async (id: number) => {
    if (!confirm('Xóa bộ từ này?')) return
    try {
      await wordApi.deleteWordSet(id)
      setWordSets((ws) => ws.filter((w) => w.id !== id))
    } catch {
      alert('Không thể xóa')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-900)' }}>
      <Navbar />

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 className="font-display" style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            Xin chào, <span className="text-gradient">{user?.username}</span> 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Tạo phòng hoặc tham gia trận đấu từ vựng</p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '48px' }}>
          {/* Create Room Card */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(91,33,182,0.1))',
            border: '1px solid rgba(124,58,237,0.3)',
            cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px var(--accent-glow)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎮</div>
            <h3 className="font-display" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Tạo Phòng Mới</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Chọn bộ từ và mời bạn bè vào đấu</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>↓ Chọn từ bộ từ bên dưới</p>
          </div>

          {/* Join Room Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(14,116,144,0.1))',
              border: '1px solid rgba(6,182,212,0.3)',
              cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => setShowJoin(true)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px var(--teal-glow)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔗</div>
            <h3 className="font-display" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Tham Gia Phòng</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Nhập mã phòng để tham gia</p>
            <button className="btn btn-teal btn-sm">Nhập mã →</button>
          </div>

          {/* Create Word Set Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
              border: '1px solid rgba(16,185,129,0.3)',
              cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => setShowCreate(true)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px var(--green-glow)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📚</div>
            <h3 className="font-display" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Tạo Bộ Từ Mới</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>Thêm từ vựng cho trận đấu</p>
            <button className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px' }}>+ Tạo mới</button>
          </div>
        </div>

        {/* Word Sets */}
        <div>
          <h2 className="font-display" style={{ fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
            📖 Bộ từ của bạn
          </h2>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px' }} />
            </div>
          ) : wordSets.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Chưa có bộ từ nào. Hãy tạo bộ từ đầu tiên!</p>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Tạo bộ từ</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {wordSets.map((ws) => (
                <div key={ws.id} className="card" style={{ transition: 'border-color 0.2s', borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, flex: 1 }}>{ws.title}</h3>
                    <span className="badge badge-purple">{ws.words.length} từ</span>
                  </div>
                  {ws.description && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>{ws.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => handleCreateRoom(ws.id)}
                    >
                      🎮 Tạo phòng
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteWordSet(ws.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoin && (
        <Modal title="🔗 Tham gia phòng" onClose={() => { setShowJoin(false); setJoinError(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Mã phòng</label>
              <input
                id="join-code"
                className="form-input"
                placeholder="WDUEL1"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                style={{ fontSize: '20px', textAlign: 'center', letterSpacing: '4px', fontWeight: 700 }}
                maxLength={10}
              />
            </div>
            {joinError && <p className="form-error">⚠️ {joinError}</p>}
            <button
              id="btn-join-room"
              className="btn btn-teal btn-full"
              onClick={handleJoin}
              disabled={joinLoading || !joinCode.trim()}
            >
              {joinLoading ? <span className="spinner" /> : '→ Tham gia'}
            </button>
          </div>
        </Modal>
      )}

      {/* Create Word Set Modal */}
      {showCreate && (
        <CreateWordSetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchWordSets() }}
        />
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }} onClick={onClose}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '480px', padding: '32px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Create Word Set Modal ───────────────────────────────────────────────────
function CreateWordSetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [words, setWords] = useState([{ term: '', definition: '', example: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addWord = () => setWords([...words, { term: '', definition: '', example: '' }])
  const removeWord = (i: number) => setWords(words.filter((_, idx) => idx !== i))
  const updateWord = (i: number, field: string, val: string) =>
    setWords(words.map((w, idx) => (idx === i ? { ...w, [field]: val } : w)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Vui lòng nhập tên bộ từ'); return }
    const validWords = words.filter((w) => w.term.trim() && w.definition.trim())
    if (validWords.length === 0) { setError('Cần ít nhất 1 từ hợp lệ'); return }
    setLoading(true)
    try {
      await wordApi.createWordSet({ title, description, words: validWords })
      onCreated()
    } catch {
      setError('Không thể tạo bộ từ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      overflowY: 'auto',
    }}>
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: '640px', padding: '32px', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 700 }}>📚 Tạo bộ từ mới</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Tên bộ từ *</label>
            <input id="ws-title" className="form-input" placeholder="Ví dụ: IELTS Vocabulary" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <input id="ws-desc" className="form-input" placeholder="Mô tả ngắn về bộ từ" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" style={{ margin: 0 }}>Từ vựng ({words.length})</label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addWord}>+ Thêm từ</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
            {words.map((w, i) => (
              <div key={i} style={{ background: 'var(--bg-700)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 700, paddingTop: '12px', minWidth: '20px' }}>{i + 1}</span>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input className="form-input" placeholder="Từ (term)" value={w.term} onChange={(e) => updateWord(i, 'term', e.target.value)} style={{ fontSize: '14px' }} />
                  <input className="form-input" placeholder="Nghĩa (definition)" value={w.definition} onChange={(e) => updateWord(i, 'definition', e.target.value)} style={{ fontSize: '14px' }} />
                  <input className="form-input" placeholder="Ví dụ (tùy chọn)" value={w.example} onChange={(e) => updateWord(i, 'example', e.target.value)} style={{ fontSize: '14px', gridColumn: '1 / -1' }} />
                </div>
                {words.length > 1 && (
                  <button type="button" onClick={() => removeWord(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '16px', padding: '10px 4px' }}>✕</button>
                )}
              </div>
            ))}
          </div>

          {error && <p className="form-error">⚠️ {error}</p>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Hủy</button>
            <button id="btn-create-ws" type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? <span className="spinner" /> : '✓ Tạo bộ từ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
