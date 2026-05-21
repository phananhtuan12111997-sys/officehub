"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase/client"
import { Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react"

type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Form
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("staff")

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  const checkAdminAndFetch = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (profile?.role === "admin") {
      setIsAdmin(true)
      fetchUsers(session.access_token)
    } else {
      setLoading(false)
    }
  }

  const fetchUsers = async (token: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email, password, full_name: fullName, role })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra")

      setIsDialogOpen(false)
      setEmail("")
      setPassword("")
      setFullName("")
      fetchUsers(session.access_token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa nhân viên này vĩnh viễn?")) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (res.ok) {
        fetchUsers(session.access_token)
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Truy cập bị từ chối</h2>
        <p className="text-muted-foreground mt-2">Khu vực này chỉ dành riêng cho Quản trị viên (Admin).</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản trị Nhân sự</h1>
          <p className="text-muted-foreground">Quản lý tài khoản, phân quyền và giám sát nhân viên.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Thêm nhân viên</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo tài khoản mới</DialogTitle>
              <DialogDescription>Hệ thống sẽ tự động tạo tài khoản và gửi thông tin đăng nhập cho nhân viên.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateUser} className="space-y-4 py-4">
              {error && <div className="text-sm text-destructive font-medium">{error}</div>}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nhanvien@congty.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu khởi tạo</Label>
                <Input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Tối thiểu 6 ký tự" minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullname">Họ và tên</Label>
                <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nguyễn Văn A" />
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="staff">Nhân viên (Staff)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tạo tài khoản
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách tài khoản ({profiles.length})</CardTitle>
          <CardDescription>Tất cả tài khoản được phép truy cập vào hệ thống nội bộ.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Ngày tham gia</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "Chưa cập nhật"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                      {p.role === "admin" ? "Admin" : "Nhân viên"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteUser(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
