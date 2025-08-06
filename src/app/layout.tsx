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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/entry', label: 'Log Entry' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/data', label: 'Data' },
  ];

  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <AuthProvider>
          <header className="fixed top-0 w-full z-50 bg-gradient-to-br from-purple-600 via-purple-500 to-blue-500 shadow-lg backdrop-blur-md">
            <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-extrabold text-white">🧩</span>
                <span className="text-white text-xl font-bold">Puzzle Tracker</span>
              </div>
              <ul className="hidden md:flex space-x-6">
                {links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`text-white font-medium hover:text-yellow-300 transition-colors ${
                        pathname === link.href ? 'underline decoration-yellow-300' : ''
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {/* Mobile menu placeholder */}
              <div className="md:hidden">
                {/* Future: add hamburger menu here */}
                <Link href="/" className="text-white font-medium">
                  Menu
                </Link>
              </div>
            </nav>
          </header>
          {/* push content below fixed header */}
          <div className={`${pathname === '/' ? '' : 'pt-24'} bg-transparent`}>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}