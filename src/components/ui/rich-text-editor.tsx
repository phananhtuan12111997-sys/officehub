import dynamic from 'next/dynamic'
import { forwardRef, useMemo, useState, useEffect } from 'react'
import 'react-quill-new/dist/quill.snow.css'
import 'quill-mention/dist/quill.mention.css'
import { supabase } from '@/lib/supabase/client'

const ReactQuill = dynamic(async () => {
  const rqModule = await import('react-quill-new')
  const ReactQuillComponent = rqModule.default
  
  try {
    const qModule = await import('quill')
    const QuillClass = qModule.default || qModule
    
    if (QuillClass && typeof QuillClass['register'] === 'function') {
      const mentionModule = await import('quill-mention')
      
      // Register both blot and module
      QuillClass['register']({
        'blots/mention': mentionModule.MentionBlot,
        'modules/mention': mentionModule.Mention
      })
    }
  } catch (err) {
    console.error("Failed to load quill-mention", err)
  }
  
  return ReactQuillComponent
}, { ssr: false, loading: () => <div className="h-full bg-muted/30 animate-pulse rounded-md"></div> })

export const RichTextEditor = forwardRef<any, any>(({ value, onChange, placeholder }, ref) => {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email')
      if (data) {
        setUsers(data.map(u => ({ id: u.id, value: u.full_name || u.email?.split('@')[0] })))
      }
    }
    fetchUsers()
  }, [])

  const modules = useMemo(() => ({
    mention: {
      allowedChars: /^[A-Za-zÀ-ỹ\s]*$/,
      mentionDenotationChars: ["@"],
      source: function (searchTerm: string, renderList: any, mentionChar: string) {
        if (searchTerm.length === 0) {
          renderList(users, searchTerm)
        } else {
          const matches = users.filter(v => v.value.toLowerCase().includes(searchTerm.toLowerCase()))
          renderList(matches, searchTerm)
        }
      }
    },
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ]
  }), [users])

  return (
    <div className="rich-text-container h-full">
      <ReactQuill 
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        className="rounded-md h-full bg-muted/30"
      />
    </div>
  )
})

RichTextEditor.displayName = 'RichTextEditor'
