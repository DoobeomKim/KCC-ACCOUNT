'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Sidebar from "@/components/layout/Sidebar"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Check } from "lucide-react"

interface CompanySettings {
  email: string
  company_name: string
  city: string
  role: 'admin' | 'user'
}

type FormDataPolicy = 'default' | 'strict'

interface SystemSettings {
  formDataPolicy: FormDataPolicy
}

const policyConfigs: Record<FormDataPolicy, {
  label: string
  description: string
  clearTriggers: {
    onBrowserClose: boolean
    onLogout: boolean
    onNavigation: boolean
    onRefresh: boolean
  }
}> = {
  default: {
    label: '기본 옵션',
    description: '브라우저 종료 또는 로그아웃 시에만 데이터가 삭제됩니다.',
    clearTriggers: {
      onBrowserClose: true,
      onLogout: true,
      onNavigation: false,
      onRefresh: false
    }
  },
  strict: {
    label: '엄격한 보안 옵션',
    description: '페이지 이동, 새로고침 시 즉시 데이터가 삭제됩니다.',
    clearTriggers: {
      onBrowserClose: true,
      onLogout: true,
      onNavigation: true,
      onRefresh: true
    }
  }
}

// 필수 입력 필드 라벨 컴포넌트
const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-1">
    {children}
    <span className="text-red-500">*</span>
  </div>
)

