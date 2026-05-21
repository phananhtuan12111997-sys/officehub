-- 1. Thêm cột avatar_url vào bảng profiles (nếu chưa có)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- 2. Đặt email admin@gmail.com làm Admin (nếu tài khoản này đã được tạo trong Profiles)
UPDATE profiles SET role = 'admin' WHERE email = 'admin@gmail.com';

-- 3. Bảng Bình luận (Comments)
CREATE TABLE IF NOT EXISTS comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade null,
  task_id uuid references tasks(id) on delete cascade null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cho phép đọc comments" ON comments;
CREATE POLICY "Cho phép đọc comments" ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cho phép tạo comments" ON comments;
CREATE POLICY "Cho phép tạo comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 4. Tạo Bucket chứa ảnh đại diện (avatars)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Cho phép đọc avatar" ON storage.objects;
CREATE POLICY "Cho phép đọc avatar" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Cho phép upload avatar" ON storage.objects;
CREATE POLICY "Cho phép upload avatar" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Cho phép sửa avatar" ON storage.objects;
CREATE POLICY "Cho phép sửa avatar" ON storage.objects FOR UPDATE USING ( bucket_id = 'avatars' );

-- 5. Trigger tự động tạo Profile khi Auth tạo user mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), 'staff');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
