import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabase } from "@/lib/supabase/client"

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    // Check if admin
    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Chỉ admin mới có quyền sửa bài" }, { status: 403 })
    }

    const body = await req.json()
    const { id, title, content, department, attachments } = body

    if (!id || !title || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("posts")
      .update({
        title,
        content,
        department,
        attachments: attachments || []
      })
      .eq("id", id)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    // Check if admin
    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Chỉ admin mới có quyền xoá bài" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

