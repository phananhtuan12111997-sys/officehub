# TÀI LIỆU SẢN PHẨM: OFFICEHUB (NỀN TẢNG QUẢN TRỊ VĂN PHÒNG)

## 1. TỔNG QUAN SẢN PHẨM
**OfficeHub** là một nền tảng quản trị và vận hành văn phòng nội bộ toàn diện (Intranet/Digital Workspace), được thiết kế để kết nối nhân viên, quản lý luồng công việc, lưu trữ tài liệu và truyền thông nội bộ một cách an toàn và hiệu quả. 

Sản phẩm cung cấp một không gian làm việc số tập trung, nơi mọi thành viên trong công ty hoặc từng phòng ban có thể dễ dàng tương tác, chia sẻ thông tin và theo dõi tiến độ dự án theo thời gian thực. Hệ thống hỗ trợ đa nền tảng (Responsive Layout), mang lại trải nghiệm liền mạch trên cả máy tính (Desktop) và thiết bị di động (Mobile).

---

## 2. KIẾN TRÚC & CÔNG NGHỆ BÊN DƯỚI (TECH STACK)
Hệ thống được xây dựng trên những công nghệ hiện đại, tối ưu cho tốc độ tải trang, tính năng thời gian thực và bảo mật cao:
- **Frontend Framework**: Next.js 14+ (App Router), React.
- **Ngôn ngữ**: TypeScript.
- **Giao diện & UI/UX**: Tailwind CSS, Shadcn/UI, Radix UI.
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage).
- **Tính năng thời gian thực**: Supabase Realtime (WebSockets).

---

## 3. CHI TIẾT CÁC TÍNH NĂNG & CÁCH SỬ DỤNG

### 3.1. Phân hệ Xác thực & Bảo mật (Authentication)
- **Đăng nhập**: Người dùng sử dụng Email và Mật khẩu được cấp phát để truy cập vào hệ thống.
- **Phân quyền (Role-based Access)**: Có sự phân chia quyền giữa `Admin` (Ban giám đốc/Quản trị viên) và `User` (Nhân viên bình thường). Quyền hạn quyết định việc hiển thị tính năng xóa/chỉnh sửa nội dung của người khác và quản lý nhân sự.
- **Duy trì phiên đăng nhập**: Người dùng không cần đăng nhập lại nhiều lần, hệ thống tự động làm mới phiên làm việc an toàn.

### 3.2. Bảng tin nội bộ & Truyền thông (Feed & Posts)
Phân hệ đóng vai trò như mạng xã hội nội bộ, giúp các phòng ban thông báo tin tức quan trọng hoặc thảo luận nội bộ.
- **Đăng bài (Rich Text)**: Người dùng có thể viết bài với định dạng phong phú (in đậm, in nghiêng, danh sách, link), đính kèm ảnh và nhiều loại file tài liệu.
- **Bình chọn (Polls)**: Cho phép tạo các cuộc bình chọn (Ví dụ: "Chọn địa điểm team building") để khảo sát ý kiến nhân viên.
- **Tương tác**: 
  - **Reactions**: Thả cảm xúc đa dạng (Thích, Yêu thích, Haha, Wow, Buồn, Phẫn nộ) tương tự Facebook.
  - **Bình luận (Comments)**: Thảo luận sâu theo từng bài đăng.
- **Phân loại & Tìm kiếm**: Có thể lọc bài viết theo phòng ban (Ví dụ: "Phòng Marketing", "Chung") hoặc sử dụng thanh tìm kiếm để tìm theo từ khoá.
- **Ghim bài (Pin)**: Quản trị viên có thể ghim các thông báo quan trọng lên đầu Bảng tin để đảm bảo không ai bị lỡ thông tin.

### 3.3. Quản lý Tài liệu Số (Documents/Drive)
Không gian lưu trữ tập trung (như Google Drive nội bộ) giúp phòng ban quản lý tri thức và biểu mẫu.
- **Giao diện linh hoạt**: Chuyển đổi giữa chế độ xem **Lưới (Grid)** hoặc **Danh sách (List)**. Có hỗ trợ sắp xếp theo Tên, Ngày tạo, Kích thước hoặc Phòng ban.
- **Quản lý Thư mục & Tệp**: 
  - Tạo mới thư mục, đổi tên, xoá thư mục và phân quyền hiển thị theo phòng ban.
  - Tải lên (Upload) nhiều tài liệu cùng lúc, hỗ trợ thao tác kéo-thả (Drag & Drop).
