"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send, ThumbsUp, X, MoreHorizontal, Image as ImageIcon, Trash2, Edit2, History } from "lucide-react"
import { EmojiReactions } from "@/components/ui/emoji-reactions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  image_url?: string | null
  is_edited?: boolean
  profiles: {
    full_name: string
    avatar_url: string
  }
  comment_reactions?: Reaction[]
}

type CommentHistory = {
  id: string
  old_content: string
  old_image_url: string | null
  changed_at: string
}

export function Comments({ postId, taskId }: { postId?: string, taskId?: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const [contextAuthorId, setContextAuthorId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [editingComment, setEditingComment] = useState<Comment | null>(null)
  const [editContent, setEditContent] = useState("")

  const [historyComment, setHistoryComment] = useState<Comment | null>(null)
  const [historyList, setHistoryList] = useState<CommentHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchComments()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchContextAuthor()
  }, [postId, taskId])

  const fetchContextAuthor = async () => {
    if (postId) {
      const { data } = await supabase.from('posts').select('author_id').eq('id', postId).single()
      setContextAuthorId(data?.author_id || null)
    } else if (taskId) {
      const { data } = await supabase.from('tasks').select('creator_id').eq('id', taskId).single()
      setContextAuthorId(data?.creator_id || null)
    }
  }

  const fetchComments = async () => {
    setLoading(true)
    let query = supabase
      .from('comments')
      .select(`
        id, content, created_at, author_id, parent_id, image_url, is_edited,
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null
    const fileExt = imageFile.name.split('.').pop()
    const fileName = `comments/${Math.random()}.${fileExt}`
    const { data } = await supabase.storage.from('office_files').upload(fileName, imageFile)
    if (data) {
      const { data: urlData } = supabase.storage.from('office_files').getPublicUrl(fileName)
      return urlData.publicUrl
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newComment.trim() && !imageFile) || !user) return

    setSubmitting(true)
    let uploadedImageUrl = await uploadImage()

    const { error } = await supabase
      .from('comments')
      .insert({
        post_id: postId || null,
        task_id: taskId || null,
        author_id: user.id,
        content: newComment.trim(),
        parent_id: replyTo ? replyTo.id : null,
        image_url: uploadedImageUrl
      })

    if (!error) {
      setNewComment("")
      setReplyTo(null)
      clearImage()
      await fetchComments()
      
      // Send notification to post/task author
      if (postId || taskId) {
        let targetUserId = null;
        let notifLink = '';
        
        if (postId) {
          const { data: post } = await supabase.from('posts').select('author_id').eq('id', postId).single()
          targetUserId = post?.author_id
          notifLink = `/post/${postId}`
        } else if (taskId) {
          const { data: task } = await supabase.from('tasks').select('assignee_id, creator_id').eq('id', taskId).single()
          targetUserId = task?.creator_id === user.id ? task?.assignee_id : task?.creator_id
          notifLink = `/tasks?taskId=${taskId}`
        }

        if (targetUserId && targetUserId !== user.id) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
          const actorName = profile?.full_name || 'Ai đó'
          
          const { count: totalComments } = await supabase.from('comments').select('id', { count: 'exact' }).eq(postId ? 'post_id' : 'task_id', postId || taskId)
          
          const contextName = postId ? 'bài viết' : 'công việc'
          const cContent = newComment.trim() ? `"${newComment.trim().substring(0, 50)}${newComment.length > 50 ? '...' : ''}"` : "một hình ảnh"
          let message = `${actorName} đã bình luận ở ${contextName}: ${cContent}`
          if (totalComments && totalComments > 1) {
             message = `${actorName} và ${totalComments - 1} người khác đã bình luận ở ${contextName} của bạn.`
          }

          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', targetUserId)
            .eq('type', 'comment')
            .eq('link', notifLink)
            .maybeSingle()

          if (existingNotif) {
            await supabase.from('notifications')
              .update({
                message,
                title: 'Bình luận mới',
                is_read: false,
                created_at: new Date().toISOString()
              })
              .eq('id', existingNotif.id)
          } else {
            await supabase.from('notifications').insert({
              user_id: targetUserId,
              title: 'Bình luận mới',
              message,
              type: 'comment',
              link: notifLink
            })
          }
        }
        
        // Also notify the parent comment author if it's a reply
        if (replyTo && replyTo.author_id !== user.id && replyTo.author_id !== targetUserId) {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
          const actorName = profile?.full_name || 'Ai đó'
          const replyLink = `${notifLink}#comment-${replyTo.id}`
          
          const { count: totalReplies } = await supabase.from('comments').select('id', { count: 'exact' }).eq('parent_id', replyTo.id)
          
          const contextName = postId ? 'bài viết' : 'công việc'
          let replyMessage = `${actorName} đã trả lời bình luận của bạn ở ${contextName}.`
          if (totalReplies && totalReplies > 1) {
             replyMessage = `${actorName} và ${totalReplies - 1} người khác đã trả lời bình luận của bạn ở ${contextName}.`
          }

          const { data: existingReplyNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', replyTo.author_id)
            .eq('type', 'comment')
            .eq('link', replyLink)
            .maybeSingle()

          if (existingReplyNotif) {
            await supabase.from('notifications')
              .update({
                message: replyMessage,
                title: 'Có người phản hồi bình luận',
                is_read: false,
                created_at: new Date().toISOString()
              })
              .eq('id', existingReplyNotif.id)
          } else {
            await supabase.from('notifications').insert({
              user_id: replyTo.author_id,
              title: 'Có người phản hồi bình luận',
              message: replyMessage,
              type: 'comment',
              link: replyLink
            })
          }
        }
      }
    } else {
      alert("Lỗi đăng bình luận: " + error.message)
    }
    setSubmitting(false)
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá bình luận này?")) return
    await supabase.from('comments').delete().eq('id', commentId)
    fetchComments()
  }

  const handleStartEdit = (comment: Comment) => {
    setEditingComment(comment)
    setEditContent(comment.content)
  }

  const handleSaveEdit = async () => {
    if (!editingComment || !editContent.trim()) return
    setSubmitting(true)
    
    await supabase.from('comment_history').insert({
      comment_id: editingComment.id,
      old_content: editingComment.content,
      old_image_url: editingComment.image_url
    })

    const { error } = await supabase.from('comments').update({
      content: editContent.trim(),
      is_edited: true
    }).eq('id', editingComment.id)

    if (!error) {
      setEditingComment(null)
      setEditContent("")
      fetchComments()
    } else {
      alert("Lỗi khi sửa bình luận!")
    }
    setSubmitting(false)
  }

  const handleViewHistory = async (comment: Comment) => {
    setHistoryComment(comment)
    setLoadingHistory(true)
    const { data } = await supabase
      .from('comment_history')
      .select('*')
      .eq('comment_id', comment.id)
      .order('changed_at', { ascending: false })
    
    setHistoryList(data || [])
    setLoadingHistory(false)
  }

  const toggleReaction = async (commentId: string, reactionType: string = 'like') => {
    if (!user) return
    const comment = comments.find(c => c.id === commentId)
    const existing = comment?.comment_reactions?.find(r => r.user_id === user.id)

    if (existing && existing.reaction_type === reactionType) {
      await supabase.from('comment_reactions').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('comment_reactions').update({ reaction_type: reactionType }).eq('id', existing.id)
    } else {
      await supabase.from('comment_reactions').insert({
        comment_id: commentId,
        user_id: user.id,
        reaction_type: reactionType
      })

      if (comment && comment.author_id !== user.id) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        const notifLink = postId ? `/post/${postId}` : (taskId ? `/tasks?taskId=${taskId}` : `/`)
        
        const reactionLabels: Record<string, string> = { like: 'thích', love: 'yêu thích', haha: 'cười haha', wow: 'wow', sad: 'buồn', angry: 'phẫn nộ' }
        const label = reactionLabels[reactionType] || 'thích'
        
        await supabase.from('notifications').insert({
          user_id: comment.author_id,
          title: 'Có người bày tỏ cảm xúc bình luận',
          message: `${profile?.full_name || 'Ai đó'} đã bày tỏ cảm xúc ${label} với bình luận của bạn.`,
          type: 'reaction',
          link: notifLink
        })
      }
    }
    fetchComments()
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const replies = comments.filter(c => c.parent_id === comment.id)

    return (
      <div key={comment.id} className={`flex gap-2 sm:gap-3 items-start ${isReply ? 'mt-3 ml-8 sm:ml-12' : 'mt-4'}`}>
        <Avatar className={`${isReply ? 'h-6 w-6 sm:h-8 sm:w-8' : 'h-8 w-8'} shrink-0`}>
          <AvatarImage src={comment.profiles?.avatar_url || ""} />
          <AvatarFallback className="bg-primary/10 text-xs">
            {(comment.profiles?.full_name || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col w-full">
          {editingComment?.id === comment.id ? (
            <div className="flex flex-col gap-2 w-full max-w-[90%]">
              <Input 
                autoFocus
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={submitting}
                className="bg-muted/50 border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                  if (e.key === 'Escape') {
                    setEditingComment(null)
                    setEditContent("")
                  }
                }}
              />
              <div className="flex gap-2 text-xs">
                <Button size="sm" variant="ghost" onClick={() => { setEditingComment(null); setEditContent(""); }} disabled={submitting}>Hủy</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim() || submitting}>Lưu</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col bg-muted/50 rounded-2xl px-3 py-2 text-sm w-fit max-w-[90%] relative group">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-foreground/90">{comment.profiles?.full_name || "Người dùng"}</span>
                {(user?.id === comment.author_id || user?.id === contextAuthorId) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded-full transition-opacity absolute -right-8 top-1">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user?.id === comment.author_id && (
                        <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                          <Edit2 className="h-4 w-4 mr-2" /> Sửa
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDelete(comment.id)} className="text-red-600 focus:bg-red-50 focus:text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" /> Xoá
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{comment.content}</p>
              {comment.image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border max-w-sm">
                  <img src={comment.image_url} alt="Attached" className="object-cover w-full h-auto max-h-[300px]" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-muted-foreground">
            <EmojiReactions 
              postId={comment.id}
              reactions={comment.comment_reactions || []}
              currentUserId={user?.id}
              onReact={toggleReaction}
            />
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
            {comment.is_edited && (
              <button 
                onClick={() => handleViewHistory(comment)}
                className="hover:underline text-[10px] ml-1 flex items-center"
              >
                (Đã chỉnh sửa)
              </button>
            )}
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
    <div className="flex flex-col gap-2 mt-4 pt-4 border-t relative">
      <div className="flex flex-col mb-2">
        {rootComments.map((comment) => renderComment(comment))}
        {comments.length === 0 && (
          <div className="text-sm text-muted-foreground italic mt-2">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
        )}
      </div>

      <div className="flex flex-col gap-2 bg-background sticky bottom-0 py-2 border-t mt-2 z-10">
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
        
        {imagePreview && (
          <div className="relative w-fit ml-2 mb-2">
            <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded-md object-cover border" />
            <button 
              type="button" 
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
          />
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="rounded-full shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>

          <Input 
            id="comment-input"
            placeholder={replyTo ? "Viết phản hồi..." : "Viết bình luận..."} 
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 rounded-full"
            disabled={submitting}
          />
          <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={(!newComment.trim() && !imageFile) || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      <Dialog open={!!historyComment} onOpenChange={(open) => !open && setHistoryComment(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lịch sử chỉnh sửa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            {loadingHistory ? (
              <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : historyList.length > 0 ? (
              historyList.map((hist, idx) => (
                <div key={hist.id} className="flex flex-col pb-4 border-b last:border-0 relative pl-4">
                  <div className="absolute left-0 top-1.5 bottom-0 w-[2px] bg-muted/50"></div>
                  <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-primary/50"></div>
                  
                  <span className="text-xs text-muted-foreground mb-1">
                    {new Date(hist.changed_at).toLocaleString('vi-VN')}
                  </span>
                  <p className="text-sm whitespace-pre-wrap">{hist.old_content}</p>
                  {hist.old_image_url && (
                    <img src={hist.old_image_url} alt="Old attachment" className="mt-2 h-20 w-auto rounded-md object-cover border" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">Không tìm thấy lịch sử.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
