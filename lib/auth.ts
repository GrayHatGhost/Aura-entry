import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { SignJWT, jwtVerify } from 'jose'

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function getSecret() {
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return new TextEncoder().encode(jwtSecret)
}

export function getAdminCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  }
}

export function getVisitorCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  }
}

export async function signAdminToken() {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject('aura-admin')
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
      subject: 'aura-admin',
    })

    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function signVisitorToken(deviceId: string) {
  return await new SignJWT({ role: 'visitor', deviceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyVisitorToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })

    if (payload.role !== 'visitor' || typeof payload.deviceId !== 'string') {
      return null
    }

    return { deviceId: payload.deviceId }
  } catch {
    return null
  }
}
