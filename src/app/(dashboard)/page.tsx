"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase/client"
import { Loader2, ArrowRight, Paperclip, Edit2, Trash2, Pin, MessageCircle, Heart, Search, Eye } from "lucide-react"
import { FileUpload } from "@/components/ui/file-upload"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AttachmentList } from "@/components/ui/attachment-list"
import { Attachment } from "@/components/ui/file-upload"
import { ImageGallery } from "@/components/ui/image-gallery"
import { EmojiReactions } from "@/components/ui/emoji-reactions"
import { PollCreator, PollData } from "@/components/ui/poll-creator"
import { PollViewer } from "@/components/ui/poll-viewer"
import Link from "next/link"
import { useRouter } from "next/navigation"
type PostType = {
  id: string
  title: string
  content: string
  department: string
  author_name?: string
  author_id?: string
  created_at: string
  is_pinned?: boolean
  attachments?: Attachment[]
  post_reads?: { id: string, user_id: string, reaction_type: string }[]
  comments?: { id: string }[]
  polls?: any[]
}

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<PostType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([])
  
  // Pagination & Filter
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filterDept, setFilterDept] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const PAGE_SIZE = 10
  
  // Form state
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [department, setDepartment] = useState("Tất cả")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isPinned, setIsPinned] = useState(false)
  const [pollData, setPollData] = useState<PollData | null>(null)

  const fetchPosts = async (isLoadMore = false, dept = filterDept) => {
    setLoading(true)
    const currentPage = isLoadMore ? page + 1 : 0
    const from = currentPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('posts')
      .select('*, post_reads(*), polls(*, poll_options(*, poll_votes(*)))', { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)
      
    if (dept !== "all") {
      query = query.eq("department", dept)
    }

    if (searchQuery.trim() !== "") {
      query = query.ilike('title', `%${searchQuery.trim()}%`)
    }

    const { data, count, error } = await query
      
    if (error) {
      console.error("fetchPosts error details:", error.message || error)
    }

    if (data) {
      // Fetch comments manually to avoid Foreign Key relation issues
      const postIds = data.map(p => p.id)
      const { data: commentsData } = await supabase
        .from('comments')
        .select('id, post_id')
        .in('post_id', postIds)

      const enrichedData = data.map(post => ({
        ...post,
        comments: commentsData ? commentsData.filter(c => c.post_id === post.id) : []
      }))

      if (isLoadMore) {
        setPosts([...posts, ...enrichedData])
      } else {
        setPosts(enrichedData)
      }
      setPage(currentPage)
      setHasMore(count !== null ? from + PAGE_SIZE < count : false)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts(false, filterDept)
  }, [searchQuery])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCurrentUser(data.session.user)
        supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single()
          .then(({ data: profile }) => {
            const managementRoles = ['admin', 'ceo', 'director', 'deputy_director', 'head_of_dept', 'deputy_head_of_dept']
            if (managementRoles.includes(profile?.role)) setIsAdmin(true)
          })
      }
    })

    supabase.from("departments").select("id, name").order("name").then(({ data }) => {
      if (data) setDepartments(data)
    })

    const channel = supabase.channel('feed_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts(false, filterDept)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        fetchPosts(false, filterDept)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !content) return

    setIsSubmitting(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const user = session.user
    const authorName = user?.email?.split('@')[0] || "Người dùng"

    if (editingPostId) {
      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: editingPostId,
          title,
          content,
          department,
          is_pinned: isPinned,
          attachments: attachments.length > 0 ? attachments : []
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        alert("Lỗi sửa bài: " + (errorData.error || "Không xác định"))
      } else {
        setShowForm(false)
        setEditingPostId(null)
        resetForm()
        await fetchPosts()
      }
    } else {
      const { data: insertedPost, error } = await supabase
        .from('posts')
        .insert({
          title,
          content,
          department,
          author_name: authorName,
          author_id: user.id,
          is_pinned: isPinned,
          attachments: attachments.length > 0 ? attachments : []
        })
        .select()

      if (error) {
        alert("Lỗi đăng bài: " + error.message)
      } else {
        const newPost = insertedPost?.[0]
          
        // Save Poll if exists
        if (newPost && pollData && pollData.question) {
          const { data: poll, error: pollError } = await supabase.from('polls').insert({
            post_id: newPost.id,
            question: pollData.question,
            is_multiple_choice: pollData.is_multiple_choice
          }).select().single()
          
          if (poll && !pollError) {
            const options = pollData.options.filter(o => o.trim() !== "").map(o => ({
              poll_id: poll.id,
              option_text: o
            }))
            if (options.length > 0) {
              await supabase.from('poll_options').insert(options)
            }
          }
        }

        // Build notifications
        const { data: senderData } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        const senderFullName = senderData?.full_name || authorName
        
        let allNotifiedUserIds = new Set<string>()

        if (department === "Tất cả") {
          const { data: allUsers } = await supabase.from('profiles').select('id')
          if (allUsers) {
            const notifications = allUsers
              .filter(u => u.id !== user.id)
              .map(u => {
                allNotifiedUserIds.add(u.id)
                return {
                  user_id: u.id,
                  title: 'Thông báo chung mới',
                  message: `${senderFullName} vừa đăng thông báo: ${title}`,
                  link: `/post/${newPost?.id}`,
                  type: 'system'
                }
              })
            if (notifications.length > 0) await supabase.from('notifications').insert(notifications)
          }
        } else {
          const dept = departments.find(d => d.name === department)
          if (dept) {
            const { data: deptUsers } = await supabase.from('profiles').select('id').eq('department_id', dept.id)
            if (deptUsers) {
              const notifications = deptUsers
                .filter(u => u.id !== user.id)
                .map(u => {
                  allNotifiedUserIds.add(u.id)
                  return {
                    user_id: u.id,
                    title: `Thông báo phòng ${department}`,
                    message: `${senderFullName} vừa đăng thông báo nội bộ: ${title}`,
                    link: `/post/${newPost?.id}`,
                    type: 'system'
                  }
                })
              if (notifications.length > 0) await supabase.from('notifications').insert(notifications)
            }
          }
        }
        
        // Extract mentions
        const mentionRegex = /data-denotation-char="@" data-id="([^"]+)"/g;
        const mentionedUserIds = new Set<string>();
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
          const mentionedId = match[1];
          if (mentionedId !== user.id) {
            mentionedUserIds.add(mentionedId);
          }
        }
        
        if (mentionedUserIds.size > 0) {
          const mentionNotifications = Array.from(mentionedUserIds).map(uid => ({
            user_id: uid,
            title: 'Bạn được nhắc đến',
            message: `${senderFullName} đã nhắc đến bạn trong bài viết: ${title}`,
            link: `/post/${newPost.id}`,
            type: 'mention'
          }))
          await supabase.from('notifications').insert(mentionNotifications)
        }
        
        setShowForm(false)
        resetForm()
        await fetchPosts()
      }
    }
    setIsSubmitting(false)
  }

  const resetForm = () => {
    setTitle("")
    setContent("")
    setDepartment("Tất cả")
    setAttachments([])
    setIsPinned(false)
    setShowForm(false)
    setEditingPostId(null)
    setPollData(null)
  }

  const handleEditPost = (post: PostType) => {
    setEditingPostId(post.id)
    setTitle(post.title)
    setContent(post.content)
    setDepartment(post.department)
    setAttachments(post.attachments || [])
    setIsPinned(post.is_pinned || false)
    setShowForm(true)
  }

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/posts', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        id,
        is_pinned: !currentPinStatus
      })
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi cập nhật trạng thái ghim: " + (errorData.error || "Không xác định"))
    } else {
      await fetchPosts(false, filterDept)
    }
  }

  const handleDeletePost = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xoá bản tin này?")) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch(`/api/posts?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` }
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi xoá bài: " + (errorData.error || "Không xác định"))
    } else {
      await fetchPosts(false, filterDept)
    }
  }

  const handleReaction = async (postId: string, type: string) => {
    if (!currentUser) return
    const post = posts.find(p => p.id === postId)
    const existingReaction = post?.post_reads?.find(r => r.user_id === currentUser.id && r.reaction_type)
    const existingRead = post?.post_reads?.find(r => r.user_id === currentUser.id)
    
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
      if (!dbError && post && post.author_id && post.author_id !== currentUser.id && (!existingReaction || existingReaction.reaction_type !== type)) {
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

        // Check if there's already an existing notification for this post
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', post.author_id)
          .eq('type', 'reaction')
          .eq('link', link)
          .maybeSingle()

        if (existingNotif) {
          // Update existing notification to bump it and change message
          await supabase.from('notifications')
            .update({ 
              message, 
              title: 'Có người bày tỏ cảm xúc',
              is_read: false,
              created_at: new Date().toISOString()
            })
            .eq('id', existingNotif.id)
        } else {
          // Insert new notification
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
      await fetchPosts(false, filterDept)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b pb-4">
        <h1 
          className="text-2xl sm:text-3xl font-bold tracking-tight text-primary cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.location.href = '/'}
        >
          Bảng tin nội bộ
        </h1>
        {isAdmin && (
          <>
            <Button 
              onClick={() => setShowForm(true)} 
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full px-6 w-full sm:w-auto"
            >
              Bạn muốn thông báo điều gì?
            </Button>
            <Dialog open={showForm} onOpenChange={(open) => {
              setShowForm(open)
              if (!open) resetForm()
            }}>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl text-primary">{editingPostId ? "Chỉnh sửa bản tin" : "Tạo bản tin mới"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
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
                    <Select value={department} onValueChange={(val) => setDepartment(val || "Tất cả")}>
                      <SelectTrigger className="border-primary/20 focus-visible:ring-primary/50">
                        <SelectValue placeholder="Chọn chuyên mục / phòng ban" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tất cả">Tất Cả</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.name}>
                            Phòng: {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Nội dung chi tiết</label>
                  <div className="h-64 mb-12">
                    <RichTextEditor 
                      placeholder="Nhập nội dung bản tin..."
                      value={content}
                      onChange={(val: string) => setContent(val)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Tài liệu đính kèm</label>
                  <FileUpload 
                    attachments={attachments}
                    onUpload={(newAttachments) => setAttachments(newAttachments)}
                    onRemove={(idx) => setAttachments(attachments.filter((_, i) => i !== idx))}
                  />
                </div>
                
                {pollData ? (
                  <PollCreator data={pollData} onChange={setPollData} />
                ) : (
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setPollData({ question: "", options: ["", ""], is_multiple_choice: false })}
                      className="border-dashed"
                    >
                      Tạo khảo sát
                    </Button>
                  </div>
                )}
                
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-2">
                    <Switch 
                      checked={isPinned} 
                      onCheckedChange={setIsPinned}
                      id="pin-post"
                    />
                    <label htmlFor="pin-post" className="text-sm font-semibold cursor-pointer">Ghim bài (Luôn hiện trên cùng)</label>
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Hủy bỏ</Button>
                  <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingPostId ? "Lưu thay đổi" : "Đăng bài"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-background border rounded-xl p-2 shadow-sm">
        <Tabs defaultValue="all" value={filterDept} onValueChange={(val) => {
          setFilterDept(val)
          fetchPosts(false, val)
        }} className="w-full md:w-auto">
          <TabsList className="flex flex-wrap h-auto w-full justify-start bg-transparent">
            <TabsTrigger value="all" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Thông báo chung</TabsTrigger>
            {departments.map(d => (
              <TabsTrigger key={d.id} value={d.name} className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Phòng {d.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Tìm kiếm bản tin..." 
            className="pl-9 bg-muted/40 border-none rounded-full" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex flex-col h-full overflow-hidden">
              <Skeleton className="h-40 w-full rounded-t-xl rounded-b-none" />
              <CardHeader className="pb-4">
                <Skeleton className="h-4 w-1/4 mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="pt-4 border-t">
                <Skeleton className="h-6 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border rounded-xl border-dashed col-span-full">
            Chưa có tin tức nào.
          </div>
        ) : (
          posts.map((post) => {
            const hasRead = post.post_reads?.some(r => r.user_id === currentUser?.id)
            const images = post.attachments?.filter(a => a.type.startsWith('image/')) || []

            return (
            <Card key={post.id} className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow border-primary/10 cursor-pointer" onClick={() => router.push(`/post/${post.id}`)}>
              <CardHeader className="bg-muted/10 pb-4 border-b border-primary/5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2 items-center">
                    {isAdmin ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleTogglePin(post.id, post.is_pinned || false); }}
                        className={`hover:scale-110 transition-transform ${post.is_pinned ? 'text-red-500' : 'text-muted-foreground/40 hover:text-red-500'}`}
                        title={post.is_pinned ? 'Bỏ ghim' : 'Ghim bài này'}
                      >
                        <Pin className={`h-4 w-4 ${post.is_pinned ? 'fill-red-500' : ''}`} />
                      </button>
                    ) : (
                      post.is_pinned && <Pin className="h-4 w-4 text-red-500 fill-red-500" />
                    )}
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {post.department === "Tất cả" ? "Tất Cả" : (post.department || "Tin tức")}
                    </span>
                    {!hasRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500" title="Chưa đọc" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); handleEditPost(post); }} title="Sửa thông báo">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} title="Xoá thông báo">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <CardTitle className={`text-xl leading-tight line-clamp-2 hover:text-primary transition-colors ${!hasRead ? 'font-black text-foreground' : 'font-bold text-foreground/80'}`}>
                  <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()}>{post.title}</Link>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2 text-xs">
                  <span>Bởi <strong>{post.author_name}</strong></span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <div 
                  className="text-sm text-muted-foreground leading-relaxed line-clamp-3 prose prose-sm max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
                
                {post.polls && post.polls.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <PollViewer 
                      poll={post.polls[0]} 
                      currentUserId={currentUser?.id} 
                      onVoteComplete={() => fetchPosts(false, filterDept)} 
                    />
                  </div>
                )}
                
                {images.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ImageGallery images={images} />
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/5 border-t pt-4 flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground gap-4">
                  <div onClick={(e) => e.stopPropagation()}>
                    <EmojiReactions 
                      postId={post.id}
                      reactions={post.post_reads || []}
                      currentUserId={currentUser?.id}
                      onReact={handleReaction}
                    />
                  </div>
                  <Link href={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-primary transition-colors" title="Bình luận">
                    <MessageCircle className="h-4 w-4" />
                    <span>{post.comments?.length || 0}</span>
                  </Link>
                  {post.attachments && post.attachments.filter(a => !a.type.startsWith('image/')).length > 0 && (
                    <div className="flex items-center gap-1 text-primary" onClick={(e) => e.stopPropagation()}>
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>{post.attachments.filter(a => !a.type.startsWith('image/')).length}</span>
                    </div>
                  )}
                </div>
                <Link href={`/post/${post.id}`}>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto font-medium">
                    Chi tiết <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )})
        )}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={() => fetchPosts(true)}>
            Tải thêm tin tức
          </Button>
        </div>
      )}
    </div>
  )
}

