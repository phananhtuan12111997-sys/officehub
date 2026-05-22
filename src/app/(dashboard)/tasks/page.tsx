"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, Plus, ArrowRight, Loader2, Paperclip, FileIcon, ChevronsUpDown, Check, Edit, Trash2, X } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Comments } from "@/components/ui/comments"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type TaskType = {
  id: string
  title: string
  description?: string
  assignee: string
  assignee_id?: string
  department_id?: string
  priority: string
  due_date: string
  due_date_timestamp?: string
  status: string
  created_at: string
  attachments?: any[]
}

const COLUMNS = [
  { id: 'new', title: "Việc mới / Đang làm" },
  { id: 'review', title: "Chờ duyệt" },
  { id: 'done', title: "Hoàn thành" }
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Data lists
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  // Form State
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [openUserCombo, setOpenUserCombo] = useState(false)
  const [openDeptCombo, setOpenDeptCombo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Detail Modal State
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null)
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editTaskData, setEditTaskData] = useState<Partial<TaskType>>({})
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetchTasks()
    fetchUsers()
    fetchDepartments()
  }, [])

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setUsers(data)
  }

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*')
    if (data) setDepartments(data)
  }

  const fetchTasks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) setTasks(data)
    setLoading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const uploadFiles = async () => {
    const uploadedAttachments = []
    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `tasks/${fileName}`

      const { error } = await supabase.storage
        .from('task_files')
        .upload(filePath, file)

      if (!error) {
        const { data } = supabase.storage.from('task_files').getPublicUrl(filePath)
        uploadedAttachments.push({
          name: file.name,
          url: data.publicUrl,
          path: filePath
        })
      }
    }
    return uploadedAttachments
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    setIsSubmitting(true)
    
    const uploadedAttachments = await uploadFiles()

    const selectedUser = users.find(u => u.id === assigneeId)
    const selectedDept = departments.find(d => d.id === departmentId)

    let assigneeName = "Chưa phân công"
    if (selectedUser) assigneeName = selectedUser.full_name
    else if (selectedDept) assigneeName = `Phòng: ${selectedDept.name}`

    const { error, data: newTask } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        assignee: assigneeName,
        assignee_id: assigneeId || null,
        department_id: departmentId || null,
        priority,
        due_date: dueDate || "Không có hạn", // Fallback for old UI text if needed
        due_date_timestamp: dueDate ? new Date(dueDate).toISOString() : null,
        status: 'new',
        attachments: uploadedAttachments
      })
      .select()
      .single()

    if (error) {
      alert("Lỗi giao việc: " + error.message)
    } else {
      // Send notifications
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserProfile = users.find(u => u.id === session?.user.id)
      const senderName = currentUserProfile ? currentUserProfile.full_name : 'Ai đó'

      if (assigneeId) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          title: 'Công việc mới',
          message: `${senderName} vừa giao cho bạn một công việc: ${title}`,
          link: `/tasks`,
          type: 'system'
        })
      } else if (departmentId) {
        const deptUsers = users.filter(u => u.department_id === departmentId)
        const notifications = deptUsers.map(u => ({
          user_id: u.id,
          title: 'Công việc mới cho phòng ban',
          message: `${senderName} vừa giao việc cho phòng ${selectedDept?.name}: ${title}`,
          link: `/tasks`,
          type: 'system'
        }))
        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications)
        }
      }

      setTitle("")
      setDescription("")
      setAssigneeId("")
      setDepartmentId("")
      setPriority("medium")
      setDueDate("")
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
      setShowForm(false)
      fetchTasks()
    }
    setIsSubmitting(false)
  }

  const handleUpdateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editTaskData.title || !selectedTask) return
    setIsUpdating(true)
    
    const selectedUser = users.find(u => u.id === editTaskData.assignee_id)
    const selectedDept = departments.find(d => d.id === editTaskData.department_id)

    let newAssigneeName = "Chưa phân công"
    if (selectedUser) newAssigneeName = selectedUser.full_name
    else if (selectedDept) newAssigneeName = `Phòng: ${selectedDept.name}`

    const { error } = await supabase.from('tasks').update({
      title: editTaskData.title,
      description: editTaskData.description,
      priority: editTaskData.priority || 'medium',
      due_date: editTaskData.due_date || "Không có hạn",
      due_date_timestamp: editTaskData.due_date ? new Date(editTaskData.due_date).toISOString() : null,
      assignee_id: editTaskData.assignee_id || null,
      department_id: editTaskData.department_id || null,
      assignee: newAssigneeName
    }).eq('id', selectedTask.id)

    setIsUpdating(false)
    if (!error) {
      setIsEditingTask(false)
      setSelectedTask({
        ...selectedTask,
        ...editTaskData,
        priority: editTaskData.priority || 'medium',
        due_date: editTaskData.due_date || "Không có hạn",
        due_date_timestamp: editTaskData.due_date ? new Date(editTaskData.due_date).toISOString() : undefined,
        assignee: newAssigneeName
      } as TaskType)
      fetchTasks()
    } else {
      alert("Lỗi cập nhật: " + error.message)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá công việc này?")) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      setSelectedTask(null)
      fetchTasks()
    } else {
      alert("Lỗi xoá công việc: " + error.message)
    }
  }

  const handleMoveTask = async (id: string, currentStatus: string) => {
    let nextStatus = 'new'
    if (currentStatus === 'new' || currentStatus === 'in-progress') nextStatus = 'review'
    else if (currentStatus === 'review') nextStatus = 'done'
    else if (currentStatus === 'done') nextStatus = 'new'

    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', id)
      
    if (!error) {
      fetchTasks()
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'bg-red-500/10 text-red-600 border-red-200'
      case 'low': return 'bg-green-500/10 text-green-600 border-green-200'
      default: return 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
    }
  }

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'high': return 'Cao'
      case 'low': return 'Thấp'
      default: return 'Trung bình'
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Công việc</h1>
          <p className="text-muted-foreground">Theo dõi và giao việc cá nhân, phòng ban.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {showForm ? "Đóng" : "Giao việc mới"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/50 shadow-sm shrink-0">
          <CardHeader>
            <CardTitle className="text-lg">Tạo công việc mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tiêu đề công việc</label>
                  <Input 
                    placeholder="Vd: Chuẩn bị hợp đồng..." 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Hạn chót</label>
                  <Input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Mô tả chi tiết (Tùy chọn)</label>
                <Textarea 
                  placeholder="Viết chi tiết các yêu cầu công việc tại đây..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Mức độ ưu tiên</label>
                  <Select value={priority} onValueChange={(val) => setPriority(val || "medium")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ưu tiên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Thấp</SelectItem>
                      <SelectItem value="medium">Trung bình</SelectItem>
                      <SelectItem value="high">Cao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Chọn người nhận</label>
                  <Popover open={openUserCombo} onOpenChange={setOpenUserCombo}>
                    <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground font-normal">
                      {assigneeId
                        ? users.find((user) => user.id === assigneeId)?.full_name
                        : "Chọn người nhận..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Tìm tên hoặc email..." />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy nhân viên.</CommandEmpty>
                          <CommandGroup>
                            {users.map((user) => (
                              <CommandItem
                                key={user.id}
                                value={user.full_name + ' ' + user.email}
                                onSelect={() => {
                                  setAssigneeId(user.id === assigneeId ? "" : user.id)
                                  setDepartmentId("")
                                  setOpenUserCombo(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    assigneeId === user.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{user.full_name}</span>
                                  <span className="text-xs text-muted-foreground">{user.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Giao cho Phòng ban</label>
                  <Popover open={openDeptCombo} onOpenChange={setOpenDeptCombo}>
                    <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground font-normal">
                      {departmentId
                        ? departments.find((d) => d.id === departmentId)?.name
                        : "Chọn phòng ban..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Tìm phòng ban..." />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy phòng ban.</CommandEmpty>
                          <CommandGroup>
                            {departments.map((d) => (
                              <CommandItem
                                key={d.id}
                                value={d.name}
                                onSelect={() => {
                                  setDepartmentId(d.id === departmentId ? "" : d.id)
                                  setAssigneeId("")
                                  setOpenDeptCombo(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    departmentId === d.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {d.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Đính kèm tài liệu</label>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    Chọn tệp
                  </Button>
                  <Input 
                    type="file" 
                    multiple 
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="hidden"
                  />
                </div>
                {files.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted p-2 rounded-md text-sm border">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileIcon className="w-4 h-4 shrink-0 text-primary" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive shrink-0 hover:bg-destructive/10" 
                          onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tạo công việc
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Đang tải dữ liệu...
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4 h-full">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter(t => 
              (col.id === 'new' && (t.status === 'new' || t.status === 'in-progress')) ||
              t.status === col.id
            )
            
            return (
              <div key={col.id} className="min-w-[320px] w-[350px] flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{col.title}</h3>
                  <Badge variant="secondary">{colTasks.length}</Badge>
                </div>

                <div className="flex flex-col gap-3">
                  {colTasks.length === 0 && (
                    <div className="text-sm text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                      Trống
                    </div>
                  )}
                  {colTasks.map((task) => (
                    <Card key={task.id} className="shadow-sm border border-border/50 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedTask(task)}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base leading-tight">{task.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={`text-xs px-1 ${getPriorityColor(task.priority)}`}>
                            {getPriorityLabel(task.priority)}
                          </Badge>
                          {task.attachments && task.attachments.length > 0 && (
                            <Badge variant="outline" className="text-xs px-1 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> {task.attachments.length}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 pb-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{task.due_date_timestamp ? new Date(task.due_date_timestamp).toLocaleDateString('vi-VN') : task.due_date}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between items-center mt-2 border-t pt-3 border-border/50" onClick={(e) => e.stopPropagation()}>
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {task.assignee.substring(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={task.assignee}>{task.assignee}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 ml-1"
                            onClick={() => handleMoveTask(task.id, task.status)}
                            title="Chuyển trạng thái"
                          >
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null)
          setIsEditingTask(false)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={getPriorityColor(selectedTask?.priority || "medium")}>
                  Ưu tiên {getPriorityLabel(selectedTask?.priority || "medium")}
                </Badge>
                <Badge variant="secondary">{COLUMNS.find(c => c.id === (selectedTask?.status === 'in-progress' ? 'new' : selectedTask?.status))?.title}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {!isEditingTask && selectedTask && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditTaskData({
                        title: selectedTask.title,
                        description: selectedTask.description || "",
                        due_date: selectedTask.due_date_timestamp ? new Date(selectedTask.due_date_timestamp).toISOString().split('T')[0] : selectedTask.due_date !== "Không có hạn" ? selectedTask.due_date : "",
                        priority: selectedTask.priority,
                        assignee_id: selectedTask.assignee_id || "",
                        department_id: selectedTask.department_id || ""
                      })
                      setIsEditingTask(true)
                    }}>
                      <Edit className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(selectedTask.id)} className="hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {!isEditingTask && <DialogTitle className="text-xl">{selectedTask?.title}</DialogTitle>}
          </DialogHeader>

          {isEditingTask ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tiêu đề công việc</label>
                  <Input 
                    value={editTaskData.title || ""}
                    onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Hạn chót</label>
                  <Input 
                    type="date"
                    value={editTaskData.due_date || ""}
                    onChange={(e) => setEditTaskData({...editTaskData, due_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Mô tả</label>
                <Textarea 
                  value={editTaskData.description || ""}
                  onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Mức độ ưu tiên</label>
                  <Select value={editTaskData.priority || "medium"} onValueChange={(val) => setEditTaskData({...editTaskData, priority: val || "medium"})}>
                    <SelectTrigger><SelectValue placeholder="Ưu tiên" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Thấp</SelectItem>
                      <SelectItem value="medium">Trung bình</SelectItem>
                      <SelectItem value="high">Cao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Giao cho cá nhân</label>
                  <Select value={editTaskData.assignee_id || "none"} onValueChange={(val) => setEditTaskData({...editTaskData, assignee_id: val === "none" ? "" : (val || ""), department_id: ""})}>
                    <SelectTrigger><SelectValue placeholder="Chọn người" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không chọn</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Phòng ban</label>
                  <Select value={editTaskData.department_id || "none"} onValueChange={(val) => setEditTaskData({...editTaskData, department_id: val === "none" ? "" : (val || ""), assignee_id: ""})}>
                    <SelectTrigger><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không chọn</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsEditingTask(false)}>Hủy</Button>
                <Button onClick={() => handleUpdateTask()} disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
              <div>
                <span className="text-muted-foreground block mb-1">Người nhận:</span>
                <span className="font-medium">{selectedTask?.assignee}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Hạn chót:</span>
                <span className="font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedTask?.due_date_timestamp ? new Date(selectedTask.due_date_timestamp).toLocaleDateString('vi-VN') : selectedTask?.due_date}
                </span>
              </div>
            </div>

            {selectedTask?.description && (
              <div>
                <h4 className="font-semibold mb-2">Mô tả công việc</h4>
                <div className="text-sm whitespace-pre-wrap bg-background p-4 border rounded-lg">
                  {selectedTask.description}
                </div>
              </div>
            )}

            {selectedTask?.attachments && selectedTask.attachments.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Tệp đính kèm ({selectedTask.attachments.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTask.attachments.map((file, idx) => (
                    <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted transition-colors text-sm">
                      <FileIcon className="w-4 h-4 text-primary" />
                      <span className="truncate flex-1" title={file.name}>{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-4">Thảo luận</h4>
              {selectedTask && <Comments taskId={selectedTask.id} />}
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
