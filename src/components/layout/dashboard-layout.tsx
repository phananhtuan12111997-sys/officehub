import { Sidebar } from "./sidebar"
import { Header } from "./header"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      <Sidebar />
      <div className="flex flex-col sm:pl-14 md:pl-64 w-full">
        <Header />
        <main className="flex-1 p-4 sm:px-6 sm:py-6 md:gap-8">
          {children}
        </main>
      </div>
    </div>
  )
}
