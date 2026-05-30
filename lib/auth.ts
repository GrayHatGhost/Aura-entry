import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signAdminToken() {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export async function signVisitorToken(deviceId: string) {
  return await new SignJWT({ role: 'visitor', deviceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyVisitorToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'visitor' || typeof payload.deviceId !== 'string') {
      return null
    }
    return { deviceId: payload.deviceId }
  } catch {
    return null
  }
}
