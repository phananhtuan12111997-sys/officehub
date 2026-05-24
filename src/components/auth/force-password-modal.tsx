"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function ForcePasswordChangeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }
      
      setUserId(user.id)
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("force_password_change")
        .eq("id", user.id)
        .single()
        
      if (!error && profile?.force_password_change) {
        setIsOpen(true)
      }
      setIsLoading(false)
    }
    
    checkUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.")
      return
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }
    
    setIsSubmitting(true)
    setError("")
    
    // Đổi mật khẩu qua Auth
    const { error: authError } = await supabase.auth.updateUser({
      password: password
    })
    
    if (authError) {
      setError(authError.message)
      setIsSubmitting(false)
      return
    }
    
    // Tắt cờ force_password_change trong profile
    if (userId) {
      await supabase.from("profiles").update({ force_password_change: false }).eq("id", userId)
    }
    
    setIsOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  // Không render gì nếu đang loading để tránh chớp giật giao diện
  if (isLoading) return null

  // Chặn dismiss bằng cách prevent escapeKeyDown và pointerDownOutside
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isOpen) {
        // Prevent closing if it's supposed to be open
        return
      }
      setIsOpen(open)
    }}>
      <DialogContent 
        className="sm:max-w-[425px]" 
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu bảo mật</DialogTitle>
          <DialogDescription>
            Tài khoản của bạn vừa được cấp mới bởi Quản trị viên. Để đảm bảo an toàn, vui lòng đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Cập nhật mật khẩu
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
