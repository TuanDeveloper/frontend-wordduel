import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roomApi, type Room, type RoomPlayer } from '../lib/api'
import { useRoomSocket, type WsMessage } from '../hooks/useRoomSocket'
import Navbar from '../components/Navbar'

export default function WaitingRoomPage() {
  const { code } = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [myReady, setMyReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [startLoading, setStartLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const hasConnectedRef = useRef(false)
  const disconnectedRef = useRef(false)

  const isHost = room?.host_id === user?.id

  // Fetch initial room state
  useEffect(() => {
    if (!code) return
    roomApi.get(code).then((res) => {
      if (res.data.data.status === 'playing') {
        navigate(`/game/${code}`, { replace: true })
        return
      }
      if (res.data.data.status === 'finished') {
        return roomApi.gameState(code).then((game) => {
          navigate(`/result/${code}`, { replace: true, state: game.data.data })
        })
      }
      setRoom(res.data.data)
      setPlayers(res.data.data.players)
      const me = res.data.data.players.find((p) => p.user_id === user?.id)
      if (me) setMyReady(me.is_ready)
    }).catch(() => navigate('/dashboard')).finally(() => setLoading(false))
  }, [code, user?.id, navigate])

  const handleMessage = useCallback((msg: WsMessage) => {
    const event = msg.event as string

    if (event === 'player_joined' || event === 'player_left') {
      // Refresh players từ WS payload
      if (Array.isArray(msg.players)) {
        // Server gửi kèm players list
        setPlayers(msg.players as RoomPlayer[])
      }
    }
    if (event === 'player_ready') {
      setPlayers((prev) =>
        prev.map((p) =>
          p.user_id === (msg.user_id as number) ? { ...p, is_ready: msg.is_ready as boolean } : p
        )
      )
      if (msg.user_id === user?.id) setMyReady(msg.is_ready as boolean)
    }
    if (event === 'game_started') {
      navigate(`/game/${code}`)
    }
  }, [code, navigate, user?.id])

  const { connected, reconnecting, error: socketError, send } = useRoomSocket({ code: code!, token, onMessage: handleMessage })

  useEffect(() => {
    if (!connected) {
      if (hasConnectedRef.current) disconnectedRef.current = true
      return
    }
    if (hasConnectedRef.current && disconnectedRef.current && code) {
      roomApi.get(code).then((response) => {
        const currentRoom = response.data.data
        setRoom(currentRoom)
        setPlayers(currentRoom.players)
        const me = currentRoom.players.find((player) => player.user_id === user?.id)
        if (me) setMyReady(me.is_ready)
        if (currentRoom.status === 'playing') navigate(`/game/${code}`, { replace: true })
        if (currentRoom.status === 'finished') {
          roomApi.gameState(code).then((game) => navigate(`/result/${code}`, { replace: true, state: game.data.data }))
        }
      }).catch(() => navigate('/dashboard'))
    }
    hasConnectedRef.current = true
    disconnectedRef.current = false
  }, [connected, code, navigate, user?.id])

  const handleReady = async () => {
    try {
      const res = await roomApi.ready(code!)
      setMyReady(res.data.data.is_ready)
    } catch {
      // fallback: gửi qua WS
      const newReady = !myReady
      send({ event: 'ready', is_ready: newReady })
    }
  }

  const handleStart = async () => {
    setStartLoading(true)
    try {
      await roomApi.start(code!)
      navigate(`/game/${code}`)
    } catch {
      send({ event: 'start' })
    } finally {
      setStartLoading(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allReady = players.length >= 2 && players.every((p) => p.is_ready)

  if (loading) {
    return (
      <div className="page-center">
        <span className="spinner" style={{ width: '40px', height: '40px' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-900)' }}>
      <Navbar />

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px', maxWidth: '700px' }}>
        {/* Room Header */}
        <div className="card animate-fade-up" style={{
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))',
          border: '1px solid rgba(124,58,237,0.25)',
          textAlign: 'center', padding: '40px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Mã phòng
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <h1 className="font-display text-gradient" style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '6px' }}>
              {code}
            </h1>
            <button
              onClick={copyCode}
              style={{
                background: copied ? 'rgba(16,185,129,0.2)' : 'var(--bg-600)',
                border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px', cursor: 'pointer', fontSize: '20px',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✅' : '📋'}
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Chia sẻ mã này cho bạn bè để họ tham gia
          </p>

          {/* WS Status */}
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: connected ? 'var(--green)' : 'var(--text-muted)',
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: connected ? 'var(--green)' : 'var(--text-muted)',
                boxShadow: connected ? '0 0 8px var(--green)' : 'none',
                animation: connected ? 'pulse-glow 2s infinite' : 'none',
              }} />
              {connected ? 'Đã kết nối real-time' : reconnecting ? 'Đang kết nối lại...' : socketError ?? 'Mất kết nối'}
            </span>
          </div>
        </div>

        {/* Players */}
        <div className="card animate-fade-up" style={{ marginBottom: '24px', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="font-display" style={{ fontSize: '18px', fontWeight: 700 }}>
              👥 Người chơi ({players.length})
            </h2>
            {!allReady && players.length < 2 && (
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cần ít nhất 2 người</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {players.map((p) => {
              const isMe = p.user_id === user?.id
              const pIsHost = p.user_id === room?.host_id
              return (
                <div key={p.user_id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', background: 'var(--bg-700)',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isMe ? 'rgba(124,58,237,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${isMe ? 'var(--accent)' : '#374151'}, ${isMe ? 'var(--teal)' : '#1f2937'})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {(p.user?.username ?? `P${p.user_id}`)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>
                        {p.user?.username ?? `Player ${p.user_id}`}
                      </span>
                      {isMe && <span className="badge badge-purple" style={{ fontSize: '10px' }}>Bạn</span>}
                      {pIsHost && <span className="badge badge-yellow" style={{ fontSize: '10px' }}>👑 Host</span>}
                    </div>
                  </div>
                  <div>
                    {p.is_ready ? (
                      <span className="badge badge-green">✓ Sẵn sàng</span>
                    ) : (
                      <span className="badge badge-gray">Chờ...</span>
                    )}
                  </div>
                </div>
              )
            })}

            {players.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Đang chờ người chơi tham gia...
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="animate-fade-up" style={{ display: 'flex', gap: '12px', animationDelay: '0.2s' }}>
          <button
            id="btn-ready"
            className={`btn ${myReady ? 'btn-secondary' : 'btn-primary'}`}
            style={{ flex: 1 }}
            onClick={handleReady}
          >
            {myReady ? '↩ Bỏ sẵn sàng' : '✓ Sẵn sàng'}
          </button>

          {isHost && (
            <button
              id="btn-start-game"
              className="btn btn-teal"
              style={{ flex: 1 }}
              onClick={handleStart}
              disabled={!allReady || startLoading}
            >
              {startLoading ? <span className="spinner" /> : '🚀 Bắt đầu'}
            </button>
          )}
        </div>

        {isHost && !allReady && players.length >= 2 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '12px' }}>
            Tất cả người chơi cần nhấn "Sẵn sàng" để bắt đầu
          </p>
        )}
      </div>
    </div>
  )
}
