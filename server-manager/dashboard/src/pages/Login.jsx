import { useState } from 'react'
import { Server, Lock, User } from 'lucide-react'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (data.success) {
        onLogin(data.token)
      } else {
        setError(data.error || 'Giriş başarısız')
      }
    } catch (err) {
      setError('Sunucuya bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Server Manager</h1>
          <p className="text-slate-400 mt-2">Sunucularınızı yönetin</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-slate-300 text-sm mb-2">Kullanıcı Adı</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-slate-300 text-sm mb-2">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>

          <p className="text-center text-slate-500 text-sm mt-4">
            Varsayılan: admin / admin123
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
