// src/app/layout.tsx
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}