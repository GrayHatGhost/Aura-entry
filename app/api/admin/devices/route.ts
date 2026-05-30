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

// GET /api/admin/devices — list all devices with latest message
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .order('last_seen', { ascending: false })

  return NextResponse.json({ devices: devices ?? [] })
}

// DELETE /api/admin/devices — delete device and its messages
export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deviceId } = await req.json()
  const supabase = createAdminClient()

  await supabase.from('messages').delete().eq('device_id', deviceId)
  await supabase.from('devices').delete().eq('device_id', deviceId)

  return NextResponse.json({ status: 'deleted' })
}

// PATCH /api/admin/devices — unblock a device
export async function PATCH(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deviceId } = await req.json()
  const supabase = createAdminClient()

  await supabase
    .from('devices')
    .update({ is_blocked: false, blocked_until: null })
    .eq('device_id', deviceId)

  return NextResponse.json({ status: 'unblocked' })
}
