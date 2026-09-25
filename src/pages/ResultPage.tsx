import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { roomApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { type WsMessage } from '../hooks/useRoomSocket'

interface LeaderboardEntry {
  rank: number
  user_id: number
  username: string
  score: number
}

const medals = ['🥇', '🥈', '🥉']

export default function ResultPage() {
  const { code } = useParams<{ code: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const stateData = location.state as WsMessage | null

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [winner, setWinner] = useState<{ username: string; user_id: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (stateData?.leaderboard && Array.isArray(stateData.leaderboard)) {
      setLeaderboard(stateData.leaderboard as LeaderboardEntry[])
      if (typeof stateData.winner_username === 'string' && typeof stateData.winner_user_id === 'number') {
        setWinner({ username: stateData.winner_username, user_id: stateData.winner_user_id })
      }
      setLoading(false)
      return
    }
    let active = true
    if (code) {
      roomApi.gameState(code).then((res) => {
        if (!active) return
        const state = res.data.data
        if (state.event === 'game_finished' && Array.isArray(state.leaderboard)) {
          setLeaderboard(state.leaderboard as LeaderboardEntry[])
          if (typeof state.winner_username === 'string' && typeof state.winner_user_id === 'number') {
            setWinner({ username: state.winner_username, user_id: state.winner_user_id })
          }
        } else if (state.event === 'game_started') {
          navigate(`/game/${code}`, { replace: true })
        } else {
          navigate(`/room/${code}`, { replace: true })
        }
      }).catch(() => {
        if (active) navigate('/dashboard', { replace: true })
      }).finally(() => {
        if (active) setLoading(false)
      })
    }
    return () => { active = false }
  }, [code, navigate, stateData])

  const myEntry = leaderboard.find((e) => e.user_id === user?.id)
  const isWinner = winner?.user_id === user?.id
  const totalWords = leaderboard.length > 0 ? Math.max(...leaderboard.map((e) => e.score)) || 1 : 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-900)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '0', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '400px',
        background: isWinner
          ? 'radial-gradient(ellipse, rgba(245,158,11,0.25) 0%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
        transition: 'background 1s',
      }} />

      <div style={{ width: '100%', maxWidth: '560px', position: 'relative', zIndex: 1 }}>

        {/* Trophy / Result */}
        <div className="animate-fade-up" style={{ textAlign: 'center', marginBottom: '32px' }}>
          {loading ? (
            <span className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto' }} />
          ) : (
            <>
              <div className="animate-float" style={{ fontSize: '80px', marginBottom: '16px' }}>
                {isWinner ? '🏆' : myEntry?.rank === 2 ? '🥈' : myEntry?.rank === 3 ? '🥉' : '🎮'}
              </div>
              <h1 className="font-display" style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>
                {isWinner ? (
                  <span className="text-gradient">Bạn thắng rồi! 🎉</span>
                ) : winner ? (
                  <>
                    <span style={{ color: 'var(--yellow)' }}>{winner.username}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '24px' }}> chiến thắng!</span>
                  </>
                ) : 'Kết thúc!'}
              </h1>
              {myEntry && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
                  Bạn đạt <span style={{ color: 'var(--green)', fontWeight: 700 }}>{myEntry.score}</span> câu đúng
                  {' '}(Hạng #{myEntry.rank})
                </p>
              )}
            </>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card animate-fade-up" style={{ padding: '24px', marginBottom: '24px', animationDelay: '0.1s' }}>
          <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', textAlign: 'center' }}>
            🏅 Bảng xếp hạng
          </h2>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <span className="spinner" style={{ width: '32px', height: '32px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaderboard.map((entry) => {
                const isMe = entry.user_id === user?.id
                const pct = totalWords > 0 ? (entry.score / totalWords) * 100 : 0
                return (
                  <div
                    key={entry.user_id}
                    style={{
                      padding: '16px 20px',
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))'
                        : entry.rank === 1
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))'
                          : 'var(--bg-700)',
                      borderRadius: 'var(--radius-md)',
                      border: isMe
                        ? '1px solid rgba(124,58,237,0.35)'
                        : entry.rank === 1
                          ? '1px solid rgba(245,158,11,0.3)'
                          : '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px', minWidth: '32px' }}>
                        {medals[entry.rank - 1] ?? `#${entry.rank}`}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: isMe ? 700 : 500, fontSize: '15px' }}>
                            {entry.username}
                          </span>
                          {isMe && <span className="badge badge-purple" style={{ fontSize: '10px' }}>Bạn</span>}
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '20px', color: entry.rank === 1 ? 'var(--yellow)' : 'var(--text-primary)' }}>
                        {entry.score}
                      </span>
                    </div>
                    <div className="progress-bar-track" style={{ height: '5px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: entry.rank === 1
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(90deg, var(--accent), var(--teal))',
                        }}
                      />
                    </div>
                  </div>
                )
              })}

              {leaderboard.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                  Không có dữ liệu
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="animate-fade-up" style={{ display: 'flex', gap: '12px', animationDelay: '0.2s' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => navigate('/dashboard')}
          >
            🏠 Về trang chính
          </button>
          <button
            id="btn-play-again"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => navigate('/dashboard')}
          >
            🎮 Chơi lại
          </button>
        </div>
      </div>
    </div>
  )
}
