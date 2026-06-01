import { NextRequest, NextResponse } from 'next/server'
import { getAdminCookieOptions, signAdminToken, verifyAdminToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  const token = await signAdminToken()

  const res = NextResponse.json({ status: 'ok' })
  res.cookies.set('aura_admin', token, getAdminCookieOptions())
  return res
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_admin')?.value

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const isValid = await verifyAdminToken(token)

  if (!isValid) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 })
    response.cookies.delete('aura_admin')
    return response
  }

  const response = NextResponse.json({ authenticated: true })
  response.cookies.set('aura_admin', token, getAdminCookieOptions())
  return response
}

export async function DELETE() {
  const res = NextResponse.json({ status: 'logged_out' })
  res.cookies.delete('aura_admin')
  return res
}
