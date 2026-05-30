'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  onComplete: () => void
  charDelayMs?: number
  mobileAutoscroll?: boolean
}

function isMobile() {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768
}

export default function TypewriterText({
  text,
  onComplete,
  charDelayMs = 43,
  mobileAutoscroll = true,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idxRef = useRef(0)
  const cbRef  = useRef(onComplete)
  const containerRef = useRef<HTMLDivElement>(null)
  const targetScrollYRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => { cbRef.current = onComplete }, [onComplete])

  useEffect(() => {
    if (!mobileAutoscroll || !isMobile() || !containerRef.current) return

    const animateToTarget = () => {
      const currentY = window.scrollY
      const targetY = targetScrollYRef.current
      const delta = targetY - currentY

      if (Math.abs(delta) < 1) {
        window.scrollTo({ top: targetY, behavior: 'auto' })
        rafRef.current = null
        return
      }

      window.scrollTo({
        top: currentY + delta * 0.16,
        behavior: 'auto',
      })
      rafRef.current = window.requestAnimationFrame(animateToTarget)
    }

    const syncScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const viewportBottom = window.innerHeight - 24
      const overflow = rect.bottom - viewportBottom

      if (overflow <= 0) return

      targetScrollYRef.current = Math.max(window.scrollY, window.scrollY + overflow + 12)
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(animateToTarget)
      }
    }

    const observer = new ResizeObserver(() => {
      syncScroll()
    })

    observer.observe(containerRef.current)
    syncScroll()

    return () => {
      observer.disconnect()
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [mobileAutoscroll, text])

  useEffect(() => {
    idxRef.current = 0
    setDisplayed('')
    setDone(false)
    const iv = setInterval(() => {
      if (idxRef.current >= text.length) {
        clearInterval(iv)
        setDone(true)
        setTimeout(() => cbRef.current(), 700)
        return
      }
      setDisplayed(text.slice(0, idxRef.current + 1))
      idxRef.current++
    }, charDelayMs)
    return () => clearInterval(iv)
  }, [text, charDelayMs])

  return (
    <motion.div
      ref={containerRef}
      style={{ textAlign: 'center', padding: '0 8px', width: '100%' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      {displayed.split('\n\n').map((para, i) => (
        <p
          key={i}
          style={{
            color: 'var(--text-primary)',
            fontSize: '0.93rem',
            letterSpacing: '0.022em',
            fontWeight: 300,
            lineHeight: 1.78,
            whiteSpace: 'pre-line',
            marginBottom: '1.1rem',
            opacity: 0.84,
          }}
        >
          {para}
        </p>
      ))}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.88, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            display: 'inline-block',
            width: 2,
            height: '0.95em',
            background: 'var(--accent)',
            opacity: 0.55,
            borderRadius: 1,
            verticalAlign: 'text-bottom',
          }}
        />
      )}
    </motion.div>
  )
}
