import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, getApiErrorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        if (!form.fullName.trim()) {
          setError('Vui lòng nhập Họ và tên')
          setLoading(false)
          return
        }

        // 1. Đăng ký tài khoản
        await authApi.register({
          username: form.username.trim(),
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
        })

        // 2. Tự động đăng nhập
        const loginRes = await authApi.login({
          username: form.username.trim(),
          password: form.password,
        })

        const token = loginRes.data?.data?.access_token || (loginRes.data as unknown as { access_token: string })?.access_token
        if (!token) throw new Error('Không nhận được access token từ server')
        await login(token)
      } else {
        // Đăng nhập
        const res = await authApi.login({
          username: form.username.trim(),
          password: form.password,
        })

        const token = res.data?.data?.access_token || (res.data as unknown as { access_token: string })?.access_token
        if (!token) throw new Error('Không nhận được access token từ server')
        await login(token)
      }

      navigate('/dashboard')
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center bg-grid" style={{ background: 'var(--bg-900)', position: 'relative' }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '-150px', left: '50%', transform: 'translateX(-50%)',
        width: '700px', height: '500px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div className="animate-fade-up" style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="font-display text-gradient" style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>
            ⚡ WordDuel
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Đấu từ vựng tiếng Anh real-time
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '32px' }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-700)',
            borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '28px',
          }}>
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '9px',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                  transition: 'all 0.2s',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-secondary)',
                  boxShadow: mode === m ? '0 2px 8px var(--accent-glow)' : 'none',
                }}
              >
                {m === 'login' ? '🔑 Đăng nhập' : '✨ Đăng ký'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Tên đăng nhập</label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-input"
                placeholder="duelist123"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Họ và tên</label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    className="form-input"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Mật khẩu</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '44px', width: '100%' }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: showPassword ? 'var(--accent-light)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    transition: 'color 0.2s',
                  }}
                >
                  {showPassword ? (
                    // Eye slash icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    // Eye icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5', fontSize: '13px', lineHeight: 1.5,
                whiteSpace: 'pre-line',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="submit-auth"
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px' }}>
          {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  )
}

