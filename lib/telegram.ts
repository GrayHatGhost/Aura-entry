const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!

export async function sendTelegramMessage(text: string, deviceId?: string) {
  // Embed device_id as invisible marker in the message for reply routing
  const marker = deviceId ? `\n\u200B[DEV:${deviceId}]` : ''
  const fullText = text + marker

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: fullText,
      parse_mode: 'HTML',
    }),
  })
  return res.json()
}

// Parse device_id from replied-to message text
export function extractDeviceIdFromMessage(text: string): string | null {
  const match = text.match(/\u200B\[DEV:([^\]]+)\]/)
  return match ? match[1] : null
}
