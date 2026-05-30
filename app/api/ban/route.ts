import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyVisitorToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, stage = 'unknown', buttonLabel = '', banDurationSeconds = 21600 } = body
    const cookieStore = await cookies()
    const token = cookieStore.get('aura_visitor')?.value
    const visitor = token ? await verifyVisitorToken(token) : null

    if (!visitor || visitor.deviceId !== deviceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip =
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      '0.0.0.0'

    const supabase = createAdminClient()

    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .single()

    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 })

    const safeBanDurationSeconds = Math.max(1, Math.min(Number(banDurationSeconds) || 21600, 60 * 60 * 24 * 365))
    const blockedUntil = new Date(Date.now() + safeBanDurationSeconds * 1000).toISOString()
    const banReason = `${stage} aşamasında "${buttonLabel}" butonuna bastı`

    await supabase
      .from('devices')
      .update({
        is_blocked: true,
        blocked_until: blockedUntil,
        ban_reason: banReason,
      })
      .eq('device_id', deviceId)

    // Log the event
    await supabase.from('device_events').insert({
      device_id: deviceId,
      stage,
      button_label: buttonLabel,
      ip,
    })

    // Telegram notification
    const label = `${device.model} — ${device.ip}`
    const stageLabel: Record<string, string> = {
      home: 'Ana Ekran',
      step2: 'Seçim Ekranı',
      reveal: 'Reveal',
      chat: 'Sohbet',
    }
    const stageName = stageLabel[stage] || stage
    await sendTelegramMessage(
      `🚫 ${label}\n"${buttonLabel}" butonuna basti (${stageName})\n${safeBanDurationSeconds} saniye ban uygulandi.`,
      deviceId
    )

    return NextResponse.json({ status: 'banned', blockedUntil })
  } catch (err) {
    console.error('ban error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
