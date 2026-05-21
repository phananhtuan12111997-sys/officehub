-- Đồng bộ tất cả các tài khoản cũ vào bảng Profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, split_part(email, '@', 1), 'staff'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Đảm bảo admin@gmail.com có quyền admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@gmail.com';
