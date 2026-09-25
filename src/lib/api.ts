/**
 * API client — axios instance với JWT token tự động đính kèm
 */
import axios from 'axios'

const HOSTNAME = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
const PAGE_PROTOCOL = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'

export const BASE_URL = `${PAGE_PROTOCOL}//${HOSTNAME}:8000`
export const API_URL = (import.meta.env.VITE_API_URL || `${BASE_URL}/api/v1`).replace(/\/$/, '')
export const WS_URL = import.meta.env.VITE_WS_URL || BASE_URL.replace(/^http/, 'ws')


const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Đính kèm token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Nếu 401 và không phải đang ở trang login hay đang gọi /auth/login → xóa token và redirect về login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthRequest = error.config?.url?.includes('/auth/login') || window.location.pathname.includes('/login')
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// ─── API Wrapper ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  status: string
  data: T
  message: string
  details?: Array<{ loc?: string[] | string; msg?: string; type?: string }>
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginPayload { username: string; password: string }
export interface RegisterPayload { username: string; email: string; full_name: string; password: string }
export interface TokenResponse { access_token: string; token_type: string }
export interface UserInfo { id: number; username: string; email: string; full_name?: string; role?: 'user' | 'admin' }

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<ApiResponse<UserInfo>>('/auth/register', payload),
  login: (payload: LoginPayload) =>
    api.post<ApiResponse<TokenResponse>>('/auth/login', payload),
  me: () => api.get<ApiResponse<UserInfo>>('/auth/me'),
}

/**
 * Trích xuất và định dạng thông báo lỗi chi tiết từ response backend (kể cả lỗi 422 validation)
 */
export function getApiErrorMessage(err: unknown): string {
  const axiosErr = err as {
    response?: {
      status?: number
      data?: {
        message?: string
        detail?: string | Array<{ loc?: string[] | string; msg?: string; type?: string }>
        details?: Array<{ loc?: string[] | string; msg?: string; type?: string }>
      }
    }
  }

  const data = axiosErr?.response?.data
  if (!data) {
    if (axiosErr?.response?.status === 401) {
      return 'Sai tên đăng nhập hoặc mật khẩu.'
    }
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại dịch vụ.'
  }

  // 1. Kiểm tra mảng validation errors (từ custom exception handler hoặc FastAPI)
  const detailList = data.details || (Array.isArray(data.detail) ? data.detail : null)
  if (detailList && Array.isArray(detailList) && detailList.length > 0) {
    const fieldMap: Record<string, string> = {
      full_name: 'Họ và tên',
      username: 'Tên đăng nhập',
      email: 'Email',
      password: 'Mật khẩu',
      title: 'Tên bộ từ',
      description: 'Mô tả',
    }

    const messages = detailList.map((item) => {
      let fieldKey = ''
      if (typeof item.loc === 'string') {
        fieldKey = item.loc.split(' -> ').pop() || item.loc
      } else if (Array.isArray(item.loc)) {
        fieldKey = String(item.loc[item.loc.length - 1])
      }

      const label = fieldMap[fieldKey] || fieldKey || 'Dữ liệu'
      if (item.type === 'missing') {
        return `Thiếu trường "${label}".`
      }
      if (item.type === 'string_too_short' || item.msg?.includes('at least')) {
        return `"${label}" quá ngắn.`
      }
      if (item.type === 'value_error' || item.msg?.includes('valid email')) {
        return `"${label}" không đúng định dạng.`
      }
      return `${label}: ${item.msg}`
    })

    return messages.join(' • ')
  }

  // 2. detail dạng text đơn giản
  if (typeof data.detail === 'string') {
    return data.detail
  }

  // 3. message chuẩn
  if (data.message) {
    return data.message
  }

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}


// ─── Word Sets & Words ────────────────────────────────────────────────────────
export interface Word { id: number; term: string; definition: string; example?: string; context_sentence?: string; word_set_id: number }
export interface WordSet { id: number; title: string; description?: string; creator_id?: number; word_count?: number; words?: Word[] }
export interface WordSetCreate { title: string; description?: string; words: { term: string; definition: string; example?: string; context_sentence?: string }[] }

