-- Thêm cột attachments (kiểu JSONB) vào bảng posts để lưu trữ mảng các file đính kèm
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='attachments') THEN
        ALTER TABLE public.posts ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Tạo Bucket lưu trữ file đính kèm bài viết (Storage)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post_attachments', 'post_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép tất cả mọi người đọc file đính kèm bài viết
DROP POLICY IF EXISTS "Cho phép đọc file đính kèm" ON storage.objects;
CREATE POLICY "Cho phép đọc file đính kèm" ON storage.objects 
FOR SELECT USING (bucket_id = 'post_attachments');

-- Cho phép tất cả người dùng đăng nhập upload file đính kèm bài viết
DROP POLICY IF EXISTS "Cho phép upload file đính kèm" ON storage.objects;
CREATE POLICY "Cho phép upload file đính kèm" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'post_attachments' AND auth.uid() IS NOT NULL);
