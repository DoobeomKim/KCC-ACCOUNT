'use client'

import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import KCCIcon from '@/components/KCCIcon'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import Sidebar from './Sidebar'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function MobileHeader() {
  const params = useParams()
  const locale = (params?.locale as string) || 'de'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 lg:hidden bg-white border-b">
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="flex items-center justify-center min-h-[48px] min-w-[48px] -ml-3"
              aria-label="메뉴 열기"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="w-[280px] bg-gray-900 p-0"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="sr-only">메인 메뉴</SheetTitle>
              <SheetDescription className="sr-only">
                KCC Account 시스템의 메인 네비게이션 메뉴입니다.
              </SheetDescription>
              <Sidebar isMobile={true} />
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <Link 
          href={`/${locale}/dashboard`} 
          className="flex items-center gap-3 flex-1 min-h-[48px]"
        >
          <KCCIcon className="w-6 h-6" />
          <span className="font-semibold text-base">KCC Account</span>
        </Link>
      </div>
    </header>
  )
} 