export const wordApi = {
  listWordSets: () => api.get<{ data: WordSet[] }>('/word-sets'),
  createWordSet: (payload: WordSetCreate) => api.post<{ data: WordSet }>('/word-sets', payload),
  getWordSet: (id: number) => api.get<{ data: WordSet }>(`/word-sets/${id}`),
  deleteWordSet: (id: number) => api.delete(`/word-sets/${id}`),
  previewImport: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return api.post<{ data: { rows: { word: string; definition: string; example?: string; context_sentence?: string }[]; valid_count: number; errors: { row: number; message: string }[] } }>(
      '/word-sets/import/preview', body, { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
  importWordSet: (file: File, title: string, description: string) => {
    const body = new FormData()
    body.append('file', file)
    body.append('title', title)
    if (description) body.append('description', description)
    return api.post<{ data: { word_set: WordSet; imported_count: number; errors: { row: number; message: string }[] } }>(
      '/word-sets/import', body, { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  },
  downloadImportTemplate: () => api.get('/word-sets/import/template', { responseType: 'blob' }),
}


// ─── Rooms ───────────────────────────────────────────────────────────────────
export interface RoomPlayer {
  id: number
  room_id: number
  user_id: number
  score: number
  is_ready: boolean
  joined_at?: string
  user?: { username: string }
}
export interface Room {
  id: number
  code: string
  host_id: number
  word_set_id: number
  word_count: number | null
  question_count: number | null
  time_per_question: number | null
  status: 'waiting' | 'playing' | 'finished'
  created_at?: string
  finished_at?: string
  players: RoomPlayer[]
}

export const roomApi = {
  create: (word_set_id: number, settings: GameSettings = {}) => api.post<{ data: Room }>('/rooms', { word_set_id, ...settings }),
  join: (code: string) => api.post<{ data: Room }>(`/rooms/${code}/join`),
  get: (code: string) => api.get<{ data: Room }>(`/rooms/${code}`),
  gameState: (code: string) => api.get<{ data: Record<string, unknown> }>(`/rooms/${code}/game-state`),
  ready: (code: string) => api.post<{ data: { is_ready: boolean } }>(`/rooms/${code}/ready`),
  start: (code: string) => api.post<{ data: unknown }>(`/rooms/${code}/start`),
  submit: (code: string, word_id: number, submitted_answer: string, question_index = 0) =>
    api.post<{ data: unknown }>(`/rooms/${code}/submit`, { word_id, submitted_answer, question_index }),
  finish: (code: string) => api.post<{ data: unknown }>(`/rooms/${code}/finish`),
  leave: (code: string) => api.post<{ data: { closed: boolean; host_id?: number } }>(`/rooms/${code}/leave`),
}

export interface GameSettings {
  word_count?: number | null
  time_per_question?: number | null
  question_count?: number | null
}

export const soloApi = {
  start: (payload: GameSettings & { source: 'word_set' | 'library'; word_set_id?: number }) =>
    api.post<{ data: Record<string, unknown> }>('/solo/start', payload),
  state: (sessionId: number) => api.get<{ data: Record<string, unknown> }>(`/solo/${sessionId}`),
  submit: (sessionId: number, word_id: number, question_index: number, submitted_answer: string, response_time_ms: number) =>
    api.post<{ data: Record<string, unknown> }>(`/solo/${sessionId}/submit`, { word_id, question_index, submitted_answer, response_time_ms }),
}

export interface SavedWord {
  id: number
  word_id: number
  note: string | null
  created_at: string
  word: Word
}

export const libraryApi = {
  list: (search = '') => api.get<{ data: SavedWord[] }>('/library', { params: search ? { search } : {} }),
  save: (word_id: number, note?: string) => api.post<{ data: SavedWord }>('/library/save', { word_id, note }),
  remove: (id: number) => api.delete(`/library/${id}`),
}

export const adminApi = {
  users: (search = '') => api.get<{ data: { id: number; username: string; email: string; full_name: string; role: string; is_active: boolean }[] }>('/admin/users', { params: search ? { search } : {} }),
  setUserStatus: (id: number, is_active: boolean) => api.patch(`/admin/users/${id}/status`, { is_active }),
  wordSets: (search = '') => api.get<{ data: { id: number; title: string; creator_username?: string; word_count: number; is_hidden: boolean }[] }>('/admin/word-sets', { params: search ? { search } : {} }),
  wordSet: (id: number) => api.get<{ data: { id: number; title: string; description?: string; is_hidden: boolean; words: { id: number; term: string; definition: string; example?: string; context_sentence?: string }[] } }>(`/admin/word-sets/${id}`),
  setWordSetVisibility: (id: number, is_hidden: boolean) => api.patch(`/admin/word-sets/${id}`, { is_hidden }),
  stats: () => api.get<{ data: { user_count: number; active_user_count: number; finished_room_count: number; word_set_count: number; popular_word_sets: { id: number; title: string; room_count: number }[] } }>('/admin/stats'),
}
