"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from "@/lib/supabase/client"
import { Loader2, Upload } from "lucide-react"

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [message, setMessage] = useState({ text: "", type: "" })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()

    if (profile) {
      setUser(profile)
      setFullName(profile.full_name || "")
      setAvatarUrl(profile.avatar_url || "")
    }
    setLoading(false)
  }

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: "", type: "" }), 5000)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, avatar_url: avatarUrl })
      .eq("id", user.id)

    if (error) showMessage(error.message, "error")
    else showMessage("Cập nhật thông tin thành công!", "success")
    
    setSavingProfile(false)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showMessage("Mật khẩu xác nhận không khớp!", "error")
      return
    }
    
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    
    if (error) showMessage(error.message, "error")
    else {
      showMessage("Đổi mật khẩu thành công!", "success")
      setNewPassword("")
      setConfirmPassword("")
    }
    setSavingPassword(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return
      
      setSavingProfile(true)
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}` // Đặt trong folder theo user id để đúng RLS

      // Tải file lên Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Lấy URL công khai
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      
      setAvatarUrl(data.publicUrl)
      showMessage("Tải ảnh thành công, vui lòng bấm Lưu thay đổi.", "success")
    } catch (error: any) {
      showMessage(error.message, "error")
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hồ sơ cá nhân</h1>
        <p className="text-muted-foreground">Quản lý thông tin và cài đặt bảo mật tài khoản.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-md ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <Card>
        <form onSubmit={handleUpdateProfile}>
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
            <CardDescription>Cập nhật ảnh đại diện và họ tên hiển thị với đồng nghiệp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl} alt="Avatar" />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors">
                    <Upload className="h-4 w-4" />
                    <span>Tải ảnh mới</span>
                  </div>
                </Label>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={savingProfile}
                />
                <p className="text-xs text-muted-foreground">Khuyến nghị ảnh vuông, tối đa 2MB.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email đăng nhập</Label>
              <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input 
                id="fullName" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Nhập tên đầy đủ của bạn" 
                required 
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thông tin
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form onSubmit={handleUpdatePassword}>
          <CardHeader>
            <CardTitle>Đổi mật khẩu</CardTitle>
            <CardDescription>Đảm bảo tài khoản của bạn sử dụng mật khẩu an toàn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input 
                id="newPassword" 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Tối thiểu 6 ký tự" 
                minLength={6}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Nhập lại mật khẩu mới" 
                required 
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" variant="secondary" disabled={savingPassword}>
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cập nhật mật khẩu
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
