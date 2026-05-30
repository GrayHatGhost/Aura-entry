export type ExperienceContentType = 'text_buttons' | 'cheatbox'
export type ExperienceTextMode = 'typewriter' | 'static'
export type ExperienceButtonType = 'open_node' | 'external_url' | 'ban'

export interface ExperienceSettings {
  entry_btn_label: string
  bg_music_url: string
  footer_text: string
  ban_confirm_text: string
  ban_pre_text: string
  typewriter_char_delay_ms: number
  mobile_autoscroll_enabled: boolean
  root_node_id: string
}

export interface ExperienceNode {
  id: string
  slug: string
  title: string
  content_type: ExperienceContentType
  text_content: string
  text_mode: ExperienceTextMode
  is_active: boolean
  sort_order: number
}

export interface ExperienceButton {
  id: string
  node_id: string
  slug: string
  label: string
  button_type: ExperienceButtonType
  target_node_id: string | null
  external_url: string | null
  show_transition: boolean
  transition_text: string
  transition_duration_ms: number
  ban_duration_seconds: number
  confirm_text_override: string | null
  is_active: boolean
  sort_order: number
}

export interface ExperiencePayload {
  settings: ExperienceSettings
  nodes: ExperienceNode[]
  buttons: ExperienceButton[]
}

export interface LegacySiteContent {
  main_text?: string
  entry_btn_label?: string
  bg_music_url?: string
  footer_text?: string
  ban_confirm_text?: string
  ban_pre_text?: string
  instagram_url?: string
  step1_btn1_label?: string
  step1_btn2_label?: string
  step1_btn3_label?: string
  transition1_text?: string
  transition2_text?: string
  step2_text?: string
  step2_btn1_label?: string
  step2_btn2_label?: string
  step2_btn3_label?: string
  reveal_text?: string
  reveal_btn1_label?: string
  reveal_btn2_label?: string
  reveal_btn3_label?: string
}

const LEGACY_ROOT_NODE_ID = 'legacy-root'
const LEGACY_STEP2_NODE_ID = 'legacy-step2'
const LEGACY_REVEAL_NODE_ID = 'legacy-reveal'
const LEGACY_CHAT_NODE_ID = 'legacy-chat'

function clampInt(value: unknown, fallback: number, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.round(value))
}

