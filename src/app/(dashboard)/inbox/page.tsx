"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Mail, Send, Eye, Paperclip, Reply, FileText, Trash2, Forward, User, X, Pin, MoreHorizontal, Download, Search, Minimize2, Maximize2 } from "lucide-react"
import { FileUpload, Attachment } from "@/components/ui/file-upload"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import 'react-quill-new/dist/quill.snow.css'

type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url?: string
}

type MailboxMessage = {
  id: string
  sender_id: string
  receiver_id: string
  subject: string
  body: string
  attachments: Attachment[]
  is_read: boolean
  created_at: string
  is_deleted_by_sender?: boolean
  is_deleted_by_receiver?: boolean
  thread_id?: string
}

type ThreadMessage = MailboxMessage & {
  threadMessages: MailboxMessage[]
}

export default function InboxPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [inbox, setInbox] = useState<MailboxMessage[]>([])
  const [sent, setSent] = useState<MailboxMessage[]>([])
  const [loading, setLoading] = useState(true)

  // Soạn thư
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [receiverIds, setReceiverIds] = useState<string[]>([])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [quotedBody, setQuotedBody] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [searchUser, setSearchUser] = useState("")
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // New features: Pagination & Compose Minimize
  const [visibleInboxCount, setVisibleInboxCount] = useState(20)
  const [visibleSentCount, setVisibleSentCount] = useState(20)
  const [visibleTrashCount, setVisibleTrashCount] = useState(20)
  const [isComposeMinimized, setIsComposeMinimized] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Xem trước file
  const [previewAttachment, setPreviewAttachment] = useState<any>(null)

  // Mới nhận thư
  const [newMailNotification, setNewMailNotification] = useState<MailboxMessage | null>(null)

  const [replyThreadId, setReplyThreadId] = useState<string | null>(null)

  // Đọc thư
  const [readingMessage, setReadingMessage] = useState<ThreadMessage | null>(null)
  const [viewMode, setViewMode] = useState<"inbox" | "sent" | "trash">("inbox")

  // Pin & Select
  const [pinnedMails, setPinnedMails] = useState<Set<string>>(new Set())
  const [selectedMails, setSelectedMails] = useState<Set<string>>(new Set())

  const searchParams = useSearchParams()
  const router = useRouter()
  const threadIdFromUrl = searchParams.get('thread_id')
  const mailIdFromUrl = searchParams.get('mailId')
  const lastProcessedUrlParam = useRef<string | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  // 1. Nhận thư thời gian thực (Real-time)
  useEffect(() => {
    if (!currentUser) return;
    
    const channel = supabase
      .channel('mailbox_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mailbox' 
      }, (payload) => {
        console.log("Supabase Realtime Payload received:", payload)
        
        if (payload.eventType === 'INSERT' && payload.new.receiver_id === currentUser.id) {
          try {
            const audio = new Audio('/sound/ting.mp3');
            audio.play().catch(e => console.log('Audio play failed:', e));
          } catch (e) {}
          
          setNewMailNotification(payload.new as MailboxMessage)
          setTimeout(() => {
            setNewMailNotification(prev => prev?.id === payload.new.id ? null : prev)
          }, 5000)
        }

        // Tải lại dữ liệu ngầm không hiện loading khi có thay đổi
        fetchInitialData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [currentUser])

  const fetchInitialData = async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      if (!silent) setLoading(false)
      return
    }
    setCurrentUser(session.user)

    const savedPinned = localStorage.getItem(`pinned_mails_${session.user.id}`)
    if (savedPinned) {
      try {
        setPinnedMails(new Set(JSON.parse(savedPinned)))
      } catch(e) {}
    }

    // Lấy danh sách profiles (trừ mình ra)
    const { data: profilesData } = await supabase.from("profiles").select("id, email, full_name, avatar_url")
    if (profilesData) {
      setProfiles(profilesData.filter(p => p.id !== session.user.id))
    }

    // 2. Phân trang ở phía máy chủ (Giới hạn 1000 thư mới nhất để tối ưu)
    // Lấy hộp thư đến
    const { data: inboxData } = await supabase
      .from("mailbox")
      .select("*")
      .eq("receiver_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1000)
    
    if (inboxData) setInbox(inboxData)

    // Lấy hộp thư đi
    const { data: sentData } = await supabase
      .from("mailbox")
      .select("*")
      .eq("sender_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1000)
      
    if (sentData) setSent(sentData)

    if (!silent) setLoading(false)
  }


  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalBody = (body + quotedBody).trim()
    if (receiverIds.length === 0 || !subject.trim() || !finalBody || finalBody === "<p><br></p>") return

    setIsSending(true)
    
    const messagesToInsert = receiverIds.map(rid => ({
      sender_id: currentUser.id,
      receiver_id: rid,
      subject: subject.trim(),
      body: finalBody,
      attachments: attachments.length > 0 ? attachments : [],
      thread_id: replyThreadId || null
    }))

    const { data, error } = await supabase.from("mailbox").insert(messagesToInsert).select()

    if (error) {
      alert("Lỗi gửi thư: " + error.message)
    } else {
      setIsComposeOpen(false)
      setReceiverIds([])
      setSubject("")
      setBody("")
      setQuotedBody("")
      setAttachments([])
      alert("Đã gửi thư thành công!")
      setSearchUser("")
      if (data) {
        setSent([...data, ...sent])
        // Gửi thông báo cho người nhận
        try {
          const notificationsToInsert = data.map(msg => ({
            user_id: msg.receiver_id,
            title: "Thư mới",
            message: `Bạn nhận được một tin nhắn từ ${currentUser.full_name || 'đồng nghiệp'}.`,
            link: `/inbox?thread_id=${msg.thread_id || msg.id}`,
            is_read: false
          }))
          await supabase.from("notifications").insert(notificationsToInsert)
        } catch (err) {}
      }
    }
    setIsSending(false)
  }

  const formatMailDate = (dateString: string) => {
    const d = new Date(dateString)
    const today = new Date()
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const toggleSelect = (msgId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedMails)
    if (newSelected.has(msgId)) {
      newSelected.delete(msgId)
    } else {
      newSelected.add(msgId)
    }
    setSelectedMails(newSelected)
  }

  const togglePin = (msgId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newPinned = new Set(pinnedMails)
    if (newPinned.has(msgId)) {
      newPinned.delete(msgId)
    } else {
      newPinned.add(msgId)
    }
    setPinnedMails(newPinned)
    if (currentUser) {
      localStorage.setItem(`pinned_mails_${currentUser.id}`, JSON.stringify(Array.from(newPinned)))
    }
  }

  const toggleSelectAll = (mails: ThreadMessage[]) => {
    if (selectedMails.size === mails.length && mails.length > 0) {
      setSelectedMails(new Set())
    } else {
      setSelectedMails(new Set(mails.map(m => m.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedMails.size === 0) return

    const currentList = viewMode === "inbox" ? sortedInbox : viewMode === "sent" ? sortedSent : sortedTrash;
    const idsToDelete = currentList
      .filter(msg => selectedMails.has(msg.id))
      .flatMap(msg => msg.threadMessages.map(m => m.id));
    
    if (viewMode === "trash") {
      if (!confirm(`Bạn có chắc muốn xóa VĨNH VIỄN ${selectedMails.size} luồng thư đã chọn?`)) return
      const { error } = await supabase.from("mailbox").delete().in("id", idsToDelete)
      
      if (error) {
        alert("Lỗi khi xóa thư: " + error.message)
      } else {
        setInbox(inbox.filter(m => !idsToDelete.includes(m.id)))
        setSent(sent.filter(m => !idsToDelete.includes(m.id)))
        setSelectedMails(new Set())
        if (readingMessage && selectedMails.has(readingMessage.id)) {
          handleCloseMessage()
        }
      }
    } else {
      if (!confirm(`Chuyển ${selectedMails.size} luồng thư vào Thùng rác?`)) return
      
      const updateData: any = {};
      if (viewMode === "inbox") updateData.is_deleted_by_receiver = true;
      if (viewMode === "sent") updateData.is_deleted_by_sender = true;
      
      const { error } = await supabase.from("mailbox").update(updateData).in("id", idsToDelete)
      if (error) {
        alert("Lỗi khi xóa thư: " + error.message)
      } else {
        if (viewMode === "inbox") {
          setInbox(inbox.map(m => idsToDelete.includes(m.id) ? { ...m, is_deleted_by_receiver: true } : m))
        } else {
          setSent(sent.map(m => idsToDelete.includes(m.id) ? { ...m, is_deleted_by_sender: true } : m))
        }
        setSelectedMails(new Set())
        if (readingMessage && selectedMails.has(readingMessage.id)) {
          handleCloseMessage()
        }
      }
    }
  }

  const allMailsMap = new Map<string, MailboxMessage>()
  inbox.forEach(m => allMailsMap.set(m.id, m))
  sent.forEach(m => allMailsMap.set(m.id, m))
  const allMailsRaw = Array.from(allMailsMap.values())

  const getFullThread = (tId: string, isTrashView: boolean) => {
    return allMailsRaw
      .filter(m => (m.thread_id === tId || m.id === tId))
      .filter(m => {
        if (isTrashView) return true;
        // Nếu người gửi và người nhận đều là currentUser (gửi cho chính mình)
        if (m.sender_id === currentUser?.id && m.receiver_id === currentUser?.id) {
          return !m.is_deleted_by_sender || !m.is_deleted_by_receiver;
        }
        return m.sender_id === currentUser?.id ? !m.is_deleted_by_sender : !m.is_deleted_by_receiver;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  const groupEmailsByThread = (emails: MailboxMessage[], checkRead: boolean, isTrashView: boolean = false): ThreadMessage[] => {
    const threadMap = new Map<string, MailboxMessage[]>()
    emails.forEach(msg => {
      const tId = msg.thread_id || msg.id
      if (!threadMap.has(tId)) {
        threadMap.set(tId, [])
      }
      if (!threadMap.get(tId)!.find(m => m.id === msg.id)) {
        threadMap.get(tId)!.push(msg)
      }
    })
    
    const threads = Array.from(threadMap.values()).map(msgs => {
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const tId = msgs[0].thread_id || msgs[0].id;
      return {
        ...msgs[msgs.length - 1], // Message mới nhất trong folder
        threadMessages: getFullThread(tId, isTrashView),
        is_read: checkRead ? msgs.every(m => m.is_read) : true
      }
    })
    
    return threads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const sortedInbox = groupEmailsByThread(inbox.filter(msg => !msg.is_deleted_by_receiver), true, false).sort((a, b) => {
    const aPinned = pinnedMails.has(a.thread_id || a.id)
    const bPinned = pinnedMails.has(b.thread_id || b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  const sortedSent = groupEmailsByThread(sent.filter(msg => !msg.is_deleted_by_sender), false, false).sort((a, b) => {
    const aPinned = pinnedMails.has(a.thread_id || a.id)
    const bPinned = pinnedMails.has(b.thread_id || b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  const rawTrash = [...inbox.filter(msg => msg.is_deleted_by_receiver), ...sent.filter(msg => msg.is_deleted_by_sender)]
  const sortedTrash = groupEmailsByThread(rawTrash, false, true)

  useEffect(() => {
    if (sortedInbox.length > 0 && !readingMessage) {
      const currentParam = threadIdFromUrl || mailIdFromUrl
      if (currentParam && currentParam !== lastProcessedUrlParam.current) {
        let msg = null
        if (threadIdFromUrl) {
          msg = sortedInbox.find(m => m.thread_id === threadIdFromUrl || m.id === threadIdFromUrl)
        } else if (mailIdFromUrl) {
          msg = sortedInbox.find(m => m.id === mailIdFromUrl || (m.threadMessages && m.threadMessages.some(tm => tm.id === mailIdFromUrl)))
        }
        if (msg) {
          openMessage(msg, "inbox")
          lastProcessedUrlParam.current = currentParam
        }
      }
      if (!currentParam) {
        lastProcessedUrlParam.current = null
      }
    }
  }, [sortedInbox, threadIdFromUrl, mailIdFromUrl])

  const handleCloseMessage = () => {
    setReadingMessage(null)
    if (threadIdFromUrl || mailIdFromUrl) {
      router.replace('/inbox', { scroll: false })
    }
  }

  const getAvatarColor = (name: string) => {
    if (!name) return 'bg-primary/20 text-primary';
    const colors = ['bg-red-500 text-white', 'bg-orange-500 text-white', 'bg-amber-500 text-white', 'bg-green-500 text-white', 'bg-emerald-500 text-white', 'bg-teal-500 text-white', 'bg-cyan-500 text-white', 'bg-blue-500 text-white', 'bg-indigo-500 text-white', 'bg-violet-500 text-white', 'bg-purple-500 text-white', 'bg-pink-500 text-white', 'bg-rose-500 text-white'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  const handleToggleRead = async (msg: ThreadMessage, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = !msg.is_read
    const unreadIds = msg.threadMessages.map(m => m.id)
    if (unreadIds.length === 0) return

    const { error } = await supabase.from("mailbox").update({ is_read: newStatus }).in("id", unreadIds)
    if (!error) {
      setInbox(inbox.map(m => unreadIds.includes(m.id) ? { ...m, is_read: newStatus } : m))
      if (readingMessage?.id === msg.id) {
        setReadingMessage({ 
          ...readingMessage, 
          is_read: newStatus,
          threadMessages: readingMessage.threadMessages.map(m => ({...m, is_read: newStatus}))
        })
      }
    }
  }

  const filteredInbox = sortedInbox.filter(msg => {
    const s = searchQuery.toLowerCase();
    if (!s) return true;
    return msg.subject.toLowerCase().includes(s) || 
           getProfileName(msg.sender_id).toLowerCase().includes(s) ||
           msg.body.replace(/<[^>]*>?/gm, '').toLowerCase().includes(s);
  });

  const filteredSent = sortedSent.filter(msg => {
    const s = searchQuery.toLowerCase();
    if (!s) return true;
    return msg.subject.toLowerCase().includes(s) || 
           getProfileName(msg.receiver_id).toLowerCase().includes(s) ||
           msg.body.replace(/<[^>]*>?/gm, '').toLowerCase().includes(s);
  });

  const filteredTrash = sortedTrash.filter(msg => {
    const s = searchQuery.toLowerCase();
    if (!s) return true;
    return msg.subject.toLowerCase().includes(s) || 
           getProfileName(msg.sender_id).toLowerCase().includes(s) ||
           getProfileName(msg.receiver_id).toLowerCase().includes(s) ||
           msg.body.replace(/<[^>]*>?/gm, '').toLowerCase().includes(s);
  });

  const handleDeleteMail = async (msg: ThreadMessage) => {
    const threadIds = msg.threadMessages.map(m => m.id);

    if (viewMode === "trash") {
      if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn toàn bộ thư trong luồng này?\n\nLƯU Ý: Thư sẽ bị xóa VĨNH VIỄN khỏi cơ sở dữ liệu.")) return
      
      const { error } = await supabase.from("mailbox").delete().in("id", threadIds)
      if (error) {
        alert("Lỗi xóa thư: " + error.message)
      } else {
        setInbox(inbox.filter(m => !threadIds.includes(m.id)))
        setSent(sent.filter(m => !threadIds.includes(m.id)))
        handleCloseMessage()
      }
    } else {
      if (!confirm("Chuyển toàn bộ thư trong luồng này vào Thùng rác?")) return
      
      const updateData: any = {};
      if (viewMode === "inbox") updateData.is_deleted_by_receiver = true;
      if (viewMode === "sent") updateData.is_deleted_by_sender = true;

      const { error } = await supabase.from("mailbox").update(updateData).in("id", threadIds)
      if (error) {
        alert("Lỗi xóa thư: " + error.message)
      } else {
        if (viewMode === "inbox") {
          setInbox(inbox.map(m => threadIds.includes(m.id) ? { ...m, is_deleted_by_receiver: true } : m))
        } else {
          setSent(sent.map(m => threadIds.includes(m.id) ? { ...m, is_deleted_by_sender: true } : m))
        }
        handleCloseMessage()
      }
    }
  }

  const handleForward = (msg: ThreadMessage) => {
    setReceiverIds([])
    setSubject(`Fwd: ${msg.subject}`)
    setBody("")
    setQuotedBody(`<br><br><div class="quote-block"><blockquote><strong>Đã chuyển tiếp từ:</strong> ${getProfileName(msg.sender_id)}<br><strong>Ngày:</strong> ${new Date(msg.created_at).toLocaleString('vi-VN')}<br><strong>Chủ đề:</strong> ${msg.subject}<br><br>${msg.body}</blockquote></div>`)
    setAttachments(msg.attachments || [])
    setReplyThreadId(null)
    setIsComposeOpen(true)
  }

  const handleReply = (msg: ThreadMessage) => {
    setReceiverIds([msg.sender_id])
    setSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, '')}`)
    setBody("")
    setQuotedBody("") // Xóa phần trích dẫn để tránh trùng lặp nội dung khi hiển thị luồng thư
    setAttachments([])
    setReplyThreadId(msg.thread_id || msg.id)
    setIsComposeOpen(true)
  }

  const openMessage = async (msg: ThreadMessage, mode: "inbox" | "sent" | "trash") => {
    setReadingMessage(msg)
    setViewMode(mode)
    const latestId = msg.threadMessages[msg.threadMessages.length - 1]?.id;
    setExpandedMessages(new Set(latestId ? [latestId] : []));

    // Cập nhật is_read nếu là thư đến và chưa đọc
    if (mode === "inbox" && !msg.is_read) {
      const unreadIds = msg.threadMessages.filter(m => !m.is_read).map(m => m.id)
      if (unreadIds.length > 0) {
        const { error } = await supabase.from("mailbox").update({ is_read: true }).in("id", unreadIds)
        if (!error) {
          setInbox(inbox.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m))
          setReadingMessage({ 
            ...msg, 
            is_read: true,
            threadMessages: msg.threadMessages.map(m => ({...m, is_read: true}))
          })
        }
      }
    }
  }

  const handleNotificationClick = () => {
    if (!newMailNotification) return;
    
    // Tìm luồng thư chứa thư mới này
    const threadId = newMailNotification.thread_id || newMailNotification.id;
    const threadMsg = sortedInbox.find(t => t.thread_id === threadId || t.id === threadId);
    
    if (threadMsg) {
      openMessage(threadMsg, "inbox");
    }
    
    setNewMailNotification(null);
  }

  const getProfile = (id: string) => profiles.find(x => x.id === id)
  const getProfileName = (id: string) => {
    const p = getProfile(id)
    return p ? (p.full_name || p.email) : "Người dùng"
  }

  const filteredUsers = profiles.filter(p => 
    !receiverIds.includes(p.id) && 
    (p.full_name?.toLowerCase().includes(searchUser.toLowerCase()) || p.email.toLowerCase().includes(searchUser.toLowerCase()))
  )

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-100px)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-primary">
            <Mail className="h-8 w-8 text-primary" /> Hộp Thư
          </h1>
          <p className="text-muted-foreground mt-1">Gửi và nhận tin nhắn, tài liệu với các thành viên khác.</p>
        </div>
        <Button onClick={() => {
          setReceiverIds([])
          setSubject("")
          setBody("")
          setAttachments([])
          setReplyThreadId(null)
          setIsComposeOpen(true)
        }} className="gap-2">
          <Send className="h-4 w-4" /> Soạn thư
        </Button>
      </div>

      <div className="flex h-[calc(100dvh-65px)] overflow-hidden p-2 sm:p-6 gap-2 sm:gap-6">
        {/* Cột trái: Danh sách thư */}
        <div className={`flex flex-col w-full md:w-1/3 border rounded-lg bg-card shadow-sm overflow-hidden ${readingMessage ? 'hidden md:flex' : 'flex'}`}>
          <Tabs defaultValue="inbox" className="w-full flex flex-col h-full" onValueChange={(v) => { setViewMode(v as any); handleCloseMessage(); setSelectedMails(new Set()); }}>
            <div className="p-2 border-b shrink-0 bg-muted/20">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                <TabsTrigger value="inbox" className="data-active:bg-primary data-active:text-primary-foreground">Hộp thư đến</TabsTrigger>
                <TabsTrigger value="sent" className="data-active:bg-primary data-active:text-primary-foreground">Đã gửi</TabsTrigger>
                <TabsTrigger value="trash" className="data-active:bg-primary data-active:text-primary-foreground">Thùng rác</TabsTrigger>
              </TabsList>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm thư..."
                  className="pl-9 h-9 bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Thanh công cụ thao tác hàng loạt */}
            <div className="flex items-center justify-between p-2 border-b bg-muted/10 shrink-0 min-h-[44px]">
              <div className="flex items-center gap-2 px-2 cursor-pointer" onClick={() => toggleSelectAll(viewMode === "inbox" ? sortedInbox : viewMode === "sent" ? sortedSent : sortedTrash)}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                  checked={viewMode === "inbox" ? (sortedInbox.length > 0 && selectedMails.size === sortedInbox.length) : viewMode === "sent" ? (sortedSent.length > 0 && selectedMails.size === sortedSent.length) : (sortedTrash.length > 0 && selectedMails.size === sortedTrash.length)}
                  readOnly
                />
                <span className="text-sm font-medium text-muted-foreground select-none">Tất cả</span>
              </div>
              {selectedMails.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-7 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" /> Xóa ({selectedMails.size})
                </Button>
              )}
            </div>

            <TabsContent value="inbox" className="flex-1 overflow-y-auto m-0 p-0 relative">
              {filteredInbox.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Không tìm thấy thư nào.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="divide-y">
                    {filteredInbox.slice(0, visibleInboxCount).map((msg) => {
                    const p = getProfile(msg.sender_id)
                    const isPinned = pinnedMails.has(msg.id)
                    const avatarColor = getAvatarColor(p?.full_name || p?.email || '')
                    return (
                    <div 
                      key={msg.id} 
                      className={`relative p-4 pl-10 pr-10 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${readingMessage?.id === msg.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'} ${!msg.is_read ? 'bg-primary/5' : ''} ${isPinned ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      onClick={() => openMessage(msg, "inbox")}
                    >
                      {!msg.is_read && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      )}
                      <div className="absolute left-4 top-5" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                          checked={selectedMails.has(msg.id)}
                          onChange={(e) => toggleSelect(msg.id, e)}
                        />
                      </div>
                      <div className="absolute right-3 top-5 flex items-center gap-2" onClick={e => togglePin(msg.id, e)}>
                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-foreground'} cursor-pointer transition-colors`} />
                      </div>
                      <Avatar className="h-10 w-10 shrink-0 ml-1">
                        <AvatarImage src={p?.avatar_url} />
                        <AvatarFallback className={avatarColor}>{p?.full_name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${!msg.is_read ? 'font-bold text-foreground' : 'font-semibold'}`}>
                            {getProfileName(msg.sender_id)}
                            {msg.threadMessages && msg.threadMessages.length > 1 && <span className="text-muted-foreground ml-1 font-normal">({msg.threadMessages.length})</span>}
                          </span>
                          <span className={`text-[10px] whitespace-nowrap ${!msg.is_read ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{formatMailDate(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs truncate ${!msg.is_read ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{msg.subject}</span>
                          {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className={`text-xs truncate ${!msg.is_read ? 'text-foreground/80' : 'text-muted-foreground'}`} dangerouslySetInnerHTML={{ __html: msg.body.replace(/<[^>]*>?/gm, '') }}>
                        </div>
                      </div>
                    </div>
                  )})}
                  </div>
                  {visibleInboxCount < filteredInbox.length && (
                    <div className="p-4 text-center border-t">
                      <Button variant="outline" size="sm" onClick={() => setVisibleInboxCount(prev => prev + 20)}>Tải thêm thư cũ</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="flex-1 overflow-y-auto m-0 p-0 relative">
              {filteredSent.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Bạn chưa gửi thư nào.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="divide-y">
                    {filteredSent.slice(0, visibleSentCount).map((msg) => {
                    const p = getProfile(msg.receiver_id)
                    const isPinned = pinnedMails.has(msg.id)
                    const avatarColor = getAvatarColor(p?.full_name || p?.email || '')
                    return (
                    <div 
                      key={msg.id} 
                      className={`relative p-3 pl-8 pr-8 sm:p-4 sm:pl-10 sm:pr-10 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${readingMessage?.id === msg.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'} ${isPinned ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      onClick={() => openMessage(msg, "sent")}
                    >
                      <div className="absolute left-2 sm:left-3 top-4 sm:top-5" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                          checked={selectedMails.has(msg.id)}
                          onChange={(e) => toggleSelect(msg.id, e)}
                        />
                      </div>
                      <div className="absolute right-2 sm:right-3 top-4 sm:top-5" onClick={e => togglePin(msg.id, e)}>
                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-foreground'} cursor-pointer transition-colors`} />
                      </div>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p?.avatar_url} />
                        <AvatarFallback className={avatarColor}>{p?.full_name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            Tới: {getProfileName(msg.receiver_id)}
                            {msg.threadMessages && msg.threadMessages.length > 1 && <span className="text-muted-foreground ml-1 font-normal">({msg.threadMessages.length})</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatMailDate(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs truncate text-foreground">{msg.subject}</span>
                          {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="text-xs truncate text-muted-foreground" dangerouslySetInnerHTML={{ __html: msg.body.replace(/<[^>]*>?/gm, '') }}>
                        </div>
                      </div>
                    </div>
                  )})}
                  </div>
                  {visibleSentCount < filteredSent.length && (
                    <div className="p-4 text-center border-t">
                      <Button variant="outline" size="sm" onClick={() => setVisibleSentCount(prev => prev + 20)}>Tải thêm thư cũ</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="trash" className="flex-1 overflow-y-auto m-0 p-0 relative">
              {filteredTrash.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Thùng rác trống.</div>
              ) : (
                <div className="flex flex-col">
                  <div className="divide-y">
                    {filteredTrash.slice(0, visibleTrashCount).map((msg) => {
                    const isSentByMe = currentUser?.id === msg.sender_id;
                    const p = getProfile(isSentByMe ? msg.receiver_id : msg.sender_id)
                    const isPinned = pinnedMails.has(msg.id)
                    const avatarColor = getAvatarColor(p?.full_name || p?.email || '')
                    return (
                    <div 
                      key={msg.id} 
                      className={`relative p-3 pl-8 pr-8 sm:p-4 sm:pl-10 sm:pr-10 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${readingMessage?.id === msg.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'} ${isPinned ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      onClick={() => openMessage(msg, "trash")}
                    >
                      <div className="absolute left-2 sm:left-3 top-4 sm:top-5" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                          checked={selectedMails.has(msg.id)}
                          onChange={(e) => toggleSelect(msg.id, e)}
                        />
                      </div>
                      <div className="absolute right-2 sm:right-3 top-4 sm:top-5" onClick={e => togglePin(msg.id, e)}>
                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-foreground'} cursor-pointer transition-colors`} />
                      </div>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p?.avatar_url} />
                        <AvatarFallback className={avatarColor}>{p?.full_name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">
                            {isSentByMe ? "Tới: " : "Từ: "} {getProfileName(isSentByMe ? msg.receiver_id : msg.sender_id)}
                            {msg.threadMessages && msg.threadMessages.length > 1 && <span className="text-muted-foreground ml-1 font-normal">({msg.threadMessages.length})</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatMailDate(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs truncate text-foreground">{msg.subject}</span>
                          {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="text-xs truncate text-muted-foreground" dangerouslySetInnerHTML={{ __html: msg.body.replace(/<[^>]*>?/gm, '') }}>
                        </div>
                      </div>
                    </div>
                  )})}
                  </div>
                  {visibleTrashCount < filteredTrash.length && (
                    <div className="p-4 text-center border-t">
                      <Button variant="outline" size="sm" onClick={() => setVisibleTrashCount(prev => prev + 20)}>Tải thêm thư cũ</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Cột phải: Nội dung chi tiết */}
        <div className={`flex flex-col w-full md:w-2/3 border rounded-lg bg-card shadow-sm overflow-hidden ${!readingMessage ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
          {!readingMessage ? (
            <div className="text-center text-muted-foreground flex flex-col items-center">
              <Mail className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <p>Chọn một thư để đọc nội dung</p>
            </div>
          ) : (
            <div className="flex flex-col h-full relative">
              <div className="p-4 sm:p-6 border-b shrink-0 flex justify-between items-start">
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex items-center justify-between w-full">
                    <h2 className="text-2xl font-bold break-words pr-8">{readingMessage.subject}</h2>
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 absolute top-4 right-4" onClick={handleCloseMessage}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
                    <div className="flex items-center gap-3">
                      {/* Có thể thêm tag cho biết có bao nhiêu thư trong luồng */}
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-md">{readingMessage.threadMessages.length} thư trong luồng này</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      
                      <div className="ml-2 flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
                        {viewMode === "inbox" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={(e) => { handleToggleRead(readingMessage, e); handleCloseMessage(); }} title="Đánh dấu chưa đọc">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => handleReply(readingMessage)} title="Trả lời">
                              <Reply className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => handleForward(readingMessage)} title="Chuyển tiếp">
                          <Forward className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteMail(readingMessage)} title="Xóa toàn bộ">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/10">
                {readingMessage.threadMessages.map((tMsg, idx) => {
                  const isExpanded = expandedMessages.has(tMsg.id);

                  const toggleExpand = () => {
                    const newSet = new Set(expandedMessages);
                    if (newSet.has(tMsg.id)) {
                      newSet.delete(tMsg.id);
                    } else {
                      newSet.add(tMsg.id);
                    }
                    setExpandedMessages(newSet);
                  };

                  return (
                  <div key={tMsg.id} className={`border rounded-lg overflow-hidden bg-card ${tMsg.id === readingMessage.id ? 'ring-1 ring-primary/20' : 'shadow-sm'}`}>
                    <div 
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'border-b bg-muted/20' : ''}`}
                      onClick={toggleExpand}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={tMsg.sender_id === currentUser?.id ? getProfile(tMsg.receiver_id)?.avatar_url : getProfile(tMsg.sender_id)?.avatar_url} />
                          <AvatarFallback className={getAvatarColor(tMsg.sender_id === currentUser?.id ? getProfileName(tMsg.receiver_id) : getProfileName(tMsg.sender_id))}>
                            {tMsg.sender_id === currentUser?.id ? getProfileName(tMsg.receiver_id)?.charAt(0) : getProfileName(tMsg.sender_id)?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-sm overflow-hidden min-w-0">
                          <span className="font-semibold truncate">
                            {tMsg.sender_id === currentUser?.id ? "Bạn" : getProfileName(tMsg.sender_id)}
                          </span>
                          {isExpanded ? (
                            <span className="text-muted-foreground text-xs truncate">
                              Tới: {tMsg.sender_id === currentUser?.id ? getProfileName(tMsg.receiver_id) : "Bạn"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs truncate max-w-[200px] sm:max-w-[400px]">
                              {tMsg.body.replace(/<[^>]+>/g, '').substring(0, 100) || "(Không có nội dung)"}...
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {!isExpanded && tMsg.attachments && tMsg.attachments.length > 0 && (
                          <Paperclip className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(tMsg.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                    <div className="p-4 sm:p-6 bg-background">
                      <div className="ql-snow">
                        <div className="ql-editor p-0 text-sm !min-h-0 !h-auto !max-h-none overflow-visible" dangerouslySetInnerHTML={{ __html: tMsg.body }}>
                        </div>
                      </div>
                      
                      {tMsg.attachments && tMsg.attachments.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Tệp đính kèm ({tMsg.attachments.length})</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {tMsg.attachments.map((att: any, index: number) => {
                            const getAttachmentType = (att: any) => {
                              if (!att) return null;
                              const mime = (att.type || '').toLowerCase();
                              const str = (att.name || att.url || '').toLowerCase();
                              
                              if (mime.startsWith('image/') || str.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/)) return 'image';
                              if (mime === 'application/pdf' || str.match(/\.(pdf)(\?.*)?$/)) return 'pdf';
                              if (mime.startsWith('video/') || str.match(/\.(mp4|webm|ogg)(\?.*)?$/)) return 'video';
                              
                              if (
                                mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('officedocument') ||
                                str.match(/\.(doc|docx|xls|xlsx|ppt|pptx|rtf|txt|csv)(\?.*)?$/)
                              ) return 'office';
                              
                              return null;
                            }
                            const type = getAttachmentType(att)
                            const canPreview = !!type
                            return (
                            <div 
                              key={index}
                              onClick={(e) => {
                                e.stopPropagation();
                                canPreview ? setPreviewAttachment(att) : window.open(att.url, '_blank');
                              }}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted transition-colors text-sm group cursor-pointer"
                            >
                              <div className="p-2 bg-blue-600/10 rounded-md group-hover:bg-blue-600/20 transition-colors shrink-0">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium" title={att.name || 'Tệp đính kèm'}>{att.name || 'Tệp đính kèm'}</div>
                                <div className="text-[10px] text-muted-foreground">{att.size ? (att.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</div>
                              </div>
                            </div>
                          )})}
                        </div>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Xem trước tệp đính kèm */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        {previewAttachment && (
          <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden flex flex-col gap-0 border-primary/20 shadow-xl h-[90vh] sm:h-auto max-h-[95vh] max-sm:max-w-[100vw] max-sm:w-[100vw] max-sm:h-[100dvh] max-sm:rounded-none max-sm:border-0">
            <DialogHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3 overflow-hidden pr-8">
                <div className="p-1.5 bg-primary/10 rounded text-primary shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <DialogTitle className="truncate font-semibold text-base">{previewAttachment.name || 'Xem trước tệp'}</DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewAttachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download
                >
                  <Button size="sm" variant="outline" className="gap-2 hidden sm:flex">
                    <Download className="h-4 w-4" /> Tải xuống
                  </Button>
                  <Button size="icon" variant="outline" className="sm:hidden h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-4 bg-background relative">
              {(() => {
                const mime = (previewAttachment.type || '').toLowerCase();
                const str = (previewAttachment.name || previewAttachment.url || '').toLowerCase();
                const ext = str.split('.').pop() || '';
                
                const isImage = mime.startsWith('image/') || ['jpeg', 'jpg', 'gif', 'png', 'webp'].includes(ext);
                const isPdf = mime === 'application/pdf' || ext === 'pdf';
                const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext);
                const isOffice = mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('officedocument') || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
                const isText = mime.startsWith('text/') || ['txt', 'csv', 'json'].includes(ext);

                if (isImage) {
                  return (
                    <div className="flex items-center justify-center bg-black/5 rounded-md p-4 min-h-[50vh]">
                      <img src={previewAttachment.url} alt={previewAttachment.name || 'Image'} className="max-w-full max-h-[70vh] object-contain shadow-sm rounded-md" />
                    </div>
                  )
                } else if (isPdf || isText) {
                  return (
                    <div className="w-full h-[75vh] rounded-md overflow-hidden border">
                      <iframe src={previewAttachment.url} className="w-full h-full border-0 bg-white" />
                    </div>
                  )
                } else if (isVideo) {
                  return (
                    <div className="flex items-center justify-center bg-black/5 rounded-md p-4 min-h-[50vh]">
                      <video src={previewAttachment.url} controls className="max-w-full max-h-[70vh] shadow-sm rounded-md" />
                    </div>
                  )
                } else if (isOffice) {
                  // Sử dụng view.aspx thay vì embed.aspx để có nút in giống tab Bảng tin
                  const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(previewAttachment.url)}`;
                  return (
                    <div className="w-full h-[75vh] rounded-md overflow-hidden border">
                      <iframe src={officeViewerUrl} className="w-full h-full border-0 bg-white" title={previewAttachment.name} />
                    </div>
                  )
                }
                
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/20 rounded-md border border-dashed">
                    <FileText className="h-16 w-16 text-muted-foreground/50" />
                    <div>
                      <p className="font-medium text-lg">Không thể xem trước định dạng file này</p>
                      <p className="text-muted-foreground text-sm mt-1">Vui lòng tải xuống để xem nội dung.</p>
                    </div>
                    <a href={previewAttachment.url} download target="_blank" rel="noopener noreferrer">
                      <Button>Tải xuống ngay</Button>
                    </a>
                  </div>
                )
              })()}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Soạn thư Floating Modal */}
      {isComposeOpen && (
        <div className={`fixed z-50 bg-background border shadow-2xl flex flex-col transition-all duration-300 overflow-hidden ${
          isComposeMinimized 
            ? 'bottom-0 right-4 sm:right-10 w-80 h-[48px] rounded-t-lg' 
            : 'bottom-0 right-0 sm:right-10 w-full h-[100dvh] sm:w-[600px] sm:h-[600px] sm:rounded-t-lg'
        }`}>
          <div className="flex items-center justify-between p-3 border-b bg-muted cursor-pointer shrink-0" onClick={() => setIsComposeMinimized(!isComposeMinimized)}>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Soạn thư mới</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted-foreground/20" onClick={(e) => { e.stopPropagation(); setIsComposeMinimized(!isComposeMinimized); }}>
                {isComposeMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted-foreground/20 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setIsComposeOpen(false); }}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {!isComposeMinimized && (
            <form onSubmit={handleSendMail} className="flex flex-col flex-1 overflow-hidden bg-background">
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              
              {/* Multi-select Người nhận */}
              <div className="flex flex-col gap-2 relative">
                <Label>Gửi đến</Label>
                <div className="min-h-10 border rounded-md px-2 py-1.5 flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  {receiverIds.map(rid => (
                    <div key={rid} className="flex items-center gap-1 bg-primary/10 text-primary text-sm px-2 py-1 rounded-md">
                      <span>{getProfileName(rid)}</span>
                      <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setReceiverIds(receiverIds.filter(id => id !== rid))} />
                    </div>
                  ))}
                  <Input 
                    placeholder={receiverIds.length === 0 ? "Tìm kiếm tên hoặc email..." : "Thêm người nhận..."}
                    className="flex-1 border-0 h-7 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none text-sm min-w-[150px]"
                    value={searchUser}
                    onChange={(e) => {
                      setSearchUser(e.target.value)
                      setShowUserDropdown(true)
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                  />
                </div>
                
                {/* Dropdown danh sách user */}
                {showUserDropdown && searchUser.trim().length > 0 && (
                  <div className="absolute top-[70px] left-0 right-0 max-h-48 overflow-y-auto border bg-popover rounded-md shadow-lg z-50 p-1">
                    {filteredUsers.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">Không tìm thấy ai</div>
                    ) : (
                      filteredUsers.map(u => (
                        <div 
                          key={u.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded-sm cursor-pointer text-sm"
                          onClick={() => {
                            setReceiverIds([...receiverIds, u.id])
                            setSearchUser("")
                            setShowUserDropdown(false)
                          }}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-primary/20">{u.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span>{u.full_name || "Người dùng"}</span>
                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <Label>Chủ đề</Label>
                <Input 
                  placeholder="Nhập tiêu đề thư..." 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2 flex-1 min-h-[250px]">
                <Label>Nội dung</Label>
                <div className="flex-1 border rounded-md overflow-hidden flex flex-col">
                  <RichTextEditor 
                    value={body}
                    onChange={setBody}
                    placeholder="Viết nội dung thư..."
                  />
                  {quotedBody && (
                    <div className="px-3 pb-3 bg-white dark:bg-card flex justify-start">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-8 w-12 border bg-muted/50 hover:bg-muted text-muted-foreground"
                        onClick={() => {
                          setBody(body + quotedBody);
                          setQuotedBody("");
                        }}
                        title="Hiển thị nội dung thư gốc"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              </div>

            <div className="px-4 pb-4 shrink-0">
              <Label className="mb-2 block text-sm font-medium text-muted-foreground">Đính kèm</Label>
              <FileUpload 
                onUpload={(newAttachments) => setAttachments([...attachments, ...newAttachments])}
                onRemove={(index) => setAttachments(attachments.filter((_, i) => i !== index))}
                attachments={attachments}
              />
            </div>

            <div className="p-4 border-t shrink-0 flex items-center justify-end bg-muted/10">
              <Button type="submit" disabled={isSending || receiverIds.length === 0 || !subject.trim() || !body.trim() || body.trim() === "<p><br></p>"}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Gửi thư {receiverIds.length > 0 ? `(${receiverIds.length} người)` : ""}
              </Button>
            </div>
          </form>
          )}
        </div>
      )}

      {/* Thông báo thư mới */}
      {newMailNotification && (
        <div 
          className="fixed bottom-4 left-4 z-50 bg-primary text-primary-foreground p-4 rounded-lg shadow-xl cursor-pointer hover:bg-primary/90 transition-all transform animate-in slide-in-from-bottom-5 max-w-sm"
          onClick={handleNotificationClick}
        >
          <div className="flex items-start gap-3">
            <div className="bg-primary-foreground/20 p-2 rounded-full">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Thư mới từ {getProfileName(newMailNotification.sender_id)}</p>
              <p className="text-xs opacity-90 line-clamp-1">{newMailNotification.subject}</p>
              <p className="text-xs opacity-70 mt-1">Bấm để đọc</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto hover:bg-primary-foreground/20 shrink-0" onClick={(e) => { e.stopPropagation(); setNewMailNotification(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
