import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roomApi } from '../lib/api'
import { useRoomSocket, type WsMessage } from '../hooks/useRoomSocket'

interface WordData {
  id: number
  term: string
  definition: string
  example?: string
}

interface PlayerProgress {
  user_id: number
  username: string
  correct: number
  total: number
  score: number
}

type GamePhase = 'playing' | 'answered' | 'finished'

// Bài hỏi: cho definition → nhập term
function buildQuestion(word: WordData): { prompt: string; answer: string } {
  return { prompt: word.definition, answer: word.term.toLowerCase().trim() }
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Words từ game_started event
  const [words, setWords] = useState<WordData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [lastResult, setLastResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null)
  const [playersProgress, setPlayersProgress] = useState<PlayerProgress[]>([])
  const [submitLoading, setSubmitLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load initial game data từ navigation state hoặc fetch
  useEffect(() => {
    const stateData = location.state as WsMessage | null
    if (stateData?.words && Array.isArray(stateData.words)) {
      setWords(stateData.words as WordData[])
    }
  }, [location.state])

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

  const { connected } = useRoomSocket({ code: code!, token, onMessage: handleMessage })

  const handleSubmit = async (overrideAnswer?: string, isTimeout = false) => {
    if (phase === 'answered' || submitLoading) return
    const currentWord = words[currentIndex]
    if (!currentWord) return

    const submitted = overrideAnswer !== undefined ? overrideAnswer : answer
    setSubmitLoading(true)
    if (timerRef.current) clearInterval(timerRef.current)

    try {
      await roomApi.submit(code!, currentWord.id, submitted)
      const { answer: correctAnswer } = buildQuestion(currentWord)
      const isCorrect = submitted.toLowerCase().trim() === correctAnswer
      setLastResult({ correct: isCorrect, correctAnswer: currentWord.term })
      setPhase('answered')
    } catch {
      if (!isTimeout) {
        setLastResult({ correct: false, correctAnswer: currentWord.term })
        setPhase('answered')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  const nextQuestion = () => {
    setAnswer('')
    setLastResult(null)
    if (currentIndex + 1 >= words.length) {
      // Kết thúc - gửi finish
      roomApi.finish(code!).catch(() => {})
      setPhase('finished')
    } else {
      setCurrentIndex((i) => i + 1)
      setPhase('playing')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const currentWord = words[currentIndex]
  const progress = words.length > 0 ? ((currentIndex) / words.length) * 100 : 0
  const myProgress = playersProgress.find((p) => p.user_id === user?.id)

  if (words.length === 0) {
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
        <p className="font-display" style={{ fontSize: '24px', fontWeight: 700 }}>Đang tính kết quả...</p>
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

          {/* WS dot */}
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: connected ? 'var(--green)' : 'var(--red)',
            boxShadow: connected ? '0 0 8px var(--green)' : 'none',
          }} />
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

          {currentWord?.example && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontStyle: 'italic', marginTop: '8px' }}>
              Ví dụ: {currentWord.example}
            </p>
          )}

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
