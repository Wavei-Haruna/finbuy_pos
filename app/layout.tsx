import React from "react"
import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'

import './globals.css'
import { BusinessProvider } from "@/lib/business-context"
import { AskPanel } from "@/components/AskPanel"

// One font for headings and body: Manrope (variable font, self-hosted by Next)
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kashora - Run Your Business Better',
  description:
    'Kashora is a point-of-sale and business management system that helps you run your business better.',
  // Files live in /public, so they are served from the site root
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <body className="font-body antialiased">
        <AuthProvider>
          <BusinessProvider>{children}
            <AskPanel />
          </BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  )
}