'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Video, Image, Eye, Search, Lightbulb, LayoutGrid, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/video-ads', label: 'Video Ads', icon: Video },
  { href: '/static-ads', label: 'Static Ads', icon: Image },
  { href: '/spy', label: 'Ad Spy', icon: Search },
  { href: '/hooks', label: 'Hook Vault', icon: Lightbulb },
  { href: '/boards', label: 'Boards', icon: LayoutGrid },
  { href: '/automations/lipsync', label: 'Lipsync', icon: Mic },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2 min-h-screen">
      <div className="flex items-center gap-2 px-3 py-4 mb-4">
        <Eye className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Succession Media</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
