import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_admin')?.value
  if (!token) return false
  return verifyAdminToken(token)
}

// GET /api/admin/messages?deviceId=xxx
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const deviceId = searchParams.get('deviceId')

  if (!deviceId) return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}
