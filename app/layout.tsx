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