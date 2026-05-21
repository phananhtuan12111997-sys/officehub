"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "./button"
import { Paperclip, X, Loader2, FileIcon } from "lucide-react"

export type Attachment = {
  name: string
  url: string
  size: number
  type: string
}

interface FileUploadProps {
  onUpload: (attachments: Attachment[]) => void
  attachments: Attachment[]
  onRemove: (index: number) => void
}

export function FileUpload({ onUpload, attachments, onRemove }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    setIsUploading(true)
    const newAttachments: Attachment[] = []

    for (const file of Array.from(e.target.files)) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error, data } = await supabase.storage
        .from('post_attachments')
        .upload(filePath, file)

      if (error) {
        console.error("Lỗi upload:", error)
        alert("Lỗi khi tải lên file: " + file.name)
      } else if (data) {
        const { data: publicUrlData } = supabase.storage
          .from('post_attachments')
          .getPublicUrl(filePath)

        newAttachments.push({
          name: file.name,
          url: publicUrlData.publicUrl,
          size: file.size,
          type: file.type
        })
      }
    }

    if (newAttachments.length > 0) {
      onUpload([...attachments, ...newAttachments])
    }
    
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-muted-foreground"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4 mr-2" />
          )}
          Đính kèm file
        </Button>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-muted/30 text-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileIcon className="h-4 w-4 flex-shrink-0 text-primary" />
                <span className="truncate max-w-[200px] sm:max-w-[300px]">{file.name}</span>
                <span className="text-muted-foreground text-xs flex-shrink-0">({formatSize(file.size)})</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRemove(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
