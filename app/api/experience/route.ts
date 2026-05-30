import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  buildLegacyExperience,
  normalizeButton,
  normalizeNode,
  normalizeSettings,
  sortButtons,
  sortNodes,
} from '@/lib/experience'

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json(buildLegacyExperience(null))
  }

  try {
    const supabase = createAdminClient()
    const { data: siteContent, error: contentError } = await supabase.from('site_content').select('*').single()

    if (contentError || !siteContent) {
      return NextResponse.json(buildLegacyExperience(null))
    }

    const { data: nodes, error: nodesError } = await supabase
      .from('experience_nodes')
      .select('id, slug, title, content_type, text_content, text_mode, is_active, sort_order')
      .order('sort_order', { ascending: true })

    if (nodesError || !nodes || nodes.length === 0) {
      return NextResponse.json(buildLegacyExperience(siteContent))
    }

    const { data: buttons, error: buttonsError } = await supabase
      .from('experience_buttons')
      .select(
        'id, node_id, slug, label, button_type, target_node_id, external_url, show_transition, transition_text, transition_duration_ms, ban_duration_seconds, confirm_text_override, is_active, sort_order'
      )
      .order('sort_order', { ascending: true })

    if (buttonsError) {
      return NextResponse.json(buildLegacyExperience(siteContent))
    }

    return NextResponse.json({
      settings: normalizeSettings(siteContent),
      nodes: sortNodes((nodes ?? []).map(normalizeNode)),
      buttons: sortButtons((buttons ?? []).map(normalizeButton)),
    })
  } catch {
    return NextResponse.json(buildLegacyExperience(null))
  }
}
