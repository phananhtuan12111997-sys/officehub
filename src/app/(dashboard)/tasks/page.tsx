"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, Plus, ArrowRight, Loader2, Paperclip, FileIcon, ChevronsUpDown, Check, Edit, Trash2, X, Search, AlignJustify, LayoutGrid, CheckSquare } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Comments } from "@/components/ui/comments"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

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
  creator_id?: string
}

const COLUMNS = [
  { id: 'new', title: "Việc mới" },
  { id: 'in-progress', title: "Đang thực hiện" },
  { id: 'review', title: "Chờ duyệt" },
  { id: 'done', title: "Hoàn thành" }
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')

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

  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null)
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [editTaskData, setEditTaskData] = useState<Partial<TaskType>>({})
  const [editTaskNewFiles, setEditTaskNewFiles] = useState<File[]>([])
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const taskIdFromUrl = searchParams.get('taskId')
  const lastProcessedTaskId = useRef<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCurrentUserId(data.session.user.id)
      }
    })
    fetchTasks()
    fetchUsers()
    fetchDepartments()

    const channel = supabase.channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (tasks.length > 0 && taskIdFromUrl && taskIdFromUrl !== lastProcessedTaskId.current) {
      const task = tasks.find(t => t.id === taskIdFromUrl)
      if (task) {
        setSelectedTask(task)
        lastProcessedTaskId.current = taskIdFromUrl
      }
    }
    if (!taskIdFromUrl) {
      lastProcessedTaskId.current = null
    }
  }, [tasks, taskIdFromUrl])

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setUsers(data)
  }

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*')
    if (data) setDepartments(data)
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setAssigneeId("")
    setDepartmentId("")
    setPriority("medium")
    setDueDate("")
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) setTasks(data)
    if (!silent) setLoading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const uploadFiles = async (fileList: File[] = files) => {
    const uploadedAttachments = []
    for (const file of fileList) {
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

    const { error, data: insertedTask } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        assignee: assigneeName,
        assignee_id: assigneeId || null,
        department_id: departmentId || null,
        priority,
        due_date: dueDate || "Không có hạn", 
        due_date_timestamp: dueDate ? new Date(dueDate).toISOString() : null,
        status: 'new',
        attachments: uploadedAttachments,
        creator_id: currentUserId || null
      })
      .select()
      .single()

    if (error) {
      alert("Lỗi giao việc: " + error.message)
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserProfile = users.find(u => u.id === session?.user.id)
      const senderName = currentUserProfile ? currentUserProfile.full_name : 'Ai đó'

      if (assigneeId) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          title: 'Công việc mới',
          message: `${senderName} vừa giao cho bạn một công việc: ${title}`,
          link: `/tasks?taskId=${insertedTask.id}`,
          type: 'system'
        })
      } else if (departmentId) {
        const deptUsers = users.filter(u => u.department_id === departmentId)
        const notifications = deptUsers.map(u => ({
          user_id: u.id,
          title: 'Công việc mới cho phòng ban',
          message: `${senderName} vừa giao việc cho phòng ${selectedDept?.name}: ${title}`,
          link: `/tasks?taskId=${insertedTask.id}`,
          type: 'system'
        }))
        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications)
        }
      }

      resetForm()
      setShowForm(false)
      fetchTasks()
    }
    setIsSubmitting(false)
  }

  const handleUpdateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editTaskData.title || !selectedTask) return
    setIsUpdating(true)
    
    let newlyUploaded: any[] = []
    if (editTaskNewFiles.length > 0) {
      newlyUploaded = await uploadFiles(editTaskNewFiles)
    }
    const finalAttachments = [...(editTaskData.attachments || []), ...newlyUploaded]

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
      assignee: newAssigneeName,
      attachments: finalAttachments
    }).eq('id', selectedTask.id)

    setIsUpdating(false)
    if (!error) {
      if (editTaskData.assignee_id && editTaskData.assignee_id !== selectedTask.assignee_id) {
        const { data: { session } } = await supabase.auth.getSession()
        const senderProfile = users.find(u => u.id === session?.user.id)
        const senderName = senderProfile ? senderProfile.full_name : 'Ai đó'

        await supabase.from('notifications').insert({
          user_id: editTaskData.assignee_id,
          title: 'Công việc được cập nhật',
          message: `${senderName} vừa giao cho bạn một công việc: ${editTaskData.title}`,
          link: `/tasks?taskId=${selectedTask.id}`,
          type: 'system'
        })
      }

      setIsEditingTask(false)
      setSelectedTask({
        ...selectedTask,
        ...editTaskData,
        priority: editTaskData.priority || 'medium',
        due_date: editTaskData.due_date || "Không có hạn",
        due_date_timestamp: editTaskData.due_date ? new Date(editTaskData.due_date).toISOString() : undefined,
        assignee: newAssigneeName,
        attachments: finalAttachments
      } as TaskType)
      setEditTaskNewFiles([])
      fetchTasks()
    } else {
      alert("Lỗi cập nhật: " + error.message)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá công việc này?")) return
    
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      
      if (res.ok && data.success) {
        setSelectedTask(null)
        fetchTasks()
      } else {
        alert("Lỗi xoá công việc: " + (data.error || "Không xác định"))
      }
    } catch (err: any) {
      alert("Lỗi kết nối: " + err.message)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId
    const task = tasks.find(t => t.id === draggableId)
    if (!task) return

    const currentUserProfile = users.find(u => u.id === currentUserId)
    const isAdmin = currentUserProfile?.role === 'admin'
    const isCreator = task.creator_id === currentUserId
    
    if (newStatus === 'done' && !isAdmin && !isCreator) {
      alert("Bạn không có quyền chuyển công việc sang Hoàn thành. Chỉ người giao việc hoặc Admin mới có quyền này.")
      return
    }
    
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t))

    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', draggableId)
    if (error) {
       fetchTasks()
       alert("Lỗi khi chuyển trạng thái: " + error.message)
    } else {
       const senderName = currentUserProfile ? currentUserProfile.full_name : 'Ai đó'
       if (newStatus === 'review') {
         if (task.creator_id && task.creator_id !== currentUserId) {
           await supabase.from('notifications').insert({
             user_id: task.creator_id,
             title: 'Công việc chờ duyệt',
             message: `${senderName} đang chờ bạn duyệt công việc: ${task.title}`,
             link: `/tasks?taskId=${task.id}`,
             type: 'system'
           })
         }
       } else if ((newStatus === 'done' || newStatus === 'in-progress') && (isAdmin || isCreator) && currentUserId !== task.assignee_id) {
          if (task.assignee_id) {
             const titleMsg = newStatus === 'done' ? 'Công việc đã được duyệt' : 'Công việc chưa được duyệt'
             const bodyMsg = newStatus === 'done' ? `${senderName} đã duyệt hoàn thành công việc: ${task.title}` : `${senderName} đã chuyển lại công việc về Đang thực hiện: ${task.title}`
             await supabase.from('notifications').insert({
               user_id: task.assignee_id,
               title: titleMsg,
               message: bodyMsg,
               link: `/tasks?taskId=${task.id}`,
               type: 'system'
             })
          }
       }
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

  const getDueDateColor = (timestamp?: string, dueDateString?: string) => {
    if (!timestamp && (!dueDateString || dueDateString === "Không có hạn")) return "text-muted-foreground"
    let date = timestamp ? new Date(timestamp) : new Date(dueDateString!)
    if (isNaN(date.getTime())) return "text-muted-foreground"

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const taskDate = new Date(date)
    taskDate.setHours(0, 0, 0, 0)

    const diffTime = taskDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "text-red-600 font-semibold"
    if (diffDays === 0) return "text-orange-500 font-semibold"
    return "text-muted-foreground"
  }

  const currentUserProfile = users.find(u => u.id === currentUserId)
  const isAdmin = currentUserProfile?.role === 'admin'
  const currentUserDepartmentId = currentUserProfile?.department_id

  const visibleTasks = tasks.filter(t => {
    let hasAccess = false
    if (isAdmin) hasAccess = true
    else if (t.assignee_id === currentUserId || (t.department_id && t.department_id === currentUserDepartmentId)) hasAccess = true
    
    if (!hasAccess) return false

    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false

    if (filterPriority !== 'all' && t.priority !== filterPriority) return false

    if (filterAssignee === 'me' && t.assignee_id !== currentUserId) return false

    return true
  })

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto h-[calc(100vh-6rem)] overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 
            className="text-2xl font-bold tracking-tight text-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.location.href = '/tasks'}
          >
            Công việc
          </h1>
          <p className="text-muted-foreground">Theo dõi và giao việc cá nhân, phòng ban.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4" />
            Giao việc mới
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-muted/30 p-2 px-3 rounded-lg border">
        <div className="flex items-center gap-2 w-full sm:w-auto relative">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <Input 
            placeholder="Tìm công việc..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[250px] pl-9 bg-background"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Select value={filterPriority} onValueChange={(val) => setFilterPriority(val || "all")}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="Ưu tiên" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi ưu tiên</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="medium">Trung bình</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={(val) => setFilterAssignee(val || "all")}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Người nhận" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả mọi người</SelectItem>
              <SelectItem value="me">Việc của tôi</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex bg-background border rounded-md p-1 shrink-0">
            <Button 
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="w-4 h-4 mr-1" /> Bảng
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode('list')}
            >
              <AlignJustify className="w-4 h-4 mr-1" /> Danh sách
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Tạo công việc mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="flex flex-col gap-4 py-4">
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
                      <SelectValue placeholder="Ưu tiên">
                        {priority === 'high' ? 'Cao' : priority === 'low' ? 'Thấp' : 'Trung bình'}
                      </SelectValue>
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
                      <span className="truncate">
                        {assigneeId
                          ? users.find((user) => user.id === assigneeId)?.full_name
                          : "Chọn người nhận..."}
                      </span>
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
                      <span className="truncate">
                        {departmentId
                          ? departments.find((d) => d.id === departmentId)?.name
                          : "Chọn phòng ban..."}
                      </span>
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
                <Button type="button" variant="outline" onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}>Hủy</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Tạo công việc
                </Button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Đang tải dữ liệu...
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {viewMode === 'kanban' && isMounted && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full pb-4 overflow-y-auto">
                {COLUMNS.map((col) => {
                  const colTasks = visibleTasks.filter(t => t.status === col.id)
                  
                  return (
                    <div key={col.id} className="flex flex-col gap-3 h-full min-h-[500px]">
                      <div className="flex items-center justify-between shrink-0 bg-muted/20 p-2 rounded-lg border">
                        <h3 className="font-semibold">{col.title}</h3>
                        <Badge variant="secondary">{colTasks.length}</Badge>
                      </div>

                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={cn(
                              "flex-1 overflow-y-auto flex flex-col gap-3 p-1 rounded-lg transition-colors",
                              snapshot.isDraggingOver ? "bg-muted/30" : ""
                            )}
                          >
                            {colTasks.length === 0 && !snapshot.isDraggingOver && (
                              <div className="text-sm text-center text-muted-foreground py-8 border border-dashed rounded-lg">
                                Kéo thả vào đây
                              </div>
                            )}
                            
                            {colTasks.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{...provided.draggableProps.style}}
                                  >
                                    <Card 
                                      className={cn(
                                        "shadow-sm border border-border/50 hover:border-primary/50 transition-colors cursor-grab active:cursor-grabbing",
                                        snapshot.isDragging ? "shadow-lg scale-[1.02] rotate-1 z-50" : ""
                                      )} 
                                      onClick={() => setSelectedTask(task)}
                                    >
                                      <CardHeader className="p-4 pb-2">
                                        <div className="flex justify-between items-start gap-2">
                                          <CardTitle className="text-base leading-tight font-medium">{task.title}</CardTitle>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                          <Badge variant="outline" className={`text-[10px] px-1 ${getPriorityColor(task.priority)}`}>
                                            {getPriorityLabel(task.priority)}
                                          </Badge>
                                          {task.attachments && task.attachments.length > 0 && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Paperclip className="w-3 h-3" /> {task.attachments.length}
                                            </div>
                                          )}
                                        </div>
                                      </CardHeader>
                                      <CardContent className="p-4 pt-2 pb-2">
                                        <div className={cn("flex items-center gap-1.5 text-xs", getDueDateColor(task.due_date_timestamp, task.due_date))}>
                                          <Clock className="w-3.5 h-3.5" />
                                          <span>{task.due_date_timestamp ? new Date(task.due_date_timestamp).toLocaleDateString('vi-VN') : task.due_date}</span>
                                        </div>
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.description}</p>
                                        )}
                                      </CardContent>
                                      <CardFooter className="p-3 pt-2 flex justify-between items-center border-t border-border/30 bg-muted/10 rounded-b-lg">
                                        <div className="flex items-center gap-2">
                                          <Avatar className="w-6 h-6 border">
                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                              {task.assignee.substring(0, 2).toUpperCase() || "??"}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={task.assignee}>{task.assignee}</span>
                                        </div>
                                      </CardFooter>
                                    </Card>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )
                })}
              </div>
            </DragDropContext>
          )}

          {viewMode === 'list' && (
            <div className="bg-background rounded-lg border shadow-sm overflow-hidden h-full flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium">Tên công việc</th>
                      <th className="px-4 py-3 font-medium">Trạng thái</th>
                      <th className="px-4 py-3 font-medium">Người nhận</th>
                      <th className="px-4 py-3 font-medium">Ưu tiên</th>
                      <th className="px-4 py-3 font-medium">Hạn chót</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">Không có công việc nào</td>
                      </tr>
                    ) : (
                      visibleTasks.map((task) => (
                        <tr key={task.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                          <td className="px-4 py-3 font-medium text-primary">{task.title}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{COLUMNS.find(c => c.id === task.status)?.title}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{task.assignee}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs px-1 ${getPriorityColor(task.priority)}`}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </td>
                          <td className={cn("px-4 py-3", getDueDateColor(task.due_date_timestamp, task.due_date))}>
                            {task.due_date_timestamp ? new Date(task.due_date_timestamp).toLocaleDateString('vi-VN') : task.due_date}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedTask} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null)
          setIsEditingTask(false)
          setEditTaskData({})
          if (taskIdFromUrl) {
            router.replace('/tasks', { scroll: false })
          }
        }
      }}>
        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={getPriorityColor(selectedTask?.priority || "medium")}>
                  Ưu tiên {getPriorityLabel(selectedTask?.priority || "medium")}
                </Badge>
                <Badge variant="secondary">{COLUMNS.find(c => c.id === selectedTask?.status)?.title}</Badge>
              </div>
              <div className="flex items-center gap-1 pr-8 sm:pr-10">
                {!isEditingTask && selectedTask && (
                  <>
                    {(!selectedTask.creator_id || selectedTask.creator_id === currentUserId || isAdmin) && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditTaskData({
                            title: selectedTask.title,
                            description: selectedTask.description || "",
                            due_date: selectedTask.due_date_timestamp ? new Date(selectedTask.due_date_timestamp).toISOString().split('T')[0] : selectedTask.due_date !== "Không có hạn" ? selectedTask.due_date : "",
                            priority: selectedTask.priority,
                            assignee_id: selectedTask.assignee_id || "",
                            department_id: selectedTask.department_id || "",
                            attachments: selectedTask.attachments || []
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Mức độ ưu tiên</label>
                  <Select value={editTaskData.priority || "medium"} onValueChange={(val) => setEditTaskData({...editTaskData, priority: val || "medium"})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ưu tiên">
                        {editTaskData.priority === 'high' ? 'Cao' : editTaskData.priority === 'low' ? 'Thấp' : 'Trung bình'}
                      </SelectValue>
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người">
                        {editTaskData.assignee_id && editTaskData.assignee_id !== "none" ? users.find(u => u.id === editTaskData.assignee_id)?.full_name : "Không chọn"}
                      </SelectValue>
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn phòng">
                        {editTaskData.department_id && editTaskData.department_id !== "none" ? departments.find(d => d.id === editTaskData.department_id)?.name : "Không chọn"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Không chọn</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <label className="text-sm font-medium">Tệp đính kèm hiện tại</label>
                {editTaskData.attachments && editTaskData.attachments.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {editTaskData.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded-md text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <FileIcon className="w-4 h-4 text-primary" />
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{file.name}</a>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTaskData({...editTaskData, attachments: editTaskData.attachments?.filter((_, i) => i !== idx)})}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Không có tệp nào</span>
                )}
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-sm font-medium">Thêm tệp mới</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="file" 
                    multiple
                    className="cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files) {
                        setEditTaskNewFiles(Array.from(e.target.files))
                      }
                    }}
                  />
                </div>
                {editTaskNewFiles.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {editTaskNewFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                        <span className="truncate">{file.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTaskNewFiles(editTaskNewFiles.filter((_, i) => i !== idx))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setIsEditingTask(false);
                  setEditTaskNewFiles([]);
                }}>Hủy</Button>
                <Button onClick={() => handleUpdateTask()} disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 py-4">
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block mb-1">Người nhận:</span>
                    <span className="font-medium">{selectedTask?.assignee}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Hạn chót:</span>
                    <span className={cn("font-medium flex items-center gap-1", getDueDateColor(selectedTask?.due_date_timestamp, selectedTask?.due_date))}>
                      <Clock className="w-3.5 h-3.5" />
                      {selectedTask?.due_date_timestamp ? new Date(selectedTask.due_date_timestamp).toLocaleDateString('vi-VN') : selectedTask?.due_date}
                    </span>
                  </div>
                </div>

                {selectedTask?.description && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><AlignJustify className="w-4 h-4 text-muted-foreground" /> Mô tả chi tiết</h4>
                    <div className="text-sm whitespace-pre-wrap bg-muted/10 p-4 border rounded-lg leading-relaxed text-foreground/90">
                      {selectedTask.description}
                    </div>
                  </div>
                )}


                {selectedTask?.attachments && selectedTask.attachments.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-muted-foreground" /> Tệp đính kèm ({selectedTask.attachments.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedTask.attachments.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted transition-colors text-sm">
                          <FileIcon className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate flex-1" title={file.name}>{file.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cột phải: Comment */}
              <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6">
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
