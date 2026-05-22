"use client"

import { useState } from "react"
import { Attachment } from "./file-upload"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface ImageGalleryProps {
  images: Attachment[]
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (!images || images.length === 0) return null

  const openImage = (index: number) => setSelectedIndex(index)
  const closeImage = () => setSelectedIndex(null)

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  // Grid Layouts based on image count
  const renderGrid = () => {
    if (images.length === 1) {
      return (
        <div className="w-full max-h-[500px] overflow-hidden rounded-xl border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => openImage(0)}>
          <img src={images[0].url} alt={images[0].name} className="w-full h-full object-cover" />
        </div>
      )
    }
    
    if (images.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-2 h-[300px] rounded-xl overflow-hidden border">
          {images.map((img, idx) => (
            <div key={img.url} className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity relative group" onClick={() => openImage(idx)}>
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )
    }

    if (images.length === 3) {
      return (
        <div className="grid grid-cols-2 gap-2 h-[350px] rounded-xl overflow-hidden border">
          <div className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity" onClick={() => openImage(0)}>
            <img src={images[0].url} alt={images[0].name} className="w-full h-full object-cover" />
          </div>
          <div className="grid grid-rows-2 gap-2 h-full">
            {images.slice(1).map((img, idx) => (
              <div key={img.url} className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity relative" onClick={() => openImage(idx + 1)}>
                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )
    }

    // 4 or more
    return (
      <div className="grid grid-cols-2 gap-2 h-[350px] rounded-xl overflow-hidden border">
        {images.slice(0, 4).map((img, idx) => {
          const isLast = idx === 3
          const extraCount = images.length - 4

          return (
            <div key={img.url} className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity relative" onClick={() => openImage(idx)}>
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              {isLast && extraCount > 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-3xl font-bold">
                  +{extraCount}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="mt-4 mb-4">
        {renderGrid()}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && closeImage()}>
        <DialogContent className="max-w-[90vw] w-full h-[90vh] bg-black/95 border-none p-0 flex flex-col justify-center items-center shadow-2xl [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Xem ảnh</DialogTitle>
          </DialogHeader>
          
          <button 
            onClick={closeImage} 
            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>

          {selectedIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center group">
              <img 
                src={images[selectedIndex].url} 
                alt={images[selectedIndex].name} 
                className="max-w-full max-h-full object-contain"
              />
              
              {selectedIndex > 0 && (
                <button 
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
              )}
              
              {selectedIndex < images.length - 1 && (
                <button 
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              )}
              
              <div className="absolute bottom-4 left-1/2 -translate-y-1/2 text-white/80 text-sm">
                {selectedIndex + 1} / {images.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
