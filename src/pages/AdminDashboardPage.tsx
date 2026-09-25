import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { adminApi, getApiErrorMessage } from '../lib/api'

type AdminTab = 'stats' | 'users' | 'word-sets'
type AdminUser = { id: number; username: string; email: string; full_name: string; role: string; is_active: boolean }
type AdminWordSet = { id: number; title: string; creator_username?: string; word_count: number; is_hidden: boolean }
type AdminWordSetDetail = { id: number; title: string; description?: string; is_hidden: boolean; words: { id: number; term: string; definition: string; example?: string; context_sentence?: string }[] }

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>('stats')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [wordSets, setWordSets] = useState<AdminWordSet[]>([])
  const [selectedSet, setSelectedSet] = useState<AdminWordSetDetail | null>(null)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminApi.stats>>['data']['data'] | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    const request = tab === 'stats'
      ? adminApi.stats().then((response) => { if (active) setStats(response.data.data) })
      : tab === 'users'
        ? adminApi.users(search).then((response) => { if (active) setUsers(response.data.data) })
        : adminApi.wordSets(search).then((response) => { if (active) setWordSets(response.data.data) })
    request.catch((reason: unknown) => { if (active) setError(getApiErrorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [search, tab])

  const toggleUser = async (user: AdminUser) => {
    try {
      await adminApi.setUserStatus(user.id, !user.is_active)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, is_active: !item.is_active } : item))
    } catch (reason) { setError(getApiErrorMessage(reason)) }
  }

  const toggleSet = async (wordSet: AdminWordSet) => {
    try {
      await adminApi.setWordSetVisibility(wordSet.id, !wordSet.is_hidden)
      setWordSets((current) => current.map((item) => item.id === wordSet.id ? { ...item, is_hidden: !item.is_hidden } : item))
    } catch (reason) { setError(getApiErrorMessage(reason)) }
  }

  const reviewSet = async (id: number) => {
    try {
      const response = await adminApi.wordSet(id)
      setSelectedSet(response.data.data)
    } catch (reason) { setError(getApiErrorMessage(reason)) }
  }

  return (
    <div className="app-page">
      <Navbar />
      <main className="container admin-page">
        <div className="admin-heading"><div><span className="eyebrow">WORDDUEL · QUẢN TRỊ</span><h1 className="font-display">Bảng điều khiển</h1><p>Quản lý tài khoản, bộ từ và hoạt động của nền tảng.</p></div></div>
        <div className="admin-tabs" role="tablist">
          {([['stats', 'Tổng quan'], ['users', 'Tài khoản'], ['word-sets', 'Bộ từ']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {tab !== 'stats' && <input className="form-input admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'users' ? 'Tìm tên hoặc email...' : 'Tìm bộ từ...'} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="inline-loading"><span className="spinner" /></div> : tab === 'stats' ? (
          stats && <>
            <div className="admin-stat-grid">
              <div className="card admin-stat"><span>Người dùng</span><strong>{stats.user_count}</strong><small>{stats.active_user_count} đang hoạt động</small></div>
              <div className="card admin-stat"><span>Trận đã chơi</span><strong>{stats.finished_room_count}</strong><small>Phòng đã kết thúc</small></div>
              <div className="card admin-stat"><span>Bộ từ</span><strong>{stats.word_set_count}</strong><small>Toàn hệ thống</small></div>
            </div>
            <section className="card admin-panel"><div className="section-title"><span className="eyebrow">MỨC ĐỘ SỬ DỤNG</span><strong>Bộ từ phổ biến</strong></div>
              {stats.popular_word_sets.map((item, index) => <div className="popular-set-row" key={item.id}><span className="popular-rank">{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span><strong>{item.room_count} trận</strong></div>)}
            </section>
          </>
        ) : tab === 'users' ? (
          <div className="card table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>
            {users.map((item) => <tr key={item.id}><td><strong>{item.username}</strong><small>{item.full_name}</small></td><td>{item.email}</td><td><span className={`badge ${item.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{item.role}</span></td><td><span className={`badge ${item.is_active ? 'badge-green' : 'badge-red'}`}>{item.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className={`btn btn-sm ${item.is_active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => void toggleUser(item)}>{item.is_active ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}
          </tbody></table>{users.length === 0 && <p className="table-empty">Không tìm thấy tài khoản.</p>}</div></div>
        ) : (
          <div className="card table-card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Bộ từ</th><th>Người tạo</th><th>Số từ</th><th>Trạng thái</th><th></th></tr></thead><tbody>
            {wordSets.map((item) => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.creator_username ?? 'Hệ thống'}</td><td>{item.word_count}</td><td><span className={`badge ${item.is_hidden ? 'badge-red' : 'badge-green'}`}>{item.is_hidden ? 'Đã ẩn' : 'Công khai'}</span></td><td><div className="table-actions"><button className="btn btn-secondary btn-sm" onClick={() => void reviewSet(item.id)}>Xem từ</button><button className="btn btn-secondary btn-sm" onClick={() => void toggleSet(item)}>{item.is_hidden ? 'Hiện lại' : 'Ẩn'}</button></div></td></tr>)}
          </tbody></table>{wordSets.length === 0 && <p className="table-empty">Không tìm thấy bộ từ.</p>}</div></div>
        )}
      </main>
      {selectedSet && <div className="modal-backdrop modal-backdrop-scroll" onMouseDown={(event) => event.target === event.currentTarget && setSelectedSet(null)}>
        <section className="card modal-panel import-panel admin-review-panel">
          <div className="modal-heading"><div><span className="eyebrow">KIỂM DUYỆT BỘ TỪ</span><h2 className="font-display">{selectedSet.title}</h2><p>{selectedSet.description || `${selectedSet.words.length} từ vựng`}</p></div><button type="button" className="icon-button" onClick={() => setSelectedSet(null)} aria-label="Đóng">×</button></div>
          <div className="table-scroll preview-table-wrap"><table className="data-table"><thead><tr><th>Từ</th><th>Nghĩa</th><th>Ví dụ / Ngữ cảnh</th></tr></thead><tbody>{selectedSet.words.map((word) => <tr key={word.id}><td><strong>{word.term}</strong></td><td>{word.definition}</td><td>{word.example || word.context_sentence || '—'}</td></tr>)}</tbody></table></div>
          {selectedSet.words.length >= 500 && <p className="field-hint">Đang hiển thị tối đa 500 từ đầu tiên.</p>}
          <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setSelectedSet(null)}>Đóng</button></div>
        </section>
      </div>}
    </div>
  )
}
