// // src/app/layout.tsx
// import './globals.css'
// import { AuthProvider } from '@/components/AuthProvider'

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
//         <AuthProvider>{children}</AuthProvider>
//       </body>
//     </html>
//   )
// }

'use client';

import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-[#050b1c] via-[#07122b] to-[#0b1f3f] text-slate-50 antialiased">
        <AuthProvider>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-sky-500/20 blur-[120px]" />
              <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-600/25 blur-[150px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.05),transparent_30%),radial-gradient(circle_at_80%_15%,rgba(111,199,255,0.12),transparent_32%),radial-gradient(circle_at_30%_80%,rgba(100,70,255,0.16),transparent_30%)]" />
            </div>

            <div className="relative">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
