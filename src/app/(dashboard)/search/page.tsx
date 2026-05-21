"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase/client"
import { ArrowRight, Paperclip, Search as SearchIcon, FileText, CheckSquare, ArrowLeft } from "lucide-react"
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

type TaskType = {
  id: string
  title: string
  assignee: string
  status: string
  created_at: string
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ""
  
  const [posts, setPosts] = useState<PostType[]>([])
  const [tasks, setTasks] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true)
      
      if (!query.trim()) {
        setPosts([])
        setTasks([])
        setLoading(false)
        return
      }

      // 1. Tìm kiếm Bài viết
      const fetchPosts = supabase
        .from('posts')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('created_at', { ascending: false })

      // 2. Tìm kiếm Công việc
      const fetchTasks = supabase
        .from('tasks')
        .select('*')
        .or(`title.ilike.%${query}%,assignee.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        
      const [postsRes, tasksRes] = await Promise.all([fetchPosts, fetchTasks])

      if (postsRes.data) setPosts(postsRes.data)
      if (tasksRes.data) setTasks(tasksRes.data)
        
      setLoading(false)
    }

    fetchSearchResults()
  }, [query])

  const hasNoResults = posts.length === 0 && tasks.length === 0
  const showResults = query.trim() !== "" && !loading

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
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

      {loading ? (
        <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-r-transparent animate-spin"></div>
          Đang tìm kiếm...
        </div>
      ) : showResults && hasNoResults ? (
        <div className="text-center py-20 bg-muted/20 border rounded-xl border-dashed flex flex-col items-center justify-center gap-4">
          <div className="p-4 bg-background rounded-full shadow-sm">
            <SearchIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">Không tìm thấy kết quả nào</h3>
            <p className="text-muted-foreground max-w-md mx-auto mt-1">
              Rất tiếc, chúng tôi không tìm thấy bài viết hay công việc nào phù hợp với từ khóa "{query}". Bạn hãy thử một từ khóa khác xem sao.
            </p>
          </div>
          <Button onClick={() => router.back()} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Quay lại trang trước
          </Button>
        </div>
      ) : showResults ? (
        <div className="flex flex-col gap-8">
          
          {/* Section: Bài viết */}
          {posts.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 border-l-4 border-primary pl-3">
                <FileText className="h-5 w-5 text-primary" /> 
                Bài viết & Thông báo ({posts.length})
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {posts.map((post) => (
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
                ))}
              </div>
            </div>
          )}

          {/* Section: Công việc */}
          {tasks.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                <CheckSquare className="h-5 w-5 text-orange-500" /> 
                Công việc liên quan ({tasks.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                  <Card key={task.id} className="shadow-sm border border-border/50 hover:border-orange-500/50 transition-colors">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base leading-tight">{task.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 pb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <span>Trạng thái:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'done' ? 'bg-green-100 text-green-700' :
                          task.status === 'review' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {task.status === 'done' ? 'Hoàn thành' : task.status === 'review' ? 'Chờ duyệt' : 'Đang làm'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Người nhận: </span>
                        <span className="font-medium">{task.assignee}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="p-4 pt-0 bg-muted/10 border-t mt-auto flex justify-end">
                      <Link href="/tasks">
                        <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 p-0 h-auto font-medium">
                          Đến bảng công việc <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : null}
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
