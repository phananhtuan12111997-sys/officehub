"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send } from "lucide-react"

type Comment = {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: {
    full_name: string
    avatar_url: string
  }
}

export function Comments({ postId, taskId }: { postId?: string, taskId?: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetchComments()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [postId, taskId])

  const fetchComments = async () => {
    setLoading(true)
    let query = supabase
      .from('comments')
      .select(`
        id, content, created_at, author_id,
        profiles (full_name, avatar_url)
      `)
      .order('created_at', { ascending: true })

    if (postId) query = query.eq('post_id', postId)
    if (taskId) query = query.eq('task_id', taskId)

    const { data, error } = await query
    
    if (!error && data) {
      setComments(data as unknown as Comment[])
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setSubmitting(true)
    const { error } = await supabase
      .from('comments')
      .insert({
        post_id: postId || null,
        task_id: taskId || null,
        author_id: user.id,
        content: newComment.trim()
      })

    if (!error) {
      setNewComment("")
      await fetchComments()
    }
    setSubmitting(false)
  }

  if (loading) return <div className="text-sm text-muted-foreground py-2 animate-pulse">Đang tải bình luận...</div>

  return (
    <div className="flex flex-col gap-4 mt-4 pt-4 border-t">
      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3 items-start">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={comment.profiles?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/10 text-xs">
                {(comment.profiles?.full_name || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col bg-muted/50 rounded-lg px-3 py-2 text-sm w-full">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{comment.profiles?.full_name || "Người dùng"}</span>
                <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleString('vi-VN')}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground italic">Chưa có bình luận nào.</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
        <Input 
          placeholder="Viết bình luận..." 
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1"
          disabled={submitting}
        />
        <Button type="submit" size="icon" disabled={!newComment.trim() || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
