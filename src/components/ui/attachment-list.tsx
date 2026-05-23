"use client"

import { useState } from "react"
import { FileIcon, Download, FileText, Image as ImageIcon, FileSpreadsheet, FileIcon as FilePdf } from "lucide-react"
import { Attachment } from "./file-upload"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FilePreview } from "@/components/ui/file-preview"
import { Button } from "@/components/ui/button"

interface AttachmentListProps {
  attachments: Attachment[]
}

export function AttachmentList({ attachments }: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)

  if (!attachments || attachments.length === 0) return null

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || ""
  }

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className="h-5 w-5" />
    if (ext === 'pdf') return <FilePdf className="h-5 w-5 text-red-500" />
    if (['doc', 'docx'].includes(ext)) return <FileText className="h-5 w-5 text-blue-500" />
    if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    if (['ppt', 'pptx'].includes(ext)) return <FileIcon className="h-5 w-5 text-orange-500" />
    return <FileIcon className="h-5 w-5" />
  }

  const handlePreview = (e: React.MouseEvent, file: Attachment) => {
    e.preventDefault()
    setPreviewFile(file)
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-semibold mb-3">Tài liệu đính kèm ({attachments.length})</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {attachments.map((file, idx) => (
          <div
            key={idx}
            onClick={(e) => handlePreview(e, file)}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-primary/10 rounded-md text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {getFileIcon(file.name)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
              </div>
            </div>
            
            <a 
              href={file.url} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // Prevent triggering preview when clicking download
              className="p-2 rounded-full hover:bg-primary/10 transition-colors"
              title="Tải xuống"
            >
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </a>
          </div>
        ))}
      </div>

      <FilePreview 
        open={!!previewFile} 
        onOpenChange={(open) => !open && setPreviewFile(null)} 
        file={previewFile ? { name: previewFile.name, url: previewFile.url } : null} 
      />
    </div>
  )
}
