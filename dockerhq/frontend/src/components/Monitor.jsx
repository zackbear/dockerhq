import { useState, useEffect, useRef, useCallback } from 'react'
import { Btn, Input, Empty } from './ui.jsx'

export default function Monitor({ containers }) {
  const [targets, setTargets] = useState([])
  const [results, setResults] = useState({})
  const [checking, setChecking] = useState(false)
  const [form, setForm] = useState({ name: '', host: 'localhost', port: '', label: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [history, setHistory] = useState({})
  const initialLoadDone = useRef(false)
  const pendingCheck = useRef(null)

  useEffect(() => {
    fetch('/api/monitor/targets')
      .then(r => r.json())
      .then(data => {
        setTargets(data)
        initialLoadDone.current = true
      })
      .catch(() => { initialLoadDone.current = true })
  }, [])

  useEffect(() => {
    if (!initialLoadDone.current) return
    clearTimeout(pendingCheck.current)
    pendingCheck.current = setTimeout(() => {
      if (targets.length > 0) runCheck()
    }, 300)
    return () => clearTimeout(pendingCheck.current)
  }, [targets])

  useEffect(() => {
    const iv = setInterval(() => {
      if (targets.length > 0) runCheck()
    }, 30000)
    return () => clearInterval(iv)
  }, [])

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/monitor/results')
      if (!res.ok) return
      const data = await res.json()
      setResults(data)
      const now = Date.now()
      setHistory(prev => {
        const next = { ...prev }
        for (const [tid, r] of Object.entries(data)) {
          if (!next[tid]) next[tid] = []
          next[tid] = [...next[tid].slice(-29), { ts: now, status: r.status, latency: r.latency_ms }]
        }
        return next
      })
    } catch {
      // Network error — leave existing results intact
    } finally {
      setChecking(false)
    }
  }, [])

  const addTarget = async () => {
    if (!form.name || !form.host || !form.port) return
    try {
      const res = await fetch('/api/monitor/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      })
      if (res.ok) {
        const t = await res.json()
        setTargets(prev => [...prev, t])
        setForm({ name: '', host: 'localhost', port: '', label: '' })
        setShowAdd(false)
      } else {
        const err = await res.json()
        alert(`Error: ${err.detail || 'Could not add target'}`)
      }
    } catch {
      alert('Network error adding target')
    }
  }

  const removeTarget = async (id) => {
    const encoded = encodeURIComponent(id)
    await fetch(`/api/monitor/targets/${encoded}`, { method: 'DELETE' })
    setTargets(prev => prev.filter(t => t.id !== id))
  }

  const importContainers = async () => {
    const toAdd = []
    for (const c of containers) {
      for (const [, hostPorts] of Object.entries(c.ports || {})) {
        for (const hp of hostPorts) {
          const port = Number(hp)
          if (!targets.find(t => t.host === 'localhost' && t.port === port)) {
            toAdd.push({ name: c.name.replace(/^\//, ''), host: 'localhost', port, label: c.image })
          }
        }
      }
    }
    if (toAdd.length === 0) return

    const responses = await Promise.allSettled(
      toAdd.map(t => fetch('/api/monitor/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t),
      }).then(r => r.ok ? r.json() : null))
    )

    const added = responses
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)

    if (added.length > 0) {
      setTargets(prev => [...prev, ...added])
    }
  }

  const upCount = Object.values(results).filter(r => r.status === 'up').length
  const total = targets.length

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>Monitor</h1>
          {total > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
              <span style={{ color: upCount === total ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{upCount}/{total}</span> services reachable
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {containers.some(c => Object.keys(c.ports || {}).length > 0) && (
            <Btn onClick={importContainers}>↧ Import from containers</Btn>
          )}
          <Btn onClick={runCheck} disabled={checking}>{checking ? '…' : '↻'} Check now</Btn>
          <Btn primary onClick={() => setShowAdd(!showAdd)}>+ Add target</Btn>
        </div>
      </div>

      {showAdd && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 18,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 100px 1fr auto',
          gap: 10,
          alignItems: 'end',
        }}>
          <Input placeholder="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Input placeholder="Host" value={form.host} onChange={v => setForm(f => ({ ...f, host: v }))} />
          <Input placeholder="Port" value={form.port} onChange={v => setForm(f => ({ ...f, port: v }))} type="number" />
          <Input placeholder="Label (optional)" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn primary onClick={addTarget}>Add</Btn>
          </div>
        </div>
      )}

      {targets.length === 0 ? (
        <Empty icon="◉" sub="Add a target or import from running containers.">No targets configured.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {targets.map(t => (
            <MonitorCard
              key={t.id}
              target={t}
              result={results[t.id]}
              history={history[t.id] || []}
              onRemove={() => removeTarget(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MonitorCard({ target, result, history, onRemove }) {
  const isUp = result?.status === 'up'
  const color = !result ? 'var(--text3)' : isUp ? 'var(--green)' : 'var(--red)'
  const upChecks = history.filter(h => h.latency != null)
  const avgLatency = upChecks.length
    ? Math.round(upChecks.reduce((s, h) => s + h.latency, 0) / upChecks.length)
    : null
  const uptimePct = history.length
    ? Math.round((history.filter(h => h.status === 'up').length / history.length) * 100)
    : null

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${result ? (isUp ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'var(--border)'}`,
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, animation: isUp ? 'pulse-dot 2s ease infinite' : 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{target.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {target.host}:{target.port}
          {target.label && <span style={{ color: 'var(--text3)', marginLeft: 8 }}>{target.label}</span>}
        </div>
      </div>

      {history.length > 0 && (
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24, flexShrink: 0 }}>
          {[...Array(30)].map((_, i) => {
            const h = history[i]
            const barColor = !h ? 'var(--border)' : h.status === 'up' ? 'var(--green)' : 'var(--red)'
            return (
              <div key={i} style={{ width: 4, height: h ? (h.latency ? Math.min(24, Math.max(6, h.latency / 5)) : 12) : 4, background: barColor, borderRadius: 1, opacity: h ? 1 : 0.2 }}
                title={h ? `${h.status}${h.latency ? ` ${h.latency}ms` : ''}` : ''} />
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
        {result ? (
          <>
            <div style={{ color, fontWeight: 700, fontSize: 13 }}>{isUp ? 'UP' : 'DOWN'}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)', marginTop: 2 }}>
              {result.latency_ms != null ? `${result.latency_ms}ms` : '—'}
              {avgLatency != null && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>avg {avgLatency}ms</span>}
            </div>
            {uptimePct != null && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{uptimePct}% uptime</div>}
          </>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Pending...</div>
        )}
      </div>

      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }} title="Remove">✕</button>
    </div>
  )
}
