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

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { deviceId, content } = await req.json()
    if (!deviceId || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = createAdminClient()

    // Mesajı tabloya ekle
    const { error } = await supabase.from('messages').insert({
      device_id: deviceId,
      content: content.trim(),
      sender: 'admin'
    })

    if (error) {
      console.error('admin reply insert error', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ status: 'sent' })
  } catch (err) {
    console.error('admin reply error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
