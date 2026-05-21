"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase/client"
import { Loader2, ArrowRight, Paperclip, Edit2 } from "lucide-react"
import { FileUpload, Attachment } from "@/components/ui/file-upload"
import Link from "next/link"

type PostType = {
  id: string
  title: string
  content: string
  department: string
  author_name: string
  created_at: string
  attachments?: Attachment[]
}

export default function FeedPage() {
  const [posts, setPosts] = useState<PostType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  
  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [department, setDepartment] = useState("Chung")
  const [attachments, setAttachments] = useState<Attachment[]>([])

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
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.role === "admin") setIsAdmin(true)
          })
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setIsSubmitting(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    const authorName = user?.email?.split('@')[0] || "Người dùng"

    if (editingPostId) {
      const { error } = await supabase
        .from('posts')
        .update({
          title,
          content,
          department,
          attachments: attachments.length > 0 ? attachments : []
        })
        .eq('id', editingPostId)

      if (error) {
        alert("Lỗi sửa bài: " + error.message)
      } else {
        resetForm()
        await fetchPosts()
      }
    } else {
      const { error } = await supabase
        .from('posts')
        .insert({
          title,
          content,
          department,
          author_name: authorName,
          attachments: attachments.length > 0 ? attachments : []
        })

      if (error) {
        alert("Lỗi đăng bài: " + error.message)
      } else {
        resetForm()
        await fetchPosts()
      }
    }
    setIsSubmitting(false)
  }

  const resetForm = () => {
    setTitle("")
    setContent("")
    setDepartment("Chung")
    setAttachments([])
    setShowForm(false)
    setEditingPostId(null)
  }

  const handleEditPost = (post: PostType) => {
    setTitle(post.title)
    setContent(post.content)
    setDepartment(post.department || "Chung")
    setAttachments(post.attachments || [])
    setEditingPostId(post.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Thông Báo</h1>
          <p className="text-muted-foreground mt-1">Thông báo và cập nhật mới nhất từ ban điều hành.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setShowForm(true)
            }
          }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {showForm ? "Đóng form" : "Đăng thông báo mới"}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-primary/50 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg text-primary">{editingPostId ? "Chỉnh sửa bản tin" : "Tạo bản tin mới"}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Tiêu đề bài viết</label>
                  <Input 
                    placeholder="Vd: Quyết định bổ nhiệm..." 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="border-primary/20 focus-visible:ring-primary/50"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Chuyên mục / Phòng ban</label>
                  <Input 
                    placeholder="Vd: Hành chính nhân sự" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="border-primary/20 focus-visible:ring-primary/50"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Nội dung chi tiết</label>
                <textarea 
                  className="flex min-h-[150px] w-full rounded-md border border-primary/20 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                  placeholder="Nhập nội dung bản tin..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Tài liệu đính kèm</label>
                <FileUpload 
                  attachments={attachments}
                  onUpload={(newAttachments) => setAttachments(newAttachments)}
                  onRemove={(idx) => setAttachments(attachments.filter((_, i) => i !== idx))}
                />
              </div>
              <div className="flex justify-end gap-3 mt-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>Hủy bỏ</Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPostId ? "Lưu thay đổi" : "Đăng bài"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground col-span-full">Đang tải bản tin...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border rounded-xl border-dashed col-span-full">
            Chưa có tin tức nào.
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow border-primary/10">
              <CardHeader className="bg-muted/20 pb-4 border-b border-primary/5">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
                    {post.department || "Tin tức"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleEditPost(post)} title="Sửa thông báo">
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl font-bold leading-tight line-clamp-2 hover:text-primary transition-colors">
                  <Link href={`/post/${post.id}`}>{post.title}</Link>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2 text-xs">
                  <span>Bởi <strong>{post.author_name}</strong></span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {post.content}
                </p>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t pt-4 flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-primary">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>{post.attachments.length} file đính kèm</span>
                    </div>
                  )}
                </div>
                <Link href={`/post/${post.id}`}>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto font-medium">
                    Xem chi tiết <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
