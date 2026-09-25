import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import { authApi, type UserInfo } from '../lib/api'

interface JwtPayload {
  sub: string
  exp: number
}

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  login: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  const login = useCallback(async (newToken: string) => {
    if (!newToken) return
    localStorage.setItem('token', newToken)
    setToken(newToken)
    try {
      const res = await authApi.me()
      setUser(res.data.data)
    } catch {
      try {
        const decoded = jwtDecode<JwtPayload>(newToken)
        setUser({ id: Number(decoded.sub), username: `user_${decoded.sub}`, email: '' })
      } catch {
        logout()
      }
    }
  }, [logout])

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('token')
      if (!stored) {
        setIsLoading(false)
        return
      }
      try {
        const decoded = jwtDecode<JwtPayload>(stored)
        if (decoded.exp * 1000 < Date.now()) {
          logout()
          setIsLoading(false)
          return
        }
        setToken(stored)
        try {
          const res = await authApi.me()
          setUser(res.data.data)
        } catch {
          // Token còn hạn, fallback user data
          setUser({ id: Number(decoded.sub), username: `user_${decoded.sub}`, email: '' })
        }
      } catch {
        logout()
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
