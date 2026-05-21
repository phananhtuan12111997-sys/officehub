"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Calendar, User } from "lucide-react"
import { AttachmentList } from "@/components/ui/attachment-list"
import { Attachment } from "@/components/ui/file-upload"
import { Comments } from "@/components/ui/comments"
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

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [post, setPost] = useState<PostType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return
      
      setLoading(true)
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setPost(data)
      } else if (error) {
        console.error("Lỗi lấy bài viết:", error)
      }
      setLoading(false)
    }

    fetchPost()
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Đang tải nội dung...</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <h2>Không tìm thấy bài viết.</h2>
        <Button onClick={() => router.push("/")} variant="outline" className="mt-4">
          Quay lại bảng tin
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Button>
        </Link>
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardHeader className="border-b bg-muted/10 pb-6">
          <div className="mb-4">
            <span className="inline-block bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
              {post.department || "Tin tức chung"}
            </span>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold leading-tight text-primary">
            {post.title}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-4 mt-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-4 w-4" /> {post.author_name}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-4 w-4" /> {new Date(post.created_at).toLocaleString('vi-VN')}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <div className="prose prose-sm sm:prose-base max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>
          
          {post.attachments && post.attachments.length > 0 && (
            <AttachmentList attachments={post.attachments} />
          )}
        </CardContent>
      </Card>

      {/* Phần Bình luận */}
      <div className="mt-4">
        <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
          Bình luận
        </h3>
        <Card className="border-primary/10">
          <CardContent className="pt-6">
            <Comments postId={post.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
