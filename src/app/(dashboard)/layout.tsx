"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login")
      } else {
        setLoading(false)
      }
    })
  }, [router])

  if (loading) return null

  return <DashboardLayout>{children}</DashboardLayout>
}
