import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });
    }

    // Bypass RLS bằng supabaseAdmin để xóa công việc
    // Ở bản production thực tế, cần verify token người dùng ở bước này để bảo mật
    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id);

    if (error) {
      console.error('Lỗi xoá công việc:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
