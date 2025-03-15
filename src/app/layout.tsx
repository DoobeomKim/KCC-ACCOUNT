import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={inter.className}>
      <div className="lg:pl-72">
        <main className="min-h-screen w-full">
          <div className="w-full max-w-[1200px] mx-auto lg:ml-0 xl:mx-8 2xl:ml-8 2xl:mr-auto px-2 sm:px-4 lg:pr-4 xl:pr-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
