import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { libraryApi, soloApi } from '../lib/api'

interface SoloWord { id: number; definition: string; context_sentence?: string | null }
interface SoloAnswer { question_index: number; word_id: number; user_answer: string; is_correct: boolean; correct_answer: string; response_time_ms: number }
interface SoloState {
  event: string
  session_id: number
  source: 'word_set' | 'library'
  word_set_id: number | null
  word_count: number
  question_count: number
  time_per_question: number | null
  words: SoloWord[]
  answers: SoloAnswer[]
  correct_count: number
  average_response_time_ms: number
  wrong_word_ids: number[]
  status: string
}

export default function SoloPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<SoloState | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<SoloAnswer | null>(null)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [savedWordIds, setSavedWordIds] = useState<number[]>([])
  const startedAt = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submitLock = useRef(false)
  const submitRef = useRef<(value?: string) => Promise<void>>(async () => {})

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      navigate('/dashboard', { replace: true })
      return
    }
    const response = await soloApi.state(Number(sessionId))
    const data = response.data.data as unknown as SoloState
    const firstUnanswered = data.answers.findIndex((answer, index) => answer.question_index !== index)
    const nextIndex = firstUnanswered < 0 && data.answers.length < data.question_count
      ? data.answers.length
      : firstUnanswered
    setSession(data)
    setCurrentIndex(nextIndex < 0 ? data.question_count - 1 : nextIndex)
    setLoading(false)
  }, [navigate, sessionId])

  useEffect(() => {
    refreshSession().catch(() => {
      setError('Không thể tải buổi luyện tập này.')
      setLoading(false)
    })
  }, [refreshSession])

  const currentWord = session?.words[currentIndex]
  const previousAnswer = session?.answers.find((item) => item.question_index === currentIndex)
  const resultComplete = session?.status === 'completed'

  const submit = useCallback(async (value = answer) => {
    if (!session || !currentWord || submitLock.current || previousAnswer || resultComplete) return
    submitLock.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    const responseTime = Math.max(0, Date.now() - startedAt.current)
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const response = await soloApi.submit(
        session.session_id,
        currentWord.id,
        currentIndex,
        value,
        responseTime,
      )
      const result = response.data.data as { user_answer: string; is_correct: boolean; correct_answer: string; response_time_ms: number; question_index: number; word_id: number; state: SoloState }
      setFeedback({
        question_index: result.question_index,
        word_id: result.word_id,
        user_answer: result.user_answer,
        is_correct: result.is_correct,
        correct_answer: result.correct_answer,
        response_time_ms: result.response_time_ms,
      })
      setSession(result.state)
    } catch {
      setError('Chưa gửi được câu trả lời. Hãy kiểm tra kết nối rồi thử lại.')
    } finally {
      setLoading(false)
      submitLock.current = false
    }
  }, [answer, currentIndex, currentWord, previousAnswer, resultComplete, session])

  useEffect(() => { submitRef.current = submit }, [submit])

  useEffect(() => {
    if (!session || !currentWord || previousAnswer || resultComplete || feedback || session.time_per_question === null) {
      if (timerRef.current) clearInterval(timerRef.current)
      setSecondsLeft(session?.time_per_question ?? null)
      return
    }
    startedAt.current = Date.now()
    setSecondsLeft(session.time_per_question)
    timerRef.current = setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining === null || remaining <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          void submitRef.current('')
          return 0
        }
        return remaining - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [currentIndex, currentWord, feedback, previousAnswer, resultComplete, session])

  useEffect(() => {
    if (previousAnswer) setFeedback(previousAnswer)
    else setFeedback(null)
    setAnswer('')
  }, [currentIndex, previousAnswer])

  const nextQuestion = () => {
    if (!session) return
    setFeedback(null)
    setNotice(null)
    setError(null)
    if (currentIndex + 1 >= session.question_count) {
      setSession({ ...session, status: 'completed' })
      return
    }
    setCurrentIndex((index) => index + 1)
  }

  const saveWord = async (wordId: number) => {
    setSaving(true)
    try {
      await libraryApi.save(wordId)
      setSavedWordIds((ids) => ids.includes(wordId) ? ids : [...ids, wordId])
      setNotice('Đã lưu từ vào thư viện cá nhân.')
    } catch {
      setNotice('Không thể lưu từ lúc này.')
    } finally {
      setSaving(false)
    }
  }

  const saveWrongWords = async () => {
    if (!session) return
    setSaving(true)
    const uniqueIds = [...new Set(session.wrong_word_ids)]
    try {
      await Promise.all(uniqueIds.map((id) => libraryApi.save(id)))
      setSavedWordIds((ids) => [...new Set([...ids, ...uniqueIds])])
      setNotice(`Đã lưu ${uniqueIds.length} từ sai vào thư viện.`)
    } catch {
      setNotice('Một số từ chưa lưu được. Bạn có thể lưu lại trong thư viện.')
    } finally {
      setSaving(false)
    }
  }

  const trainAgain = async () => {
    if (!session) return
    try {
      const response = await soloApi.start({
        source: session.source,
        word_set_id: session.word_set_id ?? undefined,
        word_count: session.word_count,
        question_count: session.question_count,
        time_per_question: session.time_per_question,
      })
      const newSession = response.data.data as { session_id: number }
      navigate(`/solo/${newSession.session_id}`, { replace: true })
    } catch {
      setError('Không thể bắt đầu lại buổi luyện tập.')
    }
  }

  if (loading && !session) return <div className="page-center"><span className="spinner" /></div>
  if (error && !session) return <div className="page-center"><div className="card state-card"><p>{error}</p><button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Về trang chủ</button></div></div>
  if (!session) return null

  if (resultComplete) {
    return (
      <div className="app-page">
        <Navbar />
        <main className="container result-page">
          <section className="card solo-result-card">
            <span className="result-sparkle">✦</span>
            <span className="eyebrow">BUỔI LUYỆN HOÀN THÀNH</span>
            <h1 className="font-display">Tiến bộ từng từ một.</h1>
            <div className="solo-result-stats">
              <div><strong>{session.correct_count}</strong><span>câu đúng / {session.question_count}</span></div>
              <div><strong>{(session.average_response_time_ms / 1000).toFixed(1)}s</strong><span>trung bình mỗi câu</span></div>
            </div>
            {notice && <p className="field-hint">{notice}</p>}
            <div className="modal-actions">
              {session.wrong_word_ids.length > 0 && <button className="btn btn-secondary" disabled={saving} onClick={() => void saveWrongWords()}>{saving ? 'Đang lưu…' : `☆ Lưu ${session.wrong_word_ids.length} từ sai`}</button>}
              <button className="btn btn-primary" onClick={() => void trainAgain()}>Luyện lại</button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Về trang chủ</button>
            </div>
            {error && <p className="form-error">{error}</p>}
          </section>
        </main>
      </div>
    )
  }

  const result = feedback ?? previousAnswer ?? null
  return (
    <div className="app-page">
      <Navbar />
      <main className="game-content solo-content">
        <div className="solo-heading-row">
          <div><span className="eyebrow">LUYỆN TẬP CÁ NHÂN</span><h1 className="font-display">Tập trung vào từ tiếp theo.</h1></div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>Thoát luyện tập</button>
        </div>
        <div className="solo-progress"><div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${(currentIndex / session.question_count) * 100}%` }} /></div><span>{currentIndex + 1} / {session.question_count}</span>
          {session.time_per_question !== null && <span className={`game-timer ${secondsLeft !== null && secondsLeft <= 5 ? 'is-urgent' : ''}`}>{secondsLeft ?? session.time_per_question}</span>}
        </div>
        <section className={`card question-card ${result ? (result.is_correct ? 'is-correct' : 'is-wrong') : ''}`}>
          <span className="eyebrow">NGHĨA CỦA TỪ LÀ GÌ?</span>
          <h2>{currentWord?.definition}</h2>
          {currentWord?.context_sentence && <p className="context-hint"><span>Gợi ý ngữ cảnh</span>{currentWord.context_sentence}</p>}
          {currentWord && <button type="button" className="save-word-button" disabled={saving || savedWordIds.includes(currentWord.id)} onClick={() => void saveWord(currentWord.id)}>{savedWordIds.includes(currentWord.id) ? '✓ Đã lưu vào thư viện' : '☆ Lưu từ này'}</button>}
          {result && <div className="answer-feedback" aria-live="polite">
            <p><span>Đáp án của bạn</span><strong>{result.user_answer.trim() || '— (để trống)'}</strong></p>
            <p className={result.is_correct ? 'feedback-correct' : 'feedback-wrong'}><span>Kết quả</span><strong>{result.is_correct ? 'Chính xác' : 'Chưa chính xác'}</strong></p>
            {!result.is_correct && <p><span>Đáp án đúng</span><strong>{result.correct_answer}</strong></p>}
          </div>}
          {notice && <p className="field-hint">{notice}</p>}
        </section>
        {result ? <button className="btn btn-primary btn-full btn-lg" onClick={nextQuestion}>{currentIndex + 1 >= session.question_count ? 'Xem kết quả' : 'Câu tiếp theo'}</button> : (
          <form className="answer-form" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <input className="form-input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Nhập từ tiếng Anh..." autoFocus disabled={loading} />
            <button className="btn btn-primary" type="submit" disabled={loading || !answer.trim()}>{loading ? <span className="spinner" /> : 'Nộp đáp án'}</button>
          </form>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
    </div>
  )
}
