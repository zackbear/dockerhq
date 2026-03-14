// Shared design primitives

export function Btn({ onClick, children, primary, danger, disabled, small, style = {} }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--sans)',
    transition: 'background 0.12s, box-shadow 0.12s, transform 0.08s',
    fontSize: small ? 11 : 12,
    padding: small ? '4px 10px' : '7px 14px',
    border: 'none',
  }

  const variant = primary
    ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 0 0 var(--accent-glow)' }
    : danger
    ? { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(240,62,62,0.25)' }
    : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variant, ...style }}
      onMouseEnter={e => {
        if (disabled) return
        if (primary) e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = primary ? '0 0 0 0 var(--accent-glow)' : 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {children}
    </button>
  )
}

export function Input({ placeholder, value, onChange, type = 'text', style = {}, autoFocus }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      autoFocus={autoFocus}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 11px',
        color: 'var(--text)',
        fontSize: 13,
        width: '100%',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        ...style,
      }}
    />
  )
}

export function Empty({ icon, children, sub }) {
  return (
    <div style={{
      padding: '48px 24px',
      textAlign: 'center',
      color: 'var(--text3)',
      border: '1px dashed var(--border2)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {icon && (
        <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      )}
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{children}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 5, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

export function Badge({ status }) {
  const colors = {
    running:    { bg: 'var(--green-dim)',  text: 'var(--green)',  dot: 'var(--green)',  pulse: true },
    exited:     { bg: 'var(--red-dim)',    text: 'var(--red)',    dot: 'var(--red)',    pulse: false },
    dead:       { bg: 'var(--red-dim)',    text: 'var(--red)',    dot: 'var(--red)',    pulse: false },
    paused:     { bg: 'var(--yellow-dim)', text: 'var(--yellow)', dot: 'var(--yellow)', pulse: false },
    restarting: { bg: 'var(--yellow-dim)', text: 'var(--yellow)', dot: 'var(--yellow)', pulse: true },
  }
  const c = colors[status] || { bg: 'var(--surface3)', text: 'var(--text3)', dot: 'var(--text3)', pulse: false }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
      background: c.bg, color: c.text,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0,
        animation: c.pulse ? 'pulse-dot 2s ease infinite' : 'none',
      }} />
      {status}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text)' }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 3, fontFamily: 'var(--mono)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
