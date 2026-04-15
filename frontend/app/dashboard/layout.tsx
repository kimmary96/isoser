'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LandingANavBar, LandingATickerBar } from '@/app/(landing)/landing-a/_components'
import { getDashboardMe, signOutDashboard } from '@/lib/api/app'

const navGroups = [
  {
    label: '',
    items: [
      { label: '대시보드', href: '/dashboard' },
    ],
  },
  {
    label: '프로필',
    items: [
      { label: '내 프로필', href: '/dashboard/profile' },
      { label: '성과저장소', href: '/dashboard/activities' },
      { label: '자기소개서', href: '/dashboard/cover-letter' },
    ],
  },
  {
    label: '문서 자동 완성',
    items: [
      { label: '이력서', href: '/dashboard/resume' },
      { label: '포트폴리오', href: '/dashboard/portfolio' },
      { label: '문서 저장소', href: '/dashboard/documents' },
    ],
  },
  {
    label: 'AI 코칭',
    items: [
      { label: '공고 매칭 분석', href: '/dashboard/match' },
      { label: '코치 이력서 첨삭', href: '/dashboard/coach' },
    ],
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [authChecking, setAuthChecking] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState<{
    id: string
    email: string | null
    displayName: string
    avatarUrl: string | null
  } | null>(null)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const result = await getDashboardMe()
        if (!mounted) return
        setUser(result.user)
      } finally {
        if (mounted) {
          setAuthChecking(false)
        }
      }
    }

    void initializeAuth()

    return () => {
      mounted = false
    }
  }, [])

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '사용자'
  const fallbackInitial = displayName.slice(0, 1) || 'U'
  const showLoginButton = !user

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOutDashboard()
      setUser(null)
      router.replace('/login')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <LandingATickerBar />
      <LandingANavBar />
      <div className="flex min-h-[calc(100vh-73px)] bg-white">
        <aside className="sticky top-[73px] flex h-[calc(100vh-73px)] w-[230px] flex-shrink-0 flex-col justify-between overflow-y-auto border-r border-gray-100 bg-white">
          <div className="p-6">
            <p className="text-lg font-bold tracking-tight text-gray-900">Isoser</p>
            <p className="mt-0.5 text-[10px] tracking-widest text-gray-400">CAREER CURATOR</p>

            <nav className="mt-8 space-y-6">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`flex items-center rounded-lg px-3 py-2 text-sm transition-all ${
                              isActive
                                ? 'bg-blue-50 font-medium text-blue-600'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="m-3 rounded-xl bg-gray-50 p-4">
            {authChecking ? (
              <div className="h-8" />
            ) : showLoginButton ? (
              <Link
                href="/login"
                className="block w-full rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                회원가입 / 로그인
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${displayName} 프로필 이미지`}
                    className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-medium text-gray-600">
                    {fallbackInitial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="truncate text-xs text-gray-400">{user?.email ?? ''}</p>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="mt-1 text-xs text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
