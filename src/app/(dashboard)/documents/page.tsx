"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  FileIcon, Search, Upload, Download, Loader2, Folder as FolderIcon, 
  Plus, ChevronLeft, Eye, FileText, ImageIcon, FileSpreadsheet, FileIcon as FilePdf, Trash2, Edit2
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

type DocumentType = {
  id: string
  name: string
  file_url: string
  size: string
  department: string
  created_at: string
  folder_id: string | null
  uploaded_by: string | null
}

type FolderType = {
  id: string
  name: string
  created_at: string
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<DocumentType[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Create Folder State
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Preview State
  const [previewFile, setPreviewFile] = useState<DocumentType | null>(null)

  // Search State
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  // Edit State
  const [editingFile, setEditingFile] = useState<DocumentType | null>(null)
  const [editName, setEditName] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Edit Folder State
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [isSavingFolderEdit, setIsSavingFolderEdit] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    checkAdmin()
    fetchData()
  }, [currentFolder])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData()
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setCurrentUserId(session.user.id)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()
    
    if (profile?.role === "admin") {
      setIsAdmin(true)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch Folders (only if not searching and at root)
    if (!searchQuery && !currentFolder) {
      try {
        // Fetch folders via API
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          const foldersRes = await fetch('/api/documents/folders', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          })
          if (foldersRes.ok) {
            const foldersData = await foldersRes.json()
            setFolders(foldersData || [])
          }
        }
      } catch (error) {
        console.error("Error fetching folders:", error)
        setFolders([])
      }
    }

    // Fetch Documents
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        let url = '/api/documents?'
        if (searchQuery) {
          url += `search=${encodeURIComponent(searchQuery)}`
          setIsSearching(true)
        } else {
          setIsSearching(false)
          if (currentFolder) {
            url += `folder_id=${currentFolder.id}`
          }
        }
        
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        })
        if (res.ok) {
          const data = await res.json()
          setFiles(data || [])
        }
      }
    } catch (error) {
      console.error("Error fetching documents:", error)
      setFiles([])
    }
    setLoading(false)
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    
    setCreatingFolder(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/documents/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name: newFolderName.trim() })
    })

    if (!res.ok) {
      const error = await res.json()
      alert("Lỗi tạo thư mục: " + (error.error || "Không thể tạo"))
    } else {
      setNewFolderName("")
      setIsFolderDialogOpen(false)
      fetchData()
    }
    setCreatingFolder(false)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    
    // Upload to Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      alert("Lỗi tải lên: " + uploadError.message)
      setUploading(false)
      return
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Insert to DB
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            name: file.name,
            file_url: publicUrl,
            size: formatBytes(file.size),
            department: "Chung",
            folder_id: currentFolder ? currentFolder.id : null,
            uploaded_by: currentUserId
          })
        })

        if (!res.ok) {
          const errorData = await res.json()
          alert("Lỗi lưu thông tin: " + (errorData.error || "Lỗi không xác định"))
        } else {
          await fetchData()
        }
      }
    } catch (err: any) {
      alert("Lỗi lưu thông tin: " + err.message)
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = (e: React.MouseEvent, url: string) => {
    e.stopPropagation()
    window.open(url, '_blank')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("Bạn có chắc muốn xóa tài liệu này?")) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch(`/api/documents?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` }
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi: " + errorData.error)
    } else {
      fetchData()
    }
  }

  const handleEdit = (e: React.MouseEvent, file: DocumentType) => {
    e.stopPropagation()
    setEditingFile(file)
    setEditName(file.name)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFile || !editName.trim()) return

    setIsSavingEdit(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/documents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: editingFile.id, name: editName.trim() })
      })

      if (!res.ok) {
        const errorData = await res.json()
        alert("Lỗi: " + errorData.error)
      } else {
        setEditingFile(null)
        fetchData()
      }
    }
    setIsSavingEdit(false)
  }

  const handleEditFolder = (folder: FolderType) => {
    setEditingFolder(folder)
    setEditFolderName(folder.name)
  }

  const saveEditFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFolder || !editFolderName.trim()) return

    setIsSavingFolderEdit(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch('/api/documents/folders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: editingFolder.id, name: editFolderName.trim() })
      })

      if (!res.ok) {
        const errorData = await res.json()
        alert("Lỗi: " + errorData.error)
      } else {
        setEditingFolder(null)
        fetchData()
      }
    }
    setIsSavingFolderEdit(false)
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa thư mục này? LƯU Ý: Bạn cần phải xóa hoặc di chuyển toàn bộ tài liệu bên trong trước khi xóa!")) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch(`/api/documents/folders?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` }
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi: " + errorData.error)
    } else {
      fetchData()
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return <FilePdf className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'xls':
      case 'xlsx': return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      default: return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  }

  const getFileViewerUrl = (url: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return url; // Browsers render PDF natively
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    // For images or others
    return url;
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Kho tài liệu</h1>
          <p className="text-muted-foreground">Lưu trữ, quản lý và chia sẻ văn bản nội bộ.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsFolderDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tạo thư mục
            </Button>
          )}
          
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
          <Button 
            onClick={handleUploadClick} 
            disabled={uploading || !currentFolder} 
            className="flex items-center gap-2"
            title={!currentFolder ? "Bạn cần chọn một thư mục trước khi tải file" : ""}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Đang tải lên..." : (!currentFolder ? "Chọn thư mục để tải lên" : "Tải lên tài liệu")}
          </Button>
        </div>
      </div>

      {/* Breadcrumb & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-card p-4 rounded-xl border shadow-sm gap-4">
        <div className="flex items-center gap-2 flex-1">
          {currentFolder ? (
            <Button variant="ghost" size="sm" onClick={() => { setCurrentFolder(null); setSearchQuery(""); }} className="px-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Quay lại
            </Button>
          ) : isSearching ? (
            <Badge variant="secondary" className="px-3 py-1 text-sm font-normal">
              Kết quả tìm kiếm cho: "{searchQuery}"
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1 text-sm font-normal">
              Thư mục gốc
            </Badge>
          )}
          
          {currentFolder && !isSearching && (
            <Badge variant="secondary" className="px-3 py-1 text-sm font-normal flex items-center gap-1">
              <FolderIcon className="w-3 h-3 text-yellow-500" />
              {currentFolder.name}
            </Badge>
          )}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Tìm kiếm tài liệu..." 
            className="pl-8 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Tên tài liệu / Thư mục</TableHead>
              <TableHead>Phòng ban</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Kích thước</TableHead>
              <TableHead className="w-[100px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : (files.length === 0 && (searchQuery || currentFolder || folders.length === 0)) ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Trống.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Render Folders (only if not searching and no current folder) */}
                {!isSearching && !currentFolder && folders.map((folder) => (
                  <TableRow 
                    key={folder.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setCurrentFolder(folder)}
                  >
                    <TableCell className="font-medium flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                        <FolderIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 fill-yellow-200 dark:fill-yellow-900/50" />
                      </div>
                      {folder.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Thư mục</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(folder.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }} className="text-muted-foreground hover:text-primary"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Render Files */}
                {files.map((file) => (
                  <TableRow key={file.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium flex items-center gap-3 cursor-pointer" onClick={() => setPreviewFile(file)}>
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        {getFileIcon(file.name)}
                      </div>
                      <span className="hover:underline">{file.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{file.department || "Chung"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{file.size}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(isAdmin || file.uploaded_by === currentUserId) && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => handleEdit(e, file)}
                              className="text-muted-foreground hover:text-primary"
                              title="Đổi tên"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => handleDelete(e, file.id)}
                              className="text-muted-foreground hover:text-destructive"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setPreviewFile(file)}
                          className="text-muted-foreground hover:text-primary"
                          title="Xem trước"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleDownload(e, file.file_url)}
                          className="text-muted-foreground hover:text-primary"
                          title="Tải xuống"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Folder Creation Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo thư mục mới</DialogTitle>
            <DialogDescription>
              Thư mục giúp phân loại và quản lý tài liệu dễ dàng hơn.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 py-4">
            <div className="space-y-2">
              <Input 
                placeholder="Nhập tên thư mục..." 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFolderDialogOpen(false)}>Hủy</Button>
              <Button type="submit" disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/30 flex-shrink-0">
            <DialogTitle className="flex items-center justify-between mr-6">
              <div className="flex items-center gap-2 truncate">
                {previewFile && getFileIcon(previewFile.name)}
                <span className="truncate">{previewFile?.name}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => previewFile && handleDownload(e, previewFile.file_url)}
                className="ml-4 shrink-0"
              >
                <Download className="w-4 h-4 mr-2" />
                Tải xuống
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-900 relative">
            {previewFile && (
              <iframe 
                src={getFileViewerUrl(previewFile.file_url, previewFile.name)}
                className="absolute inset-0 w-full h-full border-0"
                title="File Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit File Dialog */}
      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên tài liệu</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Input 
                placeholder="Tên tài liệu mới..." 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingFile(null)}>Hủy</Button>
              <Button type="submit" disabled={isSavingEdit || !editName.trim()}>
                {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên thư mục</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditFolder} className="space-y-4 py-4">
            <div className="space-y-2">
              <Input 
                placeholder="Tên thư mục mới..." 
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingFolder(null)}>Hủy</Button>
              <Button type="submit" disabled={isSavingFolderEdit || !editFolderName.trim()}>
                {isSavingFolderEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
