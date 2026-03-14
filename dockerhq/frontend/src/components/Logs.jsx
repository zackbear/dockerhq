import { useState, useEffect, useRef, useCallback } from 'react'
import { PageHeader, Btn } from './ui.jsx'

const getLineColor = (text) => {
  const lower = text.toLowerCase()
  if (lower.includes('error') || lower.includes('fatal') || lower.includes('err ')) return '#f03e3e'
  if (lower.includes('warn')) return '#f59e0b'
  if (lower.includes('info') || lower.includes('started') || lower.includes('ready') || lower.includes('listening')) return '#1db954'
  return '#6b7d99'
}

export default function Logs({ containers }) {
  const [selectedId, setSelectedId] = useState('')
  const [logs, setLogs] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!selectedId) return
    fetchLogs(selectedId)
    return () => stopStream()
  }, [selectedId])

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const fetchLogs = async (id) => {
    stopStream()
    setLogs([])
    try {
      const res = await fetch(`/api/containers/${id}/logs?tail=300`)
      if (!res.ok) { setLogs([{ id: 0, text: `Server error ${res.status}`, level: 'error' }]); return }
      const data = await res.json()
      const lines = data.logs.split('\n').filter(Boolean).map((l, i) => ({ id: i, text: l }))
      setLogs(lines)
    } catch (e) {
      setLogs([{ id: 0, text: `Error: ${e.message}`, level: 'error' }])
    }
  }

  const startStream = () => {
    if (!selectedId || wsRef.current) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/api/containers/${selectedId}/logs/stream`)
    wsRef.current = ws
    setStreaming(true)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.ping) return
        if (data.error) { setLogs(prev => [...prev, { id: Date.now(), text: `[error] ${data.error}` }]); return }
        if (data.line) setLogs(prev => [...prev.slice(-1000), { id: Date.now() + Math.random(), text: data.line }])
      } catch { /* malformed — skip */ }
    }
    ws.onclose = () => { setStreaming(false); wsRef.current = null }
    ws.onerror = () => { setStreaming(false); wsRef.current = null }
  }

  const stopStream = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    setStreaming(false)
  }, [])

  const filteredLogs = search
    ? logs.filter(l => l.text.toLowerCase().includes(search.toLowerCase()))
    : logs

  const selectedContainer = containers.find(c => c.id === selectedId)

  return (
    <div style={{ padding: '28px 32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PageHeader
        title="Logs"
        subtitle={selectedContainer ? selectedContainer.name.replace(/^\//, '') : 'Select a container'}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Search */}
            <input
              placeholder="Filter output..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 11px',
                color: 'var(--text)',
                fontSize: 11,
                fontFamily: 'var(--mono)',
                outline: 'none',
                width: 160,
                transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
            />

            {/* Container picker */}
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                color: selectedId ? 'var(--text)' : 'var(--text2)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 11px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 200,
              }}
            >
              <option value="">Select container…</option>
              {containers.map(c => (
                <option key={c.id} value={c.id}>{c.name.replace(/^\//, '')} ({c.status})</option>
              ))}
            </select>

            {selectedId && !streaming && <Btn onClick={startStream} style={{ color: 'var(--green)', borderColor: 'rgba(29,185,84,0.3)' }}>⦿ Stream</Btn>}
            {streaming && <Btn onClick={stopStream} danger>■ Stop</Btn>}
            <Btn onClick={() => setLogs([])}>Clear</Btn>
            <Btn onClick={() => setAutoScroll(a => !a)} style={autoScroll ? { color: 'var(--accent)', borderColor: 'rgba(64,128,255,0.3)' } : {}}>
              ↓ {autoScroll ? 'Auto' : 'Manual'}
            </Btn>
          </div>
        }
      />

      {/* Terminal window */}
      <div style={{
        flex: 1,
        background: '#060810',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'auto',
        padding: '14px 18px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        lineHeight: 1.75,
        minHeight: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
        {/* Terminal chrome */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #0e1321' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3d4455' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3d4455' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3d4455' }} />
          {selectedContainer && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#3d4455' }}>
              {selectedContainer.name.replace(/^\//, '')} — logs
            </span>
          )}
        </div>

        {!selectedId ? (
          <div style={{ color: '#2d3a52', padding: '20px 0' }}>
            <span style={{ color: '#3d4455' }}>$ </span>select a container to view logs
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ color: '#2d3a52' }}>
            <span style={{ color: '#3d4455' }}>$ </span>no output
          </div>
        ) : (
          filteredLogs.map((line) => {
            const color = getLineColor(line.text)
            const match = line.text.match(/^(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\s(.*)/)
            return (
              <div key={line.id} style={{ display: 'flex', gap: 14, paddingBottom: 1 }}>
                {match ? (
                  <>
                    <span style={{ color: '#2a3a50', flexShrink: 0, fontSize: 11, userSelect: 'none', minWidth: 65 }}>
                      {match[1].split('T')[1]?.slice(0, 8)}
                    </span>
                    <span style={{ color, wordBreak: 'break-all' }}>{match[2]}</span>
                  </>
                ) : (
                  <span style={{ color, wordBreak: 'break-all' }}>{line.text}</span>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginTop: 8,
        fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)',
        padding: '0 2px',
      }}>
        <span>{filteredLogs.length} lines{search && ` / ${logs.length} total`}</span>
        {streaming && (
          <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ animation: 'pulse-dot 1s ease infinite', display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 5px var(--green)' }} />
            live
          </span>
        )}
        {search && <span style={{ color: 'var(--yellow)' }}>filtered: "{search}"</span>}
      </div>
    </div>
  )
}
