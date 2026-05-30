import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyVisitorToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

// Rate limit store (in-memory, resets on server restart)
const rateLimitMap = new Map<string, { count: number; reset: number }>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, content } = body
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

    // Rate limiting: max 10 messages per minute per IP
    const now = Date.now()
    const limit = rateLimitMap.get(ip)
    if (limit && now < limit.reset) {
      if (limit.count >= 10) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
      }
      limit.count++
    } else {
      rateLimitMap.set(ip, { count: 1, reset: now + 60000 })
    }

    const supabase = createAdminClient()

    // Get device info
    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .single()

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Save message
    await supabase.from('messages').insert({
      device_id: deviceId,
      content,
      sender: 'visitor',
    })

    // Enable chat mode
    await supabase
      .from('devices')
      .update({ is_chat_mode: true })
      .eq('device_id', deviceId)

    // Telegram notification
    const label = `${device.model} - ${device.ip}`
    const msg = `${label} IP adresini kullanarak bir mesaj gönderdi: ${content}`
    await sendTelegramMessage(msg, deviceId)

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('message error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
