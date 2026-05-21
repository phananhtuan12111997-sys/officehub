"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase/client"

export function Header() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: p }) => {
            if (p) setProfile(p)
          })
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-primary-foreground/20 bg-primary text-primary-foreground px-4 sm:h-16 sm:px-6 shadow-sm">
      {/* Mobile Menu Trigger */}
      <Button size="icon" variant="outline" className="sm:hidden border-primary-foreground/20 bg-transparent hover:bg-primary-foreground/10 text-primary-foreground hover:text-white">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      {/* Mobile Title */}
      <div className="flex-1 sm:hidden">
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="OfficeHub Logo" className="h-10 max-w-[160px] object-contain" />
        </Link>
      </div>

      {/* Search (PC only) */}
      <div className="hidden flex-1 sm:flex md:grow-0">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground/50" />
            <Input
              type="search"
              placeholder="Tìm kiếm bài viết, tài liệu..."
              className="w-full rounded-lg bg-background text-foreground pl-8 md:w-[200px] lg:w-[320px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4 sm:ml-auto md:ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-80 transition-opacity text-left">
            <Avatar className="h-9 w-9 border border-primary-foreground/20 flex items-center justify-center bg-primary-foreground/10">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-transparent text-primary-foreground flex items-center justify-center">
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-semibold leading-tight">{profile?.full_name || "Người dùng"}</span>
              <span className="text-xs text-primary-foreground/80">{profile?.role === "admin" ? "Quản trị viên" : "Nhân viên"}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{profile?.full_name || "Tài khoản"}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/profile')}>
              Cài đặt cá nhân
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={handleLogout}>
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
