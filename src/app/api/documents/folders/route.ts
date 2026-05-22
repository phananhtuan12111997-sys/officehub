import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabase } from "@/lib/supabase/client"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.log("No auth header")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.log("Auth error:", authError)
      return NextResponse.json({ error: authError?.message || "Unauthorized user" }, { status: 403 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.log("Profile error:", profileError)
      return NextResponse.json({ error: "Cannot fetch profile" }, { status: 403 })
    }

    if (profile?.role !== "admin") {
      console.log("Not admin:", profile)
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const { name } = await req.json()
    console.log("Inserting folder:", name)
    const { data, error } = await supabaseAdmin.from("document_folders").insert({ name }).select()

    if (error) {
      console.log("Insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    console.log("Success:", data)
    return NextResponse.json(data)
  } catch (err: any) {
    console.log("Catch error:", err)
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from("document_folders")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const { id, name } = await req.json()
    if (!id || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const { data, error } = await supabaseAdmin.from("document_folders").update({ name }).eq("id", id).select()
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

    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 })

    const { error } = await supabaseAdmin.from("document_folders").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}

