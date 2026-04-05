'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navGroups = [
  {
    label: '프로필',
    items: [
      { label: '대시보드', href: '/dashboard' },
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

  return (
    <div className="flex min-h-screen bg-white">

      {/* 사이드바 */}
      <aside className="w-[230px] flex-shrink-0 flex flex-col justify-between bg-white border-r border-gray-100 sticky top-0 h-screen overflow-y-auto">

        {/* 상단 로고 */}
        <div className="p-6">
          <p className="font-bold text-lg text-gray-900 tracking-tight">Isosoer</p>
          <p className="text-[10px] text-gray-400 tracking-widest mt-0.5">CAREER CURATOR</p>

          {/* 네비게이션 */}
          <nav className="mt-8 space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-gray-400 px-3 mb-2 tracking-wider uppercase">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-600 font-medium'
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

        {/* 하단 유저 정보 */}
        <div className="p-4 m-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600 font-medium flex-shrink-0">
              U
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">김이소서</p>
              <p className="text-xs text-gray-400">Premium Member</p>
            </div>
          </div>
        </div>

      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

    </div>
  )
}
