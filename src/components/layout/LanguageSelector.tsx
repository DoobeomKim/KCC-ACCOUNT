'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const LanguageSelector = () => {
  const router = useRouter()
  const pathname = usePathname()
  const currentLocale = pathname.split('/')[1]

  const changeLanguage = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    router.push(newPath)
  }

  return (
    <div className="absolute top-4 right-4 z-50 flex gap-2">
      <Button
        variant={currentLocale === 'ko' ? 'default' : 'outline'}
        onClick={() => changeLanguage('ko')}
      >
        한국어
      </Button>
      <Button
        variant={currentLocale === 'de' ? 'default' : 'outline'}
        onClick={() => changeLanguage('de')}
      >
        Deutsch
      </Button>
    </div>
  )
}

export default LanguageSelector 