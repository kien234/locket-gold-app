import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Copy, CheckCircle2, Crown, Key, ExternalLink, ArrowRight,
  BookOpen, Sparkles, Send, Play, Layers, HelpCircle, Check, Lock, Code2,
  RefreshCw, Terminal, CheckCircle, AlertCircle, ShieldCheck, Zap, UserCheck, Search,
  AlertTriangle, Info, ShieldAlert, FileText, XCircle
} from 'lucide-react';
import { Navbar } from '../sections/Navbar';
import { Footer } from '../sections/Footer';
import { extractLocketUsername } from '../../services/locketService';

interface CtvInfo {
  username: string;
  displayName: string;
  apiKey?: string;
  balance: number;
  prices?: { [key: string]: number };
}

export const PostmanDocsPage: React.FC = () => {
  const [ctv, setCtv] = useState<CtvInfo | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedErrId, setCopiedErrId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  
  // Endpoint selection state
  const [activeEndpoint, setActiveEndpoint] = useState<'userinfo' | 'gold' | 'gold-package' | 'me' | 'orders'>('gold');

  // Error responses filter tab
  const [errorFilter, setErrorFilter] = useState<'all' | '200' | '400' | '401' | '403' | '500'>('all');

  // Live API Tester State
  const [testUser, setTestUser] = useState('vanle');
  const [testCategory, setTestCategory] = useState<'yearly' | 'lifetime'>('yearly');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveKeyNotice, setSaveKeyNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [customKey, setCustomKey] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isRunningApi, setIsRunningApi] = useState(false);
  const [apiResponse, setApiResponse] = useState<{ status: number; statusText: string; timeMs: number; data: unknown } | null>(null);

  // Khởi tạo: lấy token từ localStorage và fetch thông tin CTV
  useEffect(() => {
    const savedToken = localStorage.getItem('ctv_token') || localStorage.getItem('token') || null;
    setToken(savedToken);
    if (savedToken) {
      fetch('/api/ctv/me', { headers: { 'Authorization': `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setCtv(data);
            if (data.apiKey && !customKey) setCustomKey(data.apiKey);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveCustomKey = async () => {
    if (!token) {
      setSaveKeyNotice({ type: 'error', msg: 'Vui lòng đăng nhập CTV để lưu API Key!' });
      return;
    }
    if (!customKey || customKey.trim().length < 3) {
      setSaveKeyNotice({ type: 'error', msg: 'API Key phải từ 3 ký tự trở lên!' });
      return;
    }
    setIsSavingKey(true);
    setSaveKeyNotice(null);
    try {
      const res = await fetch('/api/ctv/update-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey: customKey.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveKeyNotice({ type: 'success', msg: '✅ Đã lưu API Key mới thành công!' });
        if (ctv) setCtv({ ...ctv, apiKey: data.apiKey });
        setCustomKey(data.apiKey);
        setTimeout(() => setSaveKeyNotice(null), 3000);
      } else {
        setSaveKeyNotice({ type: 'error', msg: data.error || 'Lỗi đổi API Key' });
      }
    } catch (e: any) {
      setSaveKeyNotice({ type: 'error', msg: e?.message || 'Không thể kết nối máy chủ' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRegenRandomKey = async () => {
    if (!token) {
      setSaveKeyNotice({ type: 'error', msg: 'Vui lòng đăng nhập CTV để tạo ngẫu nhiên API Key!' });
      return;
    }
    setIsSavingKey(true);
    setSaveKeyNotice(null);
    try {
      const res = await fetch('/api/ctv/regen-key', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveKeyNotice({ type: 'success', msg: '🔑 Đã tạo ngẫu nhiên API Key mới!' });
        if (ctv) setCtv({ ...ctv, apiKey: data.apiKey });
        setCustomKey(data.apiKey);
        setTimeout(() => setSaveKeyNotice(null), 3000);
      } else {
        setSaveKeyNotice({ type: 'error', msg: data.error || 'Lỗi tạo API Key' });
      }
    } catch (e: any) {
      setSaveKeyNotice({ type: 'error', msg: e?.message || 'Lỗi hệ thống' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const activeKey = customKey || ctv?.apiKey || 'ctv_key_YOUR_API_KEY';
  const activeUser = ctv?.username || 'ctv_user';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://locketgold.click';

  // Dynamic Postman Collection JSON with all 5 CTV APIs
  const postmanCollectionObj = {
    info: {
      name: "🚀 LOCKET GOLD CTV API ENTERPRISE COLLECTION",
      description: "Bộ API chuẩn chính thức dành cho Cộng tác viên (CTV) tích hợp hệ thống Nâng cấp Locket Gold 24/7",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: "1. Kích Hoạt Gold 1 Năm (POST /api/v1/ctv/gold)",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
            { key: "x-api-key", value: activeKey, type: "text", description: "API Key riêng của CTV" }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({ user: "vanle" }, null, 2)
          },
          url: {
            raw: `${baseUrl}/api/v1/ctv/gold`,
            protocol: baseUrl.startsWith("https") ? "https" : "http",
            host: [baseUrl.replace(/^https?:\/\//, "")],
            path: ["api", "v1", "ctv", "gold"]
          }
        },
        response: [
          {
            name: "200 Success - Kích hoạt Gold thành công (Trừ 1 lượt gói)",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "🎉 Kích hoạt Locket Gold 1 Năm HOÀN TẤT cho @vanle!"
            }, null, 2)
          },
          {
            name: "200 Info - Tài khoản đã có Gold (Lượt gói giữ nguyên)",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "info",
              already_has_gold: true,
              message: "ℹ️ Tài khoản @vanle đã có Locket Gold active từ trước."
            }, null, 2)
          },
          {
            name: "400 Bad Request - Hết lượt gói (0 lượt)",
            status: "Bad Request",
            code: 400,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 400,
              message: "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!"
            }, null, 2)
          },
          {
            name: "401 Unauthorized - API Key sai hoặc bị khóa",
            status: "Unauthorized",
            code: 401,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 401,
              message: "Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa."
            }, null, 2)
          },
          {
            name: "403 Forbidden - Username Locket bị KHÓA",
            status: "Forbidden",
            code: 102,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 102,
              message: "Tài khoản @vanle đã bị KHÓA (Banned) trên hệ thống!"
            }, null, 2)
          },
          {
            name: "500 Server Error - Thất bại & Hoàn lại 1 lượt gói",
            status: "Internal Server Error",
            code: 500,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 500,
              message: "Kích hoạt Gold thất bại: Lỗi kết nối máy chủ kích hoạt Gold. Đã hoàn lại 1 lượt gói cho CTV!"
            }, null, 2)
          }
        ]
      },
      {
        name: "2. Kích Hoạt Gold 1 Năm Theo Lượt Gói (POST /api/v1/ctv/gold-package)",
        request: {
          method: "POST",
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
            { key: "x-api-key", value: activeKey, type: "text", description: "API Key riêng của CTV" }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify({ user: "vanle" }, null, 2)
          },
          url: {
            raw: `${baseUrl}/api/v1/ctv/gold-package`,
            protocol: baseUrl.startsWith("https") ? "https" : "http",
            host: [baseUrl.replace(/^https?:\/\//, "")],
            path: ["api", "v1", "ctv", "gold-package"]
          }
        },
        response: [
          {
            name: "200 Success - Trừ 1 lượt gói thành công",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "🎉 Kích hoạt Gold 1 Năm bằng Lượt Gói THÀNH CÔNG cho @vanle!"
            }, null, 2)
          },
          {
            name: "400 Bad Request - Hết lượt gói (0 lượt)",
            status: "Bad Request",
            code: 400,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "error",
              code: 400,
              message: "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!"
            }, null, 2)
          }
        ]
      },
      {
        name: "3. Tra Cứu Số Dư Ví & Lượt Gói CTV (GET /api/v1/ctv/me)",
        request: {
          method: "GET",
          header: [
            { key: "x-api-key", value: activeKey, type: "text" }
          ],
          url: {
            raw: `${baseUrl}/api/v1/ctv/me`,
            protocol: baseUrl.startsWith("https") ? "https" : "http",
            host: [baseUrl.replace(/^https?:\/\//, "")],
            path: ["api", "v1", "ctv", "me"]
          }
        },
        response: [
          {
            name: "200 Success - Thông tin tài khoản CTV",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              message: "Chào mừng CTV @dinhmanh!",
              data: {
                username: "dinhmanh",
                displayName: "Đình Mạnh CTV",
                balance: 4165900,
                remaining_requests: 249,
                prices: {
                  "1year": 65000
                },
                active: true
              }
            }, null, 2)
          }
        ]
      },
      {
        name: "4. Tra Cứu Lịch Sử Đơn Hàng CTV (GET /api/v1/ctv/orders)",
        request: {
          method: "GET",
          header: [
            { key: "x-api-key", value: activeKey, type: "text" }
          ],
          url: {
            raw: `${baseUrl}/api/v1/ctv/orders`,
            protocol: baseUrl.startsWith("https") ? "https" : "http",
            host: [baseUrl.replace(/^https?:\/\//, "")],
            path: ["api", "v1", "ctv", "orders"]
          }
        },
        response: [
          {
            name: "200 Success - Lịch sử đơn hàng",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              status: "success",
              orders: [
                {
                  orderId: "CTV_ORD_1785663510688_jyo2",
                  userUpgraded: "vanle",
                  packageId: "1year",
                  amount: 65000,
                  createdAt: "2026-08-06T18:30:00.000Z"
                }
              ]
            }, null, 2)
          }
        ]
      },
      {
        name: "5. Tra Cứu Profile & Status Locket (GET /api/v1/userinfo)",
        request: {
          method: "GET",
          header: [],
          url: {
            raw: `${baseUrl}/api/v1/userinfo?user=vanle`,
            protocol: baseUrl.startsWith("https") ? "https" : "http",
            host: [baseUrl.replace(/^https?:\/\//, "")],
            path: ["api", "v1", "userinfo"],
            query: [
              {
                key: "user",
                value: "vanle"
              }
            ]
          }
        },
        response: [
          {
            name: "200 Success - Profile Locket Live",
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: JSON.stringify({
              username: "vanle",
              displayName: "Văn Lê",
              uid: "3SpzULZxvMVoV53tE8SrSqD3",
              isGold: true,
              badge: "Locket Gold"
            }, null, 2)
          }
        ]
      }
    ]
  };

  const postmanJsonString = JSON.stringify(postmanCollectionObj, null, 2);

  // Run live API Request directly in page
  const handleExecuteLiveApi = async () => {
    setIsRunningApi(true);
    setApiResponse(null);
    const startTime = performance.now();

    const cleanTarget = testUser.replace(/^@/, '').trim();

    try {
      let res: Response;
      if (activeEndpoint === 'userinfo') {
        res = await fetch(`/api/v1/userinfo?user=${encodeURIComponent(cleanTarget)}`);
      } else if (activeEndpoint === 'me') {
        res = await fetch('/api/v1/ctv/me', {
          headers: { 'x-api-key': activeKey }
        });
      } else if (activeEndpoint === 'orders') {
        res = await fetch('/api/v1/ctv/orders', {
          headers: { 'x-api-key': activeKey }
        });
      } else if (activeEndpoint === 'gold-package') {
        res = await fetch('/api/v1/ctv/gold-package', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeKey
          },
          body: JSON.stringify({ user: cleanTarget })
        });
      } else {
        res = await fetch('/api/v1/ctv/gold', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': activeKey
          },
          body: JSON.stringify({
            user: cleanTarget,
            category: testCategory
          })
        });
      }

      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      const data = await res.json().catch(() => ({ message: 'Không thể đọc phản hồi JSON' }));

      setApiResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : 'Error'),
        timeMs,
        data
      });
    } catch (err: any) {
      setApiResponse({
        status: 500,
        statusText: 'Network Error',
        timeMs: 0,
        data: { success: false, error: err?.message || 'Lỗi kết nối máy chủ' }
      });
    } finally {
      setIsRunningApi(false);
    }
  };

  // Dynamic code snippets based on selected endpoint & language
  const getSnippets = () => {
    const cleanUser = testUser || 'vanle';
    if (activeEndpoint === 'userinfo') {
      return {
        curl: `curl -X GET "${baseUrl}/api/v1/userinfo?user=${cleanUser}"`,
        js: `fetch("${baseUrl}/api/v1/userinfo?user=${cleanUser}")
  .then(res => res.json())
  .then(data => console.log(data));`,
        python: `import requests
response = requests.get("${baseUrl}/api/v1/userinfo", params={"user": "${cleanUser}"})
print(response.json())`,
        php: `<?php
$response = file_get_contents("${baseUrl}/api/v1/userinfo?user=" . urlencode("${cleanUser}"));
echo $response;`
      };
    }

    if (activeEndpoint === 'me') {
      return {
        curl: `curl -X GET "${baseUrl}/api/v1/ctv/me" -H "x-api-key: ${activeKey}"`,
        js: `fetch("${baseUrl}/api/v1/ctv/me", { headers: { "x-api-key": "${activeKey}" } })
  .then(res => res.json())
  .then(data => console.log(data));`,
        python: `import requests
response = requests.get("${baseUrl}/api/v1/ctv/me", headers={"x-api-key": "${activeKey}"})
print(response.json())`,
        php: `<?php
$ch = curl_init("${baseUrl}/api/v1/ctv/me");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: ${activeKey}"]);
echo curl_exec($ch);`
      };
    }

    if (activeEndpoint === 'orders') {
      return {
        curl: `curl -X GET "${baseUrl}/api/v1/ctv/orders" -H "x-api-key: ${activeKey}"`,
        js: `fetch("${baseUrl}/api/v1/ctv/orders", { headers: { "x-api-key": "${activeKey}" } })
  .then(res => res.json())
  .then(data => console.log(data));`,
        python: `import requests
response = requests.get("${baseUrl}/api/v1/ctv/orders", headers={"x-api-key": "${activeKey}"})
print(response.json())`,
        php: `<?php
$ch = curl_init("${baseUrl}/api/v1/ctv/orders");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: ${activeKey}"]);
echo curl_exec($ch);`
      };
    }

    if (activeEndpoint === 'gold-package') {
      return {
        curl: `curl -X POST "${baseUrl}/api/v1/ctv/gold-package" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKey}" \\
  -d '{"user": "${cleanUser}"}'`,
        js: `fetch("${baseUrl}/api/v1/ctv/gold-package", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${activeKey}"
  },
  body: JSON.stringify({ user: "${cleanUser}" })
})
.then(res => res.json())
.then(data => console.log(data));`,
        python: `import requests
url = "${baseUrl}/api/v1/ctv/gold-package"
headers = {"Content-Type": "application/json", "x-api-key": "${activeKey}"}
response = requests.post(url, json={"user": "${cleanUser}"}, headers=headers)
print(response.json())`,
        php: `<?php
$ch = curl_init("${baseUrl}/api/v1/ctv/gold-package");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "x-api-key: ${activeKey}"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["user" => "${cleanUser}"]));
echo curl_exec($ch);`
      };
    }

    return {
      curl: `curl -X POST "${baseUrl}/api/v1/ctv/gold" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${activeKey}" \\
  -d '{"user": "${cleanUser}", "category": "${testCategory}"}'`,
      js: `fetch("${baseUrl}/api/v1/ctv/gold", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${activeKey}"
  },
  body: JSON.stringify({
    user: "${cleanUser}",
    category: "${testCategory}"
  })
})
.then(res => res.json())
.then(data => console.log(data));`,
      python: `import requests
