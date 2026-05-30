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
} from '@/lib/experience'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_admin')?.value
  if (!token) return false
  return verifyAdminToken(token)
}

function unique(values: string[]) {
  return new Set(values).size === values.length
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function validateGraph(nodes: ExperienceNode[], buttons: ExperienceButton[], rootNodeId: string) {
  const nodeIds = nodes.map((node) => node.id)
  const nodeSlugs = nodes.map((node) => node.slug)
  const buttonIds = buttons.map((button) => button.id)
  const buttonSlugs = buttons.map((button) => button.slug)
  const nodeIdSet = new Set(nodeIds)

  if (!nodeIds.length) return 'En az bir kapi gerekli.'
  if (!rootNodeId || !nodeIdSet.has(rootNodeId)) return 'Gecerli bir kok kapi secilmelidir.'
  if (!unique(nodeIds)) return 'Node id degerleri benzersiz olmali.'
  if (!unique(nodeSlugs)) return 'Node slug degerleri benzersiz olmali.'
  if (!unique(buttonIds)) return 'Button id degerleri benzersiz olmali.'
  if (!unique(buttonSlugs)) return 'Button slug degerleri benzersiz olmali.'

  for (const node of nodes) {
    if (!node.slug.trim()) return 'Tum kapilarin slug alani dolu olmali.'
    if (!node.title.trim()) return 'Tum kapilarin basligi dolu olmali.'
  }

  for (const button of buttons) {
    if (!nodeIdSet.has(button.node_id)) return 'Bir buton gecersiz bir node_id kullaniyor.'
    if (!button.slug.trim()) return 'Tum butonlarin slug alani dolu olmali.'
    if (!button.label.trim()) return 'Tum butonlarin etiketi dolu olmali.'
    if (button.button_type === 'open_node' && (!button.target_node_id || !nodeIdSet.has(button.target_node_id))) {
      return 'Kapi acan butonlar icin gecerli hedef kapi secilmelidir.'
    }
    if (button.button_type === 'external_url' && (!button.external_url || !isValidUrl(button.external_url))) {
      return 'Harici baglanti butonlari icin gecerli bir URL girilmelidir.'
    }
    if (button.button_type !== 'external_url' && button.external_url) {
      return 'Sadece harici baglanti butonlarinda URL bulunabilir.'
    }
  }

  return null
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(buildLegacyExperience(null))
  }

  try {
    const supabase = createAdminClient()
    const { data: siteContent } = await supabase.from('site_content').select('*').single()
    const { data: nodes, error: nodesError } = await supabase
      .from('experience_nodes')
      .select('id, slug, title, content_type, text_content, text_mode, is_active, sort_order')
      .order('sort_order', { ascending: true })

    if (nodesError || !nodes || nodes.length === 0) {
      return NextResponse.json(buildLegacyExperience(siteContent))
    }

    const { data: buttons } = await supabase
      .from('experience_buttons')
      .select(
        'id, node_id, slug, label, button_type, target_node_id, external_url, show_transition, transition_text, transition_duration_ms, ban_duration_seconds, confirm_text_override, is_active, sort_order'
      )
      .order('sort_order', { ascending: true })

    return NextResponse.json({
      settings: normalizeSettings(siteContent),
      nodes: sortNodes((nodes ?? []).map(normalizeNode)),
      buttons: sortButtons((buttons ?? []).map(normalizeButton)),
    })
  } catch (error) {
    console.error('admin experience get error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const settings = normalizeSettings(body?.settings)
    const nodes = sortNodes((body?.nodes ?? []).map(normalizeNode))
    const buttons = sortButtons((body?.buttons ?? []).map(normalizeButton))

    const validationError = validateGraph(nodes, buttons, settings.root_node_id)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    const nodeRows = nodes.map((node) => ({
      ...node,
      updated_at: now,
    }))

    const buttonRows = buttons.map((button) => ({
      ...button,
      target_node_id: button.button_type === 'open_node' ? button.target_node_id : null,
      external_url: button.button_type === 'external_url' ? button.external_url : null,
      confirm_text_override: button.confirm_text_override || null,
      transition_text: button.show_transition ? button.transition_text : '',
      transition_duration_ms: button.show_transition ? button.transition_duration_ms : 0,
      updated_at: now,
    }))

    await supabase.from('experience_buttons').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('experience_nodes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const { error: nodeInsertError } = await supabase.from('experience_nodes').insert(nodeRows)
    if (nodeInsertError) {
      return NextResponse.json({ error: nodeInsertError.message }, { status: 400 })
    }

    const { error: buttonInsertError } = await supabase.from('experience_buttons').insert(buttonRows)
    if (buttonInsertError) {
      return NextResponse.json({ error: buttonInsertError.message }, { status: 400 })
    }

    const { error: settingsError } = await supabase
      .from('site_content')
      .upsert({
        id: 1,
        entry_btn_label: settings.entry_btn_label,
        bg_music_url: settings.bg_music_url,
        footer_text: settings.footer_text,
        ban_confirm_text: settings.ban_confirm_text,
        ban_pre_text: settings.ban_pre_text,
        typewriter_char_delay_ms: settings.typewriter_char_delay_ms,
        mobile_autoscroll_enabled: settings.mobile_autoscroll_enabled,
        root_node_id: settings.root_node_id,
        updated_at: now,
      })

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 400 })
    }

    return NextResponse.json({ status: 'updated' })
  } catch (error) {
    console.error('admin experience put error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
