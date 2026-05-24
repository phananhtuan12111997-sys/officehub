-- Thêm cột force_password_change (kiểu Boolean) vào bảng profiles để đánh dấu user cần đổi mật khẩu ở lần đăng nhập đầu tiên
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='force_password_change') THEN
        ALTER TABLE public.profiles ADD COLUMN force_password_change BOOLEAN DEFAULT false;
    END IF;
END $$;
