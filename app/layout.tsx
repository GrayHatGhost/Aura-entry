import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aura',
  description: '',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{
        margin: 0, padding: 0,
        background: '#07070c',
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      }}>
        {children}
      </body>
    </html>
  )
}
