"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Plus, ArrowRight, Loader2, MessageSquare } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Comments } from "@/components/ui/comments"

type TaskType = {
  id: string
  title: string
  assignee: string
  due_date: string
  status: string
  created_at: string
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
  
  const [title, setTitle] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [users, setUsers] = useState<any[]>([])

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setUsers(data)
  }

  const fetchTasks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) setTasks(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
    fetchUsers()
  }, [])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) return
    setIsSubmitting(true)
    
    const selectedUser = users.find(u => u.id === assigneeId)
    const { error } = await supabase
      .from('tasks')
      .insert({
        title,
        assignee: selectedUser ? selectedUser.full_name : "Chưa phân công",
        assignee_id: assigneeId || null,
        due_date: dueDate || "Không có hạn",
        status: 'new'
      })

    if (error) {
      alert("Lỗi giao việc: " + error.message)
    } else {
      setTitle("")
      setAssigneeId("")
      setDueDate("")
      setShowForm(false)
      fetchTasks()
    }
    setIsSubmitting(false)
  }

  const handleMoveTask = async (id: string, currentStatus: string) => {
    let nextStatus = 'new'
    if (currentStatus === 'new' || currentStatus === 'in-progress') nextStatus = 'review'
    else if (currentStatus === 'review') nextStatus = 'done'
    else if (currentStatus === 'done') nextStatus = 'new' // Vòng lặp test

    const { error } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', id)
      
    if (!error) {
      fetchTasks() // Refresh list
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Công việc</h1>
          <p className="text-muted-foreground">Theo dõi tiến độ các đầu việc được giao.</p>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tên công việc</label>
                  <Input 
                    placeholder="Vd: Chuẩn bị hợp đồng..." 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Người nhận</label>
                  <Select value={assigneeId} onValueChange={(val) => setAssigneeId(val || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người nhận" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Hạn chót</label>
                  <Input 
                    placeholder="Vd: Hôm nay, Ngày mai..." 
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
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
              <div key={col.id} className="min-w-[300px] w-[350px] flex flex-col gap-4">
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
                    <Card key={task.id} className="shadow-sm border border-border/50">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base leading-tight">{task.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 pb-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{task.due_date}</span>
                        </div>
                        <Comments taskId={task.id} />
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between items-center mt-2 border-t pt-3 border-border/50">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {task.assignee.substring(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">{task.assignee}</span>
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
    </div>
  )
}
