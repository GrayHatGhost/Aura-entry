'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface TypewriterTextProps {
  text: string
  onComplete: () => void
  totalDurationSeconds?: number
  mobileAutoscroll?: boolean
}

function isMobile() {
  if (typeof window === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768
}

export default function TypewriterText({
  text,
  onComplete,
  totalDurationSeconds = 12,
  mobileAutoscroll = true,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const idxRef = useRef(0)
  const cbRef = useRef(onComplete)
  const containerRef = useRef<HTMLDivElement>(null)
  const targetScrollYRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const userInteractingRef = useRef(false)
  const resumeTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    cbRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!mobileAutoscroll || !isMobile() || !containerRef.current) return

    const cancelAnimation = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    const animateToTarget = () => {
      if (userInteractingRef.current) {
        rafRef.current = null
        return
      }

      const currentY = window.scrollY
      const targetY = targetScrollYRef.current
      const delta = targetY - currentY

      if (Math.abs(delta) < 0.6) {
        window.scrollTo({ top: targetY, behavior: 'auto' })
        rafRef.current = null
        return
      }

      window.scrollTo({
        top: currentY + delta * 0.08 + Math.sign(delta) * 0.35,
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
      if (!userInteractingRef.current && rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(animateToTarget)
      }
    }

    const resumeAutoScroll = () => {
      if (resumeTimeoutRef.current != null) {
        window.clearTimeout(resumeTimeoutRef.current)
      }

      resumeTimeoutRef.current = window.setTimeout(() => {
        userInteractingRef.current = false
        syncScroll()
      }, 240)
    }

    const handleUserInteractStart = () => {
      userInteractingRef.current = true
      cancelAnimation()
      if (resumeTimeoutRef.current != null) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
    }

    const handleUserInteractEnd = () => {
      resumeAutoScroll()
    }

    const observer = new ResizeObserver(() => {
      syncScroll()
    })

    observer.observe(containerRef.current)
    window.addEventListener('touchstart', handleUserInteractStart, { passive: true })
    window.addEventListener('touchmove', handleUserInteractStart, { passive: true })
    window.addEventListener('touchend', handleUserInteractEnd, { passive: true })
    window.addEventListener('pointerdown', handleUserInteractStart, { passive: true })
    window.addEventListener('pointerup', handleUserInteractEnd, { passive: true })
    window.addEventListener(
      'wheel',
      () => {
        handleUserInteractStart()
        handleUserInteractEnd()
      },
      { passive: true }
    )
    syncScroll()

    return () => {
      observer.disconnect()
      cancelAnimation()
      if (resumeTimeoutRef.current != null) {
        window.clearTimeout(resumeTimeoutRef.current)
      }
      window.removeEventListener('touchstart', handleUserInteractStart)
      window.removeEventListener('touchmove', handleUserInteractStart)
      window.removeEventListener('touchend', handleUserInteractEnd)
      window.removeEventListener('pointerdown', handleUserInteractStart)
      window.removeEventListener('pointerup', handleUserInteractEnd)
    }
  }, [mobileAutoscroll, text])

  useEffect(() => {
    idxRef.current = 0
    setDisplayed('')
    setDone(false)

    if (!text.length) {
      setDone(true)
      const doneTimeout = window.setTimeout(() => cbRef.current(), 120)
      return () => window.clearTimeout(doneTimeout)
    }

    const charDelayMs = Math.max(
      14,
      Math.round((Math.max(1, totalDurationSeconds) * 1000) / Math.max(1, text.length))
    )

    let timeoutId = 0

    const tick = () => {
      if (idxRef.current >= text.length) {
        setDone(true)
        timeoutId = window.setTimeout(() => cbRef.current(), 700)
        return
      }

      idxRef.current += 1
      setDisplayed(text.slice(0, idxRef.current))
      timeoutId = window.setTimeout(tick, charDelayMs)
    }

    timeoutId = window.setTimeout(tick, charDelayMs)

    return () => window.clearTimeout(timeoutId)
  }, [text, totalDurationSeconds])

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
            color: 'var(--t0)',
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
            background: 'var(--p)',
            opacity: 0.55,
            borderRadius: 1,
            verticalAlign: 'text-bottom',
          }}
        />
      )}
    </motion.div>
  )
}
