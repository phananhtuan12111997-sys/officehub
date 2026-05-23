"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
import { FileIcon, Search, Upload, Download, Loader2, Folder as FolderIcon, Plus, ChevronLeft, Eye, FileText, ImageIcon, FileSpreadsheet, FileIcon as FilePdf, Trash2, Edit2, Pin, LayoutGrid, List, ArrowUp, ArrowDown } from "lucide-react"
import { Progress } from "@/components/ui/progress"
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
  is_pinned?: boolean
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

  // Drag and Drop
  const [isDragging, setIsDragging] = useState(false)

  // Edit State
  const [editingFile, setEditingFile] = useState<DocumentType | null>(null)
  const [editName, setEditName] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const openPreview = (file: DocumentType) => {
    window.history.pushState({ preview: true }, '');
    setPreviewFile(file);
  };

  const closePreview = () => {
    setPreviewFile(null);
    if (window.history.state?.preview) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (previewFile) {
        setPreviewFile(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [previewFile]);

  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  
  type SortConfig = { key: 'name' | 'created_at' | 'size' | 'department', direction: 'asc' | 'desc' } | null;
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const handleSort = (key: 'name' | 'created_at' | 'size' | 'department') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  }

  const parseSize = (sizeStr: string) => {
    if (!sizeStr || sizeStr === '-') return 0;
    const match = sizeStr.match(/([\d.]+)\s*(Bytes|KB|MB|GB)/i);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers: any = { 'BYTES': 1, 'KB': 1024, 'MB': 1024*1024, 'GB': 1024*1024*1024 };
    return val * (multipliers[unit] || 1);
  }

  const sortedFolders: FolderType[] = useMemo(() => {
    let sortableFolders = [...folders];
    if (sortConfig) {
      sortableFolders.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortConfig.key === 'department') {
          const deptA = a.department || "Chung";
          const deptB = b.department || "Chung";
          return sortConfig.direction === 'asc' ? deptA.localeCompare(deptB) : deptB.localeCompare(deptA);
        }
        if (sortConfig.key === 'created_at') {
          return sortConfig.direction === 'asc' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
    }
    return sortableFolders;
  }, [folders, sortConfig]);

  const sortedFiles: DocumentType[] = useMemo(() => {
    let sortableFiles = [...files];
    if (sortConfig) {
      sortableFiles.sort((a, b) => {
        if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortConfig.key === 'department') {
          const deptA = a.department || "Chung";
          const deptB = b.department || "Chung";
          return sortConfig.direction === 'asc' ? deptA.localeCompare(deptB) : deptB.localeCompare(a.name);
        }
        if (sortConfig.key === 'created_at') {
          return sortConfig.direction === 'asc' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortConfig.key === 'size') {
          const sizeA = parseSize(a.size);
          const sizeB = parseSize(b.size);
          return sortConfig.direction === 'asc' ? sizeA - sizeB : sizeB - sizeA;
        }
        return 0;
      });
    }
    return sortableFiles;
  }, [files, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  }
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
      if (searchQuery) fetchData()
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  useEffect(() => {
    if (!searchQuery) {
      setLoading(true)
      fetchData()
    }
  }, [currentFolder, filterDept, searchQuery])

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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const promises = []

      // Fetch Folders
      if (!searchQuery && !currentFolder) {
        promises.push(
          fetch('/api/documents/folders', {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          .then(res => res.json())
          .then(data => setFolders(data || []))
          .catch(error => {
            console.error("Error fetching folders:", error)
            setFolders([])
          })
        )
      } else {
        setFolders([])
      }

      // Fetch Documents
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
      promises.push(
        fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        })
        .then(res => res.json())
        .then(data => setFiles(data || []))
        .catch(error => {
          console.error("Error fetching documents:", error)
          setFiles([])
        })
      )

      await Promise.all(promises)

    } catch (error) {
      console.error("Error in fetchData:", error)
    } finally {
      setLoading(false)
    }
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
    await processFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!currentFolder) return
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!currentFolder) return
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFileUpload(file)
    }
  }

  const processFileUpload = async (file: File) => {
    let finalFileName = file.name;
    
    // Check duplicates
    const exists = files.find(f => f.name === finalFileName);
    if (exists) {
      const newName = prompt(`Tài liệu "${finalFileName}" đã tồn tại. Vui lòng nhập tên mới (hoặc bấm Hủy để hủy tải lên):`, finalFileName);
      if (!newName || !newName.trim()) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return; // Cancelled
      }
      finalFileName = newName.trim();
      
      // Keep extension if they accidentally removed it
      const origExt = file.name.split('.').pop() || "";
      const newExt = finalFileName.split('.').pop() || "";
      if (origExt && newExt !== origExt) {
        finalFileName = `${finalFileName}.${origExt}`;
      }
    }

    setUploading(true)
    setUploadProgress(0)

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);
    
    // Upload to Storage
    const fileExt = finalFileName.split('.').pop()
    const storageFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storageFileName, file)

    clearInterval(progressInterval);

    if (uploadError) {
      alert("Lỗi tải lên: " + uploadError.message)
      setUploading(false)
      setUploadProgress(0)
      return
    }
    setUploadProgress(100);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(storageFileName)

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
            name: finalFileName,
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

  const handleDownload = (e: React.MouseEvent, url: string, fileName?: string) => {
    e.stopPropagation()
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  const handleTogglePinFolder = async (e: React.MouseEvent, folder: FolderType) => {
    e.stopPropagation()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/documents/folders', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: folder.id, is_pinned: !folder.is_pinned })
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi ghim thư mục: " + errorData.error)
    } else {
      fetchData()
    }
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 
            className="text-2xl font-bold tracking-tight text-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.location.href = '/documents'}
          >
            Kho tài liệu
          </h1>
          <p className="text-muted-foreground">Lưu trữ, quản lý và chia sẻ văn bản nội bộ.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsFolderDialogOpen(true)} className="w-full sm:w-auto">
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
            className="flex items-center gap-2 relative overflow-hidden"
            title={!currentFolder ? "Bạn cần chọn một thư mục trước khi tải file" : ""}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Upload className="w-4 h-4 relative z-10" />}
            <span className="relative z-10">{uploading ? `Đang tải lên ${Math.round(uploadProgress)}%...` : (!currentFolder ? "Chọn thư mục để tải lên" : "Tải lên tài liệu")}</span>
            {uploading && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            )}
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2 bg-background border rounded-xl p-2 shadow-sm">
        <Tabs defaultValue="all" value={filterDept} onValueChange={(val) => {
          setFilterDept(val)
          setCurrentFolder(null)
          setSearchQuery("")
        }} className="w-full md:w-auto overflow-auto">
          <TabsList className="flex flex-wrap h-auto w-full justify-start bg-transparent">
            <TabsTrigger value="all" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Tất cả</TabsTrigger>
            <TabsTrigger value="Chung" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4">Chung</TabsTrigger>
            {departments.map(d => (
              <TabsTrigger key={d.id} value={d.name} className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4 whitespace-nowrap">Phòng {d.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center border rounded-md p-1 bg-muted/40 shrink-0">
             <Button variant="ghost" size="icon" className={`w-8 h-8 rounded-sm ${viewMode === 'table' ? 'bg-background shadow-sm' : ''}`} onClick={() => setViewMode('table')} title="Xem danh sách">
                <List className="w-4 h-4" />
             </Button>
             <Button variant="ghost" size="icon" className={`w-8 h-8 rounded-sm ${viewMode === 'grid' ? 'bg-background shadow-sm' : ''}`} onClick={() => setViewMode('grid')} title="Xem dạng lưới">
                <LayoutGrid className="w-4 h-4" />
             </Button>
          </div>
          <div className="relative w-full md:w-64 lg:w-72">
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

      <div 
        className={`border rounded-xl bg-card shadow-sm overflow-hidden transition-all duration-200 relative ${isDragging ? "border-primary border-dashed border-2 bg-primary/5" : ""} ${viewMode === 'grid' ? "p-4 bg-transparent border-none shadow-none" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-primary border-dashed rounded-xl pointer-events-none">
            <Upload className="w-12 h-12 text-primary mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-primary">Kéo thả file vào đây</h3>
            <p className="text-muted-foreground mt-2">File sẽ được tải lên thư mục hiện tại</p>
          </div>
        )}
        
        {viewMode === 'table' ? (
          <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:text-primary select-none">Tên tài liệu / Thư mục <SortIcon columnKey="name" /></TableHead>
              <TableHead onClick={() => handleSort('department')} className="cursor-pointer hover:text-primary select-none">Phòng ban <SortIcon columnKey="department" /></TableHead>
              <TableHead onClick={() => handleSort('created_at')} className="cursor-pointer hover:text-primary select-none">Ngày tạo <SortIcon columnKey="created_at" /></TableHead>
              <TableHead onClick={() => handleSort('size')} className="cursor-pointer hover:text-primary select-none">Kích thước <SortIcon columnKey="size" /></TableHead>
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
                {!isSearching && !currentFolder && sortedFolders
                  .filter(f => filterDept === "all" ? true : (f.department || "Chung") === filterDept)
                  .map((folder) => (
                  <TableRow 
                    key={folder.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setCurrentFolder(folder)}
                  >
                    <TableCell className="font-medium flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg relative">
                        <FolderIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 fill-yellow-200 dark:fill-yellow-900/50" />
                        {folder.is_pinned && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                            <Pin className="w-3 h-3 fill-current" />
                          </div>
                        )}
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
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleTogglePinFolder(e, folder)}
                            title={folder.is_pinned ? "Bỏ ghim" : "Ghim thư mục"}
                          >
                            <Pin className={`w-4 h-4 ${folder.is_pinned ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }}>
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Render Files */}
                {sortedFiles
                  .filter(f => filterDept === "all" || currentFolder ? true : (f.department || "Chung") === filterDept)
                  .map((file) => (
                  <TableRow key={file.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium flex items-center gap-3 cursor-pointer" onClick={() => openPreview(file)}>
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
                          onClick={() => openPreview(file)}
                          className="text-muted-foreground hover:text-primary"
                          title="Xem trước"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleDownload(e, file.file_url, file.name)}
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
             {loading ? (
                <div className="col-span-full flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
             ) : (!currentFolder && !isSearching && folders.length === 0) || ((currentFolder || isSearching) && files.length === 0) ? (
                <div className="col-span-full flex flex-col items-center justify-center p-10 text-muted-foreground">
                   <FolderIcon className="w-12 h-12 mb-4 opacity-20" />
                   <p>Chưa có tài liệu hoặc thư mục nào</p>
                </div>
             ) : (
                <>
                  {!isSearching && !currentFolder && sortedFolders
                    .filter(f => filterDept === "all" ? true : (f.department || "Chung") === filterDept)
                    .map(folder => (
                    <div key={folder.id} onClick={() => setCurrentFolder(folder)} className="border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors group relative bg-card shadow-sm">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleTogglePinFolder(e, folder)} title={folder.is_pinned ? "Bỏ ghim" : "Ghim"}>
                              <Pin className={`w-3 h-3 ${folder.is_pinned ? "fill-primary text-primary" : ""}`} />
                            </Button>
                         )}
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-600" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }}>
                              <Edit2 className="w-3 h-3" />
                            </Button>
                         )}
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                         )}
                      </div>
                      <div className="relative">
                        <FolderIcon className={`w-12 h-12 mb-3 ${folder.is_pinned ? 'text-yellow-600 fill-yellow-200' : 'text-yellow-500 fill-yellow-100'}`} />
                        {folder.is_pinned && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                            <Pin className="w-3 h-3 fill-current" />
                          </div>
                        )}
                      </div>
                      <span className="text-center text-sm font-medium line-clamp-2 w-full px-2" title={folder.name}>{folder.name}</span>
                      <span className="text-xs text-muted-foreground mt-1 bg-secondary px-2 rounded-full">{folder.department || "Chung"}</span>
                    </div>
                  ))}
                  
                  {sortedFiles
                    .filter(f => filterDept === "all" || currentFolder ? true : (f.department || "Chung") === filterDept)
                    .map(file => (
                    <div key={file.id} onClick={() => openPreview(file)} className="border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors group relative bg-card shadow-sm">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1 shadow-sm">
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-500" onClick={(e) => handleDownload(e, file.file_url, file.name)} title="Tải xuống">
                           <Download className="w-3 h-3" />
                         </Button>
                         {(isAdmin || currentUserId === file.uploaded_by) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-yellow-600" onClick={(e) => handleEdit(e, file)} title="Đổi tên">
                              <Edit2 className="w-3 h-3" />
                            </Button>
                         )}
                         {(isAdmin || currentUserId === file.uploaded_by) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={(e) => handleDelete(e, file.id)} title="Xóa">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                         )}
                      </div>
                      <div className="w-12 h-12 mb-3 flex items-center justify-center">
                         {getFileIcon(file.name)}
                      </div>
                      <span className="text-center text-sm font-medium line-clamp-2 w-full px-2" title={file.name}>{file.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">{file.size}</span>
                    </div>
                  ))}
                </>
             )}
          </div>
        )}
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
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        {previewFile && (
          <DialogContent className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden flex flex-col gap-0 border-primary/20 shadow-xl h-[90vh] sm:h-auto max-h-[95vh]">
            <DialogHeader className="p-2 sm:p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="sm:hidden h-8 w-8 shrink-0 rounded-full" 
                  onClick={closePreview}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="p-1.5 bg-primary/10 rounded text-primary hidden sm:block">
                  {getFileIcon(previewFile.name)}
                </div>
                <DialogTitle className="truncate font-semibold text-sm sm:text-base pr-2">{previewFile.name}</DialogTitle>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2 hidden sm:flex"
                  onClick={(e) => handleDownload(e, previewFile.file_url, previewFile.name)}
                >
                  <Download className="h-4 w-4" /> Tải xuống
                </Button>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="sm:hidden h-8 w-8 rounded-full"
                  onClick={(e) => handleDownload(e, previewFile.file_url, previewFile.name)}
                >
                  <Download className="h-4 w-4" />
                </Button>
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
                  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewFile.file_url)}`
                  return (
                    <div className="w-full h-[75vh] rounded-md overflow-hidden border">
                      <iframe 
                        src={officeViewerUrl} 
                        className="w-full h-full" 
                        title={previewFile.name} 
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      />
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
