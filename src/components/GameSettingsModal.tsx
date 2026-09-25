import { useState, type FormEvent } from 'react'
import type { GameSettings, WordSet } from '../lib/api'

interface Props {
  mode: 'duel' | 'solo'
  wordSet: WordSet
  onClose: () => void
  onStart: (settings: GameSettings) => void | Promise<void>
}

export default function GameSettingsModal({ mode, wordSet, onClose, onStart }: Props) {
  const [wordCount, setWordCount] = useState('all')
  const [questionCount, setQuestionCount] = useState('')
  const [timeLimit, setTimeLimit] = useState('20')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const settings: GameSettings = {
      word_count: wordCount === 'all' ? undefined : Number(wordCount),
      question_count: questionCount ? Number(questionCount) : undefined,
      time_per_question: timeLimit === 'unlimited' ? null : Number(timeLimit),
    }
    try {
      await onStart(settings)
    } catch {
      setError('Không thể bắt đầu. Hãy kiểm tra lại bộ từ vựng rồi thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="card modal-panel animate-fade-up" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{mode === 'duel' ? 'ĐẤU VỚI BẠN BÈ' : 'LUYỆN TẬP CÁ NHÂN'}</span>
            <h2 className="font-display">Cài đặt ván đấu</h2>
            <p>{wordSet.title} · {wordSet.word_count ?? 0} từ</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        <div className="settings-grid">
          <label className="form-group">
            <span className="form-label">Từ được chọn</span>
            <select className="form-input" value={wordCount} onChange={(event) => setWordCount(event.target.value)}>
              <option value="10">10 từ</option>
              <option value="20">20 từ</option>
              <option value="all">Toàn bộ bộ từ</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Thời gian mỗi câu</span>
            <select className="form-input" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)}>
              <option value="10">10 giây</option>
              <option value="20">20 giây</option>
              <option value="30">30 giây</option>
              <option value="unlimited">Không giới hạn</option>
            </select>
          </label>
          <label className="form-group settings-full-width">
            <span className="form-label">Số câu hỏi</span>
            <input className="form-input" type="number" min="1" max="500" placeholder="Bằng số từ đã chọn" value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} />
            <span className="field-hint">Có thể nhiều hơn số từ; các từ sẽ được xáo trộn và lặp lại.</span>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : mode === 'duel' ? 'Tạo phòng' : 'Bắt đầu luyện'}
          </button>
        </div>
      </form>
    </div>
  )
}
