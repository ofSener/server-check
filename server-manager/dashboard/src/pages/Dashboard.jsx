import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  Server, Cpu, HardDrive, Activity,
  CheckCircle, XCircle, RefreshCw, MessageSquare
} from 'lucide-react'

function Dashboard() {
  const [servers, setServers] = useState([])
  const [stats, setStats] = useState({ total: 0, online: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // İlk verileri al
    fetchServers()

    // Socket bağlantısı
    const socket = io('/dashboard')

    socket.on('connect', () => {
      console.log('Dashboard socket bağlandı')
    })

    socket.on('servers:list', (data) => {
      setServers(data)
      updateStats(data)
      setLoading(false)
    })

    socket.on('server:update', (data) => {
      setServers(prev => {
        const index = prev.findIndex(s => s.id === data.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = { ...updated[index], ...data }
          return updated
        }
        return prev
      })
    })

    socket.on('server:online', (data) => {
      setServers(prev => {
        const index = prev.findIndex(s => s.id === data.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index].status = 'online'
          return updated
        }
        return [...prev, { ...data, status: 'online' }]
      })
    })

    socket.on('server:offline', (data) => {
      setServers(prev => {
        const index = prev.findIndex(s => s.id === data.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index].status = 'offline'
          return updated
        }
        return prev
      })
    })

    return () => socket.disconnect()
  }, [])

  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/servers', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setServers(data.data)
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Sunucular alınamadı:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateStats = (serverList) => {
    setStats({
      total: serverList.length,
      online: serverList.filter(s => s.status === 'online').length
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button
          onClick={fetchServers}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Server className="w-6 h-6" />}
          label="Toplam Sunucu"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Online"
          value={stats.online}
          color="green"
        />
        <StatCard
          icon={<XCircle className="w-6 h-6" />}
          label="Offline"
          value={stats.total - stats.online}
          color="red"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Uptime"
          value={stats.total > 0 ? `${Math.round((stats.online / stats.total) * 100)}%` : '0%'}
          color="purple"
        />
      </div>

      {/* Sunucu Listesi */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="font-semibold text-white">Sunucular</h2>
        </div>

        {servers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Henüz bağlı sunucu yok</p>
            <p className="text-sm mt-1">Agent'ları başlattığınızda burada görünecekler</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {servers.map(server => (
              <ServerRow key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    purple: 'bg-purple-500/20 text-purple-400'
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className={`inline-flex p-2 rounded-lg ${colors[color]} mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  )
}

function ServerRow({ server }) {
  const isOnline = server.status === 'online'
  const metrics = server.metrics

  return (
    <Link
      to={`/server/${server.id}`}
      className="flex items-center gap-4 px-4 py-4 hover:bg-slate-700/50 transition"
    >
      {/* Status */}
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{server.name}</p>
        <p className="text-sm text-slate-400">{server.id}</p>
      </div>

      {/* Metrics */}
      {isOnline && metrics?.system && (
        <>
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Cpu className="w-4 h-4 text-slate-500" />
            <span className="text-slate-300">
              {metrics.system.cpu?.usage?.toFixed(1) || 0}%
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm">
            <HardDrive className="w-4 h-4 text-slate-500" />
            <span className="text-slate-300">
              {metrics.system.memory?.usagePercent || 0}%
            </span>
          </div>
        </>
      )}

      {/* App Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            metrics?.app?.running ? 'bg-green-500' : 'bg-slate-500'
          }`}
          title={metrics?.app?.running ? 'App çalışıyor' : 'App kapalı'}
        />

        <div
          className={`w-2 h-2 rounded-full ${
            metrics?.wpp?.overall === 'active' ? 'bg-green-500' : 'bg-slate-500'
          }`}
          title={metrics?.wpp?.overall === 'active' ? 'WPP aktif' : 'WPP pasif'}
        />
      </div>

      {/* Arrow */}
      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

export default Dashboard
