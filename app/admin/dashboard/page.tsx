'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

import StarField from '@/components/StarField'
import type {
  ExperienceButton,
  ExperienceButtonType,
  ExperienceContentType,
  ExperienceNode,
  ExperiencePayload,
  ExperienceSettings,
  ExperienceTextMode,
} from '@/lib/experience'

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
  event_type: string
  stage: string
  node_id: string | null
  node_slug: string | null
  node_title: string | null
  button_id: string | null
  button_slug: string | null
  button_label: string
  button_type: string | null
  target_node_id: string | null
  target_node_slug: string | null
  target_node_title: string | null
  transition_used: boolean
  transition_text: string
  transition_duration_seconds: number
  metadata: Record<string, unknown> | null
  ip: string
  created_at: string
}

interface Metrics {
  qr_count: number
  direct_count: number
  last_reset: string | null
}

type Tab = 'flow' | 'devices' | 'metrics'
type DetailTab = 'messages' | 'events'
type ApiError = { error?: string; details?: unknown }

const TABS: { id: Tab; label: string; icon: string }[] = [
  {
    id: 'flow',
    label: 'Akış',
    icon: 'M4 6h16M4 12h10M4 18h7M18 9l3 3-3 3',
  },
  {
    id: 'devices',
    label: 'Cihazlar',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    id: 'metrics',
    label: 'Metrikler',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
]

function SvgIcon({ d, s = 14 }: { d: string; s?: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

function fmt(dt: string | null | undefined) {
  if (!dt) return '-'

  const date = new Date(dt)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR')
}

function fmtTime(dt: string | null | undefined) {
  if (!dt) return '-'

  const date = new Date(dt)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleTimeString('tr-TR')
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

function uniqueSlug(base: string, existingSlugs: string[]) {
  const cleanBase = slugify(base) || 'item'
  const existing = new Set(existingSlugs)

  if (!existing.has(cleanBase)) return cleanBase

  for (let index = 2; index < 9999; index += 1) {
    const candidate = `${cleanBase}-${index}`

    if (!existing.has(candidate)) return candidate
  }

  return `${cleanBase}-${crypto.randomUUID().slice(0, 8)}`
}

function getApiErrorMessage(payload: unknown, fallback = 'Bilinmeyen hata') {
  if (!payload || typeof payload !== 'object') return fallback

  const error = (payload as ApiError).error

  return typeof error === 'string' && error.trim() ? error : fallback
}

function toSafeNumber(value: string, fallback: number, min = 0) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) return fallback

  return Math.max(min, Math.round(parsed))
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function reindexNodes(nodes: ExperienceNode[]) {
  return nodes.map((node, index) => ({
    ...node,
    sort_order: index,
  }))
}

function reindexButtonsByNode(buttons: ExperienceButton[]) {
  const groups = new Map<string, ExperienceButton[]>()

  for (const button of buttons) {
    const group = groups.get(button.node_id) ?? []
    group.push(button)
    groups.set(button.node_id, group)
  }

  const result: ExperienceButton[] = []

  for (const group of groups.values()) {
    result.push(
      ...group
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((button, index) => ({
          ...button,
          sort_order: index,
        }))
    )
  }

  return result
}

function normalizeButtonForSave(button: ExperienceButton): ExperienceButton {
  const buttonType = button.button_type
  const showTransition = Boolean(button.show_transition)

  return {
    ...button,
    slug: slugify(button.slug) || button.id,
    label: button.label.trim(),
    target_node_id: buttonType === 'open_node' ? button.target_node_id : null,
    external_url:
      buttonType === 'external_url' && button.external_url?.trim() ? button.external_url.trim() : null,
    show_transition: showTransition,
    transition_text: showTransition ? button.transition_text ?? '' : '',
    transition_duration_seconds: showTransition
      ? Math.max(0, Math.round(Number(button.transition_duration_seconds) || 0))
      : 0,
    ban_duration_seconds: Math.max(1, Math.round(Number(button.ban_duration_seconds) || 21600)),
    confirm_text_override: button.confirm_text_override?.trim() || null,
    is_active: Boolean(button.is_active),
  }
}

function normalizePayloadForSave(payload: ExperiencePayload): ExperiencePayload {
  const nodes = reindexNodes(
    payload.nodes.map((node) => ({
      ...node,
      slug: slugify(node.slug) || node.id,
      title: node.title.trim() || 'İsimsiz Ekran',
      text_content: node.text_content ?? '',
      is_active: Boolean(node.is_active),
      content_type: node.content_type === 'cheatbox' ? 'cheatbox' : 'text_buttons',
      text_mode: node.text_mode === 'typewriter' ? 'typewriter' : 'static',
      typewriter_duration_seconds: Math.max(1, Math.round(Number(node.typewriter_duration_seconds) || 12)),
    }))
  )

  const nodeIds = new Set(nodes.map((node) => node.id))

  const buttons = reindexButtonsByNode(
    payload.buttons
      .filter((button) => nodeIds.has(button.node_id))
      .filter((button) => !button.target_node_id || nodeIds.has(button.target_node_id))
      .map(normalizeButtonForSave)
  )

  return {
    settings: {
      ...payload.settings,
      entry_btn_label: payload.settings.entry_btn_label.trim() || 'Merak mı ediyorsun? İçeriye gir',
      bg_music_url: payload.settings.bg_music_url.trim(),
      footer_text: payload.settings.footer_text ?? '',
      mobile_autoscroll_enabled: Boolean(payload.settings.mobile_autoscroll_enabled),
      root_node_id: nodeIds.has(payload.settings.root_node_id)
        ? payload.settings.root_node_id
        : nodes[0]?.id ?? '',
    },
    nodes,
    buttons,
  }
}

function validatePayload(payload: ExperiencePayload) {
  const nodeIds = new Set(payload.nodes.map((node) => node.id))
  const nodeSlugs = new Set<string>()
  const buttonSlugs = new Set<string>()

  if (!payload.nodes.length) return 'En az bir ekran olmalı.'
  if (!payload.settings.root_node_id || !nodeIds.has(payload.settings.root_node_id)) {
    return 'Ana daktilo ekranı seçilmelidir.'
  }

  for (const node of payload.nodes) {
    if (!node.title.trim()) return 'Tüm ekranların panel adı dolu olmalı.'
    if (!node.slug.trim()) return 'Ekran teknik kimliği boş olamaz.'
    if (node.typewriter_duration_seconds < 1) return `"${node.title}" ekranında daktilo süresi en az 1 saniye olmalı.`

    if (nodeSlugs.has(node.slug)) {
      return 'Aynı teknik ekran kimliği birden fazla kullanılmış. Lütfen yeni ekranı tekrar oluştur.'
    }

    nodeSlugs.add(node.slug)
  }

  for (const button of payload.buttons) {
    if (!button.label.trim()) return 'Tüm buton yazıları dolu olmalı.'
    if (!button.slug.trim()) return 'Buton teknik kimliği boş olamaz.'

    if (buttonSlugs.has(button.slug)) {
      return 'Aynı teknik buton kimliği birden fazla kullanılmış. Lütfen butonu tekrar oluştur.'
    }

    buttonSlugs.add(button.slug)

    if (!nodeIds.has(button.node_id)) {
      return `"${button.label}" butonu geçersiz bir ekrana bağlı.`
    }

    if (button.button_type === 'open_node') {
      if (!button.target_node_id || !nodeIds.has(button.target_node_id)) {
        return `"${button.label}" butonu için açılacak ekran seçilmelidir.`
      }
    }

    if (button.button_type === 'external_url') {
      const externalUrl = button.external_url?.trim() ?? ''

      if (!externalUrl || externalUrl === 'https://' || externalUrl === 'http://') {
        return `"${button.label}" bağlantı butonu için geçerli bir URL girilmelidir.`
      }

      if (!isValidUrl(externalUrl)) {
        return `"${button.label}" bağlantı butonu geçerli bir URL içermiyor.`
      }
    }
  }

  return null
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
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
      <span className="caps" style={{ display: 'block' }}>
        {label}
      </span>
      {desc && (
        <span style={{ marginTop: -4, fontSize: '0.63rem', color: 'var(--t2)', lineHeight: 1.45 }}>
          {desc}
        </span>
      )}
      {isArea ? (
        <textarea
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          className="field"
          style={{ resize: 'vertical', lineHeight: 1.6 }}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="field"
          placeholder={placeholder}
        />
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  min = 0,
  desc = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  placeholder?: string
  min?: number
  desc?: string
}) {
  return (
    <Field
      label={label}
      value={value}
      placeholder={placeholder}
      desc={desc}
      onChange={(rawValue) => onChange(toSafeNumber(rawValue, value, min))}
    />
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
      <span className="caps" style={{ display: 'block' }}>
        {label}
      </span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
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
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 14px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r3)',
        background: 'rgba(255,255,255,0.018)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="caps" style={{ display: 'block' }}>
          {label}
        </span>
        {desc && <span style={{ fontSize: '0.63rem', color: 'var(--t2)' }}>{desc}</span>}
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--r3)',
        border: '1px solid var(--line)',
        background: 'rgba(255,255,255,0.02)',
        color: 'var(--t2)',
        fontSize: '0.74rem',
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}

function Badge({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'primary' | 'danger'
}) {
  const className =
    tone === 'primary' ? 'badge badge-p' : tone === 'danger' ? 'badge badge-danger' : 'badge badge-muted'

  return <span className={className}>{children}</span>
}

function ScreenBadge({ node }: { node: ExperienceNode }) {
  if (node.content_type === 'cheatbox') return <Badge tone="primary">cheatbox</Badge>
  if (node.text_mode === 'typewriter') return <Badge tone="primary">daktilo</Badge>

  return <Badge>metin</Badge>
}

function getEventTone(eventType: string): 'muted' | 'primary' | 'danger' {
  if (eventType === 'ban_action') return 'danger'
  if (eventType === 'site_visit' || eventType === 'repeat_visit' || eventType === 'screen_view') return 'primary'
  return 'muted'
}

function getEventLabel(eventType: string) {
  switch (eventType) {
    case 'site_visit':
      return 'ilk ziyaret'
    case 'repeat_visit':
      return 'tekrar ziyaret'
    case 'screen_view':
      return 'ekran goruntulendi'
    case 'button_click':
      return 'butona basildi'
    case 'external_link':
      return 'dis baglanti'
    case 'ban_action':
      return 'ban islemi'
    case 'back_click':
      return 'geri'
    case 'chat_message':
      return 'mesaj gonderildi'
    default:
      return eventType || 'eylem'
  }
}

function eventDetailLine(event: DeviceEvent) {
  const parts = [
    event.node_title || event.node_slug || event.stage,
    event.button_label || null,
    event.target_node_title ? `hedef: ${event.target_node_title}` : null,
    event.transition_used && event.transition_duration_seconds > 0
      ? `gecis: ${event.transition_duration_seconds} sn`
      : null,
  ].filter(Boolean)

  return parts.join(' · ')
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
  const [loadingExperience, setLoadingExperience] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [filterBlocked, setFilterBlocked] = useState<'all' | 'active' | 'blocked'>('all')
  const [replyInput, setReplyInput] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((response) => {
        if (response.status === 401) router.push('/admin')
      })
      .catch(() => {})
  }, [router])

  const selectedNode = useMemo(
    () => experience?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [experience, selectedNodeId]
  )

  const rootNode = useMemo(
    () => experience?.nodes.find((node) => node.id === experience.settings.root_node_id) ?? null,
    [experience]
  )

  const selectedNodeButtons = useMemo(
    () =>
      (experience?.buttons ?? [])
        .filter((button) => button.node_id === selectedNodeId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [experience, selectedNodeId]
  )

  const filteredDevices = useMemo(
    () =>
      devices.filter((device) => {
        if (filterBlocked === 'active') return !device.is_blocked
        if (filterBlocked === 'blocked') return device.is_blocked
        return true
      }),
    [devices, filterBlocked]
  )

  const activeCount = useMemo(() => devices.filter((device) => !device.is_blocked).length, [devices])
  const blockedCount = useMemo(() => devices.filter((device) => device.is_blocked).length, [devices])
  const total = metrics ? metrics.qr_count + metrics.direct_count : 0

  const markDirty = useCallback(() => {
    setDirty(true)
    setStatus('Kaydedilmemiş değişiklik var.')
  }, [])

  const fetchDevices = useCallback(async () => {
    const response = await fetch('/api/admin/devices', { cache: 'no-store' })

    if (response.status === 401) {
      router.push('/admin')
      return
    }

    if (!response.ok) return

    const data = await response.json()
    setDevices(data.devices ?? [])
  }, [router])

  const fetchMetrics = useCallback(async () => {
    const response = await fetch('/api/admin/metrics', { cache: 'no-store' })

    if (response.status === 401) {
      router.push('/admin')
      return
    }

    if (!response.ok) return

    const data = await response.json()
    setMetrics(data.metrics ?? null)
  }, [router])

  const fetchExperience = useCallback(async () => {
    setLoadingExperience(true)

    try {
      const response = await fetch(`/api/admin/experience?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (response.status === 401) {
        router.push('/admin')
        return
      }

      const data = await readJsonSafely(response)

      if (!response.ok) {
        setStatus(`Akış okunamadı: ${getApiErrorMessage(data)}`)
        return
      }

      const payload = data as ExperiencePayload

      setExperience(payload)
      setDirty(false)
      setStatus('')

      if (payload?.nodes?.length) {
        setSelectedNodeId((current) => {
          if (current && payload.nodes.some((node) => node.id === current)) return current

          return payload.settings?.root_node_id || payload.nodes[0].id
        })
      }
    } finally {
      setLoadingExperience(false)
    }
  }, [router])

  useEffect(() => {
    void fetchDevices()
    void fetchMetrics()
    void fetchExperience()
  }, [fetchDevices, fetchExperience, fetchMetrics, refresh])

  useEffect(() => {
    if (!selected) return

    fetch(`/api/admin/messages?deviceId=${encodeURIComponent(selected.device_id)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))

    fetch(`/api/admin/events?deviceId=${encodeURIComponent(selected.device_id)}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
  }, [selected, refresh])

  function updateSettings(patch: Partial<ExperienceSettings>) {
    setExperience((previous) =>
      previous
        ? {
            ...previous,
            settings: {
              ...previous.settings,
              ...patch,
            },
          }
        : previous
    )

    markDirty()
  }

  function updateNode(nodeId: string, patch: Partial<ExperienceNode>) {
    setExperience((previous) =>
      previous
        ? {
            ...previous,
            nodes: previous.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
          }
        : previous
    )

    markDirty()
  }

  function updateButton(buttonId: string, patch: Partial<ExperienceButton>) {
    setExperience((previous) => {
      if (!previous) return previous

      const nextButtons = previous.buttons.map((button) => {
        if (button.id !== buttonId) return button

        const merged = { ...button, ...patch }

        if (patch.button_type) {
          if (patch.button_type === 'open_node') {
            merged.external_url = null
            merged.target_node_id =
              previous.nodes.find((node) => node.id !== button.node_id)?.id ||
              previous.settings.root_node_id ||
              previous.nodes[0]?.id ||
              null
          }

          if (patch.button_type === 'external_url') {
            merged.target_node_id = null
            merged.external_url = merged.external_url || ''
          }

          if (patch.button_type === 'ban') {
            merged.target_node_id = null
            merged.external_url = null
          }
        }

        return merged
      })

      return {
        ...previous,
        buttons: nextButtons,
      }
    })

    markDirty()
  }

  function createNode(title: string, contentType: ExperienceContentType, textMode: ExperienceTextMode) {
    if (!experience) return null

    const id = crypto.randomUUID()
    const slug = uniqueSlug(title, experience.nodes.map((node) => node.slug))

    const node: ExperienceNode = {
      id,
      slug,
      title,
      content_type: contentType,
      text_content: '',
      text_mode: textMode,
      typewriter_duration_seconds: 12,
      is_active: true,
      sort_order: experience.nodes.length,
    }

    setExperience((previous) =>
      previous
        ? {
            ...previous,
            nodes: reindexNodes([...previous.nodes, node]),
          }
        : previous
    )

    setSelectedNodeId(id)
    markDirty()

    return node
  }

  function addNode() {
    if (!experience) return

    const nextIndex = experience.nodes.length + 1
    createNode(`Yeni Ekran ${nextIndex}`, 'text_buttons', 'static')
  }

  function createTargetNodeForButton(buttonId: string) {
    if (!experience) return

    const button = experience.buttons.find((item) => item.id === buttonId)
    if (!button) return

    const title = `${button.label || 'Yeni Buton'} Ekranı`
    const id = crypto.randomUUID()
    const slug = uniqueSlug(title, experience.nodes.map((node) => node.slug))

    const node: ExperienceNode = {
      id,
      slug,
      title,
      content_type: 'text_buttons',
      text_content: '',
      text_mode: 'static',
      typewriter_duration_seconds: 12,
      is_active: true,
      sort_order: experience.nodes.length,
    }

    setExperience({
      ...experience,
      nodes: reindexNodes([...experience.nodes, node]),
      buttons: experience.buttons.map((item) =>
        item.id === buttonId
          ? {
              ...item,
              button_type: 'open_node',
              target_node_id: id,
              external_url: null,
            }
          : item
      ),
    })

    setSelectedNodeId(id)
    markDirty()
  }

  function removeNode(nodeId: string) {
    if (!experience) return

    if (experience.nodes.length <= 1) {
      alert('En az bir ekran kalmalı.')
      return
    }

    const node = experience.nodes.find((item) => item.id === nodeId)

    if (
      !confirm(
        `"${node?.title ?? 'Bu ekran'}" silinsin mi? Bu ekrana giden buton bağlantıları da kaldırılır. Değişiklik Akışı Kaydet butonuna basınca kalıcı olur.`
      )
    ) {
      return
    }

    const remainingNodes = experience.nodes.filter((item) => item.id !== nodeId)
    const remainingNodeIds = new Set(remainingNodes.map((item) => item.id))
    const nextRoot =
      experience.settings.root_node_id === nodeId
        ? remainingNodes[0]?.id ?? ''
        : experience.settings.root_node_id

    const remainingButtons = experience.buttons.filter((button) => {
      if (button.node_id === nodeId) return false
      if (button.target_node_id === nodeId) return false

      return remainingNodeIds.has(button.node_id)
    })

    setExperience({
      settings: {
        ...experience.settings,
        root_node_id: nextRoot,
      },
      nodes: reindexNodes(remainingNodes),
      buttons: reindexButtonsByNode(remainingButtons),
    })

    setSelectedNodeId(nextRoot)
    markDirty()
  }

  function addButton(nodeId: string) {
    if (!experience) return

    const node = experience.nodes.find((item) => item.id === nodeId)
    const existingNodeButtons = experience.buttons.filter((button) => button.node_id === nodeId)
    const count = existingNodeButtons.length + 1
    const targetNode =
      experience.nodes.find((item) => item.id !== nodeId)?.id ||
      experience.settings.root_node_id ||
      experience.nodes[0]?.id ||
      null

    const button: ExperienceButton = {
      id: crypto.randomUUID(),
      node_id: nodeId,
      slug: uniqueSlug(
        `${node?.title || node?.slug || 'ekran'}-buton-${count}`,
        experience.buttons.map((item) => item.slug)
      ),
      label: `Yeni Buton ${count}`,
      button_type: 'open_node',
      target_node_id: targetNode,
      external_url: null,
      show_transition: false,
      transition_text: '',
      transition_duration_seconds: 0,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: count - 1,
    }

    setExperience({
      ...experience,
      buttons: reindexButtonsByNode([...experience.buttons, button]),
    })

    markDirty()
  }

  function removeButton(buttonId: string) {
    if (!experience) return

    const button = experience.buttons.find((item) => item.id === buttonId)

    if (!confirm(`"${button?.label ?? 'Bu buton'}" silinsin mi? Değişiklik Akışı Kaydet butonuna basınca kalıcı olur.`)) {
      return
    }

    setExperience({
      ...experience,
      buttons: reindexButtonsByNode(experience.buttons.filter((item) => item.id !== buttonId)),
    })

    markDirty()
  }

  async function saveExperience() {
    if (!experience || saving) return

    const payload = normalizePayloadForSave(experience)
    const validationError = validatePayload(payload)

    if (validationError) {
      alert(validationError)
      setStatus(validationError)
      return
    }

    setSaving(true)
    setStatus('Akış kaydediliyor...')

    try {
      const response = await fetch('/api/admin/experience', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(payload),
      })

      const data = await readJsonSafely(response)

      if (response.status === 401) {
        router.push('/admin')
        return
      }

      if (!response.ok) {
        const message = getApiErrorMessage(data, 'Kaydetme başarısız.')
        setStatus(`Kaydetme hatası: ${message}`)
        alert(`Kaydetme hatası: ${message}`)
        return
      }

      if (
        data &&
        typeof data === 'object' &&
        'settings' in data &&
        'nodes' in data &&
        'buttons' in data
      ) {
        const savedPayload = data as ExperiencePayload

        setExperience(savedPayload)

        if (!savedPayload.nodes.some((node) => node.id === selectedNodeId)) {
          setSelectedNodeId(savedPayload.settings.root_node_id || savedPayload.nodes[0]?.id || '')
        }
      } else {
        await fetchExperience()
      }

      setDirty(false)
      setStatus('Akış başarıyla kaydedildi.')
      alert('Akış başarıyla kaydedildi.')
    } catch (error) {
      console.error('experience save error', error)
      setStatus('Kaydetme sırasında beklenmeyen bir hata oluştu.')
      alert('Kaydetme sırasında beklenmeyen bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDevice(id: string) {
    if (!confirm('Bu cihazın tüm geçmişi silinecek.')) return

    const response = await fetch('/api/admin/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id }),
    })

    if (!response.ok) {
      const data = await readJsonSafely(response)
      alert(getApiErrorMessage(data, 'Cihaz silinemedi.'))
      return
    }

    setSelected(null)
    setMessages([])
    setEvents([])
    setRefresh((value) => value + 1)
  }

  async function unblock(id: string) {
    const response = await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: id }),
    })

    if (!response.ok) {
      const data = await readJsonSafely(response)
      alert(getApiErrorMessage(data, 'Ban kaldırılamadı.'))
      return
    }

    setRefresh((value) => value + 1)
  }

  async function resetMetrics(field: string) {
    const response = await fetch('/api/admin/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field }),
    })

    if (!response.ok) {
      const data = await readJsonSafely(response)
      alert(getApiErrorMessage(data, 'Metrik sıfırlanamadı.'))
      return
    }

    void fetchMetrics()
  }

  async function sendReply() {
    if (!selected || !replyInput.trim() || replying) return

    setReplying(true)

    try {
      const response = await fetch('/api/admin/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: selected.device_id, content: replyInput.trim() }),
      })

      if (!response.ok) {
        const data = await readJsonSafely(response)
        alert(getApiErrorMessage(data, 'Mesaj gönderilemedi.'))
        return
      }

      setReplyInput('')

      const messagesResponse = await fetch(
        `/api/admin/messages?deviceId=${encodeURIComponent(selected.device_id)}`,
        { cache: 'no-store' }
      )

      const messagesData = await messagesResponse.json()
      setMessages(messagesData.messages ?? [])
    } finally {
      setReplying(false)
    }
  }

  function renderFlowTab() {
    if (loadingExperience) {
      return (
        <div className="card" style={{ padding: 28, color: 'var(--t2)' }}>
          Akış yükleniyor...
        </div>
      )
    }

    if (!experience) {
      return (
        <div className="card" style={{ padding: 28, color: 'var(--t2)' }}>
          Akış verisi alınamadı.
        </div>
      )
    }

    return (
      <motion.div
        key="flow"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {(status || dirty) && (
          <Notice>
            {status || 'Kaydedilmemiş değişiklik var.'}
            {dirty && (
              <span style={{ display: 'block', marginTop: 6, color: 'var(--p-text)' }}>
                Kalıcı olması için sağ üstten “Akışı Kaydet” butonuna basmalısın.
              </span>
            )}
          </Notice>
        )}

        <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <p className="caps" style={{ display: 'block', marginBottom: 7 }}>
              Başlangıç
            </p>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 400 }}>
              AuraRing → giriş butonu → müzik → ana daktilo ekranı
            </h2>
            <p style={{ margin: '8px 0 0', color: 'var(--t2)', fontSize: '0.74rem', lineHeight: 1.6 }}>
              Site açıldığında önce AuraRing görünür. Giriş butonuna basılınca müzik başlar ve seçtiğin ana ekran daktilo metni olarak akar.
              Bundan sonra akış, ekranlara eklediğin butonlarla dallanır.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Field
              label="Giriş Butonu"
              value={experience.settings.entry_btn_label}
              onChange={(value) => updateSettings({ entry_btn_label: value })}
              placeholder="Merak mı ediyorsun? İçeriye gir"
            />
            <Field
              label="Arka Plan Müziği"
              value={experience.settings.bg_music_url}
              onChange={(value) => updateSettings({ bg_music_url: value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <SelectField
              label="Ana Daktilo Ekranı"
              value={experience.settings.root_node_id}
              onChange={(value) => updateSettings({ root_node_id: value })}
              options={experience.nodes.map((node) => ({ label: node.title || 'İsimsiz Ekran', value: node.id }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <ToggleField
              label="Mobil Otomatik Kaydırma"
              checked={experience.settings.mobile_autoscroll_enabled}
              onChange={(checked) => updateSettings({ mobile_autoscroll_enabled: checked })}
              desc="Daktilo metni mobilde uzadıkça akıcı şekilde aşağı kaydır."
            />
            <Field
              label="Footer Yazısı"
              value={experience.settings.footer_text}
              onChange={(value) => updateSettings({ footer_text: value })}
              placeholder="Alt bilgi yazısı"
            />
          </div>

          <Notice>
            Daktilo hizi artik global milisaniye yerine ekran bazli saniye ile yonetilir. Her ekranin toplam daktilo suresini ekran duzenleyicisinden ayarlayabilirsin.
          </Notice>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line-faint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <span className="caps" style={{ display: 'block' }}>
                  Ekranlar
                </span>
                <p style={{ margin: '4px 0 0', color: 'var(--t2)', fontSize: '0.62rem' }}>
                  Dallanma noktaları
                </p>
              </div>
              <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={addNode}>
                Yeni Ekran
              </button>
            </div>

            <div style={{ maxHeight: 680, overflowY: 'auto' }}>
              {experience.nodes.map((node) => {
                const selectedState = node.id === selectedNodeId
                const buttonCount = experience.buttons.filter((button) => button.node_id === node.id).length

                return (
                  <button
                    key={node.id}
                    type="button"
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
                      <span style={{ fontSize: '0.82rem', color: selectedState ? 'var(--p-text)' : 'var(--t0)' }}>
                        {node.title || 'İsimsiz Ekran'}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {experience.settings.root_node_id === node.id && <Badge tone="primary">ana</Badge>}
                        {!node.is_active && <Badge tone="danger">pasif</Badge>}
                        <ScreenBadge node={node} />
                      </div>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '0.62rem', color: 'var(--t2)' }}>
                      {buttonCount} buton
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!selectedNode ? (
              <div style={{ textAlign: 'center', color: 'var(--t2)', padding: '64px 24px' }}>
                Düzenlemek için bir ekran seç.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p className="caps" style={{ display: 'block', marginBottom: 6 }}>
                      Ekran Düzenleyici
                    </p>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 400 }}>{selectedNode.title}</h2>
                    {rootNode?.id === selectedNode.id && (
                      <p style={{ margin: '7px 0 0', color: 'var(--p-text)', fontSize: '0.7rem' }}>
                        Bu ekran girişten sonra gelen ana daktilo ekranı.
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.68rem' }}
                      onClick={() => updateSettings({ root_node_id: selectedNode.id })}
                    >
                      Ana Yap
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: '0.68rem' }} onClick={() => removeNode(selectedNode.id)}>
                      Sil
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <Field
                    label="Panelde Görünecek Ad"
                    value={selectedNode.title}
                    onChange={(value) => updateNode(selectedNode.id, { title: value })}
                    desc="Ziyaretçiye görünmez. Sadece panelde ekranı ayırt etmek için."
                  />
                  <SelectField
                    label="Ekranda Ne Gösterilecek?"
                    value={selectedNode.content_type}
                    onChange={(value) =>
                      updateNode(selectedNode.id, { content_type: value as ExperienceContentType })
                    }
                    options={[
                      { label: 'Yazı ve altına butonlar', value: 'text_buttons' },
                      { label: 'Cheatbox', value: 'cheatbox' },
                    ]}
                  />
                  <SelectField
                    label={selectedNode.content_type === 'cheatbox' ? 'Üst Yazı Nasıl Gelsin?' : 'Yazı Nasıl Gelsin?'}
                    value={selectedNode.text_mode}
                    onChange={(value) => updateNode(selectedNode.id, { text_mode: value as ExperienceTextMode })}
                    options={[
                      { label: 'Daktilo efektiyle yazılsın', value: 'typewriter' },
                      { label: 'Direkt görünsün', value: 'static' },
                    ]}
                  />
                  {selectedNode.text_mode === 'typewriter' && (
                    <NumberField
                      label="Daktilo Süresi (sn)"
                      value={selectedNode.typewriter_duration_seconds}
                      onChange={(value) => updateNode(selectedNode.id, { typewriter_duration_seconds: value })}
                      min={1}
                      desc="Bu ekranın tüm yazısı yaklaşık bu sürede tamamlansın."
                    />
                  )}
                </div>

                <ToggleField
                  label="Bu ekran aktif"
                  checked={selectedNode.is_active}
                  onChange={(checked) => updateNode(selectedNode.id, { is_active: checked })}
                  desc="Pasif ekranlar ziyaretçiye gösterilmez."
                />

                <Field
                  label={selectedNode.content_type === 'cheatbox' ? 'Cheatbox Ust Metni' : 'Ekran Yazisi'}
                  value={selectedNode.text_content}
                  onChange={(value) => updateNode(selectedNode.id, { text_content: value })}
                  isArea
                  desc={
                    selectedNode.content_type === 'cheatbox'
                      ? 'Bos birakirsan sadece cheatbox gorunur. Doluysa metin cheatboxin ustunde gosterilir.'
                      : 'Bu ekranda gosterilecek metin.'
                  }
                />

                {selectedNode.content_type === 'cheatbox' && (
                  <Notice>
                    Bu ekran acildiginda once ust metin, onun altinda mevcut cheatbox deneyimi gorunur. Istersen alttaki butonlarla cheatbox sonrasinda yeni dallar da olusturabilirsin.
                  </Notice>
                )}

                <div style={{ borderTop: '1px solid var(--line-faint)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p className="caps" style={{ display: 'block', marginBottom: 4 }}>
                        Bu Ekranın Butonları
                      </p>
                      <p style={{ margin: 0, color: 'var(--t2)', fontSize: '0.72rem' }}>
                        Kullanıcının bu ekrandan sonra nereye gideceğini buradan belirlersin.
                      </p>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={() => addButton(selectedNode.id)}>
                      Buton Ekle
                    </button>
                  </div>

                  {!selectedNodeButtons.length && <Notice>Bu ekranda henüz buton yok.</Notice>}

                  {selectedNodeButtons.map((button) => (
                    <div
                      key={button.id}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--r3)',
                        border: '1px solid var(--line)',
                        background: 'rgba(255,255,255,0.018)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.82rem', fontWeight: 500 }}>{button.label || 'Başlıksız Buton'}</strong>
                          <Badge>
                            {button.button_type === 'open_node'
                              ? 'kapı açar'
                              : button.button_type === 'external_url'
                                ? 'bağlantı'
                                : 'ban'}
                          </Badge>
                          {!button.is_active && <Badge tone="danger">pasif</Badge>}
                        </div>
                        <button className="btn btn-danger" style={{ fontSize: '0.66rem' }} onClick={() => removeButton(button.id)}>
                          Sil
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                        <Field
                          label="Buton Yazısı"
                          value={button.label}
                          onChange={(value) => updateButton(button.id, { label: value })}
                        />
                        <SelectField
                          label="Buton Ne Yapsın?"
                          value={button.button_type}
                          onChange={(value) => updateButton(button.id, { button_type: value as ExperienceButtonType })}
                          options={[
                            { label: 'Yeni ekran açsın', value: 'open_node' },
                            { label: 'Instagram / web bağlantısı açsın', value: 'external_url' },
                            { label: 'Kullanıcıyı banlasın', value: 'ban' },
                          ]}
                        />
                      </div>

                      {button.button_type === 'open_node' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'end' }}>
                          <SelectField
                            label="Açılacak Ekran"
                            value={button.target_node_id ?? ''}
                            onChange={(value) => updateButton(button.id, { target_node_id: value })}
                            options={experience.nodes.map((node) => ({
                              label: node.title || 'İsimsiz Ekran',
                              value: node.id,
                            }))}
                          />
                          <button className="btn btn-ghost" style={{ height: 42, fontSize: '0.68rem' }} onClick={() => createTargetNodeForButton(button.id)}>
                            Yeni ekran oluştur
                          </button>
                        </div>
                      )}

                      {button.button_type === 'external_url' && (
                        <Field
                          label="Açılacak Bağlantı"
                          value={button.external_url ?? ''}
                          onChange={(value) => updateButton(button.id, { external_url: value })}
                          placeholder="https://instagram.com/..."
                        />
                      )}

                      {button.button_type === 'ban' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                          <NumberField
                            label="Ban Süresi (sn)"
                            value={button.ban_duration_seconds}
                            onChange={(value) => updateButton(button.id, { ban_duration_seconds: value })}
                            min={1}
                          />
                          <Field
                            label="Özel Ban Onay Metni"
                            value={button.confirm_text_override ?? ''}
                            onChange={(value) => updateButton(button.id, { confirm_text_override: value || null })}
                            desc="Bos birakirsan varsayilan onay metni kullanilir."
                          />
                        </div>
                      )}

                      <ToggleField
                        label="Buton Aktif"
                        checked={button.is_active}
                        onChange={(checked) => updateButton(button.id, { is_active: checked })}
                      />

                      <ToggleField
                        label="Önce Siyah Geçiş Ekranı Göster"
                        checked={button.show_transition}
                        onChange={(checked) => updateButton(button.id, { show_transition: checked })}
                        desc="Butona basınca yeni ekran/link/ban işleminden önce siyah ekranda özel metin gösterilir."
                      />

                      {button.show_transition && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: 14 }}>
                          <Field
                            label="Siyah Ekran Yazısı"
                            value={button.transition_text}
                            onChange={(value) => updateButton(button.id, { transition_text: value })}
                            isArea
                          />
                          <NumberField
                            label="Sure (sn)"
                            value={button.transition_duration_seconds}
                            onChange={(value) => updateButton(button.id, { transition_duration_seconds: value })}
                            min={0}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  function renderDevicesTab() {
    return (
      <motion.div
        key="devices"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 0.9fr) minmax(0, 1.1fr)', gap: 18, alignItems: 'start' }}
      >
        <div className="card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--line-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'active', 'blocked'] as const).map((filter) => (
                <button
                  key={filter}
                  className={`btn ${filterBlocked === filter ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.66rem' }}
                  onClick={() => setFilterBlocked(filter)}
                >
                  {filter === 'all' ? 'Tümü' : filter === 'active' ? 'Aktif' : 'Banlı'}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ fontSize: '0.66rem' }} onClick={() => setRefresh((value) => value + 1)}>
              Yenile
            </button>
          </div>

          <div style={{ maxHeight: 680, overflowY: 'auto' }}>
            {filteredDevices.map((device) => {
              const selectedState = selected?.device_id === device.device_id

              return (
                <button
                  key={device.device_id}
                  type="button"
                  onClick={() => {
                    setSelected(device)
                    setDetailTab('messages')
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--line-faint)',
                    borderLeft: `2px solid ${selectedState ? 'var(--p)' : 'transparent'}`,
                    background: selectedState ? 'var(--p-glass)' : 'transparent',
                    color: 'var(--t0)',
                    cursor: 'pointer',
                    padding: '14px 16px',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.82rem' }}>{device.model || 'Unknown Device'}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.66rem', color: 'var(--t2)' }}>
                        {device.browser} · {device.ip}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Badge>{device.entry_type}</Badge>
                      {device.is_blocked && <Badge tone="danger">ban</Badge>}
                      {device.is_chat_mode && <Badge tone="primary">chat</Badge>}
                    </div>
                  </div>
                  <p style={{ margin: '7px 0 0', fontSize: '0.62rem', color: 'var(--t3)' }}>
                    Son görülme: {fmt(device.last_seen)}
                  </p>
                </button>
              )
            })}

            {!filteredDevices.length && (
              <div style={{ padding: 22, color: 'var(--t2)', fontSize: '0.78rem' }}>Kayıt bulunamadı.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '22px 24px', minHeight: 420 }}>
          {!selected ? (
            <div style={{ padding: 42, textAlign: 'center', color: 'var(--t2)' }}>Detay görmek için bir cihaz seç.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
                <div>
                  <p className="caps" style={{ display: 'block', marginBottom: 7 }}>
                    Cihaz Detayı
                  </p>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 400 }}>{selected.model || 'Unknown Device'}</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--t2)', fontSize: '0.72rem' }}>
                    {selected.city}, {selected.country} · {selected.isp}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.is_blocked && (
                    <button className="btn btn-primary" style={{ fontSize: '0.68rem' }} onClick={() => unblock(selected.device_id)}>
                      Ban Kaldır
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ fontSize: '0.68rem' }} onClick={() => deleteDevice(selected.device_id)}>
                    Sil
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                {[
                  ['Device ID', selected.device_id],
                  ['IP', selected.ip],
                  ['OS', selected.os_name],
                  ['Tarayıcı', selected.browser],
                  ['Timezone', selected.timezone],
                  ['RAM', `${selected.device_memory || 0} GB`],
                  ['CPU', `${selected.cpu_cores || 0} çekirdek`],
                  ['İlk Görülme', fmt(selected.first_seen)],
                  ['Son Görülme', fmt(selected.last_seen)],
                  ['Ban Bitişi', fmt(selected.blocked_until)],
                  ['Ban Nedeni', selected.ban_reason || '-'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r3)',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.015)',
                    }}
                  >
                    <p className="caps" style={{ margin: 0, display: 'block' }}>
                      {label}
                    </p>
                    <p style={{ margin: '6px 0 0', color: 'var(--t1)', fontSize: '0.72rem', overflowWrap: 'anywhere' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line-faint)', paddingBottom: 10 }}>
                <button
                  className={`btn ${detailTab === 'messages' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.68rem' }}
                  onClick={() => setDetailTab('messages')}
                >
                  Mesajlar
                </button>
                <button
                  className={`btn ${detailTab === 'events' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.68rem' }}
                  onClick={() => setDetailTab('events')}
                >
                  Eylemler
                </button>
              </div>

              {detailTab === 'messages' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        style={{
                          alignSelf: message.sender === 'admin' ? 'flex-end' : 'flex-start',
                          maxWidth: '82%',
                          padding: '10px 12px',
                          borderRadius: 'var(--r3)',
                          border: '1px solid var(--line)',
                          background: message.sender === 'admin' ? 'var(--p-glass)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.78rem', lineHeight: 1.55 }}>
                          {message.content}
                        </p>
                        <p style={{ margin: '6px 0 0', color: 'var(--t3)', fontSize: '0.58rem' }}>
                          {message.sender} · {fmtTime(message.created_at)}
                        </p>
                      </div>
                    ))}

                    {!messages.length && <Notice>Bu cihazdan henüz mesaj yok.</Notice>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="field"
                      value={replyInput}
                      onChange={(event) => setReplyInput(event.target.value)}
                      placeholder="Cevap yaz..."
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void sendReply()
                      }}
                    />
                    <button className="btn btn-primary" onClick={sendReply} disabled={replying || !replyInput.trim()}>
                      Gönder
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'events' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {events.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--r3)',
                        border: '1px solid var(--line)',
                        background: 'rgba(255,255,255,0.018)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge tone={getEventTone(event.event_type)}>{getEventLabel(event.event_type)}</Badge>
                        <span style={{ color: 'var(--t3)', fontSize: '0.62rem' }}>{fmt(event.created_at)}</span>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '0.78rem', lineHeight: 1.55 }}>
                        {eventDetailLine(event) || '-'}
                      </p>
                      <p style={{ margin: '5px 0 0', color: 'var(--t3)', fontSize: '0.62rem', lineHeight: 1.55 }}>
                        {event.ip}
                        {event.transition_used && event.transition_text ? ` · "${event.transition_text}"` : ''}
                        {event.metadata && typeof event.metadata.preview === 'string'
                          ? ` · ${event.metadata.preview}`
                          : ''}
                      </p>
                    </div>
                  ))}

                  {!events.length && <Notice>Bu cihaz için eylem kaydı yok.</Notice>}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  function renderMetricsTab() {
    return (
      <motion.div
        key="metrics"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}
      >
        {[
          ['Toplam', total, 'all'],
          ['QR', metrics?.qr_count ?? 0, 'qr_count'],
          ['Direkt', metrics?.direct_count ?? 0, 'direct_count'],
        ].map(([label, value, field]) => (
          <div key={String(label)} className="card" style={{ padding: '24px 26px' }}>
            <p className="caps" style={{ display: 'block', marginBottom: 12 }}>
              {label}
            </p>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 300 }}>{value}</h2>
            {field !== 'all' && (
              <button className="btn btn-danger" style={{ marginTop: 18, fontSize: '0.68rem' }} onClick={() => resetMetrics(String(field))}>
                Sıfırla
              </button>
            )}
          </div>
        ))}

        <div className="card" style={{ padding: '24px 26px' }}>
          <p className="caps" style={{ display: 'block', marginBottom: 12 }}>
            Son Sıfırlama
          </p>
          <p style={{ margin: 0, color: 'var(--t1)' }}>{fmt(metrics?.last_reset)}</p>
        </div>
      </motion.div>
    )
  }

  return (
    <div
      className="admin-layout"
      style={{
        display: 'flex',
        minHeight: '100dvh',
        background: 'var(--bg)',
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
        color: 'var(--t0)',
      }}
    >
      <StarField />
      <div className="vignette" />

      <aside className="sidebar">
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--line-faint)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid var(--p-line)',
                background: 'var(--p-glass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--p-text)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.77rem',
                  fontWeight: 600,
                  color: 'var(--t0)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
                }}
              >
                Aura
              </p>
              <p style={{ margin: '1px 0 0', fontSize: '0.50rem', color: 'var(--t3)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                Control Panel
              </p>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`nav-item${tab === item.id ? ' active' : ''}`}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SvgIcon d={item.icon} s={13} />
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--line-faint)', display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost btn-icon"
            title="Yenile"
            onClick={() => setRefresh((value) => value + 1)}
            style={{ flex: 1, borderRadius: 'var(--r3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 2, fontSize: '0.70rem', letterSpacing: '0.08em' }}
            onClick={async () => {
              await fetch('/api/admin/auth', { method: 'DELETE' })
              router.push('/admin')
            }}
          >
            Çıkış
          </button>
        </div>
      </aside>

      <main className="admin-main" style={{ flex: 1, padding: '36px 40px', position: 'relative', zIndex: 10, minHeight: '100dvh' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 32,
            paddingBottom: 20,
            borderBottom: '1px solid var(--line-faint)',
          }}
        >
          <div>
            <p className="caps" style={{ marginBottom: 7, display: 'block' }}>
              {TABS.find((item) => item.id === tab)?.label}
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: '1.45rem',
                fontWeight: 300,
                color: 'var(--t0)',
                letterSpacing: '-0.01em',
                fontFamily: "var(--font-outfit), 'Outfit', sans-serif",
              }}
            >
              {tab === 'flow' && 'Deneyim Akışı'}
              {tab === 'devices' && `${devices.length} Cihaz`}
              {tab === 'metrics' && `${total} Ziyaret`}
            </h1>
          </div>

          {tab === 'flow' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => void fetchExperience()} disabled={saving || loadingExperience}>
                DB’den Yenile
              </button>
              <button className="btn btn-primary" onClick={saveExperience} disabled={saving || !experience}>
                {saving ? 'Kaydediliyor…' : dirty ? 'Akışı Kaydet *' : 'Akışı Kaydet'}
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'flow' && renderFlowTab()}
          {tab === 'devices' && renderDevicesTab()}
          {tab === 'metrics' && renderMetricsTab()}
        </AnimatePresence>

        {tab === 'devices' && (
          <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', color: 'var(--t2)', fontSize: '0.72rem' }}>
            <Badge tone="primary">{activeCount} aktif</Badge>
            <Badge tone="danger">{blockedCount} banlı</Badge>
          </div>
        )}
      </main>
    </div>
  )
}
