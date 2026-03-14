import { useState, useEffect, useCallback } from 'react'
import Dashboard from './components/Dashboard.jsx'
import Containers from './components/Containers.jsx'
import Logs from './components/Logs.jsx'
import Monitor from './components/Monitor.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', symbol: '⬡' },
  { id: 'containers', label: 'Containers', symbol: '▣' },
  { id: 'logs',       label: 'Logs',       symbol: '≣' },
  { id: 'monitor',    label: 'Monitor',    symbol: '◎' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [system, setSystem] = useState(null)
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSystem = useCallback(async () => {
    try {
      const [sysRes, contRes] = await Promise.all([
        fetch('/api/system'),
        fetch('/api/containers'),
      ])
      if (sysRes.ok) setSystem(await sysRes.json())
      if (contRes.ok) setContainers(await contRes.json())
      setError(null)
    } catch (e) {
      setError('Cannot reach backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSystem()
    const iv = setInterval(fetchSystem, 8000)
    return () => clearInterval(iv)
  }, [fetchSystem])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 210,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              fontFamily: 'var(--mono)',
              boxShadow: '0 0 12px var(--accent-glow)',
              flexShrink: 0,
            }}>D</div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                DockerHQ
              </div>
              {system && (
                <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                  v{system.docker_version}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px' }}>
          {NAV.map(n => {
            const active = tab === n.id
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  marginBottom: 2,
                  transition: 'background 0.12s, color 0.12s',
                  textAlign: 'left',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text2)' }}
              >
                {/* Active indicator bar */}
                {active && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: '0 2px 2px 0',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }} />
                )}
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 14,
                  lineHeight: 1,
                  width: 18,
                  textAlign: 'center',
                  opacity: active ? 1 : 0.5,
                  flexShrink: 0,
                }}>
                  {n.symbol}
                </span>
                {n.label}
              </button>
            )
          })}
        </nav>

        {/* System stats */}
        {system && (
          <div style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            fontFamily: 'var(--mono)',
          }}>
            <div style={{ color: 'var(--text3)', marginBottom: 8, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              System
            </div>
            <StatRow label="running" value={system.containers_running} color="var(--green)" />
            <StatRow label="stopped" value={system.containers_stopped} color="var(--red)" />
            <StatRow label="images"  value={system.images} />
            <StatRow label="cpus"    value={system.cpus} />
            <StatRow label="ram"     value={`${system.memory_gb}G`} />
          </div>
        )}

        {/* Error badge */}
        {error && (
          <div style={{
            margin: '0 10px 10px',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--red-dim)',
            border: '1px solid rgba(240,62,62,0.2)',
            fontSize: 11,
            color: 'var(--red)',
            fontFamily: 'var(--mono)',
          }}>
            ⚠ {error}
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--text2)'
            }}>
              <div style={{
                animation: 'spin 0.8s linear infinite',
                border: '2px solid var(--border2)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                width: 32, height: 32,
                boxShadow: '0 0 12px var(--accent-glow)',
              }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>Connecting to Docker…</span>
            </div>
          </div>
        ) : (
          <div className="page-enter" key={tab} style={{ flex: 1 }}>
            {tab === 'dashboard'  && <Dashboard containers={containers} system={system} onNavigate={setTab} />}
            {tab === 'containers' && <Containers containers={containers} onRefresh={fetchSystem} />}
            {tab === 'logs'       && <Logs containers={containers} />}
            {tab === 'monitor'    && <Monitor containers={containers} />}
          </div>
        )}
      </main>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text2)' }}>
      <span>{label}</span>
      <span style={{ color: color || 'var(--text)', fontWeight: 700 }}>{value}</span>
    </div>
  )
}
