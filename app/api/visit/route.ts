import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { signVisitorToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const fallbackRes = NextResponse.json({ status: 'ok', isChatMode: false })
      const fallbackToken = await signVisitorToken((await req.json()).deviceId)
      fallbackRes.cookies.set('aura_visitor', fallbackToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
      return fallbackRes
    }
    const body = await req.json()
    const { 
      deviceId, model, browser, resolution, entryType,
      city = 'Unknown',
      country = 'Unknown',
      isp = 'Unknown',
      timezone = 'Unknown',
      os_name = 'Unknown',
      device_memory = 0,
      cpu_cores = 0,
      publicIp = null
    } = body

    // Use the public IP from client if available (better for vercel/local routing)
    const ip = publicIp ||
      req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      '0.0.0.0'

    const supabase = createAdminClient()

    // Check if device is blocked
    const { data: existing } = await supabase
      .from('devices')
      .select('*')
      .eq('device_id', deviceId)
      .single()

    if (existing?.is_blocked) {
      const now = new Date()
      const blockedUntil = new Date(existing.blocked_until)
      if (now < blockedUntil) {
        const blockedRes = NextResponse.json({ status: 'blocked', blockedUntil: existing.blocked_until })
        const blockedToken = await signVisitorToken(deviceId)
        blockedRes.cookies.set('aura_visitor', blockedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        })
        return blockedRes
      }
      // Unblock automatically after 6h
      await supabase
        .from('devices')
        .update({ is_blocked: false, blocked_until: null })
        .eq('device_id', deviceId)
    }

    // Upsert device
    await supabase.from('devices').upsert({
      device_id: deviceId,
      model,
      browser,
      resolution,
      ip,
      entry_type: entryType,
      city,
      country,
      isp,
      timezone,
      os_name,
      device_memory,
      cpu_cores,
      last_seen: new Date().toISOString(),
      ...(existing ? {} : { first_seen: new Date().toISOString(), is_chat_mode: false, is_blocked: false }),
    }, { onConflict: 'device_id' })

    // Update metrics
    const col = entryType === 'qr' ? 'qr_count' : 'direct_count'
    await supabase.rpc('increment_metric', { col_name: col })

    // Telegram notification
    const label = `${model} - ${ip}`
    const msg =
      entryType === 'qr'
        ? `${label} (${city}, ${country}) QR kodunu taratarak web sitesine girdi.`
        : `${label} (${city}, ${country}) doğrudan URL ile web sitesine girdi.`

    await sendTelegramMessage(msg, deviceId)

    const isChatMode = existing?.is_chat_mode ?? false
    const res = NextResponse.json({ status: 'ok', isChatMode })
    const visitorToken = await signVisitorToken(deviceId)
    res.cookies.set('aura_visitor', visitorToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('visit error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
