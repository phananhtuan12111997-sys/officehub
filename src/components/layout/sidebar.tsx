import Link from "next/link"
import { FileText, Home, CheckSquare, Users, Settings } from "lucide-react"

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex md:w-64">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FileText className="h-6 w-6 text-primary" />
          <span className="hidden md:block">OfficeHub</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-2 text-sm font-medium gap-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-primary bg-muted transition-all"
          >
            <Home className="h-4 w-4" />
            <span className="hidden md:block">Bảng tin</span>
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted/50"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden md:block">Tài liệu</span>
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted/50"
          >
            <CheckSquare className="h-4 w-4" />
            <span className="hidden md:block">Công việc</span>
          </Link>
          <Link
            href="/users"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted/50"
          >
            <Users className="h-4 w-4" />
            <span className="hidden md:block">Nhân viên</span>
          </Link>
        </nav>
      </div>
    </aside>
  )
}
