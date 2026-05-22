"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase/client"
import { Loader2, Plus, ShieldAlert, Trash2, Edit, Building2, Users } from "lucide-react"

type Department = {
  id: string
  name: string
  description: string
  created_at: string
}

type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  department_id?: string
  created_at: string
}

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Users state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("staff")
  const [departmentId, setDepartmentId] = useState("")

  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editFullName, setEditFullName] = useState("")
  const [editRole, setEditRole] = useState("staff")
  const [editPassword, setEditPassword] = useState("")
  const [editDepartmentId, setEditDepartmentId] = useState("")
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)
  const [editError, setEditError] = useState("")

  // Dept state
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false)
  const [deptName, setDeptName] = useState("")
  const [deptDesc, setDeptDesc] = useState("")
  const [isDeptSubmitting, setIsDeptSubmitting] = useState(false)
  const [deptError, setDeptError] = useState("")

  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [isEditDeptDialogOpen, setIsEditDeptDialogOpen] = useState(false)
  const [editDeptName, setEditDeptName] = useState("")
  const [editDeptDesc, setEditDeptDesc] = useState("")

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
      fetchDepartments()
      fetchUsers(session.access_token)
    } else {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    const { data, error } = await supabase.from('departments').select('*').order('created_at', { ascending: false })
    if (data) setDepartments(data)
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

  // ---- USER ACTIONS ----
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
        body: JSON.stringify({ email, password, full_name: fullName, role, department_id: departmentId || null })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra")

      setIsDialogOpen(false)
      setEmail("")
      setPassword("")
      setFullName("")
      setDepartmentId("")
      fetchUsers(session.access_token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa nhân viên này vĩnh viễn? Dữ liệu của nhân viên này sẽ bị xóa!")) return
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

  const openEditDialog = (profile: Profile) => {
    setEditingUser(profile)
    setEditFullName(profile.full_name || "")
    setEditRole(profile.role)
    setEditPassword("")
    setEditDepartmentId(profile.department_id || "")
    setEditError("")
    setIsEditDialogOpen(true)
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setIsEditSubmitting(true)
    setEditError("")

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          id: editingUser.id, 
          role: editRole, 
          full_name: editFullName, 
          password: editPassword,
          department_id: editDepartmentId || null
        })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra")

      setIsEditDialogOpen(false)
      fetchUsers(session.access_token)
    } catch (err: any) {
      setEditError(err.message)
    } finally {
      setIsEditSubmitting(false)
    }
  }

  // ---- DEPARTMENT ACTIONS ----
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsDeptSubmitting(true)
    setDeptError("")

    const { error } = await supabase.from('departments').insert({
      name: deptName,
      description: deptDesc
    })

    if (error) {
      setDeptError(error.message)
    } else {
      setIsDeptDialogOpen(false)
      setDeptName("")
      setDeptDesc("")
      fetchDepartments()
    }
    setIsDeptSubmitting(false)
  }

  const handleDeleteDept = async (id: string) => {
    if (!confirm("Xóa phòng ban này? Các nhân viên trong phòng ban sẽ không còn phòng ban nào (N/A).")) return
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (!error) {
      fetchDepartments()
      // Refresh users to reflect null department
      const { data: { session } } = await supabase.auth.getSession()
      if (session) fetchUsers(session.access_token)
    } else {
      alert(error.message)
    }
  }

  const openEditDeptDialog = (dept: Department) => {
    setEditingDept(dept)
    setEditDeptName(dept.name)
    setEditDeptDesc(dept.description || "")
    setIsEditDeptDialogOpen(true)
  }

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDept) return
    setIsDeptSubmitting(true)

    const { error } = await supabase.from('departments').update({
      name: editDeptName,
      description: editDeptDesc
    }).eq('id', editingDept.id)

    if (!error) {
      setIsEditDeptDialogOpen(false)
      fetchDepartments()
    }
    setIsDeptSubmitting(false)
  }

  const getDeptName = (deptId?: string) => {
    if (!deptId) return "N/A"
    const d = departments.find(d => d.id === deptId)
    return d ? d.name : "N/A"
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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản trị Hệ thống</h1>
        <p className="text-muted-foreground">Quản lý nhân sự và cấu trúc tổ chức.</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Nhân sự
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Phòng ban
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Tài khoản nhân viên</h2>
            <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Thêm nhân viên</Button>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Phòng ban</TableHead>
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
                      <TableCell>{getDeptName(p.department_id)}</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleDateString("vi-VN")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 hover:text-primary mr-1" onClick={() => openEditDialog(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
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
        </TabsContent>

        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Cơ cấu Phòng ban</h2>
            <Button onClick={() => setIsDeptDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tạo phòng ban</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên phòng ban</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Chưa có phòng ban nào</TableCell>
                    </TableRow>
                  )}
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.description || "-"}</TableCell>
                      <TableCell>{new Date(d.created_at).toLocaleDateString("vi-VN")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10 hover:text-primary mr-1" onClick={() => openEditDeptDialog(d)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteDept(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE USER DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo tài khoản mới</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="staff">Nhân viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Phòng ban</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">-- Không có --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
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

      {/* EDIT USER DIALOG */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin tài khoản</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 py-4">
            {editError && <div className="text-sm text-destructive font-medium">{editError}</div>}
            
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Họ và tên</Label>
              <Input id="edit-fullname" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                >
                  <option value="staff">Nhân viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Phòng ban</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={editDepartmentId}
                  onChange={(e) => setEditDepartmentId(e.target.value)}
                >
                  <option value="">-- Không có --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Mật khẩu mới (Tùy chọn)</Label>
              <Input id="edit-password" type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Để trống nếu không muốn đổi" minLength={6} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isEditSubmitting}>
                {isEditSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE DEPT DIALOG */}
      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo phòng ban mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDept} className="space-y-4 py-4">
            {deptError && <div className="text-sm text-destructive font-medium">{deptError}</div>}
            <div className="space-y-2">
              <Label>Tên phòng ban</Label>
              <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} required placeholder="Vd: IT, Marketing..." />
            </div>
            <div className="space-y-2">
              <Label>Mô tả (Tùy chọn)</Label>
              <Input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder="Phòng công nghệ thông tin..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeptDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isDeptSubmitting}>
                {isDeptSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT DEPT DIALOG */}
      <Dialog open={isEditDeptDialogOpen} onOpenChange={setIsEditDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa thông tin phòng ban</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditDept} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tên phòng ban</Label>
              <Input value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mô tả (Tùy chọn)</Label>
              <Input value={editDeptDesc} onChange={(e) => setEditDeptDesc(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDeptDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isDeptSubmitting}>
                {isDeptSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
