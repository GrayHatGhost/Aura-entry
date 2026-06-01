import type { SupabaseClient } from '@supabase/supabase-js'

export type DeviceEventType =
  | 'site_visit'
  | 'repeat_visit'
  | 'screen_view'
  | 'button_click'
  | 'external_link'
  | 'ban_action'
  | 'back_click'
  | 'chat_message'

export interface DeviceEventPayload {
  deviceId: string
  eventType: DeviceEventType
  stage?: string | null
  nodeId?: string | null
  nodeSlug?: string | null
  nodeTitle?: string | null
  buttonId?: string | null
  buttonSlug?: string | null
  buttonLabel?: string | null
  buttonType?: string | null
  targetNodeId?: string | null
  targetNodeSlug?: string | null
  targetNodeTitle?: string | null
  transitionUsed?: boolean
  transitionText?: string | null
  transitionDurationSeconds?: number | null
  ip?: string | null
  metadata?: Record<string, unknown> | null
}

function cleanText(value: string | null | undefined, maxLength = 500) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  return trimmed.slice(0, maxLength)
}

function toSafeInteger(value: number | null | undefined, fallback = 0, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(min, Math.round(value))
}

export async function insertDeviceEvent(
  supabase: SupabaseClient,
  payload: DeviceEventPayload
) {
  const row = {
    device_id: payload.deviceId,
    event_type: payload.eventType,
    stage: cleanText(payload.stage ?? payload.nodeSlug ?? 'unknown', 120) ?? 'unknown',
    node_id: cleanText(payload.nodeId, 120),
    node_slug: cleanText(payload.nodeSlug ?? payload.stage, 120),
    node_title: cleanText(payload.nodeTitle, 180),
    button_id: cleanText(payload.buttonId, 120),
    button_slug: cleanText(payload.buttonSlug, 120),
    button_label: cleanText(payload.buttonLabel, 180) ?? '',
    button_type: cleanText(payload.buttonType, 60),
    target_node_id: cleanText(payload.targetNodeId, 120),
    target_node_slug: cleanText(payload.targetNodeSlug, 120),
    target_node_title: cleanText(payload.targetNodeTitle, 180),
    transition_used: Boolean(payload.transitionUsed),
    transition_text: cleanText(payload.transitionText, 1000) ?? '',
    transition_duration_seconds: toSafeInteger(payload.transitionDurationSeconds, 0, 0),
    ip: cleanText(payload.ip, 120) ?? '0.0.0.0',
    metadata: payload.metadata ?? {},
  }

  const { error } = await supabase.from('device_events').insert(row)

  if (error) {
    throw error
  }
}