url = "${baseUrl}/api/v1/ctv/gold"
headers = {"Content-Type": "application/json", "x-api-key": "${activeKey}"}
payload = {"user": "${cleanUser}", "category": "${testCategory}"}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`,
      php: `<?php
$ch = curl_init("${baseUrl}/api/v1/ctv/gold");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "x-api-key: ${activeKey}"]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["user" => "${cleanUser}", "category" => "${testCategory}"]));
echo curl_exec($ch);`
    };
  };

  const codeSnippets = getSnippets();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#080a0f] text-slate-900 dark:text-white font-sans flex flex-col pt-16 transition-colors duration-300">
      <Navbar isLoggedIn={!!token && !!ctv} username={ctv?.username} />

      {/* Ambient Lights */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-orange-500/10 dark:bg-orange-700/10 rounded-full blur-[180px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-700/8 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── HEADER BANNER POSTMAN INTERACTIVE ── */}
        <div className="rounded-2xl bg-linear-to-r from-orange-100/90 via-white to-amber-100/90 dark:from-orange-950/40 dark:via-[#0f1117] dark:to-amber-950/30 p-6 sm:p-8 border border-orange-500/30 shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Postman API Interactive Documentation</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 font-bold text-[11px]">Postman Live Ready</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">Tài liệu và công cụ thử nghiệm API Tra cứu User Locket & Kích hoạt Gold trực tiếp</p>
            </div>
          </div>

          {/* Context Banner: Logged in vs Guest */}
          {ctv ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Đã tự động kết nối tài khoản CTV @{activeUser}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 font-mono text-[10px]">Ví: {ctv.balance.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                  API Key của bạn: <strong className="text-amber-600 dark:text-amber-400 select-all">{activeKey}</strong>
                </div>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(activeKey); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Đã copy Key!' : 'Sao chép API Key'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Bạn truy cập tự do. Đăng nhập Portal CTV để tự động điền <strong>API Key thật & Số dư</strong> của bạn!</span>
              </div>
              <a href="/" className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all shadow shrink-0">
                🔐 Đăng Nhập CTV
              </a>
            </div>
          )}
        </div>

        {/* ── 🚀 LIVE POSTMAN INTERACTIVE API RUNNER SANDBOX 🚀 ── */}
        <div className="rounded-2xl bg-white dark:bg-[#0f1117] border-2 border-orange-500/30 shadow-xl p-6 sm:p-8 space-y-6">
          
          {/* Endpoint Selector Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-orange-500 fill-current" />
                <span>Trình Chạy Thử API Trực Tiếp (Postman Playground)</span>
              </h2>
              <span className="text-xs text-slate-400">Chọn API cần kiểm tra bên dưới</span>
            </div>

            <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10">
              {[
                { id: 'gold', label: 'Nạp Số Dư', path: '/gold', icon: <Crown className="w-3.5 h-3.5" /> },
                { id: 'gold-package', label: 'Nạp Lượt Gói', path: '/gold-package', icon: <Zap className="w-3.5 h-3.5" /> },
                { id: 'me', label: 'Thông Tin Ví', path: '/me', icon: <UserCheck className="w-3.5 h-3.5" /> },
                { id: 'orders', label: 'Lịch Sử Đơn', path: '/orders', icon: <Terminal className="w-3.5 h-3.5" /> },
                { id: 'userinfo', label: 'Tra User', path: '/userinfo', icon: <Search className="w-3.5 h-3.5" /> },
              ].map(ep => {
                const isActive = activeEndpoint === ep.id;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setActiveEndpoint(ep.id as any)}
                    className={`flex-1 min-w-[110px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5'
                    }`}
                  >
                    {ep.icon}
                    <span>{ep.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Header info indicator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 gap-2 sm:gap-3 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 max-w-full flex-1">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black shrink-0 ${
                  (activeEndpoint === 'userinfo' || activeEndpoint === 'me' || activeEndpoint === 'orders') ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-purple-500/20 text-purple-600 dark:text-purple-300'
                }`}>
                  {activeEndpoint === 'userinfo' || activeEndpoint === 'me' || activeEndpoint === 'orders' ? 'GET' : 'POST'}
                </span>
                <code className="font-mono text-[11px] sm:text-xs text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0 select-all">
                  {baseUrl}{activeEndpoint === 'userinfo' ? `/api/v1/userinfo?user=${testUser || 'vanle'}` : activeEndpoint === 'me' ? '/api/v1/ctv/me' : activeEndpoint === 'orders' ? '/api/v1/ctv/orders' : activeEndpoint === 'gold-package' ? '/api/v1/ctv/gold-package' : '/api/v1/ctv/gold'}
                </code>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0 font-medium self-end sm:self-center">
                {activeEndpoint === 'userinfo' ? 'Miễn phí (No Key)' : '🔒 Cần x-api-key'}
              </span>
            </div>

            {/* API Key Header Input & Custom Edit Controls */}
            {activeEndpoint !== 'userinfo' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mã API Key (<code className="text-amber-600 dark:text-amber-400 font-mono">x-api-key</code>) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRegenRandomKey}
                      disabled={isSavingKey}
                      className="text-[11px] font-bold text-slate-500 hover:text-purple-500 dark:text-slate-400 dark:hover:text-purple-400 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSavingKey ? 'animate-spin' : ''}`} />
                      Tạo ngẫu nhiên
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customKey}
                    onChange={e => setCustomKey(e.target.value)}
                    placeholder="Nhập API Key của bạn (VD: ctv_key_custom123)..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-white/10 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                  />
                  {token && (
                    <button
                      type="button"
                      onClick={handleSaveCustomKey}
                      disabled={isSavingKey || !customKey}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isSavingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                      Lưu Key Này
                    </button>
                  )}
                </div>

                {saveKeyNotice && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    saveKeyNotice.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}>
                    {saveKeyNotice.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{saveKeyNotice.msg}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Target Locket User */}
              {(activeEndpoint === 'gold' || activeEndpoint === 'gold-package' || activeEndpoint === 'userinfo') && (
                <div className={activeEndpoint === 'userinfo' || activeEndpoint === 'gold-package' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Username Locket <code className="text-purple-600 dark:text-purple-400 font-mono">{activeEndpoint === 'userinfo' ? 'query "user"' : 'body "user"'}</code> *
                </label>
                <input
                  type="text"
                  value={testUser}
                  onChange={e => setTestUser(extractLocketUsername(e.target.value))}
                  onPaste={e => {
                    const text = e.clipboardData.getData('text');
                    if (text) {
                      e.preventDefault();
                      setTestUser(extractLocketUsername(text));
                    }
                  }}
                  placeholder="Nhập username hoặc dán link Locket (locket.cam/...)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-white/10 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              )}

              {/* Package category (Only for Gold) */}
              {activeEndpoint === 'gold' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Body parameter <code className="text-purple-600 dark:text-purple-400 font-mono">"category"</code> *
                  </label>
                  <select
                    value={testCategory}
                    onChange={e => setTestCategory(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-white/10 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                  >
                    <option value="yearly">yearly (Kích hoạt 1 Năm)</option>
                    <option value="lifetime">lifetime (Kích hoạt Vĩnh Viễn)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={handleExecuteLiveApi}
              disabled={isRunningApi || (activeEndpoint !== 'userinfo' && !activeKey) || ((activeEndpoint === 'gold' || activeEndpoint === 'gold-package' || activeEndpoint === 'userinfo') && !testUser)}
              className={`w-full py-3.5 rounded-xl text-white font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                activeEndpoint === 'userinfo'
                  ? 'bg-linear-to-r from-purple-600 to-indigo-600 shadow-purple-500/20 hover:opacity-95'
                  : 'bg-linear-to-r from-orange-600 via-amber-600 to-yellow-500 shadow-orange-500/20 hover:opacity-95'
              }`}
            >
              {isRunningApi ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Đang gửi Request...</>
              ) : (
                <><Play className="w-4 h-4 fill-current" /> ▶ Send Request</>
              )}
            </button>

            {/* Live Response Box */}
            <AnimatePresence>
              {apiResponse && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black ${
                        apiResponse.status === 200 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}>
                        STATUS: {apiResponse.status} {apiResponse.statusText}
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">Time: {apiResponse.timeMs} ms</span>
                    </div>
                  </div>

                  <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-emerald-400 border border-slate-800 overflow-x-auto whitespace-pre">
                    {JSON.stringify(apiResponse.data, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── NÚT TẢI FILE POSTMAN COLLECTION JSON ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.07] shadow-sm space-y-3">
            <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-orange-500" />
              <span>Cách 1: Tải File Postman Collection (.json)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tải tệp JSON đính kèm gồm đầy đủ <strong>API Tra Cứu User</strong> & <strong>API Kích Hoạt Gold</strong> về máy, mở Postman và bấm nút <strong>Import</strong>.
            </p>
            <a
              href="/api/v1/ctv/postman-collection"
              download="LocketGold_CTV_PostmanCollection.json"
              className="inline-flex items-center gap-2 w-full justify-center py-3 rounded-xl bg-linear-to-r from-orange-600 to-amber-600 hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>📥 Tải File JSON Postman Collection</span>
            </a>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.07] shadow-sm space-y-3">
            <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Copy className="w-4 h-4 text-purple-500" />
              <span>Cách 2: Copy Mã JSON Trực Tiếp</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Copy toàn bộ đoạn mã Postman Collection JSON để dán trực tiếp vào mục Import Raw Text trên ứng dụng Postman.
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(postmanJsonString); setCopiedJson(true); setTimeout(() => setCopiedJson(false), 2000); }}
              className="inline-flex items-center gap-2 w-full justify-center py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 font-extrabold text-xs transition-all cursor-pointer"
            >
              {copiedJson ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copiedJson ? 'Đã Copy Mã JSON!' : 'Copy Mã Postman JSON'}</span>
            </button>
          </div>
        </div>

        {/* ── CODE GENERATOR MULTI-LANGUAGE ── */}
        <div className="rounded-2xl bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.07] p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-500" />
              <span>
                Mã Nguồn Tích Hợp:{' '}
                {activeEndpoint === 'gold' && '👑 Kích Hoạt Gold Theo Số Dư Ví (/api/v1/ctv/gold)'}
                {activeEndpoint === 'gold-package' && '📦 Kích Hoạt Gold 1 Năm Theo Lượt Gói (/api/v1/ctv/gold-package)'}
                {activeEndpoint === 'me' && '💰 Tra Cứu Số Dư Ví & Lượt Gói (/api/v1/ctv/me)'}
                {activeEndpoint === 'orders' && '📜 Tra Cứu Lịch Sử Đơn Hàng (/api/v1/ctv/orders)'}
                {activeEndpoint === 'userinfo' && '🔍 Tra Cứu Profile & Status Locket (/api/v1/userinfo)'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-xs font-bold">
              {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer uppercase ${
                    selectedLang === lang
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl bg-slate-900 dark:bg-black/60 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre border border-slate-800 dark:border-white/10">{codeSnippets[selectedLang]}</pre>

            <button
              onClick={() => { navigator.clipboard.writeText(codeSnippets[selectedLang]); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur"
            >
              {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Đã Chép!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* ── ⚠️ BẢNG MÃ TRẠNG THÁI & LỖI API CHI TIẾT (ERROR RESPONSES GUIDE) ── */}
        <div className="rounded-2xl bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="border-b border-slate-200 dark:border-white/10 pb-5 space-y-4">
            {/* Row 1: Title & Subtitle (Full Width) */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                  Bảng Mã Trạng Thái & Lỗi Có Thể Xảy Ra (API Error Guide)
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Danh sách chi tiết tất cả các HTTP Status Code, Mã lỗi và đại diện JSON Payload trả về để bạn xử lý ngoại lệ trong code
              </p>
            </div>

            {/* Row 2: Filter Pills (Full Width) */}
            <div className="flex items-center flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-[#161a26] border border-slate-200 dark:border-white/10 text-xs font-bold w-full">
              {[
                { id: 'all', label: 'Tất cả mã' },
                { id: '200', label: '200 (Success / Info)' },
                { id: '400', label: '400 (Bad Request)' },
                { id: '401', label: '401 (Unauthorized)' },
                { id: '403', label: '403 (Banned)' },
                { id: '500', label: '500 / 429 (Lỗi / Rate limit)' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setErrorFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    errorFilter === tab.id
                      ? 'bg-orange-500 text-white font-black shadow-md shadow-orange-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Error Response Cards */}
          <div className="space-y-4">
            {[
              {
                id: 'err_200_ok',
                status: 200,
                statusText: '200 OK',
                code: undefined,
                badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                title: '🎉 Kích Hoạt Locket Gold Thành Công (Success)',
                category: '200',
                description: 'Đơn hàng được xử lý hoàn tất trong 0.3s - 1s. Số dư ví hoặc 1 lượt gói của CTV đã bị trừ.',
                solution: 'Lưu lại `order_id` vào cơ sở dữ liệu của bạn và báo khách hàng mở ứng dụng Locket để thấy huy hiệu Gold.',
                json: {
                  status: "success",
                  message: "🎉 Kích hoạt Locket Gold HOÀN TẤT cho @vanle!",
                  data: {
                    ctv_username: "dinhmanh",
                    user_upgraded: "vanle",
                    package: "1year",
                    amount_deducted: 65000,
                    new_balance: 185000,
                    order_id: "CTV_ORD_1785663510688_jyo2",
                    activation: { ok: true }
                  }
                }
              },
              {
                id: 'err_200_already',
                status: 200,
                statusText: '200 OK (Info)',
                code: undefined,
                badgeColor: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
                title: 'ℹ️ Tài Khoản Đã Có Gold Active Từ Trước (Already Has Gold)',
                category: '200',
                description: 'Username Locket của khách đã active Gold sẵn trên hệ thống. Số dư ví/lượt gói của CTV giữ nguyên 100% (không bị trừ tiền).',
                solution: 'Xử lý logic thành công, giữ nguyên số dư CTV và thông báo khách hàng tài khoản đã có Gold.',
                json: {
                  status: "info",
                  already_has_gold: true,
                  message: "ℹ️ Tài khoản @vanle đã có Locket Gold active từ trước. Số dư CTV giữ nguyên 100%!",
                  data: {
                    ctv_username: "dinhmanh",
                    user_upgraded: "vanle",
                    package: "1year",
                    amount_deducted: 0,
                    new_balance: 250000,
                    activation: { already_has_gold: true }
                  }
                }
              },
              {
                id: 'err_401_missing',
                status: 401,
                statusText: '401 Unauthorized',
                code: 401,
                badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
                title: '🔐 Thiếu API Token Key Xác Minh',
                category: '401',
                description: 'Yêu cầu không tìm thấy API Key ở Header (`x-api-key`, `Authorization`) hoặc URL parameter (`token`).',
                solution: 'Đảm bảo truyền Header `x-api-key: ctv_key_xxx` hoặc đính kèm `?token=ctv_key_xxx` trong Request.',
                json: {
                  status: "error",
                  code: 401,
                  message: "Thiếu API Token Key xác minh! Vui lòng truyền key qua Header (x-api-key / Bearer token) hoặc tham số (token / api_key)."
                }
              },
              {
                id: 'err_401_invalid',
                status: 401,
                statusText: '401 Unauthorized',
                code: 401,
                badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
                title: '🔒 API Key Không Chính Xác Hoặc Account Bị Khóa',
                category: '401',
                description: 'Mã API Token Key không khớp với tài khoản CTV nào hoặc tài khoản CTV của bạn đã bị tạm khóa.',
                solution: 'Truy cập Portal CTV để lấy đúng API Key thật hoặc liên hệ Quản trị viên kiểm tra trạng thái tài khoản.',
                json: {
                  status: "error",
                  code: 401,
                  message: "Xác minh thất bại! API Token Key không chính xác hoặc tài khoản CTV của bạn đã bị khóa."
                }
              },
              {
                id: 'err_400_balance',
                status: 400,
                statusText: '400 Bad Request',
                code: 400,
                badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                title: '💰 Số Dư Ví CTV Không Đủ (Insufficient Balance)',
                category: '400',
                description: 'Số dư hiện tại trong ví CTV nhỏ hơn số tiền của gói nâng cấp (`yearly`: 65k, `lifetime`: 350k).',
                solution: 'Kiểm tra `code === 400` và thông báo CTV nạp thêm tiền vào website, hoặc gợi ý đổi qua API nạp theo lượt gói.',
                json: {
                  status: "error",
                  code: 400,
                  message: "Số dư CTV không đủ! Số dư hiện tại: 20.000đ, giá gói: 65.000đ. Vui lòng nạp thêm tiền vào website!",
                  current_balance: 20000,
                  required_amount: 65000
                }
              },
              {
                id: 'err_400_quota',
                status: 400,
                statusText: '400 Bad Request',
                code: 400,
                badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                title: '📦 Hết Lượt Gói Nạp Gold 1 Năm (Out of Quota)',
                category: '400',
                description: 'Gọi API kích hoạt lượt gói `/api/v1/ctv/gold-package` nhưng kho lượt gói của CTV hiện đang là 0 lượt.',
                solution: 'Vào Portal CTV mua thêm gói lượt chiết khấu (50, 100, 500 lượt) hoặc chuyển sang dùng API ví `/gold`.',
                json: {
                  status: "error",
                  code: 400,
                  message: "Kho lượt gói nạp 1 Năm của bạn đã HẾT (0 lượt). Vui lòng mua thêm gói lượt trên website CTV!",
                  remaining_requests: 0
                }
              },
              {
                id: 'err_400_user',
                status: 400,
                statusText: '400 Bad Request',
                code: 400,
                badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
                title: '❌ Thiếu Tham Số Username Locket',
                category: '400',
                description: 'Request không chứa thông tin username Locket cần nâng cấp.',
                solution: 'Truyền tham số `user` hoặc `username` trong JSON Request Body (với POST) hoặc URL (với GET).',
                json: {
                  status: "error",
                  code: 400,
                  message: "Vui lòng truyền tham số user (Username Locket cần nâng cấp Gold)."
                }
              },
              {
                id: 'err_403_banned',
                status: 403,
                statusText: '403 Forbidden',
                code: 102,
                badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
                title: '🚫 Tài Khoản Locket Bị KHÓA (Banned User)',
                category: '403',
                description: 'Username Locket này nằm trong danh sách đen bị khóa nạp do vi phạm bùng tiền hoặc gian lận.',
                solution: 'Thông báo lại với khách hàng không thể nạp cho tài khoản này. Hệ thống không trừ tiền CTV.',
                json: {
                  status: "error",
                  code: 102,
                  message: "Tài khoản @vanle đã bị KHÓA (Banned) trên hệ thống do vi phạm bùng tiền!"
                }
              },
              {
                id: 'err_500_refund',
                status: 500,
                statusText: '500 Internal Server Error',
                code: 500,
                badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
                title: '⚠️ Kích Hoạt Thất Bại & Đã Hoàn Tiền 100%',
                category: '500',
                description: 'Máy chủ xử lý kích hoạt bị gián đoạn kết nối tới Locket. Hệ thống tự động hoàn 100% tiền/lượt lại cho CTV ngay lập tức.',
                solution: 'Chờ vài giây và bấm thử lại đơn hàng hoặc báo khách gửi lại đúng username Locket.',
                json: {
                  status: "error",
                  code: 500,
                  message: "Kích hoạt Gold thất bại: Lỗi kết nối máy chủ kích hoạt Gold. Số dư đã được hoàn lại 100%!",
                  current_balance: 250000
                }
              },
              {
                id: 'err_429_rate',
                status: 429,
                statusText: '429 Too Many Requests',
                code: 429,
                badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
                title: '⚡ Vượt Giới Hạn Tần Suất Gọi API (Rate Limit Exceeded)',
                category: '500',
                description: 'Vượt quá hạn ngạch 60 request/phút từ cùng một IP hoặc cùng một API Key.',
                solution: 'Đặt thời gian chờ (delay/sleep 500ms) giữa các request trong vòng lặp cURL hoặc mã nguồn tự động của bạn.',
                json: {
                  status: "error",
                  code: 429,
                  message: "Bạn đã gửi quá nhiều yêu cầu liên tục. Vui lòng thử lại sau ít phút!"
                }
              }
            ]
              .filter(item => errorFilter === 'all' || item.category === errorFilter)
              .map(item => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-[#121520] border border-slate-200 dark:border-slate-800/80 space-y-3.5 transition-all hover:border-orange-500/40 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border ${item.badgeColor}`}>
                        {item.statusText}
                      </span>
                      {item.code && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-[11px] font-mono text-slate-800 dark:text-slate-200 font-bold">
                          code: {item.code}
                        </span>
                      )}
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{item.title}</h3>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(item.json, null, 2));
                        setCopiedErrId(item.id);
                        setTimeout(() => setCopiedErrId(null), 2000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {copiedErrId === item.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedErrId === item.id ? 'Đã Copy JSON!' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong className="text-slate-800 dark:text-slate-200 font-bold">Nguyên nhân:</strong> {item.description}
                  </p>

                  <div className="p-3 rounded-xl bg-orange-500/10 dark:bg-orange-950/25 border border-orange-500/20 text-xs text-orange-900 dark:text-orange-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong className="font-bold">Cách xử lý khuyên dùng:</strong> {item.solution}
                    </div>
                  </div>

                  <pre className="p-4 rounded-xl bg-[#0a0d14] font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre border border-slate-800/90 shadow-inner">
                    {JSON.stringify(item.json, null, 2)}
                  </pre>
                </div>
              ))}
          </div>
        </div>


      </div>

      <Footer />
    </div>
  );
};

export default PostmanDocsPage;


