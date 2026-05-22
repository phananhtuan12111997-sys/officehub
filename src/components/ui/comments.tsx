"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send, ThumbsUp, X } from "lucide-react"

type Reaction = {
  id: string
  reaction_type: string
  user_id: string
}

type Comment = {
  id: string
  content: string
  created_at: string
  author_id: string
  parent_id: string | null
  profiles: {
    full_name: string
    avatar_url: string
  }
  comment_reactions?: Reaction[]
}

export function Comments({ postId, taskId }: { postId?: string, taskId?: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
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
        id, content, created_at, author_id, parent_id,
        profiles (full_name, avatar_url),
        comment_reactions (id, reaction_type, user_id)
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
        content: newComment.trim(),
        parent_id: replyTo ? replyTo.id : null
      })

    if (!error) {
      setNewComment("")
      setReplyTo(null)
      await fetchComments()
    } else {
      alert("Lỗi đăng bình luận: " + error.message)
    }
    setSubmitting(false)
  }

  const toggleReaction = async (commentId: string, reactionType: string = 'like') => {
    if (!user) return
    const comment = comments.find(c => c.id === commentId)
    const existing = comment?.comment_reactions?.find(r => r.user_id === user.id && r.reaction_type === reactionType)

    if (existing) {
      await supabase.from('comment_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('comment_reactions').insert({
        comment_id: commentId,
        user_id: user.id,
        reaction_type: reactionType
      })

      if (comment && comment.author_id !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        await supabase.from('notifications').insert({
          user_id: comment.author_id,
          title: 'Có người thích bình luận',
          message: `${profile?.full_name || 'Ai đó'} đã thích bình luận của bạn.`,
          type: 'reaction',
          link: '/'
        })
      }
    }
    fetchComments()
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = comments.filter(c => c.parent_id === comment.id)
    
    const likes = comment.comment_reactions?.filter(r => r.reaction_type === 'like')?.length || 0
    const hasLiked = comment.comment_reactions?.some(r => r.user_id === user?.id && r.reaction_type === 'like')

    return (
      <div key={comment.id} className={`flex gap-2 sm:gap-3 items-start ${isReply ? 'mt-3 ml-8 sm:ml-12' : 'mt-4'}`}>
        <Avatar className={`${isReply ? 'h-6 w-6 sm:h-8 sm:w-8' : 'h-8 w-8'} shrink-0`}>
          <AvatarImage src={comment.profiles?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/10 text-xs">
            {(comment.profiles?.full_name || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col w-full">
          <div className="flex flex-col bg-muted/50 rounded-2xl px-3 py-2 text-sm w-fit max-w-[90%] relative">
            <span className="font-semibold text-foreground/90">{comment.profiles?.full_name || "Người dùng"}</span>
            <p className="mt-0.5 whitespace-pre-wrap">{comment.content}</p>
            {likes > 0 && (
              <div className="absolute -bottom-2 -right-4 bg-background border shadow-sm rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1 z-10">
                <ThumbsUp className="w-3 h-3 text-blue-500 fill-blue-500" /> <span className="font-semibold text-muted-foreground">{likes}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-muted-foreground">
            <button 
              type="button"
              onClick={() => toggleReaction(comment.id, 'like')} 
              className={`hover:underline font-semibold ${hasLiked ? 'text-primary' : ''}`}
            >
              Thích
            </button>
            <button 
              type="button"
              onClick={() => { 
                setReplyTo(comment)
                setTimeout(() => document.getElementById('comment-input')?.focus(), 50)
              }}
              className="hover:underline font-semibold"
            >
              Trả lời
            </button>
            <span>{new Date(comment.created_at).toLocaleString('vi-VN')}</span>
          </div>

          {replies.length > 0 && (
            <div className="flex flex-col">
              {replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div className="text-sm text-muted-foreground py-2 animate-pulse">Đang tải bình luận...</div>

  const rootComments = comments.filter(c => !c.parent_id)

  return (
    <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
      <div className="flex flex-col mb-2">
        {rootComments.map((comment) => renderComment(comment))}
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground italic mt-2">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
        )}
      </div>

      <div className="flex flex-col gap-2 bg-background sticky bottom-0 py-2 border-t mt-2">
        {replyTo && (
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded-md text-sm border-l-2 border-primary">
            <div className="flex flex-col">
              <span className="font-semibold text-xs">Đang trả lời {replyTo.profiles?.full_name}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">{replyTo.content}</span>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyTo(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input 
            id="comment-input"
            placeholder={replyTo ? "Viết phản hồi..." : "Viết bình luận..."} 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 rounded-full"
            disabled={submitting}
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!newComment.trim() || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