function sortByOrder<T extends { sort_order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

export function normalizeSettings(raw: Partial<ExperienceSettings> | null | undefined): ExperienceSettings {
  return {
    entry_btn_label: raw?.entry_btn_label ?? 'Merak mi ediyorsun? Iceriye gir',
    bg_music_url: raw?.bg_music_url ?? '',
    footer_text: raw?.footer_text ?? '',
    ban_confirm_text:
      raw?.ban_confirm_text ??
      'Bu buton ile sayfayi tamamen yok edersin ve geri donusu yoktur. Onayliyor musun?',
    ban_pre_text: raw?.ban_pre_text ?? 'Sistemden Cikartiliyorsun...',
    typewriter_char_delay_ms: clampInt(raw?.typewriter_char_delay_ms, 43, 10),
    mobile_autoscroll_enabled: raw?.mobile_autoscroll_enabled ?? true,
    root_node_id: raw?.root_node_id ?? LEGACY_ROOT_NODE_ID,
  }
}

export function buildLegacyExperience(siteContent: LegacySiteContent | null | undefined): ExperiencePayload {
  const content = siteContent ?? {}
  const settings = normalizeSettings({
    entry_btn_label: content.entry_btn_label,
    bg_music_url: content.bg_music_url,
    footer_text: content.footer_text,
    ban_confirm_text: content.ban_confirm_text,
    ban_pre_text: content.ban_pre_text,
    typewriter_char_delay_ms: 43,
    mobile_autoscroll_enabled: true,
    root_node_id: LEGACY_ROOT_NODE_ID,
  })

  const nodes: ExperienceNode[] = sortByOrder([
    {
      id: LEGACY_ROOT_NODE_ID,
      slug: 'root',
      title: 'Ana Kapi',
      content_type: 'text_buttons',
      text_content: content.main_text ?? '',
      text_mode: 'typewriter',
      is_active: true,
      sort_order: 0,
    },
    {
      id: LEGACY_STEP2_NODE_ID,
      slug: 'step2',
      title: 'Ikinci Kapi',
      content_type: 'text_buttons',
      text_content: content.step2_text ?? '',
      text_mode: 'static',
      is_active: true,
      sort_order: 1,
    },
    {
      id: LEGACY_REVEAL_NODE_ID,
      slug: 'reveal',
      title: 'Reveal',
      content_type: 'text_buttons',
      text_content: content.reveal_text ?? '',
      text_mode: 'static',
      is_active: true,
      sort_order: 2,
    },
    {
      id: LEGACY_CHAT_NODE_ID,
      slug: 'chat',
      title: 'Cheatbox',
      content_type: 'cheatbox',
      text_content: '',
      text_mode: 'static',
      is_active: true,
      sort_order: 3,
    },
  ])

  const buttons: ExperienceButton[] = sortByOrder([
    {
      id: 'legacy-root-btn-1',
      node_id: LEGACY_ROOT_NODE_ID,
      slug: 'root-btn-1',
      label: content.step1_btn1_label ?? 'Merak ettim',
      button_type: 'open_node',
      target_node_id: LEGACY_STEP2_NODE_ID,
      external_url: null,
      show_transition: true,
      transition_text: content.transition1_text ?? 'Guzel. O zaman kontrol sende.',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 0,
    },
    {
      id: 'legacy-root-btn-2',
      node_id: LEGACY_ROOT_NODE_ID,
      slug: 'root-btn-2',
      label: content.step1_btn2_label ?? 'Kim oldugunu goster',
      button_type: 'open_node',
      target_node_id: LEGACY_REVEAL_NODE_ID,
      external_url: null,
      show_transition: true,
      transition_text: content.transition2_text ?? 'Tamam. Artik biliyorsun.',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'legacy-root-btn-3',
      node_id: LEGACY_ROOT_NODE_ID,
      slug: 'root-btn-3',
      label: content.step1_btn3_label ?? 'Pas gec',
      button_type: 'ban',
      target_node_id: null,
      external_url: null,
      show_transition: true,
      transition_text: content.ban_pre_text ?? 'Sistemden Cikartiliyorsun...',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: content.ban_confirm_text ?? null,
      is_active: true,
      sort_order: 2,
    },
    {
      id: 'legacy-step2-btn-1',
      node_id: LEGACY_STEP2_NODE_ID,
      slug: 'step2-btn-1',
      label: content.step2_btn1_label ?? 'Mesaj birak',
      button_type: 'open_node',
      target_node_id: LEGACY_CHAT_NODE_ID,
      external_url: null,
      show_transition: false,
      transition_text: '',
      transition_duration_ms: 0,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 0,
    },
    {
      id: 'legacy-step2-btn-2',
      node_id: LEGACY_STEP2_NODE_ID,
      slug: 'step2-btn-2',
      label: content.step2_btn2_label ?? 'Kim oldugunu goster',
      button_type: 'open_node',
      target_node_id: LEGACY_REVEAL_NODE_ID,
      external_url: null,
      show_transition: true,
      transition_text: content.transition2_text ?? 'Tamam. Artik biliyorsun.',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'legacy-step2-btn-3',
      node_id: LEGACY_STEP2_NODE_ID,
      slug: 'step2-btn-3',
      label: content.step2_btn3_label ?? 'Cik',
      button_type: 'ban',
      target_node_id: null,
      external_url: null,
      show_transition: true,
      transition_text: content.ban_pre_text ?? 'Sistemden Cikartiliyorsun...',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: content.ban_confirm_text ?? null,
      is_active: true,
      sort_order: 2,
    },
    {
      id: 'legacy-reveal-btn-1',
      node_id: LEGACY_REVEAL_NODE_ID,
      slug: 'reveal-btn-1',
      label: content.reveal_btn1_label ?? 'Mesaj birak',
      button_type: 'open_node',
      target_node_id: LEGACY_CHAT_NODE_ID,
      external_url: null,
      show_transition: false,
      transition_text: '',
      transition_duration_ms: 0,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 0,
    },
    {
      id: 'legacy-reveal-btn-2',
      node_id: LEGACY_REVEAL_NODE_ID,
      slug: 'reveal-btn-2',
      label: content.reveal_btn2_label ?? 'Instagramdan yaz',
      button_type: 'external_url',
      target_node_id: null,
      external_url: content.instagram_url ?? '',
      show_transition: false,
      transition_text: '',
      transition_duration_ms: 0,
      ban_duration_seconds: 21600,
      confirm_text_override: null,
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'legacy-reveal-btn-3',
      node_id: LEGACY_REVEAL_NODE_ID,
      slug: 'reveal-btn-3',
      label: content.reveal_btn3_label ?? 'Cik',
      button_type: 'ban',
      target_node_id: null,
      external_url: null,
      show_transition: true,
      transition_text: content.ban_pre_text ?? 'Sistemden Cikartiliyorsun...',
      transition_duration_ms: 5000,
      ban_duration_seconds: 21600,
      confirm_text_override: content.ban_confirm_text ?? null,
      is_active: true,
      sort_order: 2,
    },
  ])

  return { settings, nodes, buttons }
}

export function normalizeNode(raw: Partial<ExperienceNode>): ExperienceNode {
  return {
    id: raw.id ?? '',
    slug: raw.slug ?? '',
    title: raw.title ?? '',
    content_type: raw.content_type === 'cheatbox' ? 'cheatbox' : 'text_buttons',
    text_content: raw.text_content ?? '',
    text_mode: raw.text_mode === 'typewriter' ? 'typewriter' : 'static',
    is_active: raw.is_active ?? true,
    sort_order: clampInt(raw.sort_order, 0, 0),
  }
}

export function normalizeButton(raw: Partial<ExperienceButton>): ExperienceButton {
  return {
    id: raw.id ?? '',
    node_id: raw.node_id ?? '',
    slug: raw.slug ?? '',
    label: raw.label ?? '',
    button_type:
      raw.button_type === 'external_url' || raw.button_type === 'ban' ? raw.button_type : 'open_node',
    target_node_id: raw.target_node_id ?? null,
    external_url: raw.external_url ?? null,
    show_transition: raw.show_transition ?? false,
    transition_text: raw.transition_text ?? '',
    transition_duration_ms: clampInt(raw.transition_duration_ms, 0, 0),
    ban_duration_seconds: clampInt(raw.ban_duration_seconds, 21600, 1),
    confirm_text_override: raw.confirm_text_override ?? null,
    is_active: raw.is_active ?? true,
    sort_order: clampInt(raw.sort_order, 0, 0),
  }
}

export function sortNodes(nodes: ExperienceNode[]) {
  return sortByOrder(nodes)
}

export function sortButtons(buttons: ExperienceButton[]) {
  return sortByOrder(buttons)
}
