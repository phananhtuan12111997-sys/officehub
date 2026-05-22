"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Mail, Send, Eye, Paperclip, Reply, FileText } from "lucide-react"
import { FileUpload, Attachment } from "@/components/ui/file-upload"

type Profile = {
  id: string
  email: string
  full_name: string
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
  const [receiverId, setReceiverId] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Đọc thư
  const [readingMessage, setReadingMessage] = useState<MailboxMessage | null>(null)
  const [viewMode, setViewMode] = useState<"inbox" | "sent">("inbox")

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

    // Lấy danh sách profiles (trừ mình ra)
    const { data: profilesData } = await supabase.from("profiles").select("id, email, full_name")
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
    if (!receiverId || !subject.trim() || !body.trim()) return

    setIsSending(true)
    const { data, error } = await supabase.from("mailbox").insert({
      sender_id: currentUser.id,
      receiver_id: receiverId,
      subject: subject.trim(),
      body: body.trim(),
      attachments: attachments.length > 0 ? attachments : []
    }).select()

    if (error) {
      alert("Lỗi gửi thư: " + error.message)
    } else {
      setIsComposeOpen(false)
      setReceiverId("")
      setSubject("")
      setBody("")
      setAttachments([])
      if (data) {
        setSent([data[0], ...sent])
      }
    }
    setIsSending(false)
  }

  const openMessage = async (msg: MailboxMessage, mode: "inbox" | "sent") => {
    setReadingMessage(msg)
    setViewMode(mode)

    // Cập nhật is_read nếu là thư đến và chưa đọc
    if (mode === "inbox" && !msg.is_read) {
      const { error } = await supabase.from("mailbox").update({ is_read: true }).eq("id", msg.id)
      if (!error) {
        setInbox(inbox.map(m => m.id === msg.id ? { ...m, is_read: true } : m))
      }
    }
  }

  const getProfileName = (id: string) => {
    const p = profiles.find(x => x.id === id)
    return p ? (p.full_name || p.email) : "Người dùng"
  }

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-8 w-8 text-primary" /> Hộp Thư
          </h1>
          <p className="text-muted-foreground mt-1">Gửi và nhận tin nhắn, tài liệu với các thành viên khác.</p>
        </div>
        <Button onClick={() => setIsComposeOpen(true)} className="gap-2">
          <Send className="h-4 w-4" /> Soạn thư
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="inbox">Hộp thư đến ({inbox.filter(m => !m.is_read).length} mới)</TabsTrigger>
          <TabsTrigger value="sent">Đã gửi</TabsTrigger>
        </TabsList>
        
        <TabsContent value="inbox" className="mt-4">
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            {inbox.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Không có thư nào.</div>
            ) : (
              <div className="divide-y">
                {inbox.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${!msg.is_read ? 'bg-primary/5 font-semibold' : ''}`}
                    onClick={() => openMessage(msg, "inbox")}
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{getProfileName(msg.sender_id)}</span>
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>}
                        {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-sm truncate text-muted-foreground">
                        <span className="text-foreground">{msg.subject}</span> - {msg.body}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4 flex-shrink-0">
                      {new Date(msg.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            {sent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Bạn chưa gửi thư nào.</div>
            ) : (
              <div className="divide-y">
                {sent.map((msg) => (
                  <div 
                    key={msg.id} 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openMessage(msg, "sent")}
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-muted-foreground">Gửi đến: </span>
                        <span className="truncate font-medium">{getProfileName(msg.receiver_id)}</span>
                        {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-sm truncate text-muted-foreground">
                        <span className="text-foreground">{msg.subject}</span> - {msg.body}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap ml-4 flex-shrink-0">
                      {new Date(msg.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Soạn thư Modal */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>Thư mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendMail} className="flex flex-col gap-4 py-4 flex-1 overflow-auto">
            <div className="flex flex-col gap-2">
              <Label>Gửi đến</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                required
              >
                <option value="" disabled>-- Chọn người nhận --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email} ({p.email})</option>
                ))}
              </select>
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

            <div className="flex flex-col gap-2 flex-1">
              <Label>Nội dung</Label>
              <textarea
                className="flex min-h-[150px] flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Nội dung thư..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Đính kèm</Label>
              <FileUpload 
                onUpload={(newAttachments) => setAttachments(newAttachments)}
                onRemove={(index) => setAttachments(attachments.filter((_, i) => i !== index))}
                attachments={attachments}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsComposeOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Gửi thư
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Đọc thư Modal */}
      <Dialog open={!!readingMessage} onOpenChange={(open) => !open && setReadingMessage(null)}>
        <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl flex items-center gap-2">
              {readingMessage?.subject}
            </DialogTitle>
            <DialogDescription className="hidden" />
            <div className="flex justify-between items-center mt-4">
              <div className="flex flex-col gap-1 text-sm text-foreground">
                <span className="font-semibold">
                  {viewMode === "inbox" ? `Từ: ${getProfileName(readingMessage?.sender_id || "")}` : `Đến: ${getProfileName(readingMessage?.receiver_id || "")}`}
                </span>
                <span className="text-muted-foreground text-xs">
                  {readingMessage && new Date(readingMessage.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4 flex-1 overflow-auto">
            <div className="whitespace-pre-wrap leading-relaxed text-sm">
              {readingMessage?.body}
            </div>
            
            {readingMessage?.attachments && readingMessage.attachments.length > 0 && (
              <div className="mt-8 border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Tệp đính kèm ({readingMessage.attachments.length})</h4>
                <div className="flex flex-col gap-2">
                  {readingMessage.attachments.map((att: any, index: number) => (
                    <a 
                      key={index}
                      href={att.url} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted transition-colors text-sm"
                    >
                      <div className="p-2 bg-primary/10 rounded-md">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 truncate font-medium">
                        {att.name}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {(att.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setReadingMessage(null)}>Đóng</Button>
            {viewMode === "inbox" && (
              <Button onClick={() => {
                setReceiverId(readingMessage?.sender_id || "")
                setSubject(`Re: ${readingMessage?.subject}`)
                setBody(`\n\n--- Trả lời thư của ${getProfileName(readingMessage?.sender_id || "")} ---\n${readingMessage?.body}`)
                setAttachments([])
                setReadingMessage(null)
                setIsComposeOpen(true)
              }}>
                <Reply className="mr-2 h-4 w-4" /> Trả lời
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
