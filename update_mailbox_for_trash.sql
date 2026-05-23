-- Chạy lệnh SQL sau trong giao diện Supabase (mục SQL Editor)
-- Để thêm 2 cột quản lý trạng thái Thùng rác cho Hộp thư

ALTER TABLE mailbox
ADD COLUMN is_deleted_by_sender BOOLEAN DEFAULT false,
ADD COLUMN is_deleted_by_receiver BOOLEAN DEFAULT false;
