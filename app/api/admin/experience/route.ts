import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { verifyAdminToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import {
  buildLegacyExperience,
  normalizeButton,
  normalizeNode,
  normalizeSettings,
  sortButtons,
  sortNodes,
  type ExperienceButton,
  type ExperienceNode,
  type ExperiencePayload,
  type ExperienceSettings,
} from '@/lib/experience'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AdminSupabaseClient = ReturnType<typeof createAdminClient>

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
}

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_admin')?.value

  if (!token) return false

  return verifyAdminToken(token)
}

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      details,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  )
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message

    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return 'Bilinmeyen hata.'
}

function unique(values: string[]) {
  const normalized = values.map((value) => value.trim())
  return new Set(normalized).size === normalized.length
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeText(value: string | null | undefined) {
  return typeof value === 'string' ? value : ''
}

function validateGraph(
  nodes: ExperienceNode[],
  buttons: ExperienceButton[],
  rootNodeId: string
) {
  const nodeIds = nodes.map((node) => node.id)
  const nodeSlugs = nodes.map((node) => node.slug)
  const buttonIds = buttons.map((button) => button.id)
  const buttonSlugs = buttons.map((button) => button.slug)
  const nodeIdSet = new Set(nodeIds)

  if (!nodeIds.length) return 'En az bir kapı gerekli.'
  if (!rootNodeId || !nodeIdSet.has(rootNodeId)) {
    return 'Geçerli bir kök kapı seçilmelidir.'
  }

  if (!unique(nodeIds)) return 'Kapı ID değerleri benzersiz olmalı.'
  if (!unique(nodeSlugs)) return 'Kapı slug değerleri benzersiz olmalı.'
  if (!unique(buttonIds)) return 'Buton ID değerleri benzersiz olmalı.'
  if (!unique(buttonSlugs)) return 'Buton slug değerleri benzersiz olmalı.'

  for (const node of nodes) {
    if (!node.id.trim()) return 'Tüm kapıların ID alanı dolu olmalı.'
    if (!node.slug.trim()) return 'Tüm kapıların slug alanı dolu olmalı.'
    if (!node.title.trim()) return 'Tüm kapıların başlığı dolu olmalı.'

    if (node.content_type !== 'text_buttons' && node.content_type !== 'cheatbox') {
      return `"${node.title || node.slug}" kapısında geçersiz içerik tipi var.`
    }

    if (node.text_mode !== 'typewriter' && node.text_mode !== 'static') {
      return `"${node.title || node.slug}" kapısında geçersiz metin modu var.`
    }

    if (node.typewriter_duration_seconds < 1) {
      return `"${node.title || node.slug}" kapısının daktilo süresi en az 1 saniye olmalıdır.`
    }
  }

  for (const button of buttons) {
    if (!button.id.trim()) return 'Tüm butonların ID alanı dolu olmalı.'
    if (!nodeIdSet.has(button.node_id)) {
      return `"${button.label || button.slug}" butonu geçersiz bir kapıya bağlı.`
    }

    if (!button.slug.trim()) return 'Tüm butonların slug alanı dolu olmalı.'
    if (!button.label.trim()) return 'Tüm butonların etiketi dolu olmalı.'

    if (
      button.button_type === 'open_node' &&
      (!button.target_node_id || !nodeIdSet.has(button.target_node_id))
    ) {
      return `"${button.label}" butonu için geçerli bir hedef kapı seçilmelidir.`
    }

    if (button.button_type === 'external_url') {
      const externalUrl = button.external_url?.trim() ?? ''

      if (!externalUrl || externalUrl === 'https://' || externalUrl === 'http://') {
        return `"${button.label}" harici bağlantı butonu için geçerli bir URL girilmelidir.`
      }

      if (!isValidUrl(externalUrl)) {
        return `"${button.label}" harici bağlantı butonu geçerli bir URL içermiyor.`
      }
    }

    if (button.transition_duration_seconds < 0) {
      return `"${button.label}" butonunun geçiş süresi negatif olamaz.`
    }

    if (button.ban_duration_seconds < 1) {
      return `"${button.label}" butonunun ban süresi en az 1 saniye olmalıdır.`
    }
  }

  return null
}

function prepareNodeRows(nodes: ExperienceNode[], now: string) {
  return nodes.map((node) => ({
    id: node.id,
    slug: node.slug.trim(),
    title: node.title.trim(),
    content_type: node.content_type,
    text_content: normalizeText(node.text_content),
    text_mode: node.text_mode,
      typewriter_duration_seconds: node.typewriter_duration_seconds,
    is_active: Boolean(node.is_active),
    sort_order: node.sort_order,
    updated_at: now,
  }))
}

function prepareButtonRows(buttons: ExperienceButton[], now: string) {
  return buttons.map((button) => {
    const isOpenNode = button.button_type === 'open_node'
    const isExternalUrl = button.button_type === 'external_url'
    const showTransition = Boolean(button.show_transition)

    return {
      id: button.id,
      node_id: button.node_id,
      slug: button.slug.trim(),
      label: button.label.trim(),
      button_type: button.button_type,
      target_node_id: isOpenNode ? button.target_node_id : null,
      external_url: isExternalUrl ? button.external_url?.trim() ?? null : null,
      show_transition: showTransition,
      transition_text: showTransition ? normalizeText(button.transition_text) : '',
      transition_duration_seconds: showTransition ? button.transition_duration_seconds : 0,
      ban_duration_seconds: button.ban_duration_seconds,
      confirm_text_override: button.confirm_text_override?.trim() || null,
      is_active: Boolean(button.is_active),
      sort_order: button.sort_order,
      updated_at: now,
    }
  })
}

async function readExperiencePayload(
  supabase: AdminSupabaseClient
): Promise<ExperiencePayload> {
  const { data: siteContent, error: siteContentError } = await supabase
    .from('site_content')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (siteContentError) {
    throw new Error(`site_content okunamadı: ${siteContentError.message}`)
  }

  const { data: nodes, error: nodesError } = await supabase
    .from('experience_nodes')
    .select('id, slug, title, content_type, text_content, text_mode, typewriter_duration_seconds, is_active, sort_order')
    .order('sort_order', { ascending: true })

  if (nodesError) {
    throw new Error(`experience_nodes okunamadı: ${nodesError.message}`)
  }

  if (!nodes || nodes.length === 0) {
    return buildLegacyExperience(siteContent)
  }

  const { data: buttons, error: buttonsError } = await supabase
    .from('experience_buttons')
    .select(
      'id, node_id, slug, label, button_type, target_node_id, external_url, show_transition, transition_text, transition_duration_seconds, ban_duration_seconds, confirm_text_override, is_active, sort_order'
    )
    .order('sort_order', { ascending: true })

  if (buttonsError) {
    throw new Error(`experience_buttons okunamadı: ${buttonsError.message}`)
  }

  return {
    settings: normalizeSettings(siteContent),
    nodes: sortNodes((nodes ?? []).map(normalizeNode)),
    buttons: sortButtons((buttons ?? []).map(normalizeButton)),
  }
}

async function getExistingIds(supabase: AdminSupabaseClient) {
  const { data: existingNodes, error: existingNodesError } = await supabase
    .from('experience_nodes')
    .select('id')

  if (existingNodesError) {
    throw new Error(`Mevcut kapılar okunamadı: ${existingNodesError.message}`)
  }

  const { data: existingButtons, error: existingButtonsError } = await supabase
    .from('experience_buttons')
    .select('id')

  if (existingButtonsError) {
    throw new Error(`Mevcut butonlar okunamadı: ${existingButtonsError.message}`)
  }

  return {
    nodeIds: (existingNodes ?? []).map((node) => node.id as string),
    buttonIds: (existingButtons ?? []).map((button) => button.id as string),
  }
}

async function deleteRowsByIds(
  supabase: AdminSupabaseClient,
  table: 'experience_nodes' | 'experience_buttons',
  ids: string[],
  label: string
) {
  if (!ids.length) return

  const { error } = await supabase.from(table).delete().in('id', ids)

  if (error) {
    throw new Error(`${label} silinemedi: ${error.message}`)
  }
}

async function saveExperienceGraph(
  supabase: AdminSupabaseClient,
  settings: ExperienceSettings,
  nodes: ExperienceNode[],
  buttons: ExperienceButton[]
) {
  const now = new Date().toISOString()
  const nodeRows = prepareNodeRows(nodes, now)
  const buttonRows = prepareButtonRows(buttons, now)

  const nextNodeIds = new Set(nodeRows.map((node) => node.id))
  const nextButtonIds = new Set(buttonRows.map((button) => button.id))

  const existingIds = await getExistingIds(supabase)

  const buttonIdsToDelete = existingIds.buttonIds.filter((id) => !nextButtonIds.has(id))
  const nodeIdsToDelete = existingIds.nodeIds.filter((id) => !nextNodeIds.has(id))

  await deleteRowsByIds(
    supabase,
    'experience_buttons',
    buttonIdsToDelete,
    'Kaldırılan butonlar'
  )

  await deleteRowsByIds(
    supabase,
    'experience_nodes',
    nodeIdsToDelete,
    'Kaldırılan kapılar'
  )

  const { error: nodeUpsertError } = await supabase
    .from('experience_nodes')
    .upsert(nodeRows, { onConflict: 'id' })

  if (nodeUpsertError) {
    throw new Error(`Kapılar kaydedilemedi: ${nodeUpsertError.message}`)
  }

  const { error: buttonUpsertError } = await supabase
    .from('experience_buttons')
    .upsert(buttonRows, { onConflict: 'id' })

  if (buttonUpsertError) {
    throw new Error(`Butonlar kaydedilemedi: ${buttonUpsertError.message}`)
  }

  const { error: settingsError } = await supabase.from('site_content').upsert({
    id: 1,
    entry_btn_label: settings.entry_btn_label,
    bg_music_url: settings.bg_music_url,
    footer_text: settings.footer_text,
    mobile_autoscroll_enabled: settings.mobile_autoscroll_enabled,
    root_node_id: settings.root_node_id,
    updated_at: now,
  })

  if (settingsError) {
    throw new Error(`Genel ayarlar kaydedilemedi: ${settingsError.message}`)
  }
}

export async function GET() {
  if (!(await checkAuth())) {
    return jsonError('Unauthorized', 401)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonOk(buildLegacyExperience(null))
  }

  try {
    const supabase = createAdminClient()
    const payload = await readExperiencePayload(supabase)

    return jsonOk(payload)
  } catch (error) {
    console.error('admin experience get error', error)

    return jsonError(getErrorMessage(error), 500)
  }
}

export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) {
    return jsonError('Unauthorized', 401)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError('Supabase admin client yapılandırılmamış.', 500)
  }

  try {
    const body = await req.json()

    const settings = normalizeSettings(body?.settings)
    const nodes = sortNodes((body?.nodes ?? []).map(normalizeNode))
    const buttons = sortButtons((body?.buttons ?? []).map(normalizeButton))

    const validationError = validateGraph(nodes, buttons, settings.root_node_id)

    if (validationError) {
      return jsonError(validationError, 400)
    }

    const supabase = createAdminClient()

    await saveExperienceGraph(supabase, settings, nodes, buttons)

    const payload = await readExperiencePayload(supabase)

    return jsonOk({
      status: 'updated',
      ...payload,
    })
  } catch (error) {
    console.error('admin experience put error', error)

    return jsonError(getErrorMessage(error), 500)
  }
  }
