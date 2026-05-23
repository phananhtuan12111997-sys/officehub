"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileIcon, Download, FileText, Image as ImageIcon, FileSpreadsheet, FileIcon as FilePdf, Printer, ChevronLeft } from "lucide-react"

export interface PreviewFile {
  name: string;
  url: string;
}

interface FilePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: PreviewFile | null;
}

export function FilePreview({ open, onOpenChange, file }: FilePreviewProps) {
  useEffect(() => {
    if (open && file) {
      window.history.pushState({ preview: true }, "")
    }
  }, [open, file])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (open) {
        onOpenChange(false)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [open, onOpenChange])

  const handleClose = () => {
    if (window.history.state?.preview) {
      window.history.back()
    } else {
      onOpenChange(false)
    }
  }

  if (!file) return null;

  const getFileExtension = (filename: string) => filename.split('.').pop()?.toLowerCase() || ""
  const ext = getFileExtension(file.name)

  const getFileIcon = (filename: string) => {
    const extension = getFileExtension(filename)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return <ImageIcon className="h-5 w-5" />
    if (extension === 'pdf') return <FilePdf className="h-5 w-5 text-red-500" />
    if (['doc', 'docx'].includes(extension)) return <FileText className="h-5 w-5 text-blue-500" />
    if (['xls', 'xlsx'].includes(extension)) return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    if (['ppt', 'pptx'].includes(extension)) return <FileIcon className="h-5 w-5 text-orange-500" />
    return <FileIcon className="h-5 w-5" />
  }

  const renderContent = () => {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return (
        <div className="flex items-center justify-center bg-black/5 rounded-md p-4 min-h-[50vh]">
          <img src={file.url} alt={file.name} className="max-w-full max-h-[70vh] object-contain rounded-md shadow-sm" />
        </div>
      )
    }
    
    if (ext === 'pdf') {
      return (
        <div className="w-full h-[75vh] rounded-md overflow-hidden border">
          <iframe src={file.url} className="w-full h-full" title={file.name} />
        </div>
      )
    }
    
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`
      return (
        <div className="w-full h-[75vh] rounded-md overflow-hidden border bg-white">
          <iframe src={googleViewerUrl} className="w-full h-full" title={file.name} />
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/20 rounded-md border border-dashed">
        <FileIcon className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <p className="font-medium text-lg">Không thể xem trước định dạng file này</p>
          <p className="text-muted-foreground text-sm mt-1">Vui lòng tải xuống để xem nội dung.</p>
        </div>
      </div>
    )
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault()
    const a = document.createElement("a")
    a.href = file.url
    a.download = file.name
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  
  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault()
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      window.open(`https://docs.google.com/gview?url=${encodeURIComponent(file.url)}`, '_blank')
    } else {
      window.open(file.url, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose()
    }}>
      <DialogContent 
        className="sm:max-w-4xl w-[95vw] p-0 overflow-hidden flex flex-col gap-0 border-primary/20 shadow-xl h-[95vh] sm:h-[85vh] max-h-[95vh]"
      >
        <DialogHeader className="p-2 sm:p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 relative z-10">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 mr-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="sm:hidden h-8 w-8 shrink-0 rounded-full"
              onClick={handleClose}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="p-1.5 bg-primary/10 rounded text-primary shrink-0 hidden sm:block">
              {getFileIcon(file.name)}
            </div>
            <DialogTitle className="truncate font-semibold text-sm sm:text-base">{file.name}</DialogTitle>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-2 h-8 hidden sm:flex" onClick={handlePrint} title="In tài liệu">
              <Printer className="h-4 w-4" /> <span>In</span>
            </Button>
            <Button size="icon" variant="outline" className="gap-2 h-8 w-8 rounded-full sm:hidden" onClick={handlePrint} title="In tài liệu">
              <Printer className="h-4 w-4" />
            </Button>

            <Button size="sm" variant="default" className="gap-2 h-8 hidden sm:flex" onClick={handleDownload} title="Tải xuống">
              <Download className="h-4 w-4" /> <span>Tải xuống</span>
            </Button>
            <Button size="icon" variant="default" className="gap-2 h-8 w-8 rounded-full sm:hidden" onClick={handleDownload} title="Tải xuống">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-background relative">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
