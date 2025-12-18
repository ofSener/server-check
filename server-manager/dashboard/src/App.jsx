import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ServerDetail from './pages/ServerDetail'
import Login from './pages/Login'
import Layout from './components/Layout'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Token kontrolü
    const token = localStorage.getItem('token')
    if (token) {
      // Token'ı doğrula
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setIsAuthenticated(data.success)
          setLoading(false)
        })
        .catch(() => {
          localStorage.removeItem('token')
          setIsAuthenticated(false)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = (token) => {
    localStorage.setItem('token', token)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/server/:id"
          element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <ServerDetail />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
