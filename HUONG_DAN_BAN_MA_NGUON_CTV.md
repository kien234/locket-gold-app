# 📚 HƯỚNG DẪN CÀI ĐẶT & SỬ DỤNG MÃ NGUỒN LOCKET GOLD CTV (ENTERPRISE EDITION)

> **Mã nguồn Hệ thống Nâng cấp Locket Gold & Cổng API Cộng Tác Viên (CTV)**  
> **Phiên bản:** v2.0 Enterprise CTV | **Hệ quản trị DB:** MongoDB (`locket_ctv`) + Fallback JSON  

---

## 📋 MỤC LỤC
1. [Giới Thiệu Mã Nguồn](#1-giới-thiệu-mã-nguồn)
2. [Yêu Cầu Hệ Thống & Cài Đặt Ban Đầu](#2-yêu-cầu-hệ-thống--cài-đặt-ban-đầu)
3. [Cấu Hình Môi Trường (.env)](#3-cấu-hình-môi-trường-env)
4. [Khởi Tạo Database Ban Đầu (Seed CTV)](#4-khởi-tạo-database-ban-đầu-seed-ctv)
5. [Hướng Dẫn Chạy Web & Server](#5-hướng-dẫn-chạy-web--server)
6. [Tích Hợp Postman API & Quản Lý API Key](#6-tích-hợp-postman-api--quản-lý-api-key)
7. [Tài Khoản Mặc Định & Quản Trị Hệ Thống](#7-tài-khoản-mặc-định--quản-trị-hệ-thống)

---

## 1. GIỚI THIỆU MÃ NGUỒN

Bộ mã nguồn Locket Gold Enterprise CTV được thiết kế tối ưu cho các chủ web/ứng dụng bán lại dịch vụ nâng cấp Locket Gold:
* ⚡ **Tự động 100%:** Xử lý nâng cấp Locket Gold tức thì (0.3s - 1s).
* 🔑 **Quản lý API Key linh hoạt:** Cho phép CTV tùy chỉnh đổi API Key thủ công hoặc tạo ngẫu nhiên.
* 📦 **Tích hợp Postman chuẩn:** Tải 1-click Postman Collection JSON trực tiếp tại endpoint `/api/v1/ctv/postman-collection`.
* 🛡️ **Bảo vệ số dư kép:** Hệ thống không trừ tiền nếu tài khoản khách đã có Gold hoặc bị lỗi kỹ thuật.
* 🗄️ **Database Cách Ly:** Sử dụng Database `locket_ctv` độc lập kèm cơ chế Fallback JSON an toàn chống mất dữ liệu.

---

## 2. YÊU CẦU HỆ THỐNG & CÀI ĐẶT BAN ĐẦU

### Yêu cầu phần mềm:
* **Node.js**: phiên bản >= 18.0 (Khuyên dùng Node 20 LTS)
* **MongoDB**: Community Edition (phiên bản 6.0 trở lên) hoặc MongoDB Atlas URI
* **Trình duyệt**: Chrome, Brave, Edge hoặc Firefox hiện đại

### Các bước cài đặt:
1. Mở cửa sổ terminal/Command Prompt tại thư mục dự án.
2. Cài đặt toàn bộ thư viện cần thiết:
```bash
npm install
```

---

## 3. CẤU HÌNH MÔI TRƯỜNG (.env)

Tạo hoặc chỉnh sửa file `.env` tại thư mục gốc với nội dung chuẩn như sau:

```env
# Cổng chạy Express Server
PORT=3001

# Đăng nhập Admin Portal (/admin.html)
ADMIN_USER=admin
ADMIN_PASS=ChangeThisToASecurePassword123!

# External API Tokens
REVENUECAT_BEARER_TOKEN=appl_JngFETzdodyLmCREOlwTUtXdQik
TELEGRAM_BOT_TOKEN=

# URI Database MongoDB dành cho bản CTV
MONGODB_URI=mongodb://127.0.0.1:27017/locket_ctv

# Cấu hình Ngân hàng & SePay API / Webhook Auto Deposit
SEPAY_API_KEY=YOUR_SEPAY_API_KEY
SEPAY_ACCOUNT_NO=21456181
SEPAY_BANK_BRAND=ACB
SEPAY_ACCOUNT_NAME=NGUYEN VAN KIEN
SEPAY_WEBHOOK_SECRET=
```

### 💳 Hướng dẫn tích hợp SePay Auto Deposit:
1. Đăng ký tài khoản và lấy API Key tại [SePay.vn](https://sepay.vn).
2. Dán mã `SEPAY_API_KEY` vào file `.env`.
3. (Khuyên dùng) Thêm Webhook URL trong cài đặt SePay Dashboard:
   - **URL Webhook:** `https://domain-cua-ban.com/api/sepay/webhook`
   - Khi có tiền vào ngân hàng, SePay sẽ gửi dữ liệu tức thì (0s delay) để cộng tiền ví CTV hoặc kích hoạt đơn tự động.

---

## 4. KHỞI TẠO DATABASE BAN ĐẦU (SEED CTV)

Trước khi khởi chạy hệ thống lần đầu, bạn chạy lệnh sau để tự động tạo Database `locket_ctv`, tạo tài khoản CTV thử nghiệm (`ctv_demo`), cài bảng giá ban đầu và tạo file fallback:

```bash
npm run seed:ctv
```

**Kết quả khởi tạo:**
* **CTV Mẫu:** Username: `ctv_demo` | Mật khẩu: `123456` | Số dư có sẵn: `500.000đ`
* **Mã API Key mặc định:** Dạng `ctv_key_demo_...` (Có thể tùy chỉnh lại ở giao diện)

---

## 5. HƯỚNG DẪN CHẠY WEB & SERVER

### Chạy chế độ Phát triển (Dev Mode - Web + Backend Server):
```bash
npm run dev:all
```
* **Trang chủ CTV:** `http://localhost:5173/` (hoặc `http://localhost:3001/`)
* **Trang tài liệu Postman API:** `http://localhost:5173/postman`
* **Trang Quản trị Admin:** `http://localhost:3001/admin.html`

### Chạy Backend Server riêng lẻ:
```bash
npm run server
```

### Build Sản Phẩm Production:
```bash
npm run build
npm start
```

---

## 6. TÍCH HỢP POSTMAN API & QUẢN LÝ API KEY

### 🚀 Tải Bộ Postman Collection 1-Click:
Bạn hoặc CTV của bạn có thể truy cập trực tiếp URL để tải bộ Postman Collection JSON chính thức:
* **Link Tải:** `http://localhost:3001/api/v1/ctv/postman-collection`

### 🔑 Chỉnh Sửa API Key Tùy Chỉnh:
CTV có thể thay đổi API Key bằng **2 cách**:
1. **Trên Giao Diện Web:** Truy cập mục **Quản Lý API Key** / **Postman Docs** ➔ Bấm **✏️ Chỉnh sửa Key** hoặc gõ trực tiếp API Key tùy chỉnh (VD: `ctv_key_mycustom123`) ➔ Bấm **Lưu Key Này**.
2. **Qua API Backend:** Gọi Endpoint:
   * **URL:** `POST /api/ctv/update-key`
   * **Header:** `Authorization: Bearer <token_ctv>`
   * **Body JSON:** `{"apiKey": "ctv_key_mycustom123"}`

---

## 7. TÀI KHOẢN MẶC ĐỊNH & QUẢN TRỊ HỆ THỐNG

| Tài Khoản | Loại | Username | Mật Khẩu | Quyền Hạn |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Portal** | Quản trị viên | `admin` | `ChangeThisToASecurePassword123!` | Quản lý toàn bộ CTV, duyệt nạp tiền, cài bảng giá, xem lịch sử |
| **CTV Demo** | Cộng tác viên | `ctv_demo` | `123456` | Nạp Gold khách, test Postman API, đổi API Key, xem lịch sử đơn |

---
*Chúc bạn kinh doanh và hợp tác mã nguồn Locket Gold thành công!*
