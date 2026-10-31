import React from "react"
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'

import './globals.css'
import { BusinessProvider } from "@/lib/business-context"

// Headings: Outfit (variable font, loaded and self-hosted by Next)
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
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
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <head>
        {/* Body / UI font: Satoshi, served by Fontshare */}
        <link
          rel="preconnect"
          href="https://api.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://cdn.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <BusinessProvider>
          {children}
          </BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  )
}