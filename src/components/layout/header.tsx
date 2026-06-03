"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Menu, Search, User, FileText, CheckSquare, Loader2, Bell } from "lucide-react"
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Home, ShieldAlert, Mail } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export function Header() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<{posts: any[], tasks: any[]}>({ posts: [], tasks: [] })
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationLimitRef = useRef(20)
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href || (href === '/inbox' && pathname.startsWith('/inbox'))) {
      e.preventDefault()
      window.location.href = href
    } else {
      setIsMobileMenuOpen(false)
    }
  }

  const fetchNotifications = async (userId: string) => {
    const { data, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(notificationLimitRef.current)
    
    if (data) {
      setNotifications(data)
      setHasMoreNotifications(count ? count > data.length : false)
    }

    const { count: unread } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    
    if (unread !== null) {
      setUnreadCount(unread)
    }
  }

  const loadMoreNotifications = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!profile || isLoadingMore) return
    setIsLoadingMore(true)
    notificationLimitRef.current += 20
    await fetchNotifications(profile.id)
    setIsLoadingMore(false)
  }

  const handleReadNotification = async (notification: any) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id)
      setUnreadCount(prev => Math.max(0, prev - 1))
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n))
    }
    if (notification.link) {
      const linkPath = notification.link.split('#')[0]
      if (pathname === linkPath) {
        router.push(notification.link)
        router.refresh()
      } else {
        router.push(notification.link)
      }
    }
  }

  // Subscribe to real-time notifications + polling
  useEffect(() => {
    if (!profile) return
    
    // Polling as fallback (every 10s)
    const interval = setInterval(() => {
      fetchNotifications(profile.id)
    }, 10000)

    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (payload) => {
        fetchNotifications(profile.id)
      })
      .subscribe()
      
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [profile])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setIsFocused(false)
    }
  }

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [wrapperRef])

  // Debounced search for suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        setSuggestions({ posts: [], tasks: [] })
        return
      }

      setIsLoading(true)
      const query = searchQuery.trim()

      // Fetch top 3 posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, title, department')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(3)

      // Fetch top 3 tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, assignee, status')
        .or(`title.ilike.%${query}%,assignee.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(3)

      setSuggestions({
        posts: postsData || [],
        tasks: tasksData || []
      })
      setIsLoading(false)
    }

    const timeoutId = setTimeout(() => {
      fetchSuggestions()
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: p }) => {
            if (p) {
              setProfile(p)
              fetchNotifications(data.session.user.id)
            }
          })
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-primary-foreground/20 bg-primary text-primary-foreground px-4 sm:h-16 sm:px-6 shadow-sm relative">
      {/* Mobile Menu Trigger */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger className="sm:hidden border border-primary-foreground/20 bg-transparent hover:bg-primary-foreground/10 text-primary-foreground hover:text-white inline-flex items-center justify-center rounded-md h-9 w-9 shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-[300px] bg-primary text-primary-foreground border-r-primary-foreground/20 p-0 flex flex-col sm:hidden">
          <div className="flex w-full items-center justify-center border-b border-primary-foreground/20 py-4">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="OfficeHub Logo" className="h-10 object-contain" />
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <nav className="grid items-start px-2 text-sm font-medium gap-1">
              <Link href="/" onClick={(e) => handleLinkClick(e, "/")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10">
                <Home className="h-4 w-4" /> Bảng tin
              </Link>
              <Link href="/documents" onClick={(e) => handleLinkClick(e, "/documents")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10">
                <FileText className="h-4 w-4" /> Tài liệu
              </Link>
              <Link href="/tasks" onClick={(e) => handleLinkClick(e, "/tasks")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10">
                <CheckSquare className="h-4 w-4" /> Công việc
              </Link>
              <Link href="/inbox" onClick={(e) => handleLinkClick(e, "/inbox")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10">
                <Mail className="h-4 w-4" /> Hộp thư
              </Link>
              {profile?.role === "admin" && (
                <>
                  <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">Quản trị</div>
                  <Link href="/admin" onClick={(e) => handleLinkClick(e, "/admin")} className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary-foreground/80 hover:text-white hover:bg-primary-foreground/10">
                    <ShieldAlert className="h-4 w-4" /> Nhân sự
                  </Link>
                </>
              )}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Title */}
      <div className="flex-1 sm:hidden">
        <Link href="/" className="flex items-center">
          <img src="/logo.png" alt="OfficeHub Logo" className="h-10 max-w-[160px] object-contain" />
        </Link>
      </div>

      {/* Search (PC only) */}
      <div className="hidden flex-1 sm:flex md:grow-0" ref={wrapperRef}>
        <form onSubmit={handleSearch} className="relative w-full">
          <div className="relative group">
            <button 
              type="submit" 
              className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 text-foreground/50 hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Tìm kiếm"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              type="search"
              placeholder="Tìm kiếm bài viết, tài liệu, công việc..."
              className="w-full rounded-lg bg-background text-foreground pl-9 md:w-[260px] lg:w-[400px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
            />
          </div>

          {/* Search Suggestions Dropdown */}
          {isFocused && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-xl overflow-hidden z-50 flex flex-col max-h-[70vh]">
              {isLoading ? (
                <div className="p-4 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tìm kiếm...
                </div>
              ) : suggestions.posts.length === 0 && suggestions.tasks.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Không tìm thấy kết quả phù hợp
                </div>
              ) : (
                <div className="overflow-y-auto py-2">
                  {/* Bài viết section */}
                  {suggestions.posts.length > 0 && (
                    <div className="px-2 pb-1">
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 uppercase tracking-wider">Bài viết & Thông báo</div>
                      {suggestions.posts.map(post => (
                        <Link 
                          key={post.id} 
                          href={`/post/${post.id}`}
                          onClick={() => setIsFocused(false)}
                          className="flex items-start gap-3 px-2 py-2 hover:bg-muted rounded-md transition-colors"
                        >
                          <div className="bg-primary/10 p-1.5 rounded text-primary mt-0.5 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-foreground truncate">{post.title}</span>
                            <span className="text-xs text-muted-foreground truncate">{post.department || "Tin tức"}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Divider if both exist */}
                  {suggestions.posts.length > 0 && suggestions.tasks.length > 0 && (
                    <div className="h-px bg-border my-2 mx-4" />
                  )}

                  {/* Công việc section */}
                  {suggestions.tasks.length > 0 && (
                    <div className="px-2 pt-1">
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 uppercase tracking-wider">Công việc</div>
                      {suggestions.tasks.map(task => (
                        <Link 
                          key={task.id} 
                          href={`/tasks`} // Navigate to tasks page (since we don't have individual task pages)
                          onClick={() => setIsFocused(false)}
                          className="flex items-start gap-3 px-2 py-2 hover:bg-muted rounded-md transition-colors"
                        >
                          <div className="bg-orange-500/10 p-1.5 rounded text-orange-600 mt-0.5 shrink-0">
                            <CheckSquare className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              Giao cho: {task.assignee}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="px-4 pt-3 pb-1 mt-2 border-t">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="w-full text-primary hover:text-primary hover:bg-primary/10 text-sm h-8"
                      onClick={handleSearch}
                    >
                      Xem tất cả kết quả cho "{searchQuery}"
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-2 sm:gap-4 sm:ml-auto md:ml-auto">
        {/* Notification Bell */}
        <DropdownMenu onOpenChange={(open) => {
          if (open) {
            // First attempt
            setTimeout(() => {
              const container = document.getElementById('notification-scroll-container');
              if (container) container.scrollTop = 0;
            }, 100);
            // Fallback for slower mobile rendering
            setTimeout(() => {
              const container = document.getElementById('notification-scroll-container');
              if (container) container.scrollTop = 0;
            }, 300);
          }
        }}>
          <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-primary-foreground/10 hover:text-white h-9 w-9 text-primary-foreground">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <span className="font-semibold text-sm">Thông báo</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-auto p-0 text-xs font-medium ${unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} 
                disabled={unreadCount === 0}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!profile || unreadCount === 0) return
                  await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
                  fetchNotifications(profile.id)
                }}
              >
                Đánh dấu đã đọc
              </Button>
            </div>
            <div id="notification-scroll-container" className="max-h-[350px] overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="h-8 w-8 text-muted-foreground/30" />
                  <p>Không có thông báo nào</p>
                </div>
              ) : (
                notifications.map(n => (
                  <DropdownMenuItem 
                    key={n.id} 
                    className={`flex flex-col items-start gap-1 p-3 cursor-pointer rounded-none border-b last:border-0 ${!n.is_read ? 'bg-primary/5 hover:bg-primary/10 focus:bg-primary/10' : ''}`}
                    onClick={() => handleReadNotification(n)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <span className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-primary' : 'font-medium'}`}>{n.title}</span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</span>
                    <span className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(n.created_at).toLocaleString('vi-VN')}</span>
                  </DropdownMenuItem>
                ))
              )}
              {hasMoreNotifications && notifications.length > 0 && (
                <div className="p-2 border-t mt-1">
                  <Button 
                    variant="ghost" 
                    className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 h-8" 
                    onClick={loadMoreNotifications}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                    Xem thông báo trước đó
                  </Button>
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
