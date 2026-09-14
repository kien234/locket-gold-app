# 📚 HƯỚNG DẪN TÍCH HỢP API LOCKET GOLD DÀNH CHO CỘNG TÁC VIÊN (CTV)

> **Tài liệu Kỹ thuật API CTV Official Specification**  
> **Phiên bản:** v2.1 | **Base URL:** `https://locketgold.click`

---

## 📋 MỤC LỤC
1. [Giới Thiệu Chung](#1-giới-thiệu-chung)
2. [Phương Thức Xác Thực (Authentication)](#2-phương-thức-xác-thực-authentication)
3. [Chi Tiết Bộ API CTV Official](#3-chi-tiết-bộ-api-ctv-official)
4. [Các Trạng Thái Phản Hồi & Mã Lỗi](#4-các-trạng-thái-phản-hồi--mã-lỗi)
5. [Thông Báo Telegram Tự Động](#5-thông-báo-telegram-tự-động)
6. [Tải Postman Collection](#6-tải-postman-collection)
7. [Mã Nguồn Mẫu Tích Hợp (Code Snippets)](#7-mã-nguồn-mẫu-tích-hợp-code-snippets)

---

## 1. GIỚI THIỆU CHUNG

Hệ thống API CTV của Locket Gold cung cấp các Cổng kết nối chuẩn HTTP RESTful an toàn, cho phép Cộng tác viên (CTV) tự động hóa quy trình nâng cấp **Locket Gold** 24/7 trực tiếp từ website, ứng dụng hoặc bot của CTV.

### 🌟 Tính Năng Nổi Bật:
* ⚡ **Kích hoạt tự động:** Xử lý đơn hàng siêu tốc (0.3s - 1s).
* 🛡️ **Bảo mật & An toàn:** Bảo vệ số dư 100%, tự động hoàn lượt/tiền nếu đơn gặp lỗi hoặc tài khoản đã có Gold.
* 📦 **Hỗ trợ Đa Dạng:** Tương thích cả nạp theo ví số dư lẫn nạp theo kho lượt gói.
* 📲 **Telegram Notify:** Tự động gửi thông báo thời gian thực về Telegram của CTV.

---

## 2. PHƯƠNG THỨC XÁC THỰC (AUTHENTICATION)

Mỗi CTV được cấp một mã **API Token Key** riêng biệt. Bạn cần gửi Key xác thực qua HTTP Header tiêu chuẩn:

| Phương Thức Header | Cú Pháp / Header Key | Mức Độ Khuyên Dùng |
| :--- | :--- | :--- |
| **HTTP Header `x-api-key`** | `x-api-key: ctv_key_xxx` | ⭐ **Khuyên Dùng** |
| **Authorization Header** | `Authorization: Bearer ctv_key_xxx` | ⭐ Khuyên Dùng |

---

## 3. CHI TIẾT BỘ API CTV OFFICIAL

### 1. Kích Hoạt Gold 1 Năm (POST `/api/v1/ctv/gold`)
* **Endpoint:** `POST https://locketgold.click/api/v1/ctv/gold`
* **Content-Type:** `application/json`
* **Header:** `x-api-key: {YOUR_API_KEY}`
* **Body (JSON):**
```json
{
  "user": "vanle"
}
```

### 2. Kích Hoạt Gold 1 Năm Theo Lượt Gói (POST `/api/v1/ctv/gold-package`)
* **Endpoint:** `POST https://locketgold.click/api/v1/ctv/gold-package`
* **Content-Type:** `application/json`
* **Header:** `x-api-key: {YOUR_API_KEY}`
* **Body (JSON):**
```json
{
  "user": "vanle"
}
```

### 3. Tra Cứu Số Dư Ví & Lượt Gói CTV (GET `/api/v1/ctv/me`)
* **Endpoint:** `GET https://locketgold.click/api/v1/ctv/me`
* **Header:** `x-api-key: {YOUR_API_KEY}`

### 4. Tra Cứu Lịch Sử Đơn Hàng CTV (GET `/api/v1/ctv/orders`)
* **Endpoint:** `GET https://locketgold.click/api/v1/ctv/orders`
* **Header:** `x-api-key: {YOUR_API_KEY}`

### 5. Tra Cứu Profile & Status Locket (GET `/api/v1/userinfo`)
* **Endpoint:** `GET https://locketgold.click/api/v1/userinfo?user={username}`

---

## 4. CÁC TRẠNG THÁI PHẢN HỒI & MÃ LỖI

### ✅ 1. Success (`200 OK`)
```json
{
  "status": "success",
  "message": "🎉 Kích hoạt Locket Gold 1 Năm HOÀN TẤT cho @vanle!"
}
```

### ℹ️ 2. Already Active (`200 OK`)
```json
{
  "status": "info",
  "already_has_gold": true,
  "message": "ℹ️ Tài khoản @vanle đã có Locket Gold active từ trước."
}
```

### ❌ 3. Hết Lượt Gói / Số Dư (`400 Bad Request`)
```json
{
  "status": "error",
  "code": 400,
  "message": "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!"
}
```

### ❌ 4. Lỗi API Key (`401 Unauthorized`)
```json
{
  "status": "error",
  "code": 401,
  "message": "Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa."
}
```

### ❌ 5. Username Bị Khóa (`403 Forbidden` - Code 102)
```json
{
  "status": "error",
  "code": 102,
  "message": "Tài khoản @vanle đã bị KHÓA (Banned) trên hệ thống!"
}
```

### ❌ 6. Lỗi Máy Chủ (`500 Internal Server Error`)
```json
{
  "status": "error",
  "code": 500,
  "message": "Kích hoạt Gold thất bại: Lỗi kết nối máy chủ kích hoạt Gold. Đã hoàn lại 1 lượt gói cho CTV!"
}
```

---

## 5. THÔNG BÁO TELEGRAM TỰ ĐỘNG

Hệ thống tích hợp thông báo thời gian thực gửi tới Telegram của CTV khi phát sinh giao dịch:
* 🟢 **Đơn hàng hoàn tất:** Thông báo kết quả nâng cấp thành công.
* 🟡 **Tài khoản đã active:** Xác nhận giữ nguyên số dư/lượt gói.
* 🔴 **Đơn lỗi:** Gửi lý do để CTV hỗ trợ khách hàng nhanh chóng.

---

## 6. TẢI POSTMAN COLLECTION

Tải tập tin Postman Collection v2.1.0 chính thức để import trực tiếp:
* **Link Download JSON:** `https://locketgold.click/api/v1/ctv/postman-collection`

---

## 7. MÃ NGUỒN MẪU TÍCH HỢP (CODE SNIPPETS)

### 7.1 cURL
```bash
curl -X POST "https://locketgold.click/api/v1/ctv/gold" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"user": "vanle"}'
```

### 7.2 JavaScript / Node.js
```javascript
const response = await fetch('https://locketgold.click/api/v1/ctv/gold', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify({ user: 'vanle' })
});
const data = await response.json();
console.log(data);
```

### 7.3 PHP
```php
<?php
$ch = curl_init("https://locketgold.click/api/v1/ctv/gold");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(["user" => "vanle"]),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: YOUR_API_KEY'
    ]
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);
print_r($result);
?>
```

### 7.4 Python
```python
import requests

response = requests.post(
    "https://locketgold.click/api/v1/ctv/gold",
    json={"user": "vanle"},
    headers={"x-api-key": "YOUR_API_KEY"}
)
print(response.json())
```

---

## 📞 HỖ TRỢ KỸ THUẬT & SUPPORT
Liên hệ Admin qua kênh Telegram hỗ trợ chính thức trên Portal CTV khi cần hướng dẫn tích hợp.
