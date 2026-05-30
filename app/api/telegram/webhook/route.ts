import { NextRequest, NextResponse } from 'next/server'
import { extractDeviceIdFromMessage } from '@/lib/telegram'
import { createAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret
    const secret = req.headers.get('x-telegram-bot-api-secret-token')
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const message = body?.message

    if (!message) return NextResponse.json({ ok: true })

    // Only process replies
    const replyToText = message?.reply_to_message?.text
    if (!replyToText) return NextResponse.json({ ok: true })

    // Extract device_id from the original notification message
    const deviceId = extractDeviceIdFromMessage(replyToText)
    if (!deviceId) return NextResponse.json({ ok: true })

    const replyText = message?.text
    if (!replyText) return NextResponse.json({ ok: true })

    const supabase = createAdminClient()

    // Save admin reply to database — realtime will push it to the browser
    await supabase.from('messages').insert({
      device_id: deviceId,
      content: replyText,
      sender: 'admin',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('webhook error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
