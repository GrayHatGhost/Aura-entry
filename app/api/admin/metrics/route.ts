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

// GET metrics
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data } = await supabase.from('metrics').select('*').single()
  return NextResponse.json({ metrics: data })
}

// POST — reset metrics
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { field } = await req.json() // 'qr_count' | 'direct_count' | 'both'
  const supabase = createAdminClient()

  const update: Record<string, number> = {}
  if (field === 'both') {
    update.qr_count = 0
    update.direct_count = 0
  } else {
    update[field] = 0
  }

  await supabase.from('metrics').update({ ...update, last_reset: new Date().toISOString() }).eq('id', 1)
  return NextResponse.json({ status: 'reset' })
}
