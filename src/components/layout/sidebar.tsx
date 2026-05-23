"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, CheckSquare, Users, ShieldAlert, Mail } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

export function Sidebar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.role === "admin") setIsAdmin(true)
          })
      }
    })
  }, [])

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href || (href === '/inbox' && pathname.startsWith('/inbox'))) {
      e.preventDefault()
      window.location.href = href
    }
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r border-primary-foreground/20 bg-primary text-primary-foreground sm:flex md:w-64">
      <div className="flex w-full items-center justify-center border-b border-primary-foreground/20 py-4 lg:py-6">
        <Link href="/" className="flex w-full items-center justify-center">
          {/* Logo cho tablet thu gọn */}
          <img src="/logo.png" alt="OfficeHub Logo" className="h-8 object-contain md:hidden" />
          {/* Logo lớn cho desktop */}
          <img src="/logo.png" alt="OfficeHub Logo" className="hidden md:block h-16 w-auto max-w-[180px] object-contain" />
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-2 text-sm font-medium gap-1">
          <Link
            href="/"
            onClick={(e) => handleLinkClick(e, "/")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname === "/" ? "bg-primary-foreground/20 text-white font-semibold" : "text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10"}`}
          >
            <Home className="h-4 w-4" />
            <span className="hidden md:block">Bảng tin</span>
          </Link>
          <Link
            href="/documents"
            onClick={(e) => handleLinkClick(e, "/documents")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname === "/documents" ? "bg-primary-foreground/20 text-white font-semibold" : "text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10"}`}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden md:block">Tài liệu</span>
          </Link>
          <Link
            href="/tasks"
            onClick={(e) => handleLinkClick(e, "/tasks")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname === "/tasks" ? "bg-primary-foreground/20 text-white font-semibold" : "text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10"}`}
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden md:block">Công việc</span>
          </Link>
          <Link
            href="/inbox"
            onClick={(e) => handleLinkClick(e, "/inbox")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname.startsWith("/inbox") ? "bg-primary-foreground/20 text-white font-semibold" : "text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10"}`}
          >
            <Mail className="h-4 w-4" />
            <span className="hidden md:block">Hộp thư</span>
          </Link>

          {isAdmin && (
            <>
              <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground/60 hidden md:block">
                Quản trị
              </div>
              <Link
                href="/admin"
                onClick={(e) => handleLinkClick(e, "/admin")}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${pathname === "/admin" ? "bg-primary-foreground/20 text-white font-semibold" : "text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10"}`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span className="hidden md:block">Nhân sự</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </aside>
  )
}
