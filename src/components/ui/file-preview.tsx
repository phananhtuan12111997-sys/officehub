"use client"

import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileIcon, Download, FileText, Image as ImageIcon, FileSpreadsheet, FileIcon as FilePdf, Printer, ChevronLeft, X } from "lucide-react"

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
    onOpenChange(false)
    
    // Use setTimeout to ensure the dialog and iframe unmount before calling history.back()
    // This prevents the iframe (like Google Docs) from hijacking the back navigation
    setTimeout(() => {
      if (window.history.state?.preview) {
        window.history.back()
      }
    }, 50)
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
        <iframe src={file.url} className="w-full h-full border-0" title={file.name} />
      )
    }
    
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      // Use Google Docs viewer instead of Microsoft Office viewer
      const officeViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`
      return (
        <iframe src={officeViewerUrl} className="w-full h-full border-0" title={file.name} />
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
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Print</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;">
              <img src="${file.url}" style="max-width:100%; max-height:100vh;" onload="window.print();window.close();" />
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    } else if (ext === 'pdf') {
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = file.url
      document.body.appendChild(iframe)
      iframe.onload = () => {
        iframe.contentWindow?.print()
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
        }, 5000)
      }
    } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
      // Due to CORS and iframe limitations, we cannot print Office files directly
      // Open the Office viewer in a new tab so the user can use its native print feature
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}`, '_blank')
    } else {
      window.open(file.url, '_blank')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose()
      }}>
        <DialogContent 
          className="sm:max-w-4xl w-[95vw] sm:w-[90vw] p-0 overflow-hidden flex flex-col gap-0 border-primary/20 shadow-xl h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)] sm:h-[85vh] sm:max-h-[85vh]"
          showCloseButton={false}
        >
          <DialogHeader className="p-2 sm:p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0 relative z-10 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1 mr-2">
              <div className="p-1.5 bg-primary/10 rounded text-primary shrink-0">
                {getFileIcon(file.name)}
              </div>
              <DialogTitle className="truncate font-semibold text-sm sm:text-base">{file.name}</DialogTitle>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-full sm:hidden" onClick={handleDownload} title="Tải xuống">
                <Download className="h-4 w-4" />
              </Button>
              {!['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) && (
                <>
                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-full sm:hidden" onClick={handlePrint} title="In tài liệu">
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2 h-8 hidden sm:flex" onClick={handlePrint} title="In tài liệu">
                    <Printer className="h-4 w-4" /> <span>In</span>
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="gap-2 h-8 hidden sm:flex" onClick={handleDownload} title="Tải xuống">
                <Download className="h-4 w-4" /> <span>Tải xuống</span>
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="flex h-8 w-8 shrink-0 rounded-full ml-1 text-muted-foreground hover:text-foreground bg-muted sm:bg-transparent"
                onClick={handleClose}
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          <div className={`flex-1 relative ${['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'overflow-auto p-2 sm:p-4 bg-background' : 'overflow-hidden bg-white'}`}>
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
