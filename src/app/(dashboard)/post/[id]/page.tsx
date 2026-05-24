"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Calendar, User, MessageCircle } from "lucide-react"
import { AttachmentList } from "@/components/ui/attachment-list"
import { Attachment } from "@/components/ui/file-upload"
import { ImageGallery } from "@/components/ui/image-gallery"
import { PollViewer } from "@/components/ui/poll-viewer"
import { Comments } from "@/components/ui/comments"
import { EmojiReactions } from "@/components/ui/emoji-reactions"
import Link from "next/link"

type PostType = {
  id: string
  title: string
  content: string
  department: string
  author_name: string
  author_id?: string
  created_at: string
  attachments?: Attachment[]
  polls?: any[]
  post_reads?: { id: string, user_id: string, reaction_type: string }[]
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [post, setPost] = useState<PostType | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setCurrentUser(session.user)
    }
    fetchUser()
  }, [])

  const fetchPost = async () => {
    if (!id) return
    
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*, polls(*, poll_options(*, poll_votes(*))), post_reads(*)')
      .eq('id', id)
      .single()

    if (data) {
      setPost(data)
    } else if (error) {
      console.error("Lỗi lấy bài viết:", error)
    }
    setLoading(false)
  }

  const handleReaction = async (postId: string, type: string) => {
    if (!currentUser || !post) return
    const existingReaction = post.post_reads?.find(r => r.user_id === currentUser.id && r.reaction_type)
    const existingRead = post.post_reads?.find(r => r.user_id === currentUser.id)
    
    let dbError = null;

    if (existingReaction && existingReaction.reaction_type === type) {
      const { error } = await supabase.from('post_reads').update({ reaction_type: null }).eq('id', existingReaction.id)
      dbError = error;
    } else if (existingReaction) {
      const { error } = await supabase.from('post_reads').update({ reaction_type: type }).eq('id', existingReaction.id)
      dbError = error;
    } else {
      if (existingRead) {
        const { error } = await supabase.from('post_reads').update({ reaction_type: type }).eq('id', existingRead.id)
        dbError = error;
      } else {
        const { error } = await supabase.from('post_reads').insert({
          post_id: postId,
          user_id: currentUser.id,
          reaction_type: type
        })
        dbError = error;
      }
    }
      
    // Notify post author if it's not the same user
    if (!dbError && post.author_id && post.author_id !== currentUser.id && (!existingReaction || existingReaction.reaction_type !== type)) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single()
      const actorName = profile?.full_name || 'Ai đó'
      
      const currentReactions = post.post_reads?.filter(r => r.reaction_type).length || 0
      const totalReactions = currentReactions + (existingReaction ? 0 : 1)
      
      const reactionLabels: Record<string, string> = { like: 'thích', love: 'yêu thích', haha: 'cười haha', wow: 'wow', sad: 'buồn', angry: 'phẫn nộ' }
      const label = reactionLabels[type] || 'thích'
      
      let message = `${actorName} đã bày tỏ cảm xúc ${label} bài viết của bạn.`
      if (totalReactions > 1) {
        message = `${actorName} và ${totalReactions - 1} người khác đã bày tỏ cảm xúc bài viết của bạn.`
      }

      const link = `/post/${post.id}`

      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', post.author_id)
        .eq('type', 'reaction')
        .eq('link', link)
        .maybeSingle()

      if (existingNotif) {
        await supabase.from('notifications')
          .update({ 
            message, 
            title: 'Có người bày tỏ cảm xúc',
            is_read: false,
            created_at: new Date().toISOString()
          })
          .eq('id', existingNotif.id)
      } else {
        await supabase.from('notifications').insert({
          user_id: post.author_id,
          title: 'Có người bày tỏ cảm xúc',
          message,
          type: 'reaction',
          link
        })
      }
    }
    
    if (dbError) {
      console.error("Reaction error:", dbError);
      alert("Lỗi tương tác: " + dbError.message);
    } else {
      await fetchPost()
    }
  }

  useEffect(() => {
    fetchPost()

    if (id) {
      const channel = supabase.channel(`post_detail_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `id=eq.${id}` }, () => {
          fetchPost()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` }, () => {
          fetchPost()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
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

  const images = post.attachments?.filter(a => a.type.startsWith('image/')) || []
  const files = post.attachments?.filter(a => !a.type.startsWith('image/')) || []

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
          <div 
            className="prose prose-sm sm:prose-base max-w-none text-foreground leading-relaxed max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          
          {post.polls && post.polls.length > 0 && (
            <PollViewer 
              poll={post.polls[0]} 
              currentUserId={currentUser?.id} 
              onVoteComplete={() => fetchPost()} 
            />
          )}
          
          {images.length > 0 && <ImageGallery images={images} />}
          
          {files.length > 0 && (
            <AttachmentList attachments={files} />
          )}
        </CardContent>
        <CardFooter className="bg-muted/5 border-t pt-4 flex items-center justify-between rounded-b-xl">
          <div className="flex items-center text-xs text-muted-foreground gap-4">
            <EmojiReactions 
              postId={post.id}
              reactions={post.post_reads || []}
              currentUserId={currentUser?.id}
              onReact={handleReaction}
            />
            <div className="flex items-center gap-1 text-muted-foreground" title="Bình luận">
              <MessageCircle className="h-4 w-4" />
              <span>Bình luận</span>
            </div>
          </div>
        </CardFooter>
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
