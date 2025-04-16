'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import KCCIcon from '@/components/KCCIcon'
import {
  LayoutDashboard,
  Receipt,
  List,
  Settings,
  LogOut,
  Menu,
  Globe2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface SidebarProps {
  isMobile?: boolean;
}

export default function Sidebar({ isMobile = false }: SidebarProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const locale = pathname.split('/')[1]

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
        // 사용자 권한 확인
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('email', session.user.email)
          .single()

        if (userProfile) {
          setUserRole(userProfile.role)
        }
      }
    }
    getSession()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = `/${locale}/auth/login`
  }

  const navItems: NavItem[] = [
    {
      href: `/${locale}/dashboard`,
      icon: LayoutDashboard,
      label: t('dashboard')
    },
    {
      href: `/${locale}/business-expense`,
      icon: Receipt,
      label: t('businessExpense')
    },
    {
      href: `/${locale}/expense-list`,
      icon: List,
      label: t('expenseList')
    },
    ...(userRole === 'admin' ? [{
      href: `/${locale}/admin/country-allowances`,
      icon: Globe2,
      label: t('countryAllowances')
    }] : []),
    {
      href: `/${locale}/settings`,
      icon: Settings,
      label: t('settings')
    }
  ]

  const NavLinks = () => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors min-h-[48px]',
              isActive 
                ? 'bg-gray-800 text-white font-medium' 
                : 'text-gray-300 hover:bg-gray-800/50 hover:text-white active:bg-gray-800'
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  const SidebarHeader = () => (
    <div className="px-4 py-4 border-b border-gray-700">
      <div className="flex items-center gap-3 mb-3 min-h-[48px]">
        <KCCIcon className="w-8 h-8" />
        <h1 className="text-lg font-bold text-white">KCC Account</h1>
      </div>
      {userEmail && (
        <div className="text-sm text-gray-300 break-all">
          <div className="text-xs text-gray-400">현재 로그인 중</div>
          <div>{userEmail}</div>
        </div>
      )}
    </div>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <nav className="flex-1 py-2 overflow-y-auto">
        <NavLinks />
      </nav>

      <div className="border-t border-gray-700 p-4 space-y-4 mt-auto">
        <div className="grid grid-cols-2 gap-px p-0.5 bg-gray-700 rounded-lg overflow-hidden">
          <Link
            href={`/ko${pathname.substring(3)}`}
            className={cn(
              "flex items-center justify-center gap-2 py-2 text-sm transition-colors min-h-[40px]",
              pathname.includes('/ko') 
                ? "bg-gray-800 text-white font-medium" 
                : "bg-gray-900 text-gray-300 hover:text-white active:bg-gray-800"
            )}
          >
            <Globe2 className="h-4 w-4 flex-shrink-0" />
            한국어
          </Link>
          <Link
            href={`/de${pathname.substring(3)}`}
            className={cn(
              "flex items-center justify-center gap-2 py-2 text-sm transition-colors min-h-[40px]",
              pathname.includes('/de') 
                ? "bg-gray-800 text-white font-medium" 
                : "bg-gray-900 text-gray-300 hover:text-white active:bg-gray-800"
            )}
          >
            Deutsch
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-300 rounded-lg transition-colors min-h-[48px] hover:bg-gray-800/50 hover:text-white active:bg-gray-800"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">{t('logout')}</span>
        </button>
      </div>
    </div>
  )

  // 모바일 모드일 때는 내부 컨텐츠만 반환
  if (isMobile) {
    return (
      <>
        <SidebarHeader />
        <SidebarContent />
      </>
    )
  }

  // 데스크톱 모드
  return (
    <>
      {/* 모바일 사이드바 */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="lg:hidden flex items-center justify-center p-2"
            size="icon"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-gray-900 p-0">
          <SheetHeader className="p-0">
            <SidebarHeader />
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:block">
        <SidebarHeader />
        <SidebarContent />
      </div>
    </>
  )
} 