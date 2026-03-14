import { useState, useEffect } from 'react'
import { Btn, Input, Empty, Badge, PageHeader } from './ui.jsx'

export default function Dashboard({ containers, system, onNavigate }) {
  const [services, setServices] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', icon: '🔗', description: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(setServices).catch(() => {})
  }, [])

  const addService = async () => {
    if (!form.name || !form.url) return
    setAdding(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const s = await res.json()
        setServices(prev => [...prev, s])
        setForm({ name: '', url: '', icon: '🔗', description: '' })
        setShowAdd(false)
      } else {
        const err = await res.json()
        alert(err.detail || 'Could not add service')
      }
    } finally {
      setAdding(false)
    }
  }

  const removeService = async (id) => {
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const running = containers.filter(c => c.status === 'running')

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <PageHeader
        title="Overview"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      />

      {/* Stat cards */}
      {system && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
          <StatCard
            label="Running" value={system.containers_running}
            accent="var(--green)" icon="▶"
            onClick={() => onNavigate('containers')}
          />
          <StatCard
            label="Stopped" value={system.containers_stopped}
            accent="var(--red)" icon="■"
            onClick={() => onNavigate('containers')}
          />
          <StatCard label="Images" value={system.images} icon="◧" />
          <StatCard label="Host RAM" value={`${system.memory_gb}G`} icon="▤" />
        </div>
      )}

      {/* Active containers */}
      <Section
        title="Active Containers"
        count={running.length}
        action={running.length > 0 && <NavBtn onClick={() => onNavigate('containers')}>View all →</NavBtn>}
      >
        {running.length === 0 ? (
          <Empty icon="▣" sub="Start a container to see it here.">No containers running</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {running.slice(0, 8).map(c => <ContainerCard key={c.id} container={c} />)}
          </div>
        )}
      </Section>

      {/* Services */}
      <Section
        title="Services"
        count={services.length}
        action={
          <Btn small onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '✕ Cancel' : '+ Add'}
          </Btn>
        }
      >
        {showAdd && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-lg)',
            padding: 18,
            marginBottom: 14,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 72px', gap: 10, marginBottom: 10 }}>
              <Input placeholder="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} autoFocus />
              <Input placeholder="URL (https://...)" value={form.url} onChange={v => setForm(f => ({ ...f, url: v }))} />
              <Input placeholder="Icon" value={form.icon} onChange={v => setForm(f => ({ ...f, icon: v }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input placeholder="Description (optional)" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
              </div>
              <Btn primary onClick={addService} disabled={adding || !form.name || !form.url}>
                {adding ? '…' : 'Add service'}
              </Btn>
            </div>
          </div>
        )}

        {services.length === 0 && !showAdd ? (
          <Empty icon="🔗" sub="Click '+ Add' to create your launch panel.">No services added yet</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {services.map(s => <ServiceCard key={s.id} service={s} onRemove={removeService} />)}
          </div>
        )}
      </Section>
    </div>
  )
}

function StatCard({ label, value, accent, icon, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${accent || 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => {
        if (!onClick) return
        e.currentTarget.style.borderColor = accent || 'var(--border2)'
        e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span style={{ color: accent || 'var(--text3)', fontSize: 10 }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent || 'var(--text)', fontFamily: 'var(--mono)', letterSpacing: '-1px' }}>
        {value}
      </div>
    </div>
  )
}

function ContainerCard({ container }) {
  const portEntries = Object.entries(container.ports || {})
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '12px 14px',
      transition: 'border-color 0.12s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: 'var(--green)',
          animation: 'pulse-dot 2s ease infinite',
          boxShadow: '0 0 6px var(--green)',
        }} />
        <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {container.name.replace(/^\//, '')}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', marginBottom: portEntries.length > 0 ? 5 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {container.image}
      </div>
      {portEntries.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 4 }}>
          {portEntries.slice(0, 2).map(([k, v]) => `${v.join(',')}→${k}`).join('  ')}
        </div>
      )}
    </div>
  )
}

function ServiceCard({ service, onRemove }) {
  return (
    <div style={{ position: 'relative' }}>
      <a
        href={service.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px',
          textDecoration: 'none',
          color: 'inherit',
          transition: 'border-color 0.12s, box-shadow 0.12s, transform 0.1s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 8, lineHeight: 1 }}>{service.icon}</div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{service.name}</div>
        {service.description && (
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>{service.description}</div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 7, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {service.url}
        </div>
      </a>
      <button
        onClick={() => onRemove(service.id)}
        title="Remove service"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: 'var(--text3)', cursor: 'pointer',
          width: 22, height: 22, borderRadius: 4,
          fontSize: 12, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.1s, border-color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >✕</button>
    </div>
  )
}

function Section({ title, count, action, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {title}
          </h2>
          {count != null && count > 0 && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
              color: 'var(--text3)', background: 'var(--surface2)',
              padding: '1px 6px', borderRadius: 99,
              border: '1px solid var(--border)',
            }}>{count}</span>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function NavBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--mono)', padding: 0 }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  )
}
