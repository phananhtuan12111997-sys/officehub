-- Bảng thông tin nhân viên (Profiles)
CREATE TABLE profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text default 'staff',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bảng tài liệu (Documents)
CREATE TABLE documents (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  file_url text not null,
  size text,
  department text,
  uploaded_by uuid references profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Bật bảo mật dòng (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Chính sách (Policies) siêu đơn giản cho Demo: Cho phép ai đã đăng nhập cũng xem và tạo được
CREATE POLICY "Cho phép đọc profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Cho phép tạo profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Cho phép sửa profiles" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Cho phép đọc documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Cho phép tạo documents" ON documents FOR INSERT WITH CHECK (true);

-- Tạo Bucket lưu trữ file (Storage)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
CREATE POLICY "Cho phép đọc file" ON storage.objects FOR SELECT USING ( bucket_id = 'documents' );
CREATE POLICY "Cho phép upload file" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'documents' );
