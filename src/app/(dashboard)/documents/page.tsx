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
import { FileIcon, Search, Upload, Download, Loader2, Folder as FolderIcon, Plus, ChevronLeft, Eye, FileText, ImageIcon, FileSpreadsheet, FileIcon as FilePdf, Trash2, Edit2, Pin, LayoutGrid, List, ArrowUp, ArrowDown, Check, Copy, FolderInput } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FilePreview } from "@/components/ui/file-preview"

import JSZip from "jszip"
import { saveAs } from "file-saver"

type DocumentType = {
  id: string
  name: string
  file_url: string
  size: string
  department: string
  created_at: string
  folder_id: string | null
  is_pinned?: boolean
  uploaded_by: string | null
  profiles?: { full_name: string } | null
}

type FolderType = {
  id: string
  name: string
  department?: string
  is_pinned?: boolean
  parent_id?: string | null
  created_at: string
  created_by?: string | null
  profiles?: { full_name: string } | null
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
  
  // Selection State
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)


  // Create Folder State
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderDepartment, setNewFolderDepartment] = useState("Tất cả")
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

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    )
  }

  const handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const allIds = [
        ...sortedFolders.map(f => `f_${f.id}`),
        ...sortedFiles.map(d => `d_${d.id}`)
      ]
      setSelectedItems(allIds)
    } else {
      setSelectedItems([])
    }
  }

  const fetchFolderContentsRecursive = async (folderId: string): Promise<DocumentType[]> => {
    const allDocs: DocumentType[] = []
    
    // Fetch docs in this folder
    const { data: docs } = await supabase.from('documents').select('*').eq('folder_id', folderId)
    if (docs) allDocs.push(...docs)

    // Fetch subfolders
    const { data: subFolders } = await supabase.from('document_folders').select('id').eq('parent_id', folderId)
    if (subFolders) {
      for (const sf of subFolders) {
        const subDocs = await fetchFolderContentsRecursive(sf.id)
        allDocs.push(...subDocs)
      }
    }
    return allDocs
  }

  const handleDownloadBulk = async (itemIds: string[]) => {
    setIsProcessingBulk(true)
    try {
      const zip = new JSZip()
      let hasFiles = false

      const fIds = itemIds.filter(id => id.startsWith("f_")).map(id => id.replace("f_", ""))
      const dIds = itemIds.filter(id => id.startsWith("d_")).map(id => id.replace("d_", ""))

      const docsToDownload: DocumentType[] = []

      // Add selected docs
      if (dIds.length > 0) {
        const { data: docs } = await supabase.from('documents').select('*').in('id', dIds)
        if (docs) docsToDownload.push(...docs)
      }

      // Add docs from selected folders
      for (const fId of fIds) {
        const folderDocs = await fetchFolderContentsRecursive(fId)
        docsToDownload.push(...folderDocs)
      }

      if (docsToDownload.length === 0) {
        alert("Không có file nào để tải xuống.")
        setIsProcessingBulk(false)
        return
      }

      for (const doc of docsToDownload) {
        if (!doc.file_url) continue
        
        try {
          const response = await fetch(doc.file_url)
          const blob = await response.blob()
          
          let fileName = doc.name
          if (zip.file(fileName)) {
            fileName = `${doc.id.substring(0, 4)}_${fileName}`
          }
          zip.file(fileName, blob)
          hasFiles = true
        } catch (err) {
          console.error("Error downloading file", doc.name, err)
        }
      }

      if (hasFiles) {
        const content = await zip.generateAsync({ type: "blob" })
        saveAs(content, `TaiLieu_${new Date().getTime()}.zip`)
      } else {
        alert("Có lỗi khi tải các file.")
      }

    } catch (err) {
      console.error(err)
      alert("Lỗi tải xuống.")
    } finally {
      setIsProcessingBulk(false)
      setSelectedItems([])
      setIsSelectMode(false)
    }
  }

  const handleDeleteBulk = async (itemIds: string[]) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ${itemIds.length} mục đã chọn không?`)) return
    setIsProcessingBulk(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const folderIds = itemIds.filter(id => id.startsWith('f_')).map(id => id.replace('f_', ''))
      const fileIds = itemIds.filter(id => id.startsWith('d_')).map(id => id.replace('d_', ''))

      const response = await fetch(`/api/documents/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ folderIds, fileIds })
      })

      const data = await response.json()
      if (!response.ok) {
        alert("Lỗi: " + (data.error || "Không rõ nguyên nhân"))
      } else {
        fetchData()
        setIsSelectMode(false)
        setSelectedItems([])
      }
    } catch (err) {
      console.error(err)
      alert("Lỗi thực hiện thao tác.")
    } finally {
      setIsProcessingBulk(false)
    }
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
          const deptA = a.department || "Tất cả";
          const deptB = b.department || "Tất cả";
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
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (sortConfig.key === 'name') {
          return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortConfig.key === 'department') {
          const deptA = a.department || "Tất cả";
          const deptB = b.department || "Tất cả";
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
  const [editFolderDepartment, setEditFolderDepartment] = useState("Tất cả")
  const [isSavingFolderEdit, setIsSavingFolderEdit] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const fetchDataRef = useRef<() => void>(() => {})
  useEffect(() => {
    fetchDataRef.current = fetchData
  })

  useEffect(() => {
    checkAdmin()
    fetchDepartments()

    const channel = supabase.channel('documents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
        fetchDataRef.current()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_folders' }, () => {
        fetchDataRef.current()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    
      const managementRoles = ['admin', 'ceo', 'director', 'deputy_director', 'head_of_dept', 'deputy_head_of_dept']
      if (managementRoles.includes(profile?.role)) {
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

      if (!searchQuery) {
        promises.push(
          fetch(`/api/documents/folders?t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: 'no-store'
          })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setFolders(data)
            } else {
              console.error("Invalid folders data:", data)
              setFolders([])
            }
          })
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
        url += `search=${encodeURIComponent(searchQuery)}&`
        setIsSearching(true)
      } else {
        setIsSearching(false)
        if (currentFolder) {
          url += `folder_id=${currentFolder.id}&`
        }
      }
      url += `t=${Date.now()}`
      promises.push(
        fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store'
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
      body: JSON.stringify({ 
        name: newFolderName.trim(), 
        department: currentFolder ? currentFolder.department : newFolderDepartment,
        parent_id: currentFolder?.id || null 
      })
    })

    if (!res.ok) {
      const error = await res.json()
      alert("Lỗi tạo thư mục: " + (error.error || "Không thể tạo"))
    } else {
      setNewFolderName("")
      setNewFolderDepartment("Tất cả")
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
        if (prev >= 95) return 95;
        const next = prev + Math.random() * 15;
        return next > 95 ? 95 : next;
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
            department: currentFolder ? (currentFolder.department || "Tất cả") : "Tất cả",
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
    setEditFolderDepartment(folder.department || "Tất cả")
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

  const handleTogglePinFile = async (e: React.MouseEvent, file: DocumentType) => {
    e.stopPropagation()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const res = await fetch('/api/documents', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: file.id, is_pinned: !file.is_pinned })
    })

    if (!res.ok) {
      const errorData = await res.json()
      alert("Lỗi ghim tài liệu: " + errorData.error)
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
            onClick={() => {
              setCurrentFolder(null)
              setSearchQuery("")
              setFilterDept("all")
              setIsSelectMode(false)
              setSelectedItems([])
            }}
          >
            Kho tài liệu
          </h1>
          <p className="text-muted-foreground">Lưu trữ, quản lý và chia sẻ văn bản nội bộ.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2 bg-background border rounded-xl p-2 shadow-sm">
        <Tabs defaultValue="all" value={filterDept} onValueChange={(val) => {
          setFilterDept(val)
          setCurrentFolder(null)
          setSearchQuery("")
        }} className="w-full md:w-auto overflow-hidden">
          <TabsList className="flex h-auto w-full justify-start bg-transparent overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1">
            <TabsTrigger value="all" className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4 whitespace-nowrap shrink-0">Tất cả</TabsTrigger>
            {departments.map(d => (
              <TabsTrigger key={d.id} value={d.name} className="data-active:bg-primary data-active:text-primary-foreground rounded-full px-4 whitespace-nowrap shrink-0">Phòng {d.name}</TabsTrigger>
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

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 w-full justify-end mt-2 mb-4">
        {isSelectMode ? (
          <>
            <Button variant="outline" size="sm" onClick={() => { setIsSelectMode(false); setSelectedItems([]); }} className="hover:bg-primary/10 hover:text-primary transition-colors">
              Hủy
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSelectAll(selectedItems.length === 0)} className="hover:bg-primary/10 hover:text-primary transition-colors">
              {selectedItems.length === 0 ? "Chọn tất cả" : "Bỏ chọn tất cả"}
            </Button>
            {selectedItems.length > 0 && (
              <>
                <Button variant="secondary" size="sm" onClick={() => handleDownloadBulk(selectedItems)} disabled={isProcessingBulk} className="hover:bg-primary/10 hover:text-primary transition-colors">
                  {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />} Tải về ({selectedItems.length})
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleDeleteBulk(selectedItems)} disabled={isProcessingBulk} className="hover:bg-red-100 hover:text-red-600 text-red-500 transition-colors">
                  {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />} Xóa ({selectedItems.length})
                </Button>
              </>
            )}
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setIsSelectMode(true)} className="hover:bg-primary/10 hover:text-primary transition-colors">
            <Check className="w-4 h-4 mr-2" />
            Chọn nhiều
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => {
          setNewFolderDepartment(currentFolder?.department || (filterDept !== "all" ? filterDept : "Tất cả"));
          setIsFolderDialogOpen(true);
        }} className="w-full sm:w-auto hover:bg-primary/10 hover:text-primary transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Tạo thư mục
        </Button>
        
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
        />
        <Button 
          size="sm"
          onClick={handleUploadClick} 
          disabled={uploading} 
          className="flex items-center w-full sm:w-auto gap-2 relative overflow-hidden hover:opacity-90 transition-opacity"
        >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Upload className="w-4 h-4 relative z-10" />}
            <span className="relative z-10">{uploading ? `Đang tải lên ${Math.round(uploadProgress)}%...` : "Tải lên tài liệu"}</span>
            {uploading && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            )}
          </Button>
      </div>


      {/* Breadcrumb */}
      {(currentFolder || isSearching) && (
        <div className="flex flex-col sm:flex-row items-center justify-between bg-card p-4 rounded-xl border shadow-sm gap-4 mb-4">
          <div className="flex items-center gap-2 flex-1">
            {currentFolder ? (
              <Button variant="ghost" size="sm" onClick={() => { 
                if (currentFolder && currentFolder.parent_id) {
                  const parentFolder = folders.find(f => f.id === currentFolder.parent_id)
                  setCurrentFolder(parentFolder || null)
                } else {
                  setCurrentFolder(null)
                }
                setSearchQuery(""); 
                setIsSelectMode(false);
                setSelectedItems([]);
              }} className="px-2">
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
                Phòng ban: {(currentFolder.department === "Tất cả" || !currentFolder.department) ? "Tất Cả" : currentFolder.department}
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
              <TableHead className="select-none">Người tạo</TableHead>
              <TableHead onClick={() => handleSort('created_at')} className="cursor-pointer hover:text-primary select-none">Ngày tạo <SortIcon columnKey="created_at" /></TableHead>
              <TableHead onClick={() => handleSort('size')} className="cursor-pointer hover:text-primary select-none">Kích thước <SortIcon columnKey="size" /></TableHead>
              <TableHead className="w-[100px] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : (files.length === 0 && (searchQuery || currentFolder || folders.length === 0)) ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Trống.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {/* Render Folders (only if not searching) */}
                {!isSearching && sortedFolders
                  .filter(f => currentFolder ? f.parent_id === currentFolder.id : !f.parent_id)
                  .filter(f => filterDept === "all" ? true : (f.department || "Tất cả") === filterDept)
                  .map((folder) => (
                  <TableRow 
                    key={folder.id} 
                    className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isSelectMode && selectedItems.includes(`f_${folder.id}`) ? "bg-primary/5" : "")}
                    onClick={() => {
                      if (isSelectMode) toggleItemSelection(`f_${folder.id}`)
                      else setCurrentFolder(folder)
                    }}
                  >
                    <TableCell className="font-medium flex items-center gap-3">
                      {isSelectMode && (
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          selectedItems.includes(`f_${folder.id}`) ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background"
                        )}>
                          {selectedItems.includes(`f_${folder.id}`) && <Check className="w-3 h-3" />}
                        </div>
                      )}
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
                      <Badge variant="secondary" className="font-normal">{(folder.department === "Tất cả" || !folder.department) ? "Tất Cả" : folder.department}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {folder.profiles?.full_name || "Không rõ"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(folder.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDownloadBulk([`f_${folder.id}`]); }} title="Tải về">
                          <Download className="w-4 h-4 text-green-500" />
                        </Button>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleTogglePinFolder(e, folder)}
                          title={folder.is_pinned ? "Bỏ ghim" : "Ghim thư mục"}
                        >
                          <Pin className={`w-4 h-4 ${folder.is_pinned ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                        </Button>
                      )}
                      {(isAdmin || (folder.created_by && folder.created_by === currentUserId)) && (
                        <>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }}>
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Render Files */}
                {sortedFiles
                  .filter(f => filterDept === "all" || currentFolder ? true : (f.department || "Tất cả") === filterDept)
                  .map((file) => (
                  <TableRow key={file.id} 
                    className={cn("hover:bg-muted/30 transition-colors cursor-pointer", isSelectMode && selectedItems.includes(`d_${file.id}`) ? "bg-primary/5" : "")}
                    onClick={() => {
                      if (isSelectMode) toggleItemSelection(`d_${file.id}`)
                      else setPreviewFile(file)
                    }}
                  >
                    <TableCell className="font-medium flex items-center gap-3">
                      {isSelectMode && (
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          selectedItems.includes(`d_${file.id}`) ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background"
                        )}>
                          {selectedItems.includes(`d_${file.id}`) && <Check className="w-3 h-3" />}
                        </div>
                      )}
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg relative">
                        {getFileIcon(file.name)}
                        {file.is_pinned && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                            <Pin className="w-3 h-3 fill-current" />
                          </div>
                        )}
                      </div>
                      <span className="hover:underline">{file.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{(file.department === "Tất cả" || !file.department) ? "Tất Cả" : file.department}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.profiles?.full_name || "Không rõ"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString('vi-VN')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{file.size}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => handleDownload(e, file.file_url, file.name)}
                          title="Tải xuống"
                        >
                          <Download className="w-4 h-4 text-green-500" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleTogglePinFile(e, file)}
                            title={file.is_pinned ? "Bỏ ghim" : "Ghim tài liệu"}
                          >
                            <Pin className={`w-4 h-4 ${file.is_pinned ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                          </Button>
                        )}
                        {(isAdmin || file.uploaded_by === currentUserId) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleEdit(e, file)}
                            title="Đổi tên"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {(isAdmin || file.uploaded_by === currentUserId) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => handleDelete(e, file.id)}
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
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
             ) : (!isSearching && sortedFolders.filter(f => currentFolder ? f.parent_id === currentFolder.id : !f.parent_id).length === 0 && files.length === 0) ? (
                <div className="col-span-full flex flex-col items-center justify-center p-10 text-muted-foreground">
                   <FolderIcon className="w-12 h-12 mb-4 opacity-20" />
                   <p>Chưa có tài liệu hoặc thư mục nào</p>
                </div>
             ) : (
                <>
                  {!isSearching && sortedFolders
                    .filter(f => currentFolder ? f.parent_id === currentFolder.id : !f.parent_id)
                    .filter(f => filterDept === "all" ? true : (f.department || "Tất cả") === filterDept)
                    .map(folder => (
                    <div key={folder.id} 
                      onClick={() => {
                        if (isSelectMode) toggleItemSelection(`f_${folder.id}`)
                        else setCurrentFolder(folder)
                      }} 
                      className={cn("border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors group relative shadow-sm", isSelectMode && selectedItems.includes(`f_${folder.id}`) ? "bg-primary/5 border-primary" : "bg-card")}
                    >
                      {isSelectMode && (
                        <div className="absolute top-2 left-2 flex gap-1 z-10">
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                            selectedItems.includes(`f_${folder.id}`) ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background"
                          )}>
                            {selectedItems.includes(`f_${folder.id}`) && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1 shadow-sm z-10">
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-green-500" onClick={(e) => { e.stopPropagation(); handleDownloadBulk([`f_${folder.id}`]); }} title="Tải về">
                           <Download className="w-3 h-3" />
                         </Button>
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleTogglePinFolder(e, folder)} title={folder.is_pinned ? "Bỏ ghim" : "Ghim"}>
                              <Pin className={`w-3 h-3 ${folder.is_pinned ? "fill-primary text-primary" : ""}`} />
                            </Button>
                         )}
                         {(isAdmin || (folder.created_by && folder.created_by === currentUserId)) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }}>
                              <Edit2 className="w-3 h-3 text-blue-500" />
                            </Button>
                         )}
                         {(isAdmin || (folder.created_by && folder.created_by === currentUserId)) && (
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
                      <span className="text-xs text-muted-foreground mt-1 truncate px-2 w-full text-center">{folder.profiles?.full_name || "Không rõ"}</span>
                      <span className="text-xs text-muted-foreground mt-1 bg-secondary px-2 rounded-full">{(folder.department === "Tất cả" || !folder.department) ? "Tất Cả" : folder.department}</span>
                    </div>
                  ))}
                  
                  {sortedFiles
                    .filter(f => filterDept === "all" || currentFolder ? true : (f.department || "Tất cả") === filterDept)
                    .map(file => (
                    <div key={file.id} 
                      onClick={() => {
                        if (isSelectMode) toggleItemSelection(`d_${file.id}`)
                        else setPreviewFile(file)
                      }} 
                      className={cn("border rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-colors group relative shadow-sm", isSelectMode && selectedItems.includes(`d_${file.id}`) ? "bg-primary/5 border-primary" : "bg-card")}
                    >
                      {isSelectMode && (
                        <div className="absolute top-2 left-2 flex gap-1 z-10">
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                            selectedItems.includes(`d_${file.id}`) ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background"
                          )}>
                            {selectedItems.includes(`d_${file.id}`) && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-1 shadow-sm z-10">
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDownload(e, file.file_url, file.name)} title="Tải xuống">
                           <Download className="w-3 h-3 text-green-500" />
                         </Button>
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleTogglePinFile(e, file)} title={file.is_pinned ? "Bỏ ghim" : "Ghim"}>
                              <Pin className={`w-3 h-3 ${file.is_pinned ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                            </Button>
                         )}
                         {(isAdmin || currentUserId === file.uploaded_by) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleEdit(e, file)} title="Đổi tên">
                              <Edit2 className="w-3 h-3 text-blue-500" />
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
                      <span className="text-xs text-muted-foreground mt-1 truncate px-2 w-full text-center">{file.profiles?.full_name || "Không rõ"}</span>
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
            {!currentFolder && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Phòng ban (Phân loại theo bộ phận)</label>
                <Select value={newFolderDepartment} onValueChange={(val) => setNewFolderDepartment(val || "Tất cả")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn phòng ban" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tất cả">Tất Cả</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>Phòng {dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
      <FilePreview 
        open={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile ? { name: previewFile.name, url: previewFile.file_url } : null} 
      />

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
              <Select value={editFolderDepartment} onValueChange={(val) => setEditFolderDepartment(val || "Tất cả")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tất cả">Tất Cả</SelectItem>
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

