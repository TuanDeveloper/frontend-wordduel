import { useState, type ChangeEvent } from 'react'
import { getApiErrorMessage, wordApi } from '../lib/api'

interface PreviewRow {
  word: string
  definition: string
  example?: string
  context_sentence?: string
}

interface ImportError {
  row: number
  message: string
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function ImportWordSetModal({ onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [errors, setErrors] = useState<ImportError[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setRows([])
    setErrors([])
    setError(null)
    if (!selected) return
    setLoadingPreview(true)
    try {
      const response = await wordApi.previewImport(selected)
      setRows(response.data.data.rows)
      setErrors(response.data.data.errors)
    } catch (reason) {
      setError(getApiErrorMessage(reason))
    } finally {
      setLoadingPreview(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await wordApi.downloadImportTemplate()
      const url = URL.createObjectURL(response.data as Blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'wordduel-template.xlsx'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Không thể tải file mẫu.')
    }
  }

  const save = async () => {
    if (!file || !title.trim() || rows.length === 0) return
    setLoadingSave(true)
    setError(null)
    try {
      const response = await wordApi.importWordSet(file, title.trim(), description.trim())
      setErrors(response.data.data.errors)
      onCreated()
    } catch (reason) {
      setError(getApiErrorMessage(reason))
    } finally {
      setLoadingSave(false)
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop-scroll" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="card modal-panel import-panel animate-fade-up">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">THƯ VIỆN TỪ VỰNG</span>
            <h2 className="font-display">Import Excel / CSV</h2>
            <p>Cột: word, definition, example. Nội dung example có thể để trống.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="import-toolbar">
          <label className="btn btn-secondary btn-sm file-picker">
            Chọn tệp .xlsx / .csv
            <input type="file" accept=".xlsx,.csv" onChange={chooseFile} />
          </label>
          <button type="button" className="text-button" onClick={downloadTemplate}>Tải file mẫu .xlsx</button>
          {file && <span className="field-hint">{file.name}</span>}
        </div>
        <div className="settings-grid import-details">
          <label className="form-group">
            <span className="form-label">Tên bộ từ</span>
            <input className="form-input" maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Từ vựng IELTS" />
          </label>
          <label className="form-group">
            <span className="form-label">Mô tả (tùy chọn)</span>
            <input className="form-input" maxLength={255} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </div>
        {loadingPreview ? <div className="inline-loading"><span className="spinner" /> Đang đọc file...</div> : null}
        {rows.length > 0 && (
          <>
            <div className="preview-summary">Xem trước {rows.length} từ hợp lệ{errors.length > 0 ? ` · ${errors.length} dòng sẽ được bỏ qua` : ''}</div>
            <div className="table-scroll preview-table-wrap">
              <table className="data-table preview-table">
                <thead><tr><th>#</th><th>Word</th><th>Definition</th><th>Example</th></tr></thead>
                <tbody>{rows.slice(0, 30).map((row, index) => (
                  <tr key={`${row.word}-${index}`}><td>{index + 1}</td><td>{row.word}</td><td>{row.definition}</td><td>{row.example || '—'}</td></tr>
                ))}</tbody>
              </table>
              {rows.length > 30 && <p className="field-hint">Đang hiển thị 30 dòng đầu; tất cả {rows.length} dòng hợp lệ sẽ được lưu.</p>}
            </div>
          </>
        )}
        {errors.length > 0 && <div className="import-errors"><strong>Dòng cần kiểm tra</strong>{errors.slice(0, 10).map((item) => <p key={item.row}>Dòng {item.row}: {item.message}</p>)}</div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Đóng</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!file || !title.trim() || rows.length === 0 || loadingPreview || loadingSave}>
            {loadingSave ? <span className="spinner" /> : `Tạo bộ từ (${rows.length})`}
          </button>
        </div>
      </section>
    </div>
  )
}
