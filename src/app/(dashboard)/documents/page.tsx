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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  department?: string
  created_at: string
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<DocumentType[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null)
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([])
  const [filterDept, setFilterDept] = useState("all")
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Create Folder State
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderDepartment, setNewFolderDepartment] = useState("Chung")
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

  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null)
  const [editFolderName, setEditFolderName] = useState("")
  const [editFolderDepartment, setEditFolderDepartment] = useState("Chung")
  const [isSavingFolderEdit, setIsSavingFolderEdit] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    checkAdmin()
    fetchDepartments()
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData()
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, currentFolder, filterDept])

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("id, name").order("name")
    if (data) setDepartments(data)
  }



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
      body: JSON.stringify({ name: newFolderName.trim(), department: newFolderDepartment })
    })

    if (!res.ok) {
      const error = await res.json()
      alert("Lỗi tạo thư mục: " + (error.error || "Không thể tạo"))
    } else {
      setNewFolderName("")
      setNewFolderDepartment("Chung")
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
            department: currentFolder ? (currentFolder.department || "Chung") : "Chung",
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
    setEditFolderDepartment(folder.department || "Chung")
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
        body: JSON.stringify({ id: editingFolder.id, name: editFolderName.trim(), department: editFolderDepartment })
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

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2 bg-background border rounded-xl p-2 shadow-sm">
        <Tabs defaultValue="all" value={filterDept} onValueChange={(val) => {
          setFilterDept(val)
          setCurrentFolder(null)
          setSearchQuery("")
        }} className="w-full md:w-auto">
          <TabsList className="flex flex-wrap h-auto w-full justify-start bg-transparent">
            <TabsTrigger value="all" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Tất cả</TabsTrigger>
            <TabsTrigger value="Chung" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Chung</TabsTrigger>
            {departments.map(d => (
              <TabsTrigger key={d.id} value={d.name} className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Phòng {d.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Tìm kiếm tài liệu..." 
            className="pl-9 bg-muted/40 border-none rounded-full" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      {(currentFolder || isSearching) && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-card p-4 rounded-xl border shadow-sm gap-4 mb-4">
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
            ) : null}
            
            {currentFolder && !isSearching && (
              <Badge variant="secondary" className="px-3 py-1 text-sm font-normal flex items-center gap-1">
                <FolderIcon className="w-3 h-3 text-yellow-500" />
                {currentFolder.name}
              </Badge>
            )}
            
            {currentFolder && !isSearching && (
              <Badge variant="secondary" className="ml-2 font-normal">
                Phòng ban: {currentFolder.department || "Chung"}
              </Badge>
            )}
          </div>
        </div>
      )}

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
                {!isSearching && !currentFolder && folders
                  .filter(f => filterDept === "all" ? true : (f.department || "Chung") === filterDept)
                  .map((folder) => (
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
                      <Badge variant="secondary" className="font-normal">{folder.department || "Chung"}</Badge>
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
                {files
                  .filter(f => filterDept === "all" || currentFolder ? true : (f.department || "Chung") === filterDept)
                  .map((file) => (
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
              <label className="text-sm font-medium">Tên thư mục</label>
              <Input 
                placeholder="Nhập tên thư mục..." 
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phòng ban (Phân loại theo bộ phận)</label>
              <Select value={newFolderDepartment} onValueChange={(val) => setNewFolderDepartment(val || "Chung")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chung">Chung (Tất cả phòng ban)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>Phòng {dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        {previewFile && (
          <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden flex flex-col gap-0 border-primary/20 shadow-xl h-[90vh] sm:h-auto max-h-[95vh]">
            <DialogHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3 overflow-hidden pr-8">
                <div className="p-1.5 bg-primary/10 rounded text-primary">
                  {getFileIcon(previewFile.name)}
                </div>
                <DialogTitle className="truncate font-semibold text-base">{previewFile.name}</DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={previewFile.file_url} 
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
                const ext = previewFile.name.split('.').pop()?.toLowerCase() || "";
                
                // Hình ảnh
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                  return (
                    <div className="flex items-center justify-center bg-black/5 rounded-md p-4 min-h-[50vh]">
                      <img src={previewFile.file_url} alt={previewFile.name} className="max-w-full max-h-[70vh] object-contain rounded-md shadow-sm" />
                    </div>
                  )
                }
                
                // PDF
                if (ext === 'pdf') {
                  return (
                    <div className="w-full h-[75vh] rounded-md overflow-hidden border">
                      <iframe src={previewFile.file_url} className="w-full h-full" title={previewFile.name} />
                    </div>
                  )
                }
                
                // Office files (Word, Excel, PowerPoint)
                if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
                  const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(previewFile.file_url)}`
                  return (
                    <div className="w-full h-[75vh] rounded-md overflow-hidden border">
                      <iframe src={officeViewerUrl} className="w-full h-full" title={previewFile.name} />
                    </div>
                  )
                }

                // Các loại file khác không hỗ trợ xem trước
                return (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/20 rounded-md border border-dashed">
                    <FileIcon className="h-16 w-16 text-muted-foreground/50" />
                    <div>
                      <p className="font-medium text-lg">Không thể xem trước định dạng file này</p>
                      <p className="text-muted-foreground text-sm mt-1">Vui lòng tải xuống để xem nội dung.</p>
                    </div>
                    <a href={previewFile.file_url} download target="_blank" rel="noopener noreferrer">
                      <Button>Tải xuống ngay</Button>
                    </a>
                  </div>
                )
              })()}
            </div>
          </DialogContent>
        )}
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
              <label className="text-sm font-medium">Tên thư mục</label>
              <Input 
                placeholder="Tên thư mục mới..." 
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phòng ban (Phân loại theo bộ phận)</label>
              <Select value={editFolderDepartment} onValueChange={(val) => setEditFolderDepartment(val || "Chung")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chung">Chung</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
