import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, CheckCircle2, Download, Search, ShieldCheck,
  XCircle, Info, Lock, BookOpen, Code2, Wifi, Crown, RefreshCw, Send, ArrowRight, Play, ExternalLink, HelpCircle, Sparkles, Check
} from 'lucide-react';
import { Navbar } from '../sections/Navbar';
import { Footer } from '../sections/Footer';

// ─── Dual Light/Dark UI Components ───────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl bg-white dark:bg-[#0f1117] border border-slate-200/80 dark:border-white/[0.07] shadow-sm dark:shadow-none ${className}`}>{children}</div>
);

const Badge: React.FC<{ color: 'green' | 'red' | 'amber' | 'purple' | 'blue'; children: React.ReactNode }> = ({ color, children }) => {
  const map = {
    green:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    red:    'bg-rose-500/10    text-rose-600    dark:text-rose-400    border-rose-500/20',
    amber:  'bg-amber-500/10   text-amber-600   dark:text-amber-400   border-amber-500/20',
    purple: 'bg-purple-500/10  text-purple-600  dark:text-purple-400  border-purple-500/20',
    blue:   'bg-blue-500/10    text-blue-600    dark:text-blue-400    border-blue-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${map[color]}`}>
      {children}
    </span>
  );
};

const CopyBtn: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} title="Copy" className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5 shrink-0 border border-slate-200 dark:border-white/10">
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
      <span>{copied ? 'Đã chép!' : (label || 'Sao chép')}</span>
    </button>
  );
};

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang = 'json' }) => {
  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10">
        <CopyBtn text={code} label="Sao chép" />
      </div>
      <pre className="p-4 rounded-xl bg-slate-900 dark:bg-black/60 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed border border-slate-800 dark:border-white/[0.05] text-emerald-400 dark:text-emerald-300">{code}</pre>
    </div>
  );
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://locketgold.click';

