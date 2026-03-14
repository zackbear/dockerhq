import { useState } from 'react'
import { Badge, PageHeader, Btn } from './ui.jsx'

export default function Containers({ containers, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState({})

  const filtered = containers.filter(c => {
    const matchStatus = filter === 'all' || (filter === 'running' ? c.status === 'running' : c.status !== 'running')
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.image.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const act = async (id, action) => {
    setActing(prev => ({ ...prev, [id]: action }))
    try {
      await fetch(`/api/containers/${id}/${action}`, { method: 'POST' })
      await onRefresh()
    } finally {
      setActing(prev => ({ ...prev, [id]: null }))
    }
  }

  const runningCount = containers.filter(c => c.status === 'running').length
  const stoppedCount = containers.length - runningCount

  return (
    <div style={{ padding: '28px 32px' }}>
      <PageHeader
        title="Containers"
        subtitle={`${containers.length} total`}
        actions={
          <Btn onClick={onRefresh}>↻ Refresh</Btn>
        }
      />

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        {[
          { key: 'all',     label: `All (${containers.length})` },
          { key: 'running', label: `Running (${runningCount})` },
          { key: 'stopped', label: `Stopped (${stoppedCount})` },
        ].map(f => (
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <input
            placeholder="Search containers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              width: 210,
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Image', 'Status', 'Ports', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '9px 16px',
                  textAlign: 'left',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--mono)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  No containers match your filter
                </td>
              </tr>
            ) : filtered.map((c, i) => (
              <tr
                key={c.id}
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name.replace(/^\//, '')}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{c.id}</div>
                </td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', maxWidth: 220 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.image.length > 42 ? c.image.slice(0, 40) + '…' : c.image}
                  </div>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <Badge status={c.status} />
                </td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                  {Object.entries(c.ports || {}).slice(0, 3).map(([k, v]) => (
                    <div key={k} style={{ color: 'var(--accent)', marginBottom: 2 }}>{v.join(',')}→{k}</div>
                  ))}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {c.status !== 'running' && (
                      <IconBtn onClick={() => act(c.id, 'start')} loading={acting[c.id] === 'start'} color="var(--green)" title="Start">▶</IconBtn>
                    )}
                    {c.status === 'running' && (
                      <IconBtn onClick={() => act(c.id, 'stop')} loading={acting[c.id] === 'stop'} color="var(--red)" title="Stop">■</IconBtn>
                    )}
                    <IconBtn onClick={() => act(c.id, 'restart')} loading={acting[c.id] === 'restart'} title="Restart">↺</IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text2)',
        border: `1px solid ${active ? 'rgba(64,128,255,0.3)' : 'var(--border)'}`,
        borderRadius: 99,
        padding: '5px 13px',
        fontSize: 12,
        fontWeight: active ? 700 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s',
        fontFamily: 'var(--mono)',
      }}
    >
      {children}
    </button>
  )
}

function IconBtn({ onClick, children, loading, color, title }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      style={{
        background: 'var(--surface3)',
        border: '1px solid var(--border)',
        color: loading ? 'var(--text3)' : (color || 'var(--text2)'),
        width: 30, height: 30,
        borderRadius: 'var(--radius-sm)',
        fontSize: 12,
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s, border-color 0.1s, transform 0.08s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor = color || 'var(--border3)'; e.currentTarget.style.transform = 'scale(1.08)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'scale(1)' }}
    >
      {loading ? <span style={{ animation: 'spin 0.8s linear infinite', display: 'block', width: 10, height: 10, border: '1.5px solid var(--text3)', borderTopColor: 'var(--text)', borderRadius: '50%' }} /> : children}
    </button>
  )
}