export default function SettingsPage() {
  const t = useTranslations('settings')
  const nav = useTranslations('navigation')
  const [settings, setSettings] = useState<CompanySettings>({
    email: '',
    company_name: '',
    city: '',
    role: 'user'
  })
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    formDataPolicy: 'default'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // 사용자 및 시스템 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. 현재 로그인된 사용자 세션 가져오기
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) {
          console.log('No session or email found')
          return
        }

        const userEmail = session.user.email
        console.log('Current user email:', userEmail)

        // 2. 회사 프로필 데이터 가져오기
        const { data: companyProfile, error: companyError } = await supabase
          .from('company_profiles')
          .select('company_name, city')
          .eq('email', userEmail)
          .single()

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company profile:', companyError)
        }

        // 3. 사용자 프로필에서 role 가져오기
        const { data: userProfile, error: userError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('email', userEmail)
          .single()

        if (userError && userError.code !== 'PGRST116') {
          console.error('Error fetching user profile:', userError)
        }

        // 4. 시스템 설정 가져오기
        const { data: systemData, error: systemError } = await supabase
          .from('system_settings')
          .select('form_data_policy')
          .single()

        if (systemError && systemError.code !== 'PGRST116') {
          console.error('Error fetching system settings:', systemError)
        }

        // 5. 상태 업데이트
        setSettings({
          email: userEmail,
          company_name: companyProfile?.company_name || '',
          city: companyProfile?.city || '',
          role: userProfile?.role || 'user'
        })

        setSystemSettings({
          formDataPolicy: (systemData?.form_data_policy as FormDataPolicy) || 'default'
        })

      } catch (error) {
        console.error('Error in fetchData:', error)
        toast.error(t('notifications.error'))
      } finally {
        setIsInitialLoad(false)
      }
    }

    fetchData()
  }, [t])

  const validateSettings = () => {
    if (!settings.company_name.trim()) {
      toast.error(t('validation.companyNameRequired'))
      return false
    }
    if (!settings.city.trim()) {
      toast.error(t('validation.cityRequired'))
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateSettings()) return
    if (!settings.email) {
      toast.error(t('notifications.noSession'))
      return
    }

    setIsLoading(true)
    setSaveStatus('saving')
    
    try {
      const timestamp = new Date().toISOString()

      // upsert 사용 (insert or update)
      const { error } = await supabase
        .from('company_profiles')
        .upsert({
          email: settings.email,
          company_name: settings.company_name.trim(),
          city: settings.city.trim(),
          updated_at: timestamp
        }, {
          onConflict: 'email'  // email을 기준으로 upsert
        })

      if (error) throw error

      toast.success(t('notifications.saveSuccess'))
      setSaveStatus('saved')
      
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)

    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(t('notifications.saveError'))
      setSaveStatus('idle')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSystemSettingsSave = async () => {
    if (settings.role !== 'admin') {
      toast.error(t('notifications.adminOnly'))
      return
    }

    setIsLoading(true)
    setSaveStatus('saving')
    
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          id: 1, // 단일 레코드를 위한 고정 ID
          form_data_policy: systemSettings.formDataPolicy,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success(t('notifications.saveSuccess'))
      setSaveStatus('saved')
      
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)

    } catch (error) {
      console.error('Error saving system settings:', error)
      toast.error(t('notifications.saveError'))
      setSaveStatus('idle')
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitialLoad) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 lg:ml-64">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
              <div className="space-y-4">
                <div className="h-40 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{nav('settings')}</h1>
            <p className="text-gray-500">{t('description')}</p>
          </div>

          <div className="max-w-3xl">
            <div className="mb-6 text-sm text-gray-600">
              {t('roleInfo.message', {
                email: settings.email,
                role: t(`roleInfo.${settings.role}`)
              })}
            </div>

            <Tabs defaultValue="company" className="space-y-4">
              <TabsList>
                <TabsTrigger value="company">{t('companyInfo.title')}</TabsTrigger>
                {settings.role === 'admin' && (
                  <TabsTrigger value="system">{t('systemSettings.title')}</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="company">
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <Label>{t('companyInfo.email')}</Label>
                      <Input 
                        value={settings.email}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel>
                        <Label>{t('companyInfo.companyName')}</Label>
                      </RequiredLabel>
                      <Input 
                        value={settings.company_name}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          company_name: e.target.value 
                        }))}
                        placeholder={t('companyInfo.companyNamePlaceholder')}
                        className={`bg-white ${!settings.company_name && !isInitialLoad ? 'border-red-300' : ''}`}
                      />
                      {!settings.company_name && !isInitialLoad && (
                        <p className="text-sm text-red-500 mt-1">
                          {t('validation.companyNameRequired')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <RequiredLabel>
                        <Label>{t('companyInfo.city')}</Label>
                      </RequiredLabel>
                      <Input 
                        value={settings.city}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          city: e.target.value 
                        }))}
                        placeholder={t('companyInfo.cityPlaceholder')}
                        className={`bg-white ${!settings.city && !isInitialLoad ? 'border-red-300' : ''}`}
                      />
                      {!settings.city && !isInitialLoad && (
                        <p className="text-sm text-red-500 mt-1">
                          {t('validation.cityRequired')}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="mt-6 flex justify-end items-center gap-4">
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">{t('status.saved')}</span>
                    </div>
                  )}
                  {saveStatus === 'saving' && (
                    <div className="text-sm text-gray-600">
                      {t('status.saving')}
                    </div>
                  )}
                  <Button 
                    onClick={handleSave}
                    disabled={isLoading}
                  >
                    {isLoading ? t('actions.saving') : t('actions.save')}
                  </Button>
                </div>
              </TabsContent>

              {settings.role === 'admin' && (
                <TabsContent value="system">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('systemSettings.formDataManagement.title')}</CardTitle>
                      <CardDescription>
                        {t('systemSettings.formDataManagement.description')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <RadioGroup
                          value={systemSettings.formDataPolicy}
                          onValueChange={(value: FormDataPolicy) => 
                            setSystemSettings(prev => ({ ...prev, formDataPolicy: value }))
                          }
                          className="space-y-4"
                        >
                          {Object.entries(policyConfigs).map(([key, config]) => (
                            <div key={key} className="flex items-start space-x-3">
                              <RadioGroupItem value={key} id={key} />
                              <div className="space-y-1">
                                <Label htmlFor={key} className="text-base font-medium">
                                  {t(`systemSettings.formDataManagement.options.${key}.label`)}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  {t(`systemSettings.formDataManagement.options.${key}.description`)}
                                </p>
                                <div className="text-sm text-muted-foreground mt-2">
                                  <p>{t('systemSettings.formDataManagement.deletionPoints')}</p>
                                  <ul className="list-disc list-inside ml-2 mt-1">
                                    {config.clearTriggers.onBrowserClose && 
                                      <li>{t('systemSettings.formDataManagement.triggers.browserClose')}</li>}
                                    {config.clearTriggers.onLogout && 
                                      <li>{t('systemSettings.formDataManagement.triggers.logout')}</li>}
                                    {config.clearTriggers.onNavigation && 
                                      <li>{t('systemSettings.formDataManagement.triggers.navigation')}</li>}
                                    {config.clearTriggers.onRefresh && 
                                      <li>{t('systemSettings.formDataManagement.triggers.refresh')}</li>}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="mt-6 flex justify-end items-center gap-4">
                    {saveStatus === 'saved' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">{t('status.saved')}</span>
                      </div>
                    )}
                    {saveStatus === 'saving' && (
                      <div className="text-sm text-gray-600">
                        {t('status.saving')}
                      </div>
                    )}
                    <Button 
                      onClick={handleSystemSettingsSave}
                      disabled={isLoading}
                    >
                      {isLoading ? t('actions.saving') : t('actions.save')}
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
} 