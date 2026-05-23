-- Cập nhật bảng mailbox để hỗ trợ gộp thư (Threaded Conversations)
ALTER TABLE mailbox
ADD COLUMN thread_id TEXT;

-- Lưu ý: Bạn cần chạy lệnh dưới đây để bật Real-time cho bảng mailbox nếu lệnh cũ không ăn
ALTER PUBLICATION supabase_realtime ADD TABLE mailbox;
