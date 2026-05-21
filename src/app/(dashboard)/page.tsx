"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

type PostType = {
  id: string
  title: string
  content: string
  department: string
  author_name: string
  created_at: string
}

export default function FeedPage() {
  const [posts, setPosts] = useState<PostType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [department, setDepartment] = useState("Chung")

  const fetchPosts = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) {
      setPosts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setIsSubmitting(true)
    
    // Default author name since we don't have a deep profile fetch setup yet
    // In a real app, you would fetch the user's profile first
    const { data: { user } } = await supabase.auth.getUser()
    const authorName = user?.email?.split('@')[0] || "Người dùng"

    const { error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        department,
        author_name: authorName
      })

    if (error) {
      alert("Lỗi đăng bài: " + error.message)
    } else {
      setTitle("")
      setContent("")
      setShowForm(false)
      await fetchPosts()
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bảng tin công ty</h1>
          <p className="text-muted-foreground">Thông báo và cập nhật mới nhất từ các phòng ban.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Đóng" : "Đăng thông báo"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tạo thông báo mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Tiêu đề</label>
                  <Input 
                    placeholder="Vd: Thông báo nghỉ lễ..." 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Phòng ban</label>
                  <Input 
                    placeholder="Vd: Hành chính, Kế toán..." 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nội dung</label>
                <textarea 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Nhập nội dung thông báo..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Đăng ngay
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Đang tải thông báo...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">
            Chưa có thông báo nào. Hãy đăng bài đầu tiên!
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {post.department.substring(0, 2).toUpperCase() || "CH"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base font-medium">
                    {post.department || "Chung"} - {post.title}
                  </CardTitle>
                  <CardDescription>
                    Đăng bởi {post.author_name} • {new Date(post.created_at).toLocaleString('vi-VN')}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
