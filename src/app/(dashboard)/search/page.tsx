"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import { ArrowRight, Paperclip, Search as SearchIcon } from "lucide-react"
import Link from "next/link"
import { Attachment } from "@/components/ui/file-upload"

type PostType = {
  id: string
  title: string
  content: string
  department: string
  author_name: string
  created_at: string
  attachments?: Attachment[]
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ""
  
  const [posts, setPosts] = useState<PostType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true)
      
      if (!query.trim()) {
        setPosts([])
        setLoading(false)
        return
      }

      // Tìm kiếm trong tiêu đề hoặc nội dung
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        
      if (data) {
        setPosts(data)
      }
      setLoading(false)
    }

    fetchSearchResults()
  }, [query])

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <SearchIcon className="h-6 w-6" />
          Kết quả tìm kiếm
        </h1>
        <p className="text-muted-foreground mt-1">
          {query ? (
            <>Đang hiển thị kết quả cho từ khóa: <strong className="text-foreground">"{query}"</strong></>
          ) : (
            "Vui lòng nhập từ khóa để tìm kiếm."
          )}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground col-span-full">Đang tìm kiếm...</div>
        ) : !query.trim() ? (
          null
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border rounded-xl border-dashed col-span-full">
            Không tìm thấy kết quả nào phù hợp với từ khóa của bạn.
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow border-primary/10">
              <CardHeader className="bg-muted/20 pb-4 border-b border-primary/5">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
                    {post.department || "Tin tức"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold leading-tight line-clamp-2 hover:text-primary transition-colors">
                  <Link href={`/post/${post.id}`}>{post.title}</Link>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2 text-xs">
                  <span>Bởi <strong>{post.author_name}</strong></span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {post.content}
                </p>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t pt-4 flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-primary">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>{post.attachments.length} file đính kèm</span>
                    </div>
                  )}
                </div>
                <Link href={`/post/${post.id}`}>
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto font-medium">
                    Xem chi tiết <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Đang tải...</div>}>
      <SearchResults />
    </Suspense>
  )
}
