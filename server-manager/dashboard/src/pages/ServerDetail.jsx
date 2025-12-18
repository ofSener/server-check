import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Server, Cpu, HardDrive, Activity,
  Play, Square, RefreshCw, MessageSquare, Download
} from 'lucide-react'

function ServerDetail() {
  const { id } = useParams()
  const [server, setServer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    fetchServer()
    const interval = setInterval(fetchServer, 5000) // 5 saniyede bir güncelle
    return () => clearInterval(interval)
  }, [id])

  const fetchServer = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/servers/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setServer(data.data)
      }
    } catch (err) {
      console.error('Sunucu bilgisi alınamadı:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendCommand = async (command) => {
    setActionLoading(command)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/commands/${id}/${command}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        // Başarılı - durumu güncelle
        setTimeout(fetchServer, 2000)
      } else {
        alert(`Hata: ${data.error || data.message}`)
      }
    } catch (err) {
      alert('Komut gönderilemedi')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!server) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Sunucu Bulunamadı</h2>
        <p className="text-slate-400 mb-4">Bu ID ile kayıtlı sunucu yok: {id}</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300">
          Dashboard'a dön
        </Link>
      </div>
    )
  }

  const isOnline = server.status === 'online'
  const metrics = server.metrics

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/"
          className="p-2 hover:bg-slate-700 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <h1 className="text-2xl font-bold text-white">{server.name}</h1>
          </div>
          <p className="text-slate-400">{server.id}</p>
        </div>

        <button
          onClick={fetchServer}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Yenile
        </button>
      </div>

      {/* Ana Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol - Metrikler */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sistem Metrikleri */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sistem Metrikleri</h2>

            {isOnline && metrics?.system ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  icon={<Cpu className="w-5 h-5" />}
                  label="CPU"
                  value={`${metrics.system.cpu?.usage?.toFixed(1) || 0}%`}
                  subtext={`${metrics.system.cpu?.cores || 0} çekirdek`}
                />
                <MetricCard
                  icon={<HardDrive className="w-5 h-5" />}
                  label="RAM"
                  value={`${metrics.system.memory?.usagePercent || 0}%`}
                  subtext={metrics.system.memory?.used || '0'}
                />
                <MetricCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Disk"
                  value={`${metrics.system.disk?.[0]?.usagePercent || 0}%`}
                  subtext={metrics.system.disk?.[0]?.used || '0'}
                />
                <MetricCard
                  icon={<Server className="w-5 h-5" />}
                  label="Process"
                  value={metrics.system.processes?.total || 0}
                  subtext="toplam"
                />
              </div>
            ) : (
              <p className="text-slate-400">Sunucu çevrimdışı - metrikler alınamıyor</p>
            )}
          </div>

          {/* Uygulama Durumu */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Uygulama Durumu</h2>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${metrics?.app?.running ? 'bg-green-500' : 'bg-red-500'}`} />
                <div>
                  <p className="font-medium text-white">Ana Uygulama</p>
                  <p className="text-sm text-slate-400">
                    {metrics?.app?.running ? 'Çalışıyor' : 'Durdurulmuş'}
                    {metrics?.app?.pids?.length > 0 && ` (PID: ${metrics.app.pids.join(', ')})`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <ActionButton
                  icon={<Play className="w-4 h-4" />}
                  label="Başlat"
                  onClick={() => sendCommand('app/start')}
                  loading={actionLoading === 'app/start'}
                  disabled={!isOnline || metrics?.app?.running}
                  color="green"
                />
                <ActionButton
                  icon={<Square className="w-4 h-4" />}
                  label="Durdur"
                  onClick={() => sendCommand('app/stop')}
                  loading={actionLoading === 'app/stop'}
                  disabled={!isOnline || !metrics?.app?.running}
                  color="red"
                />
                <ActionButton
                  icon={<RefreshCw className="w-4 h-4" />}
                  label="Yeniden"
                  onClick={() => sendCommand('app/restart')}
                  loading={actionLoading === 'app/restart'}
                  disabled={!isOnline}
                  color="yellow"
                />
              </div>
            </div>

            {metrics?.app?.running && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-700/30 rounded">
                  <p className="text-slate-400 text-sm">CPU Kullanımı</p>
                  <p className="text-white font-medium">{metrics.app.cpu?.toFixed(1) || 0}%</p>
                </div>
                <div className="p-3 bg-slate-700/30 rounded">
                  <p className="text-slate-400 text-sm">RAM Kullanımı</p>
                  <p className="text-white font-medium">{metrics.app.memory?.toFixed(1) || 0}%</p>
                </div>
              </div>
            )}
          </div>

          {/* WPP Connect */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">WPP Connect</h2>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className={`w-5 h-5 ${metrics?.wpp?.overall === 'active' ? 'text-green-500' : 'text-slate-500'}`} />
                <div>
                  <p className="font-medium text-white">WhatsApp Bağlantısı</p>
                  <p className="text-sm text-slate-400">
                    {metrics?.wpp?.overall === 'active' ? 'Aktif' : 'Pasif'}
                    {metrics?.wpp?.httpHealthy && ' - HTTP OK'}
                  </p>
                </div>
              </div>

              <ActionButton
                icon={<RefreshCw className="w-4 h-4" />}
                label="Yeniden Başlat"
                onClick={() => sendCommand('wpp/restart')}
                loading={actionLoading === 'wpp/restart'}
                disabled={!isOnline}
                color="blue"
              />
            </div>
          </div>
        </div>

        {/* Sağ - Hızlı İşlemler */}
        <div className="space-y-6">
          {/* Sunucu Bilgileri */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Sunucu Bilgileri</h2>

            <div className="space-y-3">
              <InfoRow label="Hostname" value={metrics?.system?.os?.hostname || '-'} />
              <InfoRow label="OS" value={metrics?.system?.os?.distro || '-'} />
              <InfoRow label="Durum" value={isOnline ? 'Online' : 'Offline'} />
              <InfoRow label="Son Görülme" value={formatDate(server.lastSeen)} />
            </div>
          </div>

          {/* Hızlı İşlemler */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Hızlı İşlemler</h2>

            <div className="space-y-2">
              <button
                onClick={() => sendCommand('agent/restart')}
                disabled={!isOnline || actionLoading === 'agent/restart'}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-slate-300 transition"
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading === 'agent/restart' ? 'animate-spin' : ''}`} />
                Agent Yeniden Başlat
              </button>

              <button
                disabled={!isOnline}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white transition"
              >
                <Download className="w-4 h-4" />
                Güncelleme Gönder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, subtext }) {
  return (
    <div className="p-4 bg-slate-700/50 rounded-lg">
      <div className="text-slate-400 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
      {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
  )
}

function ActionButton({ icon, label, onClick, loading, disabled, color }) {
  const colors = {
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
    blue: 'bg-blue-600 hover:bg-blue-700'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 px-3 py-2 ${colors[color]} disabled:opacity-50 rounded-lg text-white text-sm transition`}
    >
      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('tr-TR')
}

export default ServerDetail