// ─── Main Component ───────────────────────────────────────────────────────────
export const ApiDocsPage: React.FC = () => {
  // Playground state for non-coders
  const [testKey, setTestKey] = useState('');
  const [testUser, setTestUser] = useState('vanle');
  const [testPkg, setTestPkg] = useState<'yearly' | 'lifetime'>('yearly');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [codeTab, setCodeTab] = useState<'curl' | 'js' | 'php' | 'python'>('curl');

  const testLink = `${BASE_URL}/api/v1/ctv/gold?token=${testKey || 'YOUR_KEY'}&user=${testUser || 'username'}&category=${testPkg}`;

  const runTestApi = async () => {
    if (!testKey.trim() || !testUser.trim()) {
      setTestResult({ status: 'error', message: 'Vui lòng nhập API Key và Username khách để chạy thử!' });
      return;
    }
    setIsTesting(true); setTestResult(null);
    try {
      const res = await fetch(`/api/v1/ctv/gold?token=${encodeURIComponent(testKey.trim())}&user=${encodeURIComponent(testUser.trim())}&category=${testPkg}`);
      const data = await res.json();
      setTestResult(data);
    } catch (_e) {
      setTestResult({ status: 'error', message: 'Không thể kết nối đến máy chủ API.' });
    } finally {
      setIsTesting(false);
    }
  };

  const codeSnippets: Record<string, string> = {
    curl: `curl -X POST "${BASE_URL}/api/v1/ctv/gold" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${testKey || 'YOUR_API_KEY'}" \\
  -d '{"user": "${testUser || 'vanle'}", "category": "${testPkg}"}'`,

    js: `// Node.js hoặc JavaScript Fetch
const res = await fetch("${BASE_URL}/api/v1/ctv/gold", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${testKey || 'YOUR_API_KEY'}"
  },
  body: JSON.stringify({
    user: "${testUser || 'vanle'}",
    category: "${testPkg}"
  })
});
console.log(await res.json());`,

    php: `<?php
// PHP cURL (Dành cho Web Shop / Panel Bán Hàng)
$apiKey = "${testKey || 'YOUR_API_KEY'}";
$url = "${BASE_URL}/api/v1/ctv/gold";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(["user" => "${testUser || 'vanle'}", "category" => "${testPkg}"]),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'x-api-key: ' . $apiKey]
]);

$result = json_decode(curl_exec($ch), true);
curl_close($ch);
print_r($result);
?>`,

    python: `import requests

res = requests.post(
    "${BASE_URL}/api/v1/ctv/gold",
    json={"user": "${testUser || 'vanle'}", "category": "${testPkg}"},
    headers={"x-api-key": "${testKey || 'YOUR_API_KEY'}"}
)
print(res.json())`,
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#080a0f] text-slate-900 dark:text-white font-sans flex flex-col pt-16 transition-colors duration-300">
      <Navbar />

      {/* Ambient Light */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-purple-500/10 dark:bg-purple-700/10 rounded-full blur-[180px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-700/8 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 py-8 space-y-10">

        {/* ── BANNER ĐƠN GIẢN CHO NGƯỜI KHÔNG BIẾT CODE ── */}
        <Card className="p-6 sm:p-8 bg-linear-to-r from-purple-100/90 via-white to-indigo-100/90 dark:from-purple-900/20 dark:via-[#0f1117] dark:to-indigo-900/20 border-purple-500/30 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Hướng Dẫn Tích Hợp API CTV</h1>
                <Badge color="green">Dễ hiểu 100%</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Dành cho chủ Shop, người bán Locket Gold hoặc thợ làm website</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
            <div className="font-extrabold text-purple-600 dark:text-purple-400 text-sm flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> API là gì và nó giúp ích gì cho bạn?
            </div>
            <p>
              <strong>API</strong> giống như một "chú thợ phụ tự động". Khi khách mua Locket Gold trên website/shop của bạn, website sẽ tự động nhắn cho hệ thống Locket Gold nâng cấp cho khách ngay lập tức trong <strong>3 giây</strong> mà bạn <strong>KHÔNG CẦN BẤM TAY THỦ CÔNG!</strong>
            </p>
          </div>
        </Card>

        {/* ── 3 BƯỚC THỰC HIỆN DỄ DÀNG ── */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <span>3 Bước Để Shop Của Bạn Tự Động Kích Hoạt Gold</span>
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="p-5 space-y-2 border-purple-500/20">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-sm flex items-center justify-center">
                1
              </div>
              <div className="font-black text-sm text-slate-900 dark:text-white">Lấy API Key Cá Nhân</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Đăng nhập vào Portal CTV của bạn, tìm mục <strong className="text-amber-600 dark:text-amber-400">API Key</strong> và bấm Copy.
              </p>
            </Card>

            <Card className="p-5 space-y-2 border-indigo-500/20">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center justify-center">
                2
              </div>
              <div className="font-black text-sm text-slate-900 dark:text-white">Gửi Cho Thợ Làm Web</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Gửi Key API và link hướng dẫn này cho thợ làm website / shop của bạn để họ dán vào web.
              </p>
            </Card>

            <Card className="p-5 space-y-2 border-emerald-500/20">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center">
                3
              </div>
              <div className="font-black text-sm text-slate-900 dark:text-white">Bán Hàng Tự Động 24/7</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Khách mua hàng trên shop → Gold tự nhảy trong 3s → Tiền ví CTV tự trừ → Nhận báo qua Telegram!
              </p>
            </Card>
          </div>
        </div>

        {/* ── CÔNG CỤ CHẠY THỬ API TRỰC TIẾP (NO-CODE TEST TOOL) ── */}
        <Card className="p-6 sm:p-8 border-purple-500/30 space-y-6 shadow-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <span>Công Cụ Chạy Thử API Trực Tiếp (Không Cần Code)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nhập API Key CTV của bạn vào đây để thử kích hoạt thật trên hệ thống</p>
            </div>
            <Badge color="green">Dán Key & Thử Ngay</Badge>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">1. Dán API Key CTV của bạn vào đây *</label>
                <input
                  type="text"
                  value={testKey}
                  onChange={e => setTestKey(e.target.value)}
                  placeholder="Ví dụ: ctv_key_abc123..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-white/10 text-xs font-mono text-amber-600 dark:text-amber-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">2. Username Locket của khách *</label>
                <input
                  type="text"
                  value={testUser}
                  onChange={e => setTestUser(e.target.value.replace(/^@/, ''))}
                  placeholder="vanle"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-white/10 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">3. Chọn gói Locket Gold</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setTestPkg('yearly')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    testPkg === 'yearly'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ⭐ Gói 1 Năm
                </button>
                <button
                  type="button"
                  onClick={() => setTestPkg('lifetime')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    testPkg === 'lifetime'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  👑 Gói Vĩnh Viễn
                </button>
              </div>
            </div>

            {/* URL gọi trực tiếp trình duyệt */}
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Link gọi API trực tiếp trên Trình duyệt (Chrome / Safari):</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 truncate select-all">{testLink}</code>
                <CopyBtn text={testLink} label="Copy Link" />
              </div>
            </div>

            {/* Submit test button */}
            <button
              type="button"
              onClick={runTestApi}
              disabled={isTesting}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:opacity-90 font-black text-sm text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> Bấm Chạy Thử API Ngay Trực Tiếp</>}
            </button>

            {/* Test result display */}
            {testResult && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Kết quả phản hồi từ Máy Chủ:</div>
                <CodeBlock code={JSON.stringify(testResult, null, 2)} lang="json" />
              </div>
            )}
          </div>
        </Card>

        {/* ── GIẢI THÍCH KẾT QUẢ BẰNG TIẾNG VIỆT ── */}
        <Card className="p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <span>Cách Đọc Kết Quả Trả Về (Dành Cho Người Không Biết Code)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Khi gọi API, hệ thống sẽ trả về câu trả lời dưới đây:</p>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
              <div className="font-extrabold text-purple-600 dark:text-purple-400">📦 API Riêng Cho CTV Dùng Gói Lượt (`/api/v1/ctv/gold-package`):</div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">Nếu tài khoản của bạn đang có gói lượt (100, 500, 1000 lượt), hãy gọi đường dẫn <code>{BASE_URL}/api/v1/ctv/gold-package?token=YOUR_KEY&user=username</code>. Hệ thống sẽ trừ 1 lượt gói thay vì trừ tiền ví.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <div className="font-extrabold text-emerald-600 dark:text-emerald-400">🟢 Khi thành công (`status: "success"`):</div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">Tài khoản khách đã lên Gold hoàn tất. Tiền ví CTV hoặc 1 lượt gói đã được trừ thành công.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="font-extrabold text-amber-600 dark:text-amber-400">🟡 Khách đã có Gold từ trước (`status: "info"`):</div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">Khách hàng này đã lên Gold trước đó rồi. Hệ thống thông báo và <strong>GIỮ NGUYÊN TIỀN VÍ / LƯỢT GÓI 100%</strong> (hoàn lại lượt gói).</p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
              <div className="font-extrabold text-rose-600 dark:text-rose-400">🔴 Khi hết tiền ví / hết lượt gói (`code: 400`):</div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">Số dư ví CTV hoặc số lượt gói của bạn đã hết. Hãy vào Portal CTV nạp thêm tiền hoặc mua thêm gói lượt.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
              <div className="font-extrabold text-rose-600 dark:text-rose-400">🔴 Khi nhập sai API Key (`code: 401`):</div>
              <p className="text-slate-700 dark:text-slate-300 text-[11px]">Key API bạn dán vào bị sai hoặc thừa khoảng trắng. Hãy copy lại Key trong Portal CTV.</p>
            </div>
          </div>
        </Card>

        {/* ── MÃ NGUỒN MẪU DÀNH CHO THỢ LÀM WEB (DEVELOPERS) ── */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Code2 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <span>Mã Nguồn Mẫu (Đưa Cho Lập Trình Viên)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nếu bạn thuê thợ làm web, chỉ cần gửi đoạn code mẫu dưới đây cho họ</p>
            </div>

            <div className="flex items-center gap-2">
              <a href="/postman" className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all">
                🚀 Trang Postman 1-Click
              </a>
              <a href="/api/v1/ctv/postman-collection" download="LocketGold_CTV_PostmanCollection.json"
                className="px-3.5 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 font-extrabold text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Postman JSON
              </a>
            </div>
          </div>

          <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/[0.06] w-fit">
            {(['curl', 'js', 'php', 'python'] as const).map(lang => (
              <button key={lang} onClick={() => setCodeTab(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${codeTab === lang ? 'bg-purple-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                {lang === 'php' ? 'PHP (Web Shop)' : lang}
              </button>
            ))}
          </div>

          <CodeBlock code={codeSnippets[codeTab]} lang={codeTab} />
        </Card>

      </div>

      <Footer />
    </div>
  );
};

