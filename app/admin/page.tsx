'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import StarField from '@/components/StarField'

export default function AdminLogin() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [focused, setFocused]   = useState(false)
  const [showPw, setShowPw]     = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setLoading(true); setError('')
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push('/admin/dashboard') }
    else { setError('yanlış şifre'); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'grid',
      gridTemplateColumns: '420px 1fr',
      background: 'var(--bg)',
      fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      position: 'relative',
    }}>
      <StarField />

      {/* ── Left panel — identity ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '52px 52px 48px',
          borderRight: '1px solid var(--line-faint)',
          background: 'rgba(9,9,15,0.70)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* Top — wordmark */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid var(--p-line)',
              background: 'var(--p-glass)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--p-text)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span style={{
              fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              fontSize: '0.88rem', fontWeight: 500,
              color: 'var(--t0)', letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              Aura
            </span>
          </div>

          {/* Large heading */}
          <div>
            <p style={{ margin: '0 0 14px', color: 'var(--t2)', fontSize: '0.60rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
              Yönetim Paneli
            </p>
            <h1 style={{
              margin: 0,
              fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              fontSize: '2.65rem', fontWeight: 200,
              color: 'var(--t0)', letterSpacing: '-0.02em',
              lineHeight: 1.16,
            }}>
              Ana Üs
            </h1>
            {/* Accent line */}
            <div style={{
              marginTop: 20,
              width: 36, height: 1,
              background: 'linear-gradient(90deg, var(--p), transparent)',
              opacity: 0.55,
            }} />
          </div>
        </div>

        {/* Bottom — status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--ok-text)', opacity: 0.7,
          }} />
          <span style={{ fontSize: '0.62rem', color: 'var(--t2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Sistem Aktif
          </span>
        </div>
      </motion.div>

      {/* ── Right panel — form ── */}
      <motion.div
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.72, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '48px 64px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Form heading */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{
              margin: 0,
              fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              fontSize: '1.35rem', fontWeight: 300,
              color: 'var(--t0)', letterSpacing: '0.01em',
            }}>
              Giriş Yap
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--t2)', letterSpacing: '0.02em' }}>
              Erişim için şifreni gir
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Password field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label className="caps" style={{ display: 'block' }}>Şifre</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 14px',
                    background: 'rgba(255,255,255,0.018)',
                    border: `1px solid ${error ? 'var(--red-line)' : focused ? 'var(--p-line)' : 'var(--line)'}`,
                    borderRadius: 'var(--r3)',
                    color: 'var(--t0)',
                    fontSize: '0.88rem',
                    letterSpacing: password && !showPw ? '0.20em' : '0.01em',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxShadow: focused ? '0 0 0 3px rgba(124,82,220,0.07)' : 'none',
                    transition: 'border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease',
                  }}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t2)', padding: 4,
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.14s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--t2)')}
                >
                  {showPw ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  margin: 0, fontSize: '0.70rem',
                  color: 'var(--red-text)', letterSpacing: '0.04em',
                }}
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                marginTop: 6,
                width: '100%', padding: '12px 16px',
                borderRadius: 'var(--r3)',
                background: password ? 'var(--p-glass)' : 'transparent',
                border: `1px solid ${password ? 'var(--p-line)' : 'var(--line)'}`,
                color: password ? 'var(--p-text)' : 'var(--t2)',
                fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.14em',
                textTransform: 'uppercase', cursor: password ? 'pointer' : 'default',
                fontFamily: 'inherit',
                transition: 'background 0.14s ease, border-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease, transform 0.1s ease',
                opacity: loading ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (!password) return
                e.currentTarget.style.background = 'var(--p-glass2)'
                e.currentTarget.style.borderColor = 'var(--line-hl2)'
                e.currentTarget.style.color = 'rgba(205,188,255,0.98)'
                e.currentTarget.style.boxShadow = '0 0 22px rgba(124,82,220,0.08)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = password ? 'var(--p-glass)' : 'transparent'
                e.currentTarget.style.borderColor = password ? 'var(--p-line)' : 'var(--line)'
                e.currentTarget.style.color = password ? 'var(--p-text)' : 'var(--t2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {loading ? '…' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
