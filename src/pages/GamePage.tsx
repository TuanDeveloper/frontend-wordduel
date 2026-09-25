import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { libraryApi, roomApi } from '../lib/api'
import { useRoomSocket, type WsMessage } from '../hooks/useRoomSocket'

interface GameWord {
  id: number
  definition: string
  context_sentence?: string | null
}

interface PlayerProgress {
  user_id: number
  username: string
  correct: number
  total: number
  score: number
}

interface AnswerFeedback {
  userAnswer: string
  correct: boolean
  correctAnswer: string
}

export default function GamePage() {
  const { code = '' } = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [words, setWords] = useState<GameWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answeredIndices, setAnsweredIndices] = useState<number[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameLoaded, setGameLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [players, setPlayers] = useState<PlayerProgress[]>([])
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(20)
  const [timePerQuestion, setTimePerQuestion] = useState<number | null>(20)
  const [savedWordIds, setSavedWordIds] = useState<number[]>([])
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submitRef = useRef<((value?: string, timedOut?: boolean) => Promise<void>) | null>(null)
  const submitLock = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const connectedOnce = useRef(false)
  const wasDisconnected = useRef(false)
  const answeredRef = useRef(false)

  const loadState = useCallback(async () => {
    const response = await roomApi.gameState(code)
    const state = response.data.data
    if (state.event === 'game_waiting') {
      navigate(`/room/${code}`, { replace: true })
      return
    }
    if (state.event === 'game_finished') {
      navigate(`/result/${code}`, { replace: true, state })
      return
    }
    if (!Array.isArray(state.words) || state.words.length === 0) throw new Error('Trận đấu chưa có câu hỏi.')
    const gameWords = state.words as GameWord[]
    const answered = Array.isArray(state.answered_question_indices)
      ? state.answered_question_indices.filter((index): index is number => typeof index === 'number')
      : []
    const firstUnanswered = gameWords.findIndex((_, index) => !answered.includes(index))
    setWords(gameWords)
    setAnsweredIndices(answered)
    setCurrentIndex(firstUnanswered < 0 ? gameWords.length - 1 : firstUnanswered)
    setPlayers(Array.isArray(state.players) ? state.players as PlayerProgress[] : [])
    setIsHost(state.host_id === user?.id)
    setFeedback(null)
    setAnswer('')
    const timer = typeof state.time_per_question === 'number' ? state.time_per_question : null
    setTimePerQuestion(timer)
    setTimeLeft(timer)
    setGameLoaded(true)
    if (firstUnanswered < 0 && state.host_id === user?.id) {
      const finish = await roomApi.finish(code)
      navigate(`/result/${code}`, { replace: true, state: finish.data.data })
    }
  }, [code, navigate, user?.id])

  useEffect(() => {
    if (!code) return
    loadState().catch(() => setLoadError('Không thể tải trạng thái trận đấu. Hãy thử tải lại trang.'))
  }, [code, loadState])

  useEffect(() => {
    answeredRef.current = feedback !== null
  }, [feedback])

  const submit = useCallback(async (value = answer, timedOut = false) => {
    if (answeredRef.current || submitLock.current || submitLoading || !words[currentIndex]) return
    submitLock.current = true
    const submitted = value
    setUserAnswer(submitted)
    setSubmitLoading(true)
    setSubmitError(null)
    setSaveMessage(null)
    if (timerRef.current) clearInterval(timerRef.current)
    try {
      const word = words[currentIndex]
      const response = await roomApi.submit(code, word.id, submitted, currentIndex)
      const result = response.data.data as { is_correct: boolean; correct_answer: string; players?: PlayerProgress[] }
      if (Array.isArray(result.players)) setPlayers(result.players)
      setAnsweredIndices((indices) => [...new Set([...indices, currentIndex])])
      setFeedback({ userAnswer: submitted, correct: result.is_correct, correctAnswer: result.correct_answer })
    } catch {
      setSubmitError(timedOut
        ? 'Không gửi được câu trả lời khi hết giờ. Kiểm tra kết nối rồi thử lại.'
        : 'Chưa gửi được câu trả lời. Kiểm tra kết nối rồi thử lại.')
    } finally {
      submitLock.current = false
      setSubmitLoading(false)
    }
  }, [answer, code, currentIndex, submitLoading, words])

  useEffect(() => { submitRef.current = submit }, [submit])

  useEffect(() => {
    if (!gameLoaded || feedback || !words[currentIndex] || timePerQuestion === null) {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(timePerQuestion)
      return
    }
    setTimeLeft(timePerQuestion)
    timerRef.current = setInterval(() => {
      setTimeLeft((remaining) => {
        if (remaining === null || remaining <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          void submitRef.current?.('', true)
          return 0
        }
        return remaining - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentIndex, feedback, gameLoaded, timePerQuestion, words.length])

  const handleMessage = useCallback((message: WsMessage) => {
    if (message.event === 'progress_update' && Array.isArray(message.players)) {
      setPlayers(message.players as PlayerProgress[])
    }
    if (message.event === 'game_finished') navigate(`/result/${code}`, { state: message })
    if (message.event === 'player_left') {
      if (typeof message.host_id === 'number') setIsHost(message.host_id === user?.id)
      if (typeof message.user_id === 'number') setPlayers((current) => current.filter((player) => player.user_id !== message.user_id))
    }
    if (message.event === 'room_closed') navigate('/dashboard', { replace: true })
  }, [code, navigate, user?.id])

  const { connected, reconnecting, error: socketError } = useRoomSocket({ code, token, onMessage: handleMessage })

  useEffect(() => {
    if (!connected) {
      if (connectedOnce.current) wasDisconnected.current = true
      return
    }
    if (connectedOnce.current && wasDisconnected.current && gameLoaded) {
      loadState().catch(() => setLoadError('Kết nối bị gián đoạn; hãy tải lại trạng thái trận đấu.'))
    }
    connectedOnce.current = true
    wasDisconnected.current = false
  }, [connected, gameLoaded, loadState])

  const nextQuestion = async () => {
    setAnswer('')
    setUserAnswer('')
    setFeedback(null)
    setSubmitError(null)
    setSaveMessage(null)
    const next = words.findIndex((_, index) => index > currentIndex && !answeredIndices.includes(index))
    if (next < 0) {
      if (isHost) {
        try {
          const response = await roomApi.finish(code)
          navigate(`/result/${code}`, { state: response.data.data })
        } catch {
          setSubmitError('Chưa thể kết thúc trận. Hãy thử lại khi đã kết nối.')
        }
      } else {
        setSubmitError('Bạn đã trả lời hết câu. Đang chờ chủ phòng kết thúc trận.')
      }
      return
    }
    setCurrentIndex(next)
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const leaveRoom = async () => {
    const message = feedback || answeredIndices.length > 0
      ? 'Bạn đang trong trận đấu. Rời phòng sẽ xóa bạn khỏi bảng điểm hiện tại. Tiếp tục?'
      : 'Bạn muốn rời phòng này?'
    if (!window.confirm(message)) return
    try {
      await roomApi.leave(code)
      navigate('/dashboard', { replace: true })
    } catch {
      setSubmitError('Không thể rời phòng. Phòng có thể đã đóng; hãy tải lại trang.')
    }
  }

  const saveCurrentWord = async () => {
    const word = words[currentIndex]
    if (!word) return
    try {
      await libraryApi.save(word.id)
      setSavedWordIds((ids) => ids.includes(word.id) ? ids : [...ids, word.id])
      setSaveMessage('Đã lưu từ vào thư viện cá nhân.')
    } catch {
      setSaveMessage('Không thể lưu từ lúc này.')
    }
  }

  const word = words[currentIndex]
  const myProgress = players.find((player) => player.user_id === user?.id)
  const progress = words.length ? (answeredIndices.length / words.length) * 100 : 0

  if (loadError) return <div className="page-center"><div className="card state-card"><p>{loadError}</p><button className="btn btn-secondary" onClick={() => void loadState()}>Tải lại</button></div></div>
  if (!gameLoaded || !word) return <div className="page-center"><span className="spinner" /></div>

  return (
    <div className="game-shell">
      <header className="game-topbar">
        <div className="game-topbar-inner">
          <span className="navbar-logo">WordDuel</span>
          <div className="game-topbar-progress"><div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div></div>
          <span className="game-counter">{currentIndex + 1} / {words.length}</span>
          {timePerQuestion !== null && <span className={`game-timer ${timeLeft !== null && timeLeft <= 5 ? 'is-urgent' : ''}`}>{timeLeft ?? timePerQuestion}</span>}
          <span className={`connection-label ${connected ? 'is-connected' : ''}`}>{connected ? 'Đang kết nối' : reconnecting ? 'Đang kết nối lại' : socketError ?? 'Mất kết nối'}</span>
          <button type="button" className="btn btn-danger btn-sm" onClick={leaveRoom}>Rời phòng</button>
        </div>
      </header>

      <main className="game-content">
        <div className="game-stats">
          <div className="card stat-card"><strong>{myProgress?.correct ?? 0}</strong><span>Đúng</span></div>
          <div className="card stat-card"><strong>{myProgress?.total ?? answeredIndices.length}</strong><span>Đã làm</span></div>
          <div className="card stat-card"><strong>{Math.max(0, words.length - answeredIndices.length)}</strong><span>Còn lại</span></div>
        </div>

        <section className={`card question-card ${feedback ? (feedback.correct ? 'is-correct' : 'is-wrong') : ''}`}>
          <span className="eyebrow">NGHĨA CỦA TỪ LÀ GÌ?</span>
          <h1>{word.definition}</h1>
          {word.context_sentence && <p className="context-hint"><span>Gợi ý ngữ cảnh</span>{word.context_sentence}</p>}
          <button className="save-word-button" type="button" onClick={saveCurrentWord} disabled={savedWordIds.includes(word.id)}>
            {savedWordIds.includes(word.id) ? '✓ Đã lưu vào thư viện' : '☆ Lưu từ này'}
          </button>
          {saveMessage && <p className="field-hint">{saveMessage}</p>}

          {feedback && (
            <div className="answer-feedback" aria-live="polite">
              <p><span>Đáp án của bạn</span><strong>{userAnswer.trim() || '— (để trống)'}</strong></p>
              <p className={feedback.correct ? 'feedback-correct' : 'feedback-wrong'}><span>Kết quả</span><strong>{feedback.correct ? 'Chính xác' : 'Chưa chính xác'}</strong></p>
              {!feedback.correct && <p><span>Đáp án đúng</span><strong>{feedback.correctAnswer}</strong></p>}
            </div>
          )}
        </section>

        {!feedback ? (
          <form className="answer-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <input ref={inputRef} className="form-input" id="answer-input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Nhập từ tiếng Anh..." autoFocus disabled={submitLoading} />
            <button className="btn btn-primary" type="submit" disabled={submitLoading || !answer.trim()}>{submitLoading ? <span className="spinner" /> : 'Nộp đáp án'}</button>
            {submitError && <p className="form-error answer-error" role="alert">{submitError}</p>}
          </form>
        ) : (
          <div className="next-question-actions">
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <button className="btn btn-primary btn-full btn-lg" onClick={() => void nextQuestion()}>
              {currentIndex + 1 >= words.length ? 'Xem kết quả' : 'Câu tiếp theo'}
            </button>
          </div>
        )}

        <section className="card opponent-progress">
          <div className="section-title"><span className="eyebrow">BẢNG ĐIỂM</span><strong>{players.length} người chơi</strong></div>
          <div className="progress-list">
            {players.slice().sort((a, b) => b.correct - a.correct).map((player) => (
              <div className="player-progress" key={player.user_id}>
                <div><span>{player.username}{player.user_id === user?.id ? ' · Bạn' : ''}</span><strong>{player.correct}/{words.length}</strong></div>
                <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${words.length ? (player.correct / words.length) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
