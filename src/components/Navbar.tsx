import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/dashboard" className="navbar-logo">
          ⚡ WordDuel
        </Link>

        <div className="navbar-actions">
          {user && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', background: 'var(--bg-700)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--teal))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: 'white',
                }}>
                  {user.username[0].toUpperCase()}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.username}
                </span>
              </div>

              <button
                id="btn-logout"
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
