import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabase } from "@/lib/supabase/client"

// Hàm phụ trợ kiểm tra xem request có gửi từ Admin không
async function checkAdminAuth(req: Request) {
  // Ở một app thực tế nên dùng supabase-js auth qua cookies hoặc Bearer token
  // Để tối giản cho demo, chúng ta dựa vào header 'Authorization' kèm token của user, 
  // hoặc có thể truyền uid trong request, rồi check DB.
  
  // Vì là app Demo Next.js client-side nặng, chúng ta có thể làm cách này:
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) return false

  // Lấy role từ bảng profiles
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  return profile?.role === "admin"
}

export async function GET(req: Request) {
  const isAdmin = await checkAdminAuth(req)
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  // Lấy danh sách profiles
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(profiles)
}

export async function POST(req: Request) {
  const isAdmin = await checkAdminAuth(req)
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { email, password, full_name, role, department_id } = body

  // Tạo auth user bằng Admin API
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Lưu ý: Trigger on_auth_user_created sẽ tự tạo row trong profiles.
  // Tuy nhiên ta cần cập nhật full_name và role theo đúng form, đồng thời bắt buộc user đổi mật khẩu.
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name, role: role || "staff", department_id, force_password_change: true })
      .eq("id", authData.user.id)

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ message: "User created successfully", user: authData.user })
}

export async function PATCH(req: Request) {
  const isAdmin = await checkAdminAuth(req)
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const body = await req.json()
  const { id, role, full_name, password, department_id } = body

  // Update profile
  const updateData: any = {}
  if (role !== undefined) updateData.role = role
  if (full_name !== undefined) updateData.full_name = full_name
  if (department_id !== undefined) updateData.department_id = department_id

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update password if provided
  if (password && password.trim() !== "") {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: password.trim() })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  return NextResponse.json({ message: "User updated" })
}

export async function DELETE(req: Request) {
  const isAdmin = await checkAdminAuth(req)
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

  // Clean up related records manually to prevent FK constraint errors
  await supabaseAdmin.from('comment_reactions').delete().eq('user_id', id)
  await supabaseAdmin.from('comments').delete().eq('author_id', id)
  await supabaseAdmin.from('notifications').delete().eq('user_id', id)
  await supabaseAdmin.from('mailbox').delete().or(`sender_id.eq.${id},receiver_id.eq.${id}`)
  await supabaseAdmin.from('tasks').update({ assignee_id: null }).eq('assignee_id', id)
  await supabaseAdmin.from('posts').delete().eq('author_id', id)

  // Profile is usually cascade deleted, but let's be explicit
  await supabaseAdmin.from('profiles').delete().eq('id', id)

  // Xóa user từ Auth.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ message: "User deleted" })
}
