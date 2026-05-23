-- Thêm cột thread_id để hỗ trợ tính năng gom nhóm thư (Threaded Conversations)
ALTER TABLE public.mailbox ADD COLUMN IF NOT EXISTS thread_id UUID;

-- (Tùy chọn) Reload lại schema cache nếu Supabase vẫn báo lỗi cache
NOTIFY pgrst, 'reload schema';
