import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyVisitorToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'

// Public route — lets visitor fetch their own messages
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const deviceId = searchParams.get('deviceId')

  if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_visitor')?.value
  const visitor = token ? await verifyVisitorToken(token) : null

  if (!visitor || visitor.deviceId !== deviceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}
