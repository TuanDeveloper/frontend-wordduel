import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import WaitingRoomPage from './pages/WaitingRoomPage'
import GamePage from './pages/GamePage'
import ResultPage from './pages/ResultPage'
import SoloPage from './pages/SoloPage'
import LibraryPage from './pages/LibraryPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import './index.css'

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-900)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}

// ─── App Routes ───────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:code"
        element={
          <ProtectedRoute>
            <WaitingRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/:code"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result/:code"
        element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route path="/solo/:sessionId" element={<ProtectedRoute><SoloPage /></ProtectedRoute>} />
      <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
