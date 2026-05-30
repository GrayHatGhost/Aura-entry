'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import StarField from '@/components/StarField'
import type { ExperienceButton, ExperienceButtonType, ExperienceNode, ExperiencePayload, ExperienceSettings } from '@/lib/experience'

interface Device {
  device_id: string
  model: string
  browser: string
  ip: string
  entry_type: string
  is_chat_mode: boolean
  is_blocked: boolean
  blocked_until: string | null
  ban_reason: string | null
  last_seen: string
  first_seen: string
  city: string
  country: string
  isp: string
  timezone: string
  os_name: string
  device_memory: number
  cpu_cores: number
}

interface Message {
  id: string
  content: string
  sender: 'visitor' | 'admin'
  created_at: string
}

interface DeviceEvent {
  id: string
  stage: string
  button_label: string
  ip: string
  created_at: string
}

interface Metrics {
  qr_count: number
  direct_count: number
  last_reset: string
}

type Tab = 'flow' | 'devices' | 'metrics'
type DetailTab = 'messages' | 'events'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'flow', label: 'Akış', icon: 'M4 6h16M4 12h10M4 18h7M18 9l3 3-3 3' },
  { id: 'devices', label: 'Cihazlar', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'metrics', label: 'Metrikler', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
]

function SvgIcon({ d, s = 14 }: { d: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('tr-TR')
}

function fmtTime(dt: string) {
  return new Date(dt).toLocaleTimeString('tr-TR')
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  isArea = false,
  desc = '',
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  isArea?: boolean
  desc?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="caps" style={{ display: 'block' }}>{label}</span>
      {desc && <p style={{ margin: 0, fontSize: '0.63rem', color: 'var(--t2)', lineHeight: 1.5 }}>{desc}</p>}
      {isArea ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="field"
          style={{ resize: 'vertical', lineHeight: 1.6 }}
          placeholder={placeholder}
        />
      ) : (
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="field" placeholder={placeholder} />
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="caps" style={{ display: 'block' }}>{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
  desc,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  desc?: string
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 14px',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r3)',
      background: 'rgba(255,255,255,0.018)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="caps" style={{ display: 'block' }}>{label}</span>
        {desc && <span style={{ fontSize: '0.63rem', color: 'var(--t2)' }}>{desc}</span>}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('flow')
  const [devices, setDevices] = useState<Device[]>([])
  const [selected, setSelected] = useState<Device | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('messages')
  const [messages, setMessages] = useState<Message[]>([])
  const [events, setEvents] = useState<DeviceEvent[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [experience, setExperience] = useState<ExperiencePayload | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [filterBlocked, setFilterBlocked] = useState<'all' | 'active' | 'blocked'>('all')
  const [replyInput, setReplyInput] = useState('')
  const [replying, setReplying] = useState(false)

  const selectedNode = useMemo(
    () => experience?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [experience, selectedNodeId]
  )

  const selectedNodeButtons = useMemo(
    () => (experience?.buttons ?? []).filter((button) => button.node_id === selectedNodeId).sort((a, b) => a.sort_order - b.sort_order),
    [experience, selectedNodeId]
  )

  const fetchDevices = useCallback(async () => {
    const r = await fetch('/api/admin/devices')
    if (r.status === 401) { router.push('/admin'); return }
    const d = await r.json()
    setDevices(d.devices ?? [])
  }, [router])

  const fetchMetrics = useCallback(async () => {
    const d = await (await fetch('/api/admin/metrics')).json()
    setMetrics(d.metrics)
  }, [])

  const fetchExperience = useCallback(async () => {
    const r = await fetch('/api/admin/experience', { cache: 'no-store' })
    if (r.status === 401) { router.push('/admin'); return }
    const d = await r.json()
    setExperience(d)
    if (!selectedNodeId && d?.nodes?.length) {
      setSelectedNodeId(d.settings?.root_node_id || d.nodes[0].id)
    }
  }, [router, selectedNodeId])

  useEffect(() => {
    void fetchDevices()
    void fetchMetrics()
    void fetchExperience()
  }, [fetchDevices, fetchMetrics, fetchExperience, refresh])

  useEffect(() => {
    if (!selected) return
    fetch(`/api/admin/messages?deviceId=${selected.device_id}`).then((r) => r.json()).then((d) => setMessages(d.messages ?? []))
    fetch(`/api/admin/events?deviceId=${selected.device_id}`).then((r) => r.json()).then((d) => setEvents(d.events ?? []))
  }, [selected, refresh])

  async function deleteDevice(id: string) {
    if (!confirm('Bu cihazın tüm geçmişi silinecek.')) return
    await fetch('/api/admin/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id }),
    })
    setSelected(null)
    setMessages([])
    setEvents([])
    setRefresh((v) => v + 1)
  }

  async function unblock(id: string) {
    await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id }),
    })
    setRefresh((v) => v + 1)
  }

  async function resetMetrics(field: string) {
    await fetch('/api/admin/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field }),
    })
    void fetchMetrics()
  }

  async function sendReply() {
    if (!selected || !replyInput.trim() || replying) return
    setReplying(true)
    const res = await fetch('/api/admin/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: selected.device_id, content: replyInput }),
    })
    if (res.ok) {
      setReplyInput('')
      const r = await fetch(`/api/admin/messages?deviceId=${selected.device_id}`)
      const d = await r.json()
      setMessages(d.messages ?? [])
    }
    setReplying(false)
  }

  function updateSettings(patch: Partial<ExperienceSettings>) {
    setExperience((prev) => prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev)
  }

  function updateNode(nodeId: string, patch: Partial<ExperienceNode>) {
    setExperience((prev) => prev ? {
      ...prev,
      nodes: prev.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node),
    } : prev)
  }

  function updateButton(buttonId: string, patch: Partial<ExperienceButton>) {
    setExperience((prev) => prev ? {
      ...prev,
      buttons: prev.buttons.map((button) => button.id === buttonId ? { ...button, ...patch } : button),
    } : prev)
  }

  function addNode() {
    if (!experience) return
    const nextIndex = experience.nodes.length + 1
    const id = crypto.randomUUID()
    const slugBase = `kapi-${nextIndex}`
    const node: ExperienceNode = {
      id,
      slug: slugBase,
      title: `Yeni Kapı ${nextIndex}`,
      content_type: 'text_buttons',
      text_content: '',
      text_mode: 'static',
      is_active: true,
      sort_order: experience.nodes.length,
    }
    setExperience({
      ...experience,
      nodes: [...experience.nodes, node],
    })
    setSelectedNodeId(id)
  }

  function removeNode(nodeId: string) {
    if (!experience || experience.nodes.length <= 1) return
    const remainingNodes = experience.nodes.filter((node) => node.id !== nodeId)
    const remainingButtons = experience.buttons.filter((button) => button.node_id !== nodeId && button.target_node_id !== nodeId)
    const nextRoot = experience.settings.root_node_id === nodeId ? remainingNodes[0]?.id || '' : experience.settings.root_node_id
    setExperience({
      settings: { ...experience.settings, root_node_id: nextRoot },
      nodes: remainingNodes.map((node, index) => ({ ...node, sort_order: index })),
      buttons: remainingButtons.map((button, index) => ({ ...button, sort_order: index })),
    })
    setSelectedNodeId(nextRoot)
  }

  function addButton(nodeId: string) {
    if (!experience) return
    const node = experience.nodes.find((item) => item.id === nodeId)
    const count = experience.buttons.filter((button) => button.node_id === nodeId).length + 1
    const button: ExperienceButton = {
      id: crypto.randomUUID(),
      node_id: nodeId,
      slug: `${slugify(node?.slug || 'button')}-btn-${count}`,
      label: `Yeni Buton ${count}`,
      button_type: 'open_node',
      target_node_id: experience.settings.root_node_id,
      external_url: null,
      show_transition: false,
      transition_text: '',
      transition_duration_ms: 0,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: count - 1,
    }
    setExperience({
      ...experience,
      buttons: [...experience.buttons, button],
    })
  }

  function removeButton(buttonId: string) {
    setExperience((prev) => prev ? {
      ...prev,
      buttons: prev.buttons.filter((button) => button.id !== buttonId),
    } : prev)
  }

  async function saveExperience() {
    if (!experience) return
    setSaving(true)
    const res = await fetch('/api/admin/experience', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experience),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('Kaydetme hatası: ' + (err.error || 'Bilinmeyen hata'))
    } else {
      alert('Akış başarıyla kaydedildi.')
      void fetchExperience()
    }
    setSaving(false)
  }

  const filteredDevices = devices.filter((device) => {
    if (filterBlocked === 'active') return !device.is_blocked
    if (filterBlocked === 'blocked') return device.is_blocked
    return true
  })

  const activeCount = devices.filter((device) => !device.is_blocked).length
  const blockedCount = devices.filter((device) => device.is_blocked).length
  const total = metrics ? metrics.qr_count + metrics.direct_count : 0

  return (
    <div className="admin-layout" style={{
      display: 'flex',
      minHeight: '100dvh',
      background: 'var(--bg)',
      fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      color: 'var(--t0)',
    }}>
      <StarField />
      <div className="vignette" />

      <aside className="sidebar">
        <div className="sidebar-header" style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--line-faint)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--p-line)', background: 'var(--p-glass)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--p-text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.77rem', fontWeight: 600, color: 'var(--t0)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>Aura</p>
              <p style={{ margin: '1px 0 0', fontSize: '0.50rem', color: 'var(--t3)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>Control Panel</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`nav-item${tab === item.id ? ' active' : ''}`}>
              <span className="nav-item-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SvgIcon d={item.icon} s={13} />
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: '10px 8px', borderTop: '1px solid var(--line-faint)', display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-icon" title="Yenile" onClick={() => setRefresh((value) => value + 1)} style={{ flex: 1, borderRadius: 'var(--r3)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button className="btn btn-danger" style={{ flex: 2, fontSize: '0.70rem', letterSpacing: '0.08em' }} onClick={async () => { await fetch('/api/admin/auth', { method: 'DELETE' }); router.push('/admin') }}>
            Çıkış
          </button>
        </div>
      </aside>

      <main className="admin-main" style={{ flex: 1, padding: '36px 40px', position: 'relative', zIndex: 10, minHeight: '100dvh' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid var(--line-faint)',
        }}>
          <div>
            <p className="caps" style={{ marginBottom: 7, display: 'block' }}>{TABS.find((item) => item.id === tab)?.label}</p>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 300, color: 'var(--t0)', letterSpacing: '-0.01em', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>
              {tab === 'flow' && 'Deneyim Mimarisi'}
              {tab === 'devices' && `${devices.length} Cihaz`}
              {tab === 'metrics' && `${total} Ziyaret`}
            </h1>
          </div>
          {tab === 'flow' && (
            <button className="btn btn-primary" onClick={saveExperience} disabled={saving || !experience}>
              {saving ? 'Kaydediliyor…' : 'Akışı Kaydet'}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'flow' && experience && (
            <motion.div key="flow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Giriş Butonu" value={experience.settings.entry_btn_label} onChange={(value) => updateSettings({ entry_btn_label: value })} placeholder="Merak mı ediyorsun? İçeriye gir" />
                <Field label="Arka Plan Müziği" value={experience.settings.bg_music_url} onChange={(value) => updateSettings({ bg_music_url: value })} placeholder="https://www.youtube.com/watch?v=..." />
                <Field label="Footer Yazısı" value={experience.settings.footer_text} onChange={(value) => updateSettings({ footer_text: value })} placeholder="Alt bilgi yazısı" />
                <Field label="Daktilo Hızı (ms)" value={experience.settings.typewriter_char_delay_ms} onChange={(value) => updateSettings({ typewriter_char_delay_ms: Number(value) || 43 })} placeholder="43" />
                <Field label="Global Ban Onay Metni" value={experience.settings.ban_confirm_text} onChange={(value) => updateSettings({ ban_confirm_text: value })} isArea />
                <Field label="Global Siyah Geçiş Metni" value={experience.settings.ban_pre_text} onChange={(value) => updateSettings({ ban_pre_text: value })} isArea />
                <ToggleField label="Mobil Otomatik Kaydırma" checked={experience.settings.mobile_autoscroll_enabled} onChange={(checked) => updateSettings({ mobile_autoscroll_enabled: checked })} desc="Daktilo metni mobilde uzadıkça premium ve akıcı şekilde aşağı kaydır." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'start' }}>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-faint)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="caps" style={{ display: 'block' }}>Kapılar</span>
                    <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={addNode}>Yeni Kapı</button>
                  </div>
                  <div style={{ maxHeight: 620, overflowY: 'auto' }}>
                    {experience.nodes.map((node) => {
                      const selectedState = node.id === selectedNodeId
                      return (
                        <button
                          key={node.id}
                          onClick={() => setSelectedNodeId(node.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            background: selectedState ? 'var(--p-glass)' : 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--line-faint)',
                            borderLeft: `2px solid ${selectedState ? 'var(--p)' : 'transparent'}`,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: '0.82rem', color: selectedState ? 'var(--p-text)' : 'var(--t0)' }}>{node.title}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {experience.settings.root_node_id === node.id && <span className="badge badge-p">root</span>}
                              <span className="badge badge-muted">{node.content_type === 'cheatbox' ? 'cheatbox' : 'yazi'}</span>
                            </div>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '0.6rem', color: 'var(--t2)' }}>{node.slug}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {!selectedNode ? (
                    <div style={{ textAlign: 'center', color: 'var(--t2)', padding: '64px 24px' }}>Düzenlemek için bir kapı seç.</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <p className="caps" style={{ display: 'block', marginBottom: 6 }}>Kapı Düzenleyici</p>
                          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 400 }}>{selectedNode.title}</h2>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-ghost" style={{ fontSize: '0.68rem' }} onClick={() => updateSettings({ root_node_id: selectedNode.id })}>
                            Root Yap
                          </button>
                          <button className="btn btn-danger" style={{ fontSize: '0.68rem' }} onClick={() => removeNode(selectedNode.id)}>
                            Sil
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Field label="Kapı Başlığı" value={selectedNode.title} onChange={(value) => updateNode(selectedNode.id, { title: value })} />
                        <Field label="Slug" value={selectedNode.slug} onChange={(value) => updateNode(selectedNode.id, { slug: slugify(value) || selectedNode.slug })} />
                        <SelectField
                          label="İçerik Tipi"
                          value={selectedNode.content_type}
                          onChange={(value) => updateNode(selectedNode.id, { content_type: value as ExperienceNode['content_type'] })}
                          options={[
                            { label: 'Yazı + Butonlar', value: 'text_buttons' },
                            { label: 'Cheatbox', value: 'cheatbox' },
                          ]}
                        />
                        <SelectField
                          label="Yazı Modu"
                          value={selectedNode.text_mode}
                          onChange={(value) => updateNode(selectedNode.id, { text_mode: value as ExperienceNode['text_mode'] })}
                          options={[
                            { label: 'Daktilo', value: 'typewriter' },
                            { label: 'Statik', value: 'static' },
                          ]}
                        />
                      </div>

                      <ToggleField label="Kapı Aktif" checked={selectedNode.is_active} onChange={(checked) => updateNode(selectedNode.id, { is_active: checked })} />

                      {selectedNode.content_type === 'text_buttons' && (
                        <Field label="Kapı Metni" value={selectedNode.text_content} onChange={(value) => updateNode(selectedNode.id, { text_content: value })} isArea desc="Daktilo veya statik gösterilecek ana içerik." />
                      )}

                      {selectedNode.content_type === 'cheatbox' && (
                        <div style={{ padding: '14px 16px', borderRadius: 'var(--r3)', border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', color: 'var(--t2)', fontSize: '0.78rem', lineHeight: 1.6 }}>
                          Bu kapı açıldığında mevcut cheatbox deneyimi ana içerik olarak gösterilir. İstersen altına yine yeni butonlar ekleyebilirsin.
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line-faint)' }}>
                        <span className="caps" style={{ display: 'block' }}>Alt Butonlar</span>
                        <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={() => addButton(selectedNode.id)}>Buton Ekle</button>
                      </div>

                      {selectedNodeButtons.length === 0 && (
                        <div style={{ color: 'var(--t2)', fontSize: '0.78rem' }}>Bu kapıda henüz buton yok.</div>
                      )}

                      {selectedNodeButtons.map((button, index) => (
                        <div key={button.id} className="card-sm" style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <p className="caps" style={{ display: 'block', marginBottom: 6 }}>Buton {index + 1}</p>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--t0)' }}>{button.label}</p>
                            </div>
                            <button className="btn btn-danger" style={{ fontSize: '0.68rem' }} onClick={() => removeButton(button.id)}>Sil</button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Field label="Buton Metni" value={button.label} onChange={(value) => updateButton(button.id, { label: value })} />
                            <Field label="Slug" value={button.slug} onChange={(value) => updateButton(button.id, { slug: slugify(value) || button.slug })} />
                            <SelectField
                              label="Buton Tipi"
                              value={button.button_type}
                              onChange={(value) => updateButton(button.id, {
                                button_type: value as ExperienceButtonType,
                                target_node_id: value === 'open_node' ? experience.settings.root_node_id : null,
                                external_url: value === 'external_url' ? 'https://' : null,
                              })}
                              options={[
                                { label: 'Kapı Aç', value: 'open_node' },
                                { label: 'Harici Bağlantı', value: 'external_url' },
                                { label: 'Ban', value: 'ban' },
                              ]}
                            />
                            <ToggleField label="Buton Aktif" checked={button.is_active} onChange={(checked) => updateButton(button.id, { is_active: checked })} />
                          </div>

                          {button.button_type === 'open_node' && (
                            <SelectField
                              label="Hedef Kapı"
                              value={button.target_node_id || ''}
                              onChange={(value) => updateButton(button.id, { target_node_id: value })}
                              options={experience.nodes.map((node) => ({ label: `${node.title} (${node.slug})`, value: node.id }))}
                            />
                          )}

                          {button.button_type === 'external_url' && (
                            <Field label="Harici URL" value={button.external_url || ''} onChange={(value) => updateButton(button.id, { external_url: value })} placeholder="https://instagram.com/..." />
                          )}

                          {button.button_type === 'ban' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <Field label="Ban Süresi (saniye)" value={button.ban_duration_seconds} onChange={(value) => updateButton(button.id, { ban_duration_seconds: Number(value) || 21600 })} />
                              <Field label="Özel Onay Metni" value={button.confirm_text_override || ''} onChange={(value) => updateButton(button.id, { confirm_text_override: value || null })} placeholder="Boşsa global metin kullanılır" />
                            </div>
                          )}

                          <ToggleField label="Siyah Geçiş Ekranı Kullan" checked={button.show_transition} onChange={(checked) => updateButton(button.id, { show_transition: checked })} />

                          {button.show_transition && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <Field label="Geçiş Metni" value={button.transition_text} onChange={(value) => updateButton(button.id, { transition_text: value })} isArea />
                              <Field label="Geçiş Süresi (ms)" value={button.transition_duration_ms} onChange={(value) => updateButton(button.id, { transition_duration_ms: Number(value) || 0 })} />
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'devices' && (
            <motion.div key="devices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line-faint)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {(['all', 'active', 'blocked'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFilterBlocked(filter)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.62rem',
                        border: '1px solid',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        letterSpacing: '0.05em',
                        background: filterBlocked === filter ? 'var(--p-glass)' : 'transparent',
                        borderColor: filterBlocked === filter ? 'var(--p-line)' : 'var(--line-faint)',
                        color: filterBlocked === filter ? 'var(--p-text)' : 'var(--t2)',
                      }}
                    >
                      {filter === 'all' ? `Tümü (${devices.length})` : filter === 'active' ? `Aktif (${activeCount})` : `Banlı (${blockedCount})`}
                    </button>
                  ))}
                </div>

                <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                  {filteredDevices.map((device) => {
                    const isSelected = selected?.device_id === device.device_id
                    return (
                      <button
                        key={device.device_id}
                        onClick={() => { setSelected(device); setDetailTab('messages') }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          border: 'none',
                          borderBottom: '1px solid var(--line-faint)',
                          borderLeft: `2px solid ${isSelected ? 'var(--p)' : device.is_blocked ? 'rgba(220,60,60,0.4)' : 'transparent'}`,
                          background: isSelected ? 'var(--p-glass)' : 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.83rem', fontWeight: 500, color: isSelected ? 'var(--p-text)' : 'var(--t0)' }}>{device.model}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {device.is_blocked && <span className="badge badge-red">banlı</span>}
                            {device.is_chat_mode && <span className="badge badge-p">sohbet</span>}
                          </div>
                        </div>
                        <p style={{ margin: '0 0 2px', fontSize: '0.72rem', color: 'var(--t1)', fontFamily: 'monospace' }}>{device.ip}</p>
                        <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--t2)' }}>{device.browser} · {device.entry_type === 'qr' ? 'QR' : 'Link'} · {fmt(device.last_seen)}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!selected ? (
                  <div style={{ padding: '88px 24px', textAlign: 'center', color: 'var(--t2)', fontSize: '0.8rem' }}>Sol listeden bir cihaz seç.</div>
                ) : (
                  <>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-faint)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{selected.model}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--t1)', fontFamily: 'monospace' }}>{selected.ip}</p>
                          <p style={{ margin: '3px 0 0', fontSize: '0.61rem', color: 'var(--t3)' }}>{selected.device_id}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {selected.is_blocked && <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={() => unblock(selected.device_id)}>Banı Kaldır</button>}
                          <button className="btn btn-danger" style={{ fontSize: '0.68rem' }} onClick={() => deleteDevice(selected.device_id)}>Sil</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 6, border: '1px solid var(--line-faint)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--t3)', textTransform: 'uppercase' }}>Konum</span>
                          <span style={{ fontSize: '0.70rem', color: 'var(--t1)' }}>{selected.city}, {selected.country}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--t3)', textTransform: 'uppercase' }}>Sağlayıcı</span>
                          <span style={{ fontSize: '0.70rem', color: 'var(--t1)' }}>{selected.isp}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--t3)', textTransform: 'uppercase' }}>Donanım</span>
                          <span style={{ fontSize: '0.70rem', color: 'var(--t1)' }}>{selected.device_memory} GB RAM, {selected.cpu_cores} Çekirdek</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                        {(['messages', 'events'] as DetailTab[]).map((item) => (
                          <button
                            key={item}
                            onClick={() => setDetailTab(item)}
                            style={{
                              padding: '5px 14px',
                              borderRadius: 12,
                              fontSize: '0.65rem',
                              border: '1px solid',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              background: detailTab === item ? 'var(--p-glass)' : 'transparent',
                              borderColor: detailTab === item ? 'var(--p-line)' : 'var(--line-faint)',
                              color: detailTab === item ? 'var(--p-text)' : 'var(--t2)',
                            }}
                          >
                            {item === 'messages' ? `Mesajlar (${messages.length})` : `Eylemler (${events.length})`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {detailTab === 'messages' && (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          {messages.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--t2)', fontSize: '0.78rem', marginTop: 40 }}>Mesaj yok</p>
                          ) : messages.map((msg) => (
                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'visitor' ? 'flex-start' : 'flex-end' }}>
                              <div className={msg.sender === 'admin' ? 'msg-out' : 'msg-in'}>
                                {msg.content}
                                <p style={{ margin: '3px 0 0', fontSize: '0.54rem', color: 'var(--t3)', opacity: 0.8 }}>{msg.sender === 'admin' ? 'sen' : 'ziyaretçi'} · {fmtTime(msg.created_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line-faint)', background: 'var(--bg-2)' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input value={replyInput} onChange={(e) => setReplyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Ziyaretçiye yanıt yaz..." className="field" style={{ flex: 1, background: 'var(--bg)', margin: 0 }} />
                            <button className="btn btn-primary" onClick={sendReply} disabled={replying || !replyInput.trim()} style={{ padding: '0 18px' }}>Gönder</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === 'events' && (
                      <div style={{ padding: '16px 20px', maxHeight: 420, overflowY: 'auto', flex: 1 }}>
                        {events.length === 0 ? (
                          <p style={{ textAlign: 'center', color: 'var(--t2)', fontSize: '0.78rem', marginTop: 40 }}>Kayıtlı eylem yok</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {events.map((event) => (
                              <div key={event.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line-faint)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--t0)', fontWeight: 500 }}>&quot;{event.button_label}&quot;</p>
                                  <p style={{ margin: '3px 0 0', fontSize: '0.62rem', color: 'var(--t2)' }}>{event.stage} · {event.ip}</p>
                                </div>
                                <span style={{ fontSize: '0.58rem', color: 'var(--t3)', whiteSpace: 'nowrap', marginLeft: 12 }}>{fmt(event.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {tab === 'metrics' && metrics && (
            <motion.div key="metrics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'QR Kod Taramaları', value: metrics.qr_count, field: 'qr_count' },
                  { label: 'Direkt Ziyaret', value: metrics.direct_count, field: 'direct_count' },
                ].map((metric) => {
                  const pct = Math.min(100, total > 0 ? (metric.value / total) * 100 : 0)
                  return (
                    <div key={metric.field} className="card" style={{ padding: '28px 28px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <p className="caps" style={{ margin: 0, display: 'block' }}>{metric.label}</p>
                        <span className="badge badge-muted">{pct.toFixed(0)}%</span>
                      </div>
                      <p style={{ margin: '0 0 20px', fontSize: '3.5rem', fontWeight: 200, lineHeight: 1, color: 'var(--t0)', letterSpacing: '-0.04em', fontFamily: "var(--font-outfit), 'Outfit', sans-serif" }}>{metric.value}</p>
                      <div className="prog-track" style={{ marginBottom: 22 }}>
                        <div className="prog-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <button className="btn btn-danger" onClick={() => resetMetrics(metric.field)} style={{ fontSize: '0.69rem' }}>Sıfırla</button>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--t3)' }}>{metrics.last_reset && `Son sıfırlama: ${fmt(metrics.last_reset)}`}</span>
                <button className="btn btn-danger" onClick={() => resetMetrics('both')} style={{ fontSize: '0.69rem' }}>Tümünü Sıfırla</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
