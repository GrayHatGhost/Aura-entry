'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: string
  content: string
  sender: 'visitor' | 'admin'
  created_at: string
}

interface ChatBoxProps {
  deviceId: string
  initialMessages?: Message[]
  onFirstMessage?: () => void
}

export default function ChatBox({ deviceId, initialMessages = [], onFirstMessage }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [focused, setFocused]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    if (!deviceId) return

    let stopped = false

    const syncMessages = async () => {
      try {
        const res = await fetch(`/api/visitor/messages?deviceId=${encodeURIComponent(deviceId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (!stopped && Array.isArray(data.messages)) {
          setMessages(data.messages)
        }
      } catch {
        // Ignore transient polling failures
      }
    }

    syncMessages()
    const interval = window.setInterval(syncMessages, 2500)

    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [deviceId])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const opt: Message = {
      id: `opt-${Date.now()}`,
      content: text,
      sender: 'visitor',
      created_at: new Date().toISOString(),
    }
    
    // Trigger callback if this is the first message ever sent in this session
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage()
    }

    setMessages(prev => [...prev, opt])
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, content: text }),
    })
    setSending(false)
  }

  const hasInput  = input.trim().length > 0
  const isExpanded = focused || hasInput

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        width: '100%', maxWidth: 490, margin: '0 auto',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', zIndex: 20,
      }}
    >
      {/* Messages */}
      {messages.length > 0 && (
        <div style={{
          maxHeight: '36vh', overflowY: 'auto',
          padding: '2px 2px 4px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <AnimatePresence>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'visitor' ? 'flex-end' : 'flex-start',
                }}
              >
                <div className={msg.sender === 'visitor' ? 'msg-visitor' : 'msg-admin'}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <motion.div
        animate={{
          height: isExpanded ? 110 : 50,
        }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '10px 14px',
          overflow: 'hidden',
          borderRadius: 20,
          background: focused
            ? 'rgba(11, 11, 20, 0.90)'
            : 'rgba(15, 15, 26, 0.80)',
          border: `1px solid ${focused ? 'rgba(124, 82, 220, 0.30)' : 'rgba(255,255,255,0.06)'}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: focused
            ? '0 0 0 3px rgba(124, 82, 220, 0.05), 0 4px 20px rgba(0,0,0,0.35)'
            : '0 2px 12px rgba(0,0,0,0.25)',
          transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease',
        }}
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="bir yanıt yaz…"
          style={{
            flex: 1, background: 'transparent', outline: 'none',
            resize: 'none', width: '100%', height: '100%',
            border: 'none', color: 'var(--text-primary)',
            caretColor: 'var(--accent)',
            fontSize: '0.87rem', letterSpacing: '0.012em',
            padding: '2px 2px', lineHeight: 1.58,
            fontFamily: 'inherit',
          }}
        />
        <motion.button
          onClick={send}
          disabled={sending || !hasInput}
          animate={{ opacity: hasInput ? 1 : 0.25, scale: hasInput ? 1 : 0.90 }}
          whileHover={hasInput ? { scale: 1.10 } : {}}
          whileTap={hasInput ? { scale: 0.92 } : {}}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 33, height: 33,
            borderRadius: '50%',
            border: `1px solid ${hasInput ? 'var(--accent-border)' : 'var(--border)'}`,
            background: hasInput ? 'var(--accent-muted)' : 'transparent',
            color: hasInput ? 'var(--accent-text)' : 'var(--text-tertiary)',
            cursor: hasInput ? 'pointer' : 'default',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 1,
            transition: 'background 0.14s, border-color 0.14s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
