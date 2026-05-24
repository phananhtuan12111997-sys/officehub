export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabase } from "@/lib/supabase/client"

async function checkPermission(req: Request, fileId: string) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return { allowed: false, error: "No Auth" }
  const token = authHeader.replace("Bearer ", "")
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return { allowed: false, error: "Invalid user" }

  const { data: file } = await supabaseAdmin.from("documents").select("uploaded_by").eq("id", fileId).single()
  if (!file) return { allowed: false, error: "File not found" }

  if (file.uploaded_by === user.id) return { allowed: true, user }

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "admin") return { allowed: true, user }

  return { allowed: false, error: "Unauthorized" }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

  const perm = await checkPermission(req, id)
  if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

  const { error } = await supabaseAdmin.from("documents").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, name, is_pinned } = body
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })
  if (name === undefined && is_pinned === undefined) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const perm = await checkPermission(req, id)
  if (!perm.allowed) return NextResponse.json({ error: perm.error }, { status: 403 })

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (is_pinned !== undefined) updates.is_pinned = is_pinned

  const { error } = await supabaseAdmin.from("documents").update(updates).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { data: profile } = await supabaseAdmin.from("profiles").select("role, department_id, departments(name)").eq("id", user.id).single()
    const isAdmin = profile?.role === "admin"
    const deptData: any = profile?.departments;
    const userDeptName = Array.isArray(deptData) ? deptData[0]?.name : deptData?.name;

    const { searchParams } = new URL(req.url)
    const folderId = searchParams.get("folder_id")
    const searchQuery = searchParams.get("search")

    let query = supabaseAdmin
      .from('documents')
      .select(`
        *,
        profiles!documents_uploaded_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (folderId) {
      query = query.eq('folder_id', folderId)
    } else if (!searchQuery) {
      query = query.is('folder_id', null)
    }

    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`)
    }

    if (!isAdmin && !folderId) {
      // If filtering at root or searching globally, restrict by department
      if (userDeptName) {
        query = query.in("department", ["Chung", userDeptName])
      } else {
        query = query.eq("department", "Chung")
      }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const body = await req.json()
    const { name, file_url, size, department, folder_id } = body
    if (!name || !file_url) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data, error } = await supabaseAdmin.from("documents").insert({
      name,
      file_url,
      size,
      department,
      uploaded_by: user.id,
      folder_id: folder_id || null
    }).select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}


