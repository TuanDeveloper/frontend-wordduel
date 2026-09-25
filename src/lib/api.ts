/**
 * API client — axios instance với JWT token tự động đính kèm
 */
import axios from 'axios'

const HOSTNAME = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'

export const BASE_URL = `http://${HOSTNAME}:8000`
export const API_URL = `${BASE_URL}/api/v1`
export const WS_URL = `ws://${HOSTNAME}:8000`


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
export interface UserInfo { id: number; username: string; email: string; full_name?: string }

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
export interface Word { id: number; term: string; definition: string; example?: string; word_set_id: number }
export interface WordSet { id: number; title: string; description?: string; creator_id?: number; words: Word[] }
export interface WordSetCreate { title: string; description?: string; words: { term: string; definition: string; example?: string }[] }

export const wordApi = {
  listWordSets: () => api.get<{ data: WordSet[] }>('/word-sets'),
  createWordSet: (payload: WordSetCreate) => api.post<{ data: WordSet }>('/word-sets', payload),
  getWordSet: (id: number) => api.get<{ data: WordSet }>(`/word-sets/${id}`),
  deleteWordSet: (id: number) => api.delete(`/word-sets/${id}`),
}


// ─── Rooms ───────────────────────────────────────────────────────────────────
export interface RoomPlayer {
  id: number
  room_id: number
  user_id: number
  score: number
  is_ready: boolean
  joined_at?: string
  user?: UserInfo
}
export interface Room {
  id: number
  code: string
  host_id: number
  word_set_id: number
  status: 'waiting' | 'playing' | 'finished'
  created_at?: string
  finished_at?: string
  players: RoomPlayer[]
}

export const roomApi = {
  create: (word_set_id: number) => api.post<{ data: Room }>('/rooms', { word_set_id }),
  join: (code: string) => api.post<{ data: Room }>(`/rooms/${code}/join`),
  get: (code: string) => api.get<{ data: Room }>(`/rooms/${code}`),
  ready: (code: string) => api.post<{ data: { is_ready: boolean } }>(`/rooms/${code}/ready`),
  start: (code: string) => api.post<{ data: unknown }>(`/rooms/${code}/start`),
  submit: (code: string, word_id: number, submitted_answer: string) =>
    api.post<{ data: unknown }>(`/rooms/${code}/submit`, { word_id, submitted_answer }),
  finish: (code: string) => api.post<{ data: unknown }>(`/rooms/${code}/finish`),
}
