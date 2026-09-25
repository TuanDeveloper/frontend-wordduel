import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roomApi } from '../lib/api'
import { useRoomSocket, type WsMessage } from '../hooks/useRoomSocket'

interface WordData {
  id: number
  definition: string
}

interface PlayerProgress {
  user_id: number
  username: string
  correct: number
  total: number
  score: number
}

type GamePhase = 'playing' | 'answered' | 'finished'

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const [words, setWords] = useState<WordData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answeredWordIds, setAnsweredWordIds] = useState<number[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [lastResult, setLastResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null)
  const [playersProgress, setPlayersProgress] = useState<PlayerProgress[]>([])
  const [submitLoading, setSubmitLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasConnectedRef = useRef(false)
  const disconnectedRef = useRef(false)

  // Always fetch member-scoped state so a refresh can resume the current game.
  useEffect(() => {
    if (!code) return
    let active = true
    roomApi.gameState(code).then((response) => {
      if (!active) return
      const state = response.data.data
      if (state.event === 'game_waiting') {
        navigate(`/room/${code}`, { replace: true })
        return
      }
      if (state.event === 'game_finished') {
        navigate(`/result/${code}`, { replace: true, state })
        return
      }
      if (!Array.isArray(state.words)) {
        throw new Error('Không nhận được dữ liệu câu hỏi')
      }
      const gameWords = state.words as WordData[]
      const answered = Array.isArray(state.answered_word_ids)
        ? state.answered_word_ids.filter((id): id is number => typeof id === 'number')
        : []
      const firstUnanswered = gameWords.findIndex((word) => !answered.includes(word.id))
      setWords(gameWords)
      setAnsweredWordIds(answered)
      setCurrentIndex(firstUnanswered < 0 ? gameWords.length : firstUnanswered)
      setPlayersProgress(Array.isArray(state.players) ? state.players as PlayerProgress[] : [])
      setIsHost(state.host_id === user?.id)
      setPhase(firstUnanswered < 0 ? 'finished' : 'playing')
      setGameLoaded(true)
      if (firstUnanswered < 0 && state.host_id === user?.id) {
        roomApi.finish(code).then((finishResponse) => {
          if (active) navigate(`/result/${code}`, { replace: true, state: finishResponse.data.data })
        }).catch(() => {
          if (active) setSubmitError('Chưa thể kết thúc trận đấu. Hãy thử lại khi đã kết nối.')
        })
      }
    }).catch(() => {
      if (active) setLoadError('Không thể tải trạng thái trận đấu. Hãy thử tải lại hoặc về phòng chờ.')
    })
    return () => { active = false }
  }, [code, navigate, user?.id])

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || words.length === 0) return
    setTimeLeft(20)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          // Auto submit empty answer on timeout
          handleSubmit('', true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, phase, words.length])

  const handleMessage = useCallback((msg: WsMessage) => {
    const event = msg.event as string
    if (event === 'progress_update' && Array.isArray(msg.players)) {
      setPlayersProgress(msg.players as PlayerProgress[])
    }
    if (event === 'game_finished') {
      navigate(`/result/${code}`, { state: msg })
    }
  }, [code, navigate])

  const { connected, reconnecting, error: socketError } = useRoomSocket({ code: code!, token, onMessage: handleMessage })

  useEffect(() => {
    if (!connected) {
      if (hasConnectedRef.current) disconnectedRef.current = true
      return
    }
    if (hasConnectedRef.current && disconnectedRef.current && gameLoaded && code) {
      roomApi.gameState(code).then((response) => {
        const state = response.data.data
        if (state.event === 'game_finished') {
          navigate(`/result/${code}`, { replace: true, state })
        } else if (state.event === 'game_waiting') {
          navigate(`/room/${code}`, { replace: true })
        } else if (Array.isArray(state.players)) {
          setPlayersProgress(state.players as PlayerProgress[])
          if (Array.isArray(state.answered_word_ids)) {
            const answered = state.answered_word_ids.filter((id): id is number => typeof id === 'number')
            setAnsweredWordIds(answered)
            const nextIndex = words.findIndex((word) => !answered.includes(word.id))
            if (nextIndex >= 0 && nextIndex !== currentIndex && phase === 'playing') setCurrentIndex(nextIndex)
          }
        }
      }).catch(() => setLoadError('Kết nối bị gián đoạn. Hãy tải lại trạng thái trận đấu.'))
    }
    hasConnectedRef.current = true
    disconnectedRef.current = false
  }, [connected, gameLoaded, code, navigate, words, currentIndex, phase])

  const handleSubmit = async (overrideAnswer?: string, isTimeout = false) => {
    if (phase === 'answered' || submitLoading) return
    const currentWord = words[currentIndex]
    if (!currentWord) return

    const submitted = overrideAnswer !== undefined ? overrideAnswer : answer
    setSubmitLoading(true)
    setSubmitError(null)
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const response = await roomApi.submit(code!, currentWord.id, submitted)
      const feedback = response.data.data as { is_correct: boolean; correct_answer: string; players?: PlayerProgress[] }
      if (Array.isArray(feedback.players)) setPlayersProgress(feedback.players)
      setAnsweredWordIds((current) => [...new Set([...current, currentWord.id])])
      setLastResult({ correct: feedback.is_correct, correctAnswer: feedback.correct_answer })
      setPhase('answered')
    } catch {
      setSubmitError(isTimeout
        ? 'Không gửi được câu trả lời khi hết giờ. Hãy kiểm tra kết nối rồi nộp lại.'
        : 'Chưa gửi được câu trả lời. Kiểm tra kết nối rồi thử lại.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const nextQuestion = async () => {
    setAnswer('')
    setLastResult(null)
    setSubmitError(null)
    const nextIndex = words.findIndex((word, index) => index > currentIndex && !answeredWordIds.includes(word.id))
    if (nextIndex < 0) {
      setPhase('finished')
      if (isHost) {
        try {
          const response = await roomApi.finish(code!)
          navigate(`/result/${code}`, { state: response.data.data })
        } catch {
          setSubmitError('Chưa thể kết thúc trận đấu. Hãy thử lại khi đã kết nối.')
        }
      }
    } else {
      setCurrentIndex(nextIndex)
      setPhase('playing')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const currentWord = words[currentIndex]
  const progress = words.length > 0 ? ((currentIndex) / words.length) * 100 : 0
  const myProgress = playersProgress.find((p) => p.user_id === user?.id)

  if (loadError) {
    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>{loadError}</p>
        <button className="btn btn-secondary" onClick={() => navigate(`/room/${code}`)}>Về phòng chờ</button>
      </div>
    )
  }

  if (!gameLoaded || words.length === 0) {
    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: '16px' }}>
        <span className="spinner" style={{ width: '40px', height: '40px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải câu hỏi...</p>
      </div>
    )
  }

  if (phase === 'finished') {
    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: '24px' }}>
        <div style={{ fontSize: '64px' }}>⏳</div>
        <p className="font-display" style={{ fontSize: '24px', fontWeight: 700 }}>
          {isHost ? 'Đang tính kết quả...' : 'Đang chờ chủ phòng kết thúc trận...'}
        </p>
        {submitError && <p role="alert" style={{ color: 'var(--red)' }}>{submitError}</p>}
        {isHost && submitError && (
          <button
            className="btn btn-primary"
            onClick={() => roomApi.finish(code!).then((response) => navigate(`/result/${code}`, { state: response.data.data }))}
          >
            Thử kết thúc lại
          </button>
        )}
        <span className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-900)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,11,15,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="font-display text-gradient" style={{ fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap' }}>
            ⚡ WordDuel
          </span>
          <div style={{ flex: 1 }}>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'nowrap', fontWeight: 600 }}>
            {currentIndex + 1} / {words.length}
          </span>

          {/* Timer */}
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: timeLeft <= 5 ? 'rgba(239,68,68,0.2)' : 'var(--bg-700)',
            border: `2px solid ${timeLeft <= 5 ? 'var(--red)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 700,
            color: timeLeft <= 5 ? 'var(--red)' : 'var(--text-primary)',
            transition: 'all 0.3s',
          }}>
            {timeLeft}
          </div>

          <span style={{ color: connected ? 'var(--green)' : 'var(--red)', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {connected ? 'Kết nối ổn định' : reconnecting ? 'Đang kết nối lại...' : socketError ?? 'Mất kết nối'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: '120px', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--green)' }}>{myProgress?.correct ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Đúng</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '120px', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{myProgress?.total ?? 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Đã làm</div>
          </div>
          <div className="card" style={{ flex: 1, minWidth: '120px', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-light)' }}>{words.length - currentIndex - 1}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Còn lại</div>
          </div>
        </div>

        {/* Question Card */}
        <div className="card animate-fade-up" style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 40px', textAlign: 'center',
          background: phase === 'answered'
            ? lastResult?.correct
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.06))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(185,28,28,0.06))'
            : 'var(--bg-800)',
          border: phase === 'answered'
            ? `1px solid ${lastResult?.correct ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`
            : '1px solid var(--border)',
          transition: 'all 0.4s',
          marginBottom: '24px',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>
            Nghĩa của từ là gì?
          </p>

          <div style={{
            fontSize: '28px', fontWeight: 700, lineHeight: 1.4,
            color: 'var(--text-primary)', maxWidth: '600px', marginBottom: '12px',
          }}>
            "{currentWord?.definition}"
          </div>

          {/* Result Feedback */}
          {phase === 'answered' && lastResult && (
            <div style={{ marginTop: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                {lastResult.correct ? '🎉' : '❌'}
              </div>
              <div style={{
                fontSize: '20px', fontWeight: 700,
                color: lastResult.correct ? 'var(--green)' : 'var(--red)',
              }}>
                {lastResult.correct ? 'Chính xác!' : 'Sai rồi!'}
              </div>
              {!lastResult.correct && (
                <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '16px' }}>
                  Đáp án: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{lastResult.correctAnswer}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Answer Input / Next */}
        {phase === 'playing' ? (
          <>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                ref={inputRef}
                className="form-input"
                id="answer-input"
                placeholder="Nhập từ tiếng Anh..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                autoFocus
                disabled={submitLoading}
                style={{ flex: 1, fontSize: '18px', fontWeight: 500 }}
              />
              <button
                id="btn-submit-answer"
                className="btn btn-primary"
                onClick={() => handleSubmit()}
                disabled={submitLoading || !answer.trim()}
                style={{ padding: '12px 28px', fontSize: '16px' }}
              >
                {submitLoading ? <span className="spinner" /> : '→ Nộp'}
              </button>
            </div>
            {submitError && <p role="alert" style={{ color: 'var(--red)', marginTop: '10px' }}>{submitError}</p>}
          </>
        ) : (
          <button
            id="btn-next-question"
            className="btn btn-primary btn-full"
            onClick={nextQuestion}
            style={{ padding: '16px', fontSize: '16px' }}
          >
            {currentIndex + 1 >= words.length ? '🏁 Xem kết quả' : '→ Câu tiếp theo'}
          </button>
        )}

        {/* Players Progress Bar */}
        {playersProgress.length > 0 && (
          <div className="card" style={{ marginTop: '24px', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tiến độ người chơi
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {playersProgress
                .sort((a, b) => b.correct - a.correct)
                .map((p) => (
                  <div key={p.user_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: p.user_id === user?.id ? 'var(--accent)' : 'var(--bg-500)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: 'white',
                        }}>
                          {p.username[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: p.user_id === user?.id ? 700 : 400 }}>
                          {p.username}
                          {p.user_id === user?.id && ' (bạn)'}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>
                        {p.correct}/{p.total || words.length}
                      </span>
                    </div>
                    <div className="progress-bar-track" style={{ height: '6px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${words.length > 0 ? (p.correct / words.length) * 100 : 0}%`,
                          background: p.user_id === user?.id
                            ? 'linear-gradient(90deg, var(--accent), var(--teal))'
                            : 'linear-gradient(90deg, #374151, #6b7280)',
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
