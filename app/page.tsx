'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import AuraRing from '@/components/AuraRing'
import ChatBox from '@/components/ChatBox'
import StarField from '@/components/StarField'
import TypewriterText from '@/components/TypewriterText'
import type { ExperienceButton, ExperienceNode, ExperiencePayload } from '@/lib/experience'

function getDeviceId(model: string): string {
  const base = `${model}-${navigator.language}-${screen.width}x${screen.height}`
  let h = 0
  for (let i = 0; i < base.length; i++) { h = (h << 5) - h + base.charCodeAt(i); h |= 0 }
  return `dev_${Math.abs(h).toString(36)}`
}

function getDeviceModel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) { const m = ua.match(/iPhone OS (\d+)_/); return `iPhone (iOS ${m?.[1] ?? ''})` }
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) { const m = ua.match(/;\s([^;)]+)\sBuild/); return m ? m[1].trim() : 'Android Device' }
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'Unknown Device'
}

function getBrowser(): string {
  const ua = navigator.userAgent
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  if (/Edg\//.test(ua)) return 'Edge'
  return 'Other'
}

function getYouTubeId(url?: string) {
  if (!url) return null
  const m = url.match(/(?:v=|\/|youtu\.be\/)([0-9A-Za-z_-]{11})/)
  return m ? m[1] : null
}

function normalizeUrl(url: string | null) {
  if (!url) return null
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
}

function getChatNodeId(payload: ExperiencePayload | null) {
  if (!payload) return null
  return payload.nodes.find((node) => node.content_type === 'cheatbox')?.id ?? payload.settings.root_node_id
}

type PageStage = 'loading' | 'ring' | 'experience' | 'blocked'

interface Message {
  id: string
  content: string
  sender: 'visitor' | 'admin'
  created_at: string
}

interface TransitionState {
  button: ExperienceButton
}

export default function Home() {
  const router = useRouter()
  const [pageStage, setPageStage] = useState<PageStage>('loading')
  const [experience, setExperience] = useState<ExperiencePayload | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState('')
  const [typedNodeIds, setTypedNodeIds] = useState<string[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [ringExpanded, setRingExpanded] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const deviceIdRef = useRef('')
  const [existingMsgs, setExistingMsgs] = useState<Message[]>([])
  const [destroyed, setDestroyed] = useState(false)
  const [glitching, setGlitching] = useState(false)
  const [musicStarted, setMusicStarted] = useState(false)
  const [showEntryBtn, setShowEntryBtn] = useState(false)
  const [hasSentMessage, setHasSentMessage] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [activeTransition, setActiveTransition] = useState<TransitionState | null>(null)
  const [pendingBanButton, setPendingBanButton] = useState<ExperienceButton | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasFadedRef = useRef(false)
  const transitionFiredRef = useRef(false)

  useEffect(() => {
    async function init() {
      const model = getDeviceModel()
      const browser = getBrowser()
      const resolution = `${screen.width}x${screen.height}`
      const id = getDeviceId(model)
      setDeviceId(id)
      deviceIdRef.current = id
      const entryType = new URLSearchParams(window.location.search).get('ref') === 'qr' ? 'qr' : 'direct'

      let publicIp = null, city = 'Unknown', country = 'Unknown', isp = 'Unknown'
      try {
        const ipRes = await fetch('https://ipapi.co/json/')
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          publicIp = ipData.ip
          city = ipData.city || 'Unknown'
          country = ipData.country_name || 'Unknown'
          isp = ipData.org || 'Unknown'
        }
      } catch (e) {
        console.warn('IP fetch failed', e)
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
      const device_memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0
      const cpu_cores = navigator.hardwareConcurrency || 0

      let os_name = 'Unknown'
      const ua = navigator.userAgent
      if (/Windows NT 10.0/.test(ua)) os_name = 'Windows 10/11'
      else if (/Windows NT 6.3/.test(ua)) os_name = 'Windows 8.1'
      else if (/Windows NT 6.2/.test(ua)) os_name = 'Windows 8'
      else if (/Windows NT 6.1/.test(ua)) os_name = 'Windows 7'
      else if (/Mac OS X/.test(ua)) os_name = 'macOS'
      else if (/Android/.test(ua)) os_name = 'Android'
      else if (/iPhone|iPad|iPod/.test(ua)) os_name = 'iOS'
      else if (/Linux/.test(ua)) os_name = 'Linux'

      const [visitRes, experienceRes] = await Promise.all([
        fetch('/api/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: id,
            model,
            browser,
            resolution,
            entryType,
            publicIp,
            city,
            country,
            isp,
            timezone,
            os_name,
            device_memory,
            cpu_cores,
          }),
        }),
        fetch('/api/experience', { cache: 'no-store' }),
      ])

      const visitData = await visitRes.json()
      const experienceData = await experienceRes.json()
      setExperience(experienceData)

      const rootNodeId = experienceData?.settings?.root_node_id || experienceData?.nodes?.[0]?.id || ''
      setCurrentNodeId(rootNodeId)

      if (visitData.status === 'blocked') {
        setPageStage('blocked')
        return
      }

      if (visitData.isChatMode) {
        const chatNodeId = getChatNodeId(experienceData)
        const msgData = await (await fetch(`/api/visitor/messages?deviceId=${encodeURIComponent(id)}`, { cache: 'no-store' })).json()
        setExistingMsgs(msgData.messages || [])
        setCurrentNodeId(chatNodeId || rootNodeId)
        setRingExpanded(true)
        setTypedNodeIds(chatNodeId ? [chatNodeId] : [])
        setPageStage('experience')
        return
      }

      setPageStage('ring')
    }

    init()
  }, [])

  useEffect(() => {
    if (pageStage === 'ring') {
      const t = setTimeout(() => setShowEntryBtn(true), 1400)
      return () => clearTimeout(t)
    }

    setShowEntryBtn(false)
  }, [pageStage])

  const startExperience = useCallback(() => {
    setMusicStarted(true)
    setRingExpanded(true)
    setShowEntryBtn(false)
    setTimeout(() => setPageStage('experience'), 950)
  }, [])

  const currentNode = useMemo(
    () => experience?.nodes.find((node) => node.id === currentNodeId && node.is_active) ?? null,
    [experience, currentNodeId]
  )

  const currentButtons = useMemo(
    () =>
      (experience?.buttons ?? [])
        .filter((button) => button.node_id === currentNodeId && button.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [experience, currentNodeId]
  )

  const shouldTypewriteCurrentNode = !!(
    currentNode &&
    currentNode.content_type === 'text_buttons' &&
    currentNode.text_mode === 'typewriter' &&
    !typedNodeIds.includes(currentNode.id)
  )

  const markCurrentNodeTyped = useCallback(() => {
    if (!currentNodeId) return
    setTypedNodeIds((prev) => (prev.includes(currentNodeId) ? prev : [...prev, currentNodeId]))
  }, [currentNodeId])

  const openNode = useCallback((targetNodeId: string | null) => {
    if (!targetNodeId || targetNodeId === currentNodeId) return
    setHistory((prev) => (currentNodeId ? [...prev, currentNodeId] : prev))
    setCurrentNodeId(targetNodeId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentNodeId])

  const goBack = useCallback(() => {
    if (history.length === 0) return
    const prevNodeId = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))
    setCurrentNodeId(prevNodeId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [history])

  const triggerDestroySequence = useCallback(() => {
    setGlitching(true)
    setTimeout(() => {
      setDestroyed(true)
      router.push('/destroyed')
    }, 1800)
  }, [router])

  const executeBan = useCallback(async (button: ExperienceButton) => {
    try {
      await fetch('/api/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceIdRef.current,
          stage: currentNode?.slug || 'unknown',
          buttonLabel: button.label,
          banDurationSeconds: button.ban_duration_seconds,
        }),
      })
    } catch {
      // Ban request is best-effort before redirecting to the 404 flow.
    }

    triggerDestroySequence()
  }, [currentNode?.slug, triggerDestroySequence])

  const executeButtonAction = useCallback(async (button: ExperienceButton) => {
    if (button.button_type === 'open_node') {
      openNode(button.target_node_id)
      return
    }

    if (button.button_type === 'external_url') {
      const url = normalizeUrl(button.external_url)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      return
    }

    await executeBan(button)
  }, [executeBan, openNode])

  useEffect(() => {
    if (!activeTransition) return

    transitionFiredRef.current = false
    const duration = Math.max(0, activeTransition.button.transition_duration_ms)

    const finalize = () => {
      if (transitionFiredRef.current) return
      transitionFiredRef.current = true
      const button = activeTransition.button
      setActiveTransition(null)
      void executeButtonAction(button)
    }

    const timeout = window.setTimeout(finalize, duration)
    return () => window.clearTimeout(timeout)
  }, [activeTransition, executeButtonAction])

  const handleButtonClick = useCallback((button: ExperienceButton) => {
    if (button.button_type === 'ban') {
      setPendingBanButton(button)
      return
    }

    if (button.show_transition && button.transition_duration_ms > 0) {
      setActiveTransition({ button })
      return
    }

    void executeButtonAction(button)
  }, [executeButtonAction])

  const confirmBan = useCallback(() => {
    if (!pendingBanButton) return
    const button = pendingBanButton
    setPendingBanButton(null)

    if (button.show_transition && button.transition_duration_ms > 0) {
      setActiveTransition({ button })
      return
    }

    void executeBan(button)
  }, [executeBan, pendingBanButton])

  const ytId = getYouTubeId(experience?.settings.bg_music_url)
  const showMusicPlayer = !!ytId && pageStage !== 'blocked' && !hasSentMessage && existingMsgs.length === 0
  const showMusic = musicStarted && showMusicPlayer

  useEffect(() => {
    if (showMusicPlayer && !musicStarted) {
      const interval = setInterval(() => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'setVolume',
          args: [0],
        }), '*')
      }, 200)
      return () => clearInterval(interval)
    }
  }, [showMusicPlayer, musicStarted])

  useEffect(() => {
    if (showMusic && iframeRef.current && !isMuted) {
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({
        event: 'command',
        func: 'unMute',
        args: [],
      }), '*')

      if (hasFadedRef.current) {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'setVolume',
          args: [100],
        }), '*')
        return
      }

      let vol = 0
      const interval = setInterval(() => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'setVolume',
          args: [vol],
        }), '*')
        if (vol < 100) vol += 4
        else {
          hasFadedRef.current = true
          clearInterval(interval)
        }
      }, 300)

      return () => clearInterval(interval)
    }
  }, [showMusic, isMuted])

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({
      event: 'command',
      func: isMuted ? 'mute' : 'unMute',
      args: [],
    }), '*')
  }, [isMuted])

  const shouldShowRing = pageStage !== 'blocked'
  const showExperience = pageStage === 'experience' && currentNode
  const currentBanConfirmText =
    pendingBanButton?.confirm_text_override ||
    experience?.settings.ban_confirm_text ||
    'Bu buton ile sayfayı tamamen yok edersin ve geri dönüşü yoktur. Onaylıyor musun?'

  if (destroyed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}>
        <motion.span
          animate={{ opacity: [1, 0.3, 1, 0.08, 0], x: [0, -4, 3, -2, 0] }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
          style={{
            fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
            fontSize: '1.5rem', fontWeight: 200,
            color: 'var(--t2)', letterSpacing: '0.04em',
          }}
        >
          404
        </motion.span>
      </div>
    )
  }

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowX: 'hidden',
      overflowY: 'auto',
      paddingTop: ringExpanded ? '7vh' : 0,
      justifyContent: ringExpanded ? 'flex-start' : 'center',
      position: 'relative',
    }}>
      <StarField />

      <AnimatePresence>
        {glitching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}
          >
            <motion.div
              animate={{ y: ['-100%', '100%'] }}
              transition={{ duration: 1.1, ease: 'linear', repeat: 1 }}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '200%',
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(124,82,220,0.06) 2px, rgba(124,82,220,0.06) 4px)',
              }}
            />
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  x: [0, (i % 2 === 0 ? 1 : -1) * (8 + i * 4), 0, (i % 2 === 0 ? -1 : 1) * (4 + i * 2), 0],
                  opacity: [0, 0.5, 0, 0.7, 0],
                  scaleX: [1, 1.02, 1, 0.98, 1],
                }}
                transition={{ duration: 0.18 + i * 0.06, delay: i * 0.12, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  top: `${10 + i * 18}%`,
                  left: 0,
                  right: 0,
                  height: `${4 + i * 2}%`,
                  background: i % 3 === 0 ? 'rgba(124,82,220,0.12)' : i % 3 === 1 ? 'rgba(255,30,80,0.07)' : 'rgba(0,200,255,0.06)',
                  mixBlendMode: 'screen',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showMusicPlayer && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0.01, pointerEvents: 'none' }}>
          <iframe
            ref={iframeRef}
            width="100"
            height="100"
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&enablejsapi=1`}
            allow="autoplay"
            frameBorder="0"
          />
        </div>
      )}

      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 90, display: 'flex', gap: 16 }}>
        {showMusic && (
          <button onClick={() => setIsMuted((prev) => !prev)} className="minimal-icon-btn" title={isMuted ? 'Müziği Aç' : 'Müziği Kapat'}>
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            )}
          </button>
        )}
      </div>

      <div className="vignette" />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(ellipse 50% 38% at 50% 28%, rgba(124,82,220,0.04) 0%, transparent 100%)',
      }} />

      <AnimatePresence>
        {showExperience && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'fixed', top: 32, left: 0, right: 0, zIndex: 100,
              display: 'flex', justifyContent: 'space-between', padding: '0 40px',
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              <button onClick={goBack} className="nav-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Geri
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTransition && (
          <motion.div
            key="transition-overlay"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => {
              if (transitionFiredRef.current) return
              transitionFiredRef.current = true
              const button = activeTransition.button
              setActiveTransition(null)
              void executeButtonAction(button)
            }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'black', textAlign: 'center', padding: '0 24px',
              cursor: 'pointer',
            }}
          >
            <h1 className="transition-text" style={{
              margin: 0,
              fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              fontSize: 'clamp(1.8rem, 6vw, 3rem)', fontWeight: 200,
              color: 'var(--t0)', letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {activeTransition.button.transition_text}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        position: 'relative', zIndex: 10, width: '100%',
        maxWidth: 600, padding: '0 20px 72px', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
      }}>
        <AnimatePresence>
          {shouldShowRing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
            >
              <AuraRing isExpanded={ringExpanded} onClick={() => {}} />

              <AnimatePresence>
                {showEntryBtn && pageStage === 'ring' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0 } }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    style={{ position: 'absolute', top: 'calc(100% + 40px)' }}
                  >
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.6 }}>
                      <button className="premium-entry-btn" onClick={startExperience}>
                        {experience?.settings.entry_btn_label || 'Merak mı ediyorsun? İçeriye gir'}
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showExperience && (
            <motion.div
              key="sep"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: '100%', maxWidth: 200, height: 1, marginTop: 28,
                background: 'linear-gradient(90deg, transparent, rgba(124,82,220,0.18), transparent)',
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showExperience && currentNode && (
            <motion.div
              key={currentNode.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%', marginTop: 24, textAlign: 'center' }}
            >
              {currentNode.content_type === 'text_buttons' && (
                <>
                  {shouldTypewriteCurrentNode ? (
                    <TypewriterText
                      text={currentNode.text_content}
                      onComplete={markCurrentNodeTyped}
                      charDelayMs={experience?.settings.typewriter_char_delay_ms}
                      mobileAutoscroll={experience?.settings.mobile_autoscroll_enabled}
                    />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      {currentNode.text_content.split('\n\n').map((paragraph, i) => (
                        <p
                          key={i}
                          style={{
                            color: 'var(--t0)',
                            fontSize: '0.92rem',
                            fontWeight: 300,
                            lineHeight: 1.8,
                            letterSpacing: '0.02em',
                            marginBottom: '1.1rem',
                            whiteSpace: 'pre-line',
                            opacity: 0.84,
                          }}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {currentNode.content_type === 'cheatbox' && (
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 26,
                  marginTop: 24,
                  paddingBottom: 24,
                }}>
                  <ChatBox
                    deviceId={deviceId}
                    initialMessages={existingMsgs}
                    onFirstMessage={() => setHasSentMessage(true)}
                  />
                </div>
              )}

              {(!shouldTypewriteCurrentNode || currentNode.content_type === 'cheatbox') && currentButtons.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40, alignItems: 'center' }}
                >
                  {currentButtons.map((button) => (
                    <button
                      key={button.id}
                      className={`action-btn${button.button_type === 'ban' ? ' exit-btn' : ''}`}
                      onClick={() => handleButtonClick(button)}
                    >
                      {button.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {pageStage === 'blocked' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
          >
            <span style={{
              fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              fontSize: '5rem', fontWeight: 200,
              color: 'var(--t2)', letterSpacing: '-0.04em', lineHeight: 1, opacity: 0.45,
            }}>
              404
            </span>
            <p style={{
              color: 'var(--t2)', fontSize: '0.64rem',
              letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0, opacity: 0.65,
            }}>
              bu sayfa şu an mevcut değil
            </p>
          </motion.div>
        )}
      </div>

      {experience?.settings.footer_text && (
        <div style={{
          position: 'fixed', bottom: 16, left: 0, right: 0, textAlign: 'center', zIndex: 90,
          opacity: 0.5, fontSize: '0.75rem', fontWeight: 300, letterSpacing: '0.05em', color: 'var(--t0)', pointerEvents: 'none',
        }}>
          {experience.settings.footer_text}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .action-btn {
          width: 100%;
          max-width: 220px;
          padding: 14px 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: var(--t0);
          font-family: var(--font-outfit), 'Outfit', sans-serif;
          font-size: 0.85rem;
          font-weight: 300;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(4px);
        }
        .action-btn:hover {
          background: rgba(124, 82, 220, 0.1);
          border-color: rgba(124, 82, 220, 0.3);
          transform: translateY(-1px);
        }
        .action-btn.exit-btn {
          background: transparent;
          border-color: transparent;
          color: var(--t2);
          font-size: 0.78rem;
          opacity: 0.55;
          max-width: 180px;
          padding: 10px 20px;
        }
        .action-btn.exit-btn:hover {
          color: rgba(220, 80, 80, 0.85);
          opacity: 1;
          border-color: rgba(200, 60, 60, 0.15);
          background: rgba(200, 60, 60, 0.04);
          transform: translateY(0);
        }
        .nav-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          color: var(--t2);
          font-family: var(--font-outfit), 'Outfit', sans-serif;
          font-size: 0.75rem;
          font-weight: 300;
          letter-spacing: 0.04em;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(4px);
        }
        .nav-btn:hover {
          background: rgba(124, 82, 220, 0.1);
          border-color: rgba(124, 82, 220, 0.3);
          color: var(--t0);
        }
      ` }} />

      <AnimatePresence>
        {pendingBanButton && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(12px)',
              zIndex: 9999, padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              style={{
                background: 'rgba(20, 20, 30, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '30px 24px', borderRadius: 16,
                maxWidth: 400, width: '100%',
                display: 'flex', flexDirection: 'column', gap: 24,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
            >
              <p style={{ margin: 0, color: 'var(--t1)', fontSize: '0.9rem', lineHeight: 1.6, textAlign: 'center' }}>
                {currentBanConfirmText}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  className="action-btn"
                  style={{ background: 'transparent' }}
                  onClick={() => setPendingBanButton(null)}
                >
                  Vazgeç
                </button>
                <button
                  className="action-btn"
                  style={{ background: 'rgba(220, 40, 40, 0.2)', borderColor: 'rgba(220, 40, 40, 0.4)', color: '#ffaaaa' }}
                  onClick={confirmBan}
                >
                  Onayla
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
