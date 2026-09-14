# 👑 HƯỚNG DẪN SETUP & VẬN HÀNH HỆ THỐNG NÂNG CẤP LOCKET GOLD AUTO 24/7

Tài liệu chi tiết hướng dẫn cài đặt, cấu hình biến môi trường, clone repo về VPS Linux/Windows, vận hành hệ thống bán lẻ khách hàng, cổng CTV và Admin Portal cho hệ thống **Locket Gold Enterprise**.

---

## 📋 MỤC LỤC

1. [Yêu Cầu Hệ Thống (Prerequisites)](#1-yêu-cầu-hệ-thống-prerequisites)
2. [Hướng Dẫn Clone Repo & Deploy Lên VPS Linux (Ubuntu/Debian)](#2-hướng-dẫn-clone-repo--deploy-lên-vps-linux-ubuntudebian)
3. [Cấu Hình Biến Môi Trường (`.env`)](#3-cấu-hình-biến-môi-trường-env)
4. [Cài Đặt & Khởi Động Dự Án (Cục Bộ / Local)](#4-cài-đặt--khởi-động-dự-án-cục-bộ--local)
5. [Cấu Hình SePay Webhook Auto VietQR 100%](#5-cấu-hình-sepay-webhook-auto-vietqr-100)
6. [Hướng Dẫn Sử Dụng Trang Admin Portal (`/admin`)](#6-hướng-dẫn-sử-dụng-trang-admin-portal-admin)
7. [Tích Hợp Web Mẹ (Upstream `locketgold.click`)](#7-tích-hợp-web-mẹ-upstream-locketgoldclick)
8. [Cập Nhật Code Tự Động (Auto Redeploy)](#8-cập-nhật-code-tự-động-auto-redeploy)
9. [Xử Lý Lỗi Thường Gặp (Troubleshooting)](#9-xử-lý-lỗi-thường-gặp-troubleshooting)

---

## 1. 💻 Yêu Cầu Hệ Thống (Prerequisites)

- **Node.js**: Phiên bản `v18.x` hoặc `v20.x` LTS trở lên.
- **NPM**: Đi kèm với Node.js (`v9.x` trở lên).
- **Git**: Đã cài đặt trên máy tính hoặc VPS.
- **MongoDB**: *(Không bắt buộc)* local `mongodb://127.0.0.1:27017/locket_ctv` hoặc MongoDB Atlas cloud. Nếu chưa cài MongoDB, hệ thống sẽ **tự động dùng bộ đệm JSON dự phòng (`ctv_orders_fallback.json`)** giúp ứng dụng chạy liên tục không bao giờ gián đoạn.
- **Tài khoản SePay**: Để kết nối VietQR quét mã thanh toán tự động (đăng ký tại [my.sepay.vn](https://my.sepay.vn)).

---

## 2. 🐧 Hướng Dẫn Clone Repo & Deploy Lên VPS Linux (Ubuntu/Debian)

### Bước 2.1: Kết Nối VPS & Cài Đặt Môi Trường Ban Đầu
Mở Terminal / PuTTY kết nối vào VPS của bạn qua SSH:
```bash
ssh root@YOUR_VPS_IP
```

Cập nhật hệ thống và cài đặt **Node.js 20**, **Git**, **Nginx**, **PM2**:
```bash
# 1. Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# 3. Cài đặt PM2 quản lý tiến trình ngầm 24/7
sudo npm install -g pm2
```

### Bước 2.2: Clone Repository Từ GitHub
Di chuyển vào thư mục ứng dụng web và clone mã nguồn:
```bash
cd /var/www
git clone https://github.com/kien234/locket-gold-app.git
cd locket-gold-app
```

### Bước 2.3: Tạo File Cấu Hình `.env`
Sao chép mẫu cấu hình hoặc tạo file `.env` mới:
```bash
cp .env.example .env
nano .env
```
*(Điền đầy đủ thông tin tài khoản Admin, SePay, Upstream Key, Domain... như hướng dẫn ở Mục 3 bên dưới, sau đó bấm `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát).*

### Bước 2.4: Cài Đặt Package & Build Frontend Production
```bash
# Cài đặt thư viện Node modules
npm install

# Build mã nguồn Frontend React Vite thành file tĩnh (dist)
npm run build
```

### Bước 2.5: Khởi Động Server Chạy Ngầm Với PM2
```bash
# Khởi chạy server backend với tên "locket-gold"
pm2 start server/index.cjs --name "locket-gold"

# Lưu danh sách tiến trình PM2 để tự khởi động lại khi reboot VPS
pm2 save
pm2 startup
```

### Bước 2.6: Cấu Hình Nginx Reverse Proxy & SSL (HTTPS)
Tạo file cấu hình Nginx cho tên miền của bạn:
```bash
sudo nano /etc/nginx/sites-available/locket-gold
```

Dán nội dung sau vào (thay `yourdomain.com` bằng tên miền thực tế của bạn):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Kích hoạt cấu hình Nginx và cài chứng chỉ SSL miễn phí (Certbot):
```bash
sudo ln -s /etc/nginx/sites-available/locket-gold /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Cài SSL tự động
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 3. ⚙️ Cấu Hình Biến Môi Trường (`.env`)

Tạo hoặc chỉnh sửa file `.env` tại thư mục gốc dự án:

```env
# 1. Cổng máy chủ Backend API
PORT=3009

# 2. Tài khoản quản trị Admin Portal (Dùng đăng nhập /admin)
ADMIN_USER=admin
ADMIN_PASS=admin123!

# 3. Upstream Key Web Mẹ (Key CTV của bạn trên locketgold.click)
UPSTREAM_API_KEY=ctv_key_1786123405752_y89rtu

# 4. Cấu hình Ngân Hàng & SePay VietQR Auto
SEPAY_ACCOUNT_NO=21456181
SEPAY_BANK_BRAND=ACB
SEPAY_ACCOUNT_NAME=NGUYEN VAN KIEN
SEPAY_API_KEY=8c38bfbbd412190c9fffe04237cd03194c5ef601ff87b7433e8f58978121b736
SEPAY_WEBHOOK_SECRET=sepay_secret_token_123

# 5. Telegram Bot Thông Báo Tự Động (Tùy chọn)
TELEGRAM_BOT_TOKEN=789123456:AAxxxxx_your_bot_token

# 6. MongoDB Database (Tùy chọn, tự động dùng JSON nếu offline)
MONGODB_URI=mongodb://127.0.0.1:27017/locket_ctv

# 7. Tên Miền Cho Phép (Frontend Domain - Phân cách bằng dấu phẩy)
VITE_ALLOWED_HOSTS=kawailocket.top,yourdomain.com,localhost,127.0.0.1
```

---

## 4. 🚀 Cài Đặt & Khởi Động Dự Án (Cục Bộ / Local)

### Bước 1: Cài Đặt Thư Viện Dependencies
Mở Terminal tại thư mục gốc dự án và chạy:
```bash
npm install
```

### Bước 2: Build Giao Diện Frontend (Production)
```bash
npm run build
```

### Bước 3: Khởi Động Server Backend + Web Portal
```bash
node server/index.cjs
```
> Server sẽ tự động kích hoạt trên cổng **3009** (hoặc cổng được cấu hình trong `.env`).

### Bước 4: Chế Độ Phát Triển Dev Mode (Tùy chọn)
Nếu muốn phát triển và sửa code giao diện thời gian thực:
```bash
npm run dev
```
- **Frontend App**: `http://localhost:5174`
- **Backend API**: `http://localhost:3009`

---

## 5. 💳 Cấu Hình SePay Webhook Auto VietQR 100%

Hệ thống tự động phát hiện và kích hoạt Locket Gold chỉ **0.5s** ngay khi khách thanh toán qua mã VietQR.

1. Truy cập [my.sepay.vn](https://my.sepay.vn) -> Chọn **Cấu hình Webhook**.
2. Thêm URL Webhook theo tên miền của bạn:
   ```text
   https://yourdomain.com/api/sepay/webhook
   ```
3. Điền **Secret Token** (trùng khớp với `SEPAY_WEBHOOK_SECRET` trong file `.env` hoặc cấu hình SePay trong Admin Portal).
4. Lưu cấu hình. Mọi giao dịch chuyển khoản với nội dung mã đơn (VD: `LGM123456`) sẽ được SePay đẩy trực tiếp về hệ thống để xử lý kích hoạt tự động.

---

## 6. 👑 Hướng Dẫn Sử Dụng Trang Admin Portal (`/admin`)

Truy cập đường dẫn: **`https://yourdomain.com/admin`**

### 🎨 1. Cấu Hình Thương Hiệu & Logo App
- **Chọn Ảnh Logo Từ Máy Tính**: Bấm nút `📁 Chọn Ảnh Logo Từ Máy Tính...` để tải trực tiếp ảnh đại diện logo từ máy (`PNG`, `JPG`, `SVG`, `WebP`).
- **Tên Thương Hiệu**: Nhập tên hiển thị (VD: `Locket Gold`).
- **Thẻ Nhãn (Tag)**: Nhập thẻ nhãn (VD: `PREMIUM`).
- **Tiêu Đề Trang Web**: Cấu hình tên tab trình duyệt (`document.title`) và thẻ SEO.

### 📦 2. Cấu Hình Bảng Giá & Gói Gold Bán Lẻ
- Đổi tên gói, giá bán lẻ khách hàng (Gói 1 Năm & Gói Vĩnh Viễn).
- Tùy chỉnh mô tả phụ và danh sách tính năng (mỗi dòng 1 tính năng).

### 🤝 3. Quản Lý Tài Khoản Cộng Tác Viên (CTV)
- **Tạo CTV Mới**: Nhập Username, Mật khẩu, Giá sỉ 1 Năm & Vĩnh Viễn.
- **Nạp Tiền Ví CTV**: Cộng/Trừ số dư ví trực tiếp.
- **Tạo API Key / Telegram Chat ID**: Đấu nối API tự động cho các CTV làm đại lý.

### 🔐 4. Đổi Tài Khoản & Mật Khẩu Admin
- Đổi tên đăng nhập và mật khẩu truy cập Admin Portal nhanh chóng.

---

## 7. 🌐 Tích Hợp Web Mẹ (Upstream `locketgold.click`)

- Mọi đơn hàng kích hoạt trên website sẽ được chuyển tiếp tự động (Upstream) sang máy chủ trung tâm **`https://locketgold.click`**.
- Đảm bảo nhập đúng **Upstream API Key** trong thẻ *Cấu hình API Key Web Mẹ* trên Admin Portal.
- Có thể bấm nút **`🔄 Kiểm Tra`** trên Admin để xem trực tiếp **Số dư ví** và **Lượt gói còn lại** trên Web Mẹ.

---

## 8. 🔄 Cập Nhật Code Tự Động (Auto Redeploy)

Khi có bản cập nhật mới trên GitHub (`kien234/locket-gold-app`), chạy lệnh sau trên VPS:

```bash
cd /var/www/locket-gold-app
git pull origin main
npm install
npm run build
pm2 restart locket-gold
```
*(Hoặc chạy file script `deploy.bat` nếu vận hành VPS Windows).*

---

## 9. 🛠️ Xử Lý Lỗi Thường Gặp (Troubleshooting)

### ❓ Lỗi Bận Cổng (Port 3009 is busy)
Nếu khởi động bị báo lỗi cổng 3009 đang bị chiếm dụng bởi tiến trình khác:

**Trên Linux:**
```bash
sudo kill -9 $(lsof -t -i:3009)
```

**Trên Windows (PowerShell):**
```powershell
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3009).OwningProcess -Force"
```

### ❓ Màn Hình Chờ Preloader Lồng Lộn
- Trang web tích hợp sẵn màn hình chờ **Preloader Locket Gold 👑 0ms** nhúng trực tiếp trong `index.html` giúp chống vỡ giao diện / lộ HTML thô trước khi phông chữ và CSS tải xong.

### ❓ Kiểm Tra Kết Nối Bank SePay
Trên Admin Portal -> Thẻ *SePay Webhook* -> Bấm **`🔌 Test Lấy 10 GD Gần Nhất`** để kiểm tra kết nối tài khoản ngân hàng SePay thời gian thực.

---
👑 **Chúc bạn vận hành hệ thống thành công & doanh thu rực rỡ!**

