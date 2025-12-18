import { Link } from 'react-router-dom'
import { Server, LogOut, Home } from 'lucide-react'

function Layout({ children, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Server className="w-6 h-6 text-blue-500" />
            Server Manager
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white transition"
            >
              <Home className="w-4 h-4" />
              Dashboard
            </Link>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" />
              Çıkış
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

export default Layout
