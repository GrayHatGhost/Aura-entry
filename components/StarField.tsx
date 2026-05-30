'use client'

import { useEffect, useRef } from 'react'

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    type Star = {
      x: number; y: number; z: number;
      r: number; alpha: number; phase: number;
    }

    const stars: Star[] = []

    // Mouse tracking for parallax
    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function init() {
      stars.length = 0
      // Sayıyı biraz toparladım ki ekran tamamen boş kalmasın (çok azaltmıştım)
      const count = Math.min(Math.floor((canvas!.width * canvas!.height) / 9000), 250)
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          z: Math.random() * 2 + 0.1,
          r: Math.random() * 0.9 + 0.24, // Eskisine göre tam %20 küçültüldü
          alpha: Math.random() * 0.5 + 0.2, // Görünürlükleri tekrar sağlandı
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      let clientX, clientY;
      if (e.type === 'touchmove') {
        clientX = (e as TouchEvent).touches[0].clientX;
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      // Orijinal parallax hızının (0.03) tam yarısı (0.015)
      targetMouseX = (clientX - canvas!.width / 2) * 0.015;
      targetMouseY = (clientY - canvas!.height / 2) * 0.015;
    }

    let t = 0
    function draw() {
      t += 0.002 // Titreme/Flicker hızı

      mouseX += (targetMouseX - mouseX) * 0.04
      mouseY += (targetMouseY - mouseY) * 0.04

      // Temiz arka plan
      ctx.fillStyle = '#060609'
      ctx.fillRect(0, 0, canvas!.width, canvas!.height)

      for (const s of stars) {
        // Orijinal akış hızının (-0.15, -0.25) tam yarısı (-0.075, -0.125)
        const driftX = -0.075 * s.z
        const driftY = -0.125 * s.z

        s.x += driftX - (mouseX * 0.02 * s.z)
        s.y += driftY - (mouseY * 0.02 * s.z)

        if (s.x < -20) s.x = canvas!.width + 20
        if (s.x > canvas!.width + 20) s.x = -20
        if (s.y < -20) s.y = canvas!.height + 20
        if (s.y > canvas!.height + 20) s.y = -20

        const flicker = Math.sin(t * 1.5 + s.phase) * 0.2 + 0.8
        const currentAlpha = s.alpha * flicker
        const currentR = s.r * (s.z * 0.3 + 0.7) * flicker

        const hue = s.z > 1.5 ? '210, 205, 225' : s.z > 0.8 ? '170, 165, 185' : '100, 95, 115'

        ctx.globalAlpha = Math.max(0.05, Math.min(1, currentAlpha))

        ctx.beginPath()
        ctx.arc(s.x, s.y, currentR, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${hue})`
        ctx.fill()

        if (s.z > 1.8) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, currentR * 2.5, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, currentR * 2.5)
          grad.addColorStop(0, `rgba(${hue}, ${currentAlpha * 0.15})`)
          grad.addColorStop(1, `rgba(${hue}, 0)`)
          ctx.fillStyle = grad
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }

    resize(); init(); draw()
    const onResize = () => { resize(); init() }

    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', handleMouseMove as any)
    window.addEventListener('touchmove', handleMouseMove as any, { passive: true })

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', handleMouseMove as any)
      window.removeEventListener('touchmove', handleMouseMove as any)
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%', height: '100%',
          display: 'block',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 60% at 85% -10%, rgba(124, 82, 220, 0.02) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 50% 60% at -10% 110%, rgba(80, 50, 180, 0.02) 0%, transparent 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(6, 6, 9, 0.8) 100%)',
      }} />
    </div>
  )
}
