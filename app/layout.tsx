import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'

import './globals.css'
import { BusinessProvider } from "@/lib/business-context"

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Finbuy IMS - Inventory Management System',
  description: 'Professional inventory management system for home appliances and sneakers',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AuthProvider>
          <BusinessProvider>
          {children}
          </BusinessProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
