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
import { FileIcon, Search, Upload, Download, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type DocumentType = {
  id: string
  name: string
  file_url: string
  size: string
  department: string
  created_at: string
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<DocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const fetchDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (data) {
      setFiles(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

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
    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        name: file.name,
        file_url: publicUrl,
        size: formatBytes(file.size),
        department: "Chung", // Could add a selector later
      })

    if (dbError) {
      alert("Lỗi lưu thông tin: " + dbError.message)
    } else {
      await fetchDocuments()
    }
    
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownload = (url: string) => {
    window.open(url, '_blank')
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kho tài liệu</h1>
          <p className="text-muted-foreground">Lưu trữ và chia sẻ văn bản nội bộ công ty.</p>
        </div>
        <div>
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
          <Button onClick={handleUploadClick} disabled={uploading} className="flex items-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Đang tải lên..." : "Tải lên tài liệu"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Tìm kiếm tên file..." className="pl-8 bg-muted/50" />
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Tên tài liệu</TableHead>
              <TableHead>Phòng ban</TableHead>
              <TableHead>Ngày tải lên</TableHead>
              <TableHead>Kích thước</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Đang tải dữ liệu...
                </TableCell>
              </TableRow>
            ) : files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Chưa có tài liệu nào.
                </TableCell>
              </TableRow>
            ) : (
              files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                      <FileIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    {file.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">{file.department || "Chung"}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(file.created_at).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{file.size}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDownload(file.file_url)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
