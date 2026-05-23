"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Mail, Send, Eye, Paperclip, Reply, FileText, Trash2, Forward, User, X, Pin, MoreHorizontal } from "lucide-react"
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

  // Xem trước file
  const [previewAttachment, setPreviewAttachment] = useState<any>(null)

  // Đọc thư
  const [readingMessage, setReadingMessage] = useState<MailboxMessage | null>(null)
  const [viewMode, setViewMode] = useState<"inbox" | "sent">("inbox")

  // Pin & Select
  const [pinnedMails, setPinnedMails] = useState<Set<string>>(new Set())
  const [selectedMails, setSelectedMails] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
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

    // Lấy hộp thư đến
    const { data: inboxData } = await supabase
      .from("mailbox")
      .select("*")
      .eq("receiver_id", session.user.id)
      .order("created_at", { ascending: false })
    
    if (inboxData) setInbox(inboxData)

    // Lấy hộp thư đi
    const { data: sentData } = await supabase
      .from("mailbox")
      .select("*")
      .eq("sender_id", session.user.id)
      .order("created_at", { ascending: false })
      
    if (sentData) setSent(sentData)

    setLoading(false)
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
      attachments: attachments.length > 0 ? attachments : []
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
      setSearchUser("")
      if (data) {
        setSent([...data, ...sent])
      }
    }
    setIsSending(false)
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

  const toggleSelectAll = (mails: MailboxMessage[]) => {
    if (selectedMails.size === mails.length && mails.length > 0) {
      setSelectedMails(new Set())
    } else {
      setSelectedMails(new Set(mails.map(m => m.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedMails.size === 0) return
    if (!confirm(`Bạn có chắc muốn xóa ${selectedMails.size} thư đã chọn?\n\nLƯU Ý: Thư sẽ bị xóa vĩnh viễn khỏi hộp thư của cả người gửi và người nhận.`)) return

    const idsToDelete = Array.from(selectedMails)
    const { error } = await supabase.from("mailbox").delete().in("id", idsToDelete)
    
    if (error) {
      alert("Lỗi khi xóa thư: " + error.message)
    } else {
      setInbox(inbox.filter(m => !selectedMails.has(m.id)))
      setSent(sent.filter(m => !selectedMails.has(m.id)))
      setSelectedMails(new Set())
      if (readingMessage && selectedMails.has(readingMessage.id)) {
        setReadingMessage(null)
      }
    }
  }

  const sortedInbox = [...inbox].sort((a, b) => {
    const aPinned = pinnedMails.has(a.id)
    const bPinned = pinnedMails.has(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  const sortedSent = [...sent].sort((a, b) => {
    const aPinned = pinnedMails.has(a.id)
    const bPinned = pinnedMails.has(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  const handleDeleteMail = async (msg: MailboxMessage) => {
    if (!confirm("Bạn có chắc chắn muốn xóa thư này?\n\nLƯU Ý: Do thiết kế hệ thống hiện tại, thư sẽ bị xóa VĨNH VIỄN khỏi hộp thư của cả người gửi và người nhận.")) return
    
    const { error } = await supabase.from("mailbox").delete().eq("id", msg.id)
    if (error) {
      alert("Lỗi xóa thư: " + error.message)
    } else {
      if (viewMode === "inbox") {
        setInbox(inbox.filter(m => m.id !== msg.id))
      } else {
        setSent(sent.filter(m => m.id !== msg.id))
      }
      setReadingMessage(null)
    }
  }

  const handleForward = (msg: MailboxMessage) => {
    setReceiverIds([])
    setSubject(`Fwd: ${msg.subject}`)
    setBody("")
    setQuotedBody(`<br><br><div class="quote-block"><blockquote><strong>Đã chuyển tiếp từ:</strong> ${getProfileName(msg.sender_id)}<br><strong>Ngày:</strong> ${new Date(msg.created_at).toLocaleString('vi-VN')}<br><strong>Chủ đề:</strong> ${msg.subject}<br><br>${msg.body}</blockquote></div>`)
    setAttachments(msg.attachments || [])
    setIsComposeOpen(true)
  }

  const handleReply = (msg: MailboxMessage) => {
    setReceiverIds([msg.sender_id])
    setSubject(`Re: ${msg.subject}`)
    setBody("")
    setQuotedBody(`<br><br><div class="quote-block"><blockquote><strong>Phản hồi thư của:</strong> ${getProfileName(msg.sender_id)}<br><strong>Ngày:</strong> ${new Date(msg.created_at).toLocaleString('vi-VN')}<br><br>${msg.body}</blockquote></div>`)
    setAttachments([])
    setIsComposeOpen(true)
  }

  const openMessage = async (msg: MailboxMessage, mode: "inbox" | "sent") => {
    setReadingMessage(msg)
    setViewMode(mode)

    // Cập nhật is_read nếu là thư đến và chưa đọc
    if (mode === "inbox" && !msg.is_read) {
      const { error } = await supabase.from("mailbox").update({ is_read: true }).eq("id", msg.id)
      if (!error) {
        setInbox(inbox.map(m => m.id === msg.id ? { ...m, is_read: true } : m))
        setReadingMessage({ ...msg, is_read: true })
      }
    }
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
          setIsComposeOpen(true)
        }} className="gap-2">
          <Send className="h-4 w-4" /> Soạn thư
        </Button>
      </div>

      <div className="flex h-[calc(100dvh-65px)] overflow-hidden p-2 sm:p-6 gap-2 sm:gap-6">
        {/* Cột trái: Danh sách thư */}
        <div className={`flex flex-col w-full md:w-1/3 border rounded-lg bg-card shadow-sm overflow-hidden ${readingMessage ? 'hidden md:flex' : 'flex'}`}>
          <Tabs defaultValue="inbox" className="w-full flex flex-col h-full" onValueChange={(v) => { setViewMode(v as any); setReadingMessage(null); setSelectedMails(new Set()); }}>
            <div className="p-2 border-b shrink-0 bg-muted/20">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="inbox" className="data-active:bg-primary data-active:text-primary-foreground">Hộp thư đến</TabsTrigger>
                <TabsTrigger value="sent" className="data-active:bg-primary data-active:text-primary-foreground">Đã gửi</TabsTrigger>
              </TabsList>
            </div>
            
            {/* Thanh công cụ thao tác hàng loạt */}
            <div className="flex items-center justify-between p-2 border-b bg-muted/10 shrink-0 min-h-[44px]">
              <div className="flex items-center gap-2 px-2 cursor-pointer" onClick={() => toggleSelectAll(viewMode === "inbox" ? sortedInbox : sortedSent)}>
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                  checked={viewMode === "inbox" ? (sortedInbox.length > 0 && selectedMails.size === sortedInbox.length) : (sortedSent.length > 0 && selectedMails.size === sortedSent.length)}
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
              {sortedInbox.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Không có thư nào.</div>
              ) : (
                <div className="divide-y">
                  {sortedInbox.map((msg) => {
                    const p = getProfile(msg.sender_id)
                    const isPinned = pinnedMails.has(msg.id)
                    return (
                    <div 
                      key={msg.id} 
                      className={`relative p-4 pl-10 pr-10 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${readingMessage?.id === msg.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'} ${!msg.is_read ? 'bg-primary/5' : ''} ${isPinned ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      onClick={() => openMessage(msg, "inbox")}
                    >
                      <div className="absolute left-3 top-5" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer"
                          checked={selectedMails.has(msg.id)}
                          onChange={(e) => toggleSelect(msg.id, e)}
                        />
                      </div>
                      <div className="absolute right-3 top-5" onClick={e => togglePin(msg.id, e)}>
                        <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground hover:text-foreground'} cursor-pointer transition-colors`} />
                      </div>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={p?.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary">{p?.full_name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${!msg.is_read ? 'font-bold text-primary' : 'font-semibold'}`}>{getProfileName(msg.sender_id)}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs truncate ${!msg.is_read ? 'font-semibold text-foreground' : 'text-foreground'}`}>{msg.subject}</span>
                          {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="text-xs truncate text-muted-foreground" dangerouslySetInnerHTML={{ __html: msg.body.replace(/<[^>]*>?/gm, '') }}>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="flex-1 overflow-y-auto m-0 p-0 relative">
              {sortedSent.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Bạn chưa gửi thư nào.</div>
              ) : (
                <div className="divide-y">
                  {sortedSent.map((msg) => {
                    const p = getProfile(msg.receiver_id)
                    const isPinned = pinnedMails.has(msg.id)
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
                        <AvatarFallback className="bg-muted text-muted-foreground">{p?.full_name?.charAt(0) || <User className="w-4 h-4" />}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1 overflow-hidden flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">Tới: {getProfileName(msg.receiver_id)}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString('vi-VN')}</span>
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
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 absolute top-4 right-4" onClick={() => setReadingMessage(null)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={viewMode === "inbox" ? getProfile(readingMessage.sender_id)?.avatar_url : getProfile(readingMessage.receiver_id)?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {viewMode === "inbox" ? getProfile(readingMessage.sender_id)?.full_name?.charAt(0) : getProfile(readingMessage.receiver_id)?.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">
                          {viewMode === "inbox" ? getProfileName(readingMessage.sender_id) : "Bạn"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Tới: {viewMode === "inbox" ? "Bạn" : getProfileName(readingMessage.receiver_id)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span>{new Date(readingMessage.created_at).toLocaleString('vi-VN')}</span>
                      
                      <div className="ml-2 flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
                        {viewMode === "inbox" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => handleReply(readingMessage)} title="Trả lời">
                            <Reply className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-background" onClick={() => handleForward(readingMessage)} title="Chuyển tiếp">
                          <Forward className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteMail(readingMessage)} title="Xóa">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                <div className="ql-snow">
                  <div className="ql-editor p-0 text-sm" dangerouslySetInnerHTML={{ __html: readingMessage.body }}>
                  </div>
                </div>
                
                {readingMessage.attachments && readingMessage.attachments.length > 0 && (
                  <div className="mt-10 border-t pt-6">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Tệp đính kèm ({readingMessage.attachments.length})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {readingMessage.attachments.map((att: any, index: number) => {
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
            </div>
          )}
        </div>
      </div>

      {/* Xem trước tệp đính kèm */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="sm:max-w-4xl max-sm:max-w-[100vw] max-sm:w-[100vw] h-[100dvh] sm:h-[80vh] max-sm:rounded-none max-sm:border-0 flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="truncate pr-4">{previewAttachment?.name || 'Xem trước tệp'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-black/5 flex items-center justify-center p-4">
            {(() => {
              if (!previewAttachment) return null;
              
              const mime = (previewAttachment.type || '').toLowerCase();
              const str = (previewAttachment.name || previewAttachment.url || '').toLowerCase();
              
              const isImage = mime.startsWith('image/') || str.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/);
              const isPdf = mime === 'application/pdf' || str.match(/\.(pdf)(\?.*)?$/);
              const isVideo = mime.startsWith('video/') || str.match(/\.(mp4|webm|ogg)(\?.*)?$/);
              const isOffice = mime.includes('word') || mime.includes('excel') || mime.includes('powerpoint') || mime.includes('officedocument') || str.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/);
              const isText = mime.startsWith('text/') || str.match(/\.(txt|csv|json)(\?.*)?$/);

              if (isImage) {
                return <img src={previewAttachment.url} alt={previewAttachment.name || 'Image'} className="max-w-full max-h-full object-contain shadow-md" />
              } else if (isPdf || isText) {
                return <iframe src={previewAttachment.url} className="w-full h-full border-0 bg-white shadow-md rounded-md" />
              } else if (isVideo) {
                return <video src={previewAttachment.url} controls className="max-w-full max-h-full shadow-md" />
              } else if (isOffice) {
                // Using Google Docs Viewer as it is generally faster and more reliable than Microsoft's viewer
                const officeViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(previewAttachment.url)}&embedded=true`;
                return <iframe src={officeViewerUrl} className="w-full h-full border-0 bg-white shadow-md rounded-md" />
              }
              
              return <div className="text-muted-foreground flex flex-col items-center gap-2">
                <FileText className="w-12 h-12 text-muted-foreground/50" />
                <span>Không thể xem trước tệp này.</span>
              </div>
            })()}
          </div>
          <DialogFooter className="p-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setPreviewAttachment(null)}>Đóng</Button>
            <Button onClick={() => window.open(previewAttachment?.url, '_blank')} className="bg-blue-600 hover:bg-blue-700 text-white">Mở tab mới / Tải xuống</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soạn thư Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-[700px] max-sm:max-w-[100vw] max-sm:w-[100vw] h-[100dvh] sm:h-[80vh] max-sm:rounded-none max-sm:border-0 flex flex-col p-0 overflow-hidden gap-0">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>Soạn thư mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendMail} className="flex flex-col flex-1 overflow-hidden">
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

              <div className="flex flex-col gap-2 mt-4">
                <Label>Đính kèm</Label>
                <FileUpload 
                  onUpload={(newAttachments) => setAttachments([...attachments, ...newAttachments])}
                  onRemove={(index) => setAttachments(attachments.filter((_, i) => i !== index))}
                  attachments={attachments}
                />
              </div>
            </div>

            <DialogFooter className="p-6 pt-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => setIsComposeOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isSending || receiverIds.length === 0 || !subject.trim() || !body.trim() || body.trim() === "<p><br></p>"}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Gửi thư {receiverIds.length > 0 ? `(${receiverIds.length} người)` : ""}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
