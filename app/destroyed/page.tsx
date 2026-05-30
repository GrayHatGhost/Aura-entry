'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import StarField from '@/components/StarField'

export default function DestroyedPage() {
  const [text, setText] = useState('bu sayfa artık mevcut değil')

  useEffect(() => {
    fetch('/api/admin/content')
      .then(r => r.json())
      .then(d => {
        if (d.content?.destroyed_text) {
          setText(d.content.destroyed_text)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative',
    }}>
      <StarField />
      <div className="vignette" />

      <motion.div
        style={{
          position: 'relative', zIndex: 10,
          textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 20,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Subtle divider line above */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 48, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(124,82,220,0.25), transparent)',
          }}
        />

        <motion.span
          animate={{ opacity: [0.14, 0.20, 0.14] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '5.5rem',
            fontWeight: 200,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'var(--text-primary)',
            display: 'block',
          }}
        >
          404
        </motion.span>

        <p style={{
          margin: 0,
          fontSize: '0.64rem',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 400,
          opacity: 0.6,
        }}>
          {text}
        </p>

        {/* Subtle divider line below */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 48, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(124,82,220,0.25), transparent)',
          }}
        />
      </motion.div>
    </main>
  )
}