- **Trình xem trước Tài liệu (File Preview)**:
  - Xem trực tiếp nội dung các file ảnh (JPG, PNG).
  - Xem trực tiếp PDF trên trình duyệt.
  - Tích hợp Google Docs Viewer để xem mượt mà các định dạng Word, Excel, PowerPoint mà không cần tải xuống.
  - Nút đóng, in ấn và tải xuống được bố trí trực quan trên cả máy tính và điện thoại.
- **Ghim Thư mục**: Hỗ trợ ghim các thư mục hay dùng lên đầu.

### 3.4. Quản lý Công việc & Dự án (Tasks/Kanban)
Hỗ trợ kiểm soát tiến độ công việc minh bạch theo từng cá nhân hoặc đội nhóm.
- **Chế độ xem**:
  - **Kanban Board**: Kéo thả công việc giữa các cột trạng thái (Việc mới -> Đang thực hiện -> Chờ duyệt -> Hoàn thành).
  - **List View**: Xem danh sách các công việc dưới dạng bảng.
- **Chi tiết Công việc**:
  - Giao việc (Assignee) cho một người cụ thể.
  - Chọn phòng ban phụ trách, đặt mức độ ưu tiên (Thấp, Trung bình, Cao) và thời hạn hoàn thành (Deadline).
  - Đính kèm file ngay trong công việc để người nhận dễ tham khảo.
- **Bình luận tác vụ**: Mọi người có thể trao đổi, báo cáo tiến độ ngay bên dưới mỗi thẻ công việc.
- **Bộ lọc thông minh**: Lọc công việc theo người thực hiện, mức độ ưu tiên, hoặc tìm kiếm theo tiêu đề.

### 3.5. Hộp thư & Thông báo (Inbox/Notifications)
- Cập nhật luồng công việc thời gian thực.
- Bất cứ khi nào có người bình luận vào bài đăng, thả cảm xúc, hay giao một công việc mới, người dùng sẽ nhận được thông báo đỏ để cập nhật tức thời.

### 3.6. Thiết lập & Quản lý Thông tin Cá nhân (Profile)
- Người dùng có thể cập nhật thông tin cá nhân (Tên, Số điện thoại, Vai trò chuyên môn).

---

## 4. HƯỚNG DẪN VẬN HÀNH DÀNH CHO QUẢN TRỊ VIÊN (ADMIN)

Để hệ thống vận hành trơn tru, Quản trị viên (Admin) cần lưu ý thực hiện các bước sau:
1. **Quản lý Cơ cấu Tổ chức**: Tạo sẵn danh sách các Phòng ban trên cơ sở dữ liệu để nhân viên có thể lựa chọn khi đăng bài hoặc tạo thư mục tài liệu.
2. **Cấp phát tài khoản**: Đảm bảo tất cả nhân sự có email và mật khẩu. Cấp quyền `admin` cho các quản lý cấp cao để họ có thể ghim bài viết và quản lý thư mục của toàn công ty.
3. **Phân luồng thông tin**: Khuyến khích các phòng ban sử dụng thẻ tags và bộ lọc phòng ban đúng quy định để bảng tin công ty không bị "nhiễu" thông tin.
4. **Quy định Lưu trữ**: Tài liệu nên được phân vào các Thư mục chung theo tên Phòng ban. Hạn chế tải lên các file định dạng lạ, không phổ biến để trình xem trước (File Preview) hoạt động tốt nhất.

---

## 5. TỐI ƯU GIAO DIỆN DI ĐỘNG (MOBILE-FIRST)
Sản phẩm được thiết kế với chuẩn Mobile-First cực kỳ khắt khe:
- Thanh điều hướng (Sidebar) thu gọn thành nút Menu dưới màn hình hoặc góc trên.
- Các Pop-up, Form nhập liệu, và **File Preview Dialog** tự động thay đổi kích thước, sắp xếp linh hoạt để tránh bị khuất màn hình.
- Các tương tác phức tạp (kéo thả Task) hoặc (bấm vào Card) đều được tách biệt vùng nhấn để người dùng trên màn hình cảm ứng không bị chạm nhầm.

---
*Tài liệu này là phiên bản tổng hợp tính đến phiên bản hiện tại. Mọi cập nhật mới về tính năng sẽ được bổ sung tiếp ở các phiên bản sau.*
