"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Tự động nối đuôi email nội bộ nếu người dùng chỉ nhập tên tài khoản
    const loginEmail = account.includes("@") ? account : `${account}@officehub.local`

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      const errorMapping: Record<string, string> = {
        "Invalid login credentials": "Email hoặc mật khẩu không chính xác.",
        "Email not confirmed": "Vui lòng xác nhận email của bạn trước khi đăng nhập.",
        "User not found": "Người dùng không tồn tại.",
      }
      setError(errorMapping[error.message] || error.message)
      setLoading(false)
      return
    }

    // Đăng nhập thành công, chuyển hướng về trang chủ
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm border-0 shadow-lg sm:border sm:shadow-sm">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-2">
            <img src="/logo.png" alt="OfficeHub Logo" className="h-20 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">OfficeHub</CardTitle>
          <CardDescription>Đăng nhập vào hệ thống nội bộ</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-100 dark:bg-red-900/30 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="account">Tài khoản công ty</Label>
              <Input 
                id="account" 
                type="text" 
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <a 
                  href="#" 
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Vui lòng liên hệ admin để cấp lại mật khẩu.");
                  }}
                >Quên mật khẩu?</a>
              </div>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
