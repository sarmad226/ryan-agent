import { useState, useRef, useEffect, useCallback } from "react";

// ─── Storage helpers ────────────────────────────────────────────────
const STORAGE_KEY = "ryan_agent_conversations";
const loadConvos = () => {
  try { const r = window.storage; return r ? [] : []; } catch { return []; }
};

// ─── System prompt ──────────────────────────────────────────────────
const SYSTEM = `أنت "ريان Pro" — مساعد شخصي ذكي متكامل يتحدث العربي والإنجليزي وأي لغة أخرى.

قدراتك:
1. 💬 محادثة شاملة وإجابة على أي سؤال
2. 💻 كتابة وشرح الكود بكل اللغات
3. 📝 تلخيص وترجمة النصوص لأي لغة
4. 📅 تخطيط وجداول وأهداف
5. 🎨 إنشاء محتوى جاهز للنشر (انستقرام، تيك توك، لينكدإن، تويتر)
6. 💰 أفكار مشاريع وفريلانس واستراتيجيات تحقيق الدخل
7. 📊 تحليل الصور والملفات المرفوعة
8. 🔍 عند طلب بحث، قدّم معلومات شاملة ومحدّثة حسب معرفتك

قواعد مهمة:
- استخدم لغة المستخدم دائماً
- للمحتوى: أعطه جاهزاً مع هاشتاقات
- للكود: ضعه في code block
- للترجمة: قدّم الترجمة مباشرة
- كن عملياً ومفيداً وموجزاً عند الحاجة ومفصّلاً عند الضرورة`;

// ─── Tab config ──────────────────────────────────────────────────────
const TABS = [
  { id: "chat",    icon: "💬", label: "محادثة",  color: "#6366f1" },
  { id: "content", icon: "🎨", label: "محتوى",   color: "#ec4899" },
  { id: "money",   icon: "💰", label: "دخل",     color: "#22c55e" },
  { id: "plan",    icon: "📅", label: "تخطيط",   color: "#f59e0b" },
  { id: "code",    icon: "💻", label: "كود",     color: "#06b6d4" },
  { id: "translate","icon": "🌐", label: "ترجمة", color: "#a78bfa" },
];

const TAB_HINTS = {
  chat:      "اسألني أي شي...",
  content:   "صف المحتوى اللي تبيه (بوست، مقال، سكريبت...)",
  money:     "اسألني عن أفكار الدخل والمشاريع...",
  plan:      "أخبرني شو تبي تخطط...",
  code:      "اكتب متطلبات الكود...",
  translate: "اكتب النص واذكر اللغة المطلوبة...",
};

const QUICK = {
  chat:      ["ما أفضل طريقة للتعلم الذاتي؟","نصائح للإنتاجية اليومية","كيف أبني عادات ناجحة؟","ما هو الذكاء الاصطناعي؟"],
  content:   ["بوست انستقرام احترافي عن التطوير الذاتي","سكريبت تيك توك 60 ثانية عن نجاح ريادي","خيوط تويتر X تريند عن التقنية","بيو احترافي للينكدإن"],
  money:     ["أفكار مشاريع بأقل من 1000 ريال","كيف أبدأ فريلانس من الصفر","خطة كسب 5000 ريال شهرياً أونلاين","أفضل منصات بيع الخدمات الرقمية"],
  plan:      ["خطط لي أسبوعاً منتجاً","روتين صباحي للنجاح","خطة 90 يوم لهدف مهني","كيف أوازن بين العمل والدراسة؟"],
  code:      ["API REST بـ Python Flask","موقع بورتفوليو HTML/CSS احترافي","بوت تيليغرام بسيط","React dashboard component"],
  translate: ["ترجم للإنجليزية: [النص هنا]","ترجم للفرنسية: [النص هنا]","ترجم للتركية: [النص هنا]","ترجم للألمانية: [النص هنا]"],
};

// ─── Render markdown-ish content ─────────────────────────────────────
function MsgContent({ text, onCopy, copied }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lang = part.match(/```(\w*)/)?.[1] || "";
          const code = part.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <div key={i} style={{ position: "relative", margin: "10px 0" }}>
              {lang && <div style={{ fontSize: 10, color: "#06b6d4", padding: "6px 12px 0", fontFamily: "monospace" }}>{lang}</div>}
              <pre style={{
                background: "#060610", border: "1px solid rgba(6,182,212,0.2)",
                borderRadius: 10, padding: "12px 14px", overflowX: "auto",
                fontSize: 12, lineHeight: 1.65, color: "#a5f3fc",
                direction: "ltr", textAlign: "left", margin: 0, fontFamily: "'Fira Code', monospace",
              }}><code>{code}</code></pre>
              <button onClick={() => onCopy(code, "code" + i)} style={{
                position: "absolute", top: lang ? 28 : 8, left: 8,
                background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)",
                borderRadius: 6, color: "#06b6d4", fontSize: 10.5, padding: "2px 8px", cursor: "pointer",
              }}>{copied === "code" + i ? "✓ نُسخ" : "نسخ"}</button>
            </div>
          );
        }
        const isAr = /[\u0600-\u06FF]/.test(part);
        const html = part
          .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#fbbf24'>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/`([^`]+)`/g, "<code style='background:rgba(99,102,241,0.2);padding:1px 6px;border-radius:4px;font-size:12px;color:#a5b4fc'>$1</code>")
          .replace(/^### (.+)$/gm, "<div style='font-weight:800;font-size:14px;color:#c4b5fd;margin:12px 0 4px'>$1</div>")
          .replace(/^## (.+)$/gm, "<div style='font-weight:800;font-size:15px;color:#fbbf24;margin:14px 0 5px;border-bottom:1px solid rgba(251,191,36,0.2);padding-bottom:4px'>$1</div>")
          .replace(/^# (.+)$/gm, "<div style='font-weight:900;font-size:16px;color:#f97316;margin:16px 0 6px'>$1</div>")
          .replace(/^[-•] (.+)$/gm, "<div style='display:flex;gap:8px;margin:3px 0;padding-right:4px'><span style='color:#f97316;margin-top:2px;flex-shrink:0'>▸</span><span>$1</span></div>")
          .replace(/^(\d+)\. (.+)$/gm, "<div style='display:flex;gap:8px;margin:3px 0'><span style='color:#06b6d4;font-weight:700;min-width:18px'>$1.</span><span>$2</span></div>")
          .replace(/\n/g, "<br/>");
        return (
          <div key={i}
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ direction: isAr ? "rtl" : "ltr", textAlign: isAr ? "right" : "left" }}
          />
        );
      })}
    </div>
  );
}

// ─── Pulsing dots ────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "4px 2px", alignItems: "center" }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#f97316",
          animation: `td 1.2s ease-in-out ${i*0.2}s infinite`,
        }}/>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("chat");
  const [sessions, setSessions] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [{ id: Date.now(), name: "محادثة 1", messages: [] }];
    } catch { return [{ id: Date.now(), name: "محادثة 1", messages: [] }]; }
  });
  const [activeId, setActiveId] = useState(() => sessions[0]?.id);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [imgFile, setImgFile]   = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const bottomRef = useRef(null);
  const taRef     = useRef(null);
  const fileRef   = useRef(null);

  const activeSession = sessions.find(s => s.id === activeId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Persist sessions
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch {}
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const updateMessages = (id, msgs) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, messages: msgs, name: msgs[0]?.content?.slice(0,25) || s.name } : s));
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if ((!msg && !imgFile) || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    // Build user content
    let userContent;
    if (imgFile) {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(imgFile);
      });
      userContent = [
        { type: "image", source: { type: "base64", media_type: imgFile.type, data: b64 } },
        { type: "text", text: msg || "حلل هذه الصورة بالتفصيل" },
      ];
      setImgFile(null); setImgPreview(null);
    } else {
      userContent = msg;
    }

    const searchPrefix = searchMode
      ? "ابحث وقدّم معلومات شاملة ومحدّثة عن: "
      : "";
    const finalContent = typeof userContent === "string"
      ? searchPrefix + userContent
      : userContent;

    const history = [...messages, { role: "user", content: finalContent }];
    updateMessages(activeId, history);
    setLoading(true);

    try {
      const apiMessages = history.map(m => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content
          : (typeof m.content === "string" ? m.content : String(m.content)),
      }));

      const bodyObj = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM,
        messages: apiMessages,
      };

      if (searchMode) {
        bodyObj.tools = [{ type: "web_search_20250305", name: "web_search" }];
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.type === "text" ? b.text : "").filter(Boolean).join("") || "حدث خطأ.";
      updateMessages(activeId, [...history, { role: "assistant", content: reply }]);
    } catch {
      updateMessages(activeId, [...history, { role: "assistant", content: "⚠️ تعذّر الاتصال، تحقق من الإنترنت وحاول مجدداً." }]);
    } finally {
      setLoading(false);
      setSearchMode(false);
    }
  };

  const newChat = () => {
    const id = Date.now();
    setSessions(prev => [...prev, { id, name: `محادثة ${prev.length + 1}`, messages: [] }]);
    setActiveId(id);
    setShowSidebar(false);
  };

  const deleteChat = (id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const newId = Date.now();
        setActiveId(newId);
        return [{ id: newId, name: "محادثة 1", messages: [] }];
      }
      if (activeId === id) setActiveId(filtered[filtered.length - 1].id);
      return filtered;
    });
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    const url = URL.createObjectURL(f);
    setImgPreview(url);
    e.target.value = "";
  };

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      background: "#07070f", color: "#e2e2ef",
      fontFamily: "'Segoe UI', 'Noto Kufi Arabic', 'Noto Sans Arabic', sans-serif",
      direction: "rtl", overflow: "hidden", position: "relative",
    }}>
      {/* Ambient */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${activeTab?.color}18 0%, transparent 70%)`,
        transition: "background 0.6s ease",
      }}/>

      {/* ── Sidebar overlay (mobile) ── */}
      {showSidebar && (
        <div onClick={() => setShowSidebar(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40,
          backdropFilter: "blur(4px)",
        }}/>
      )}

      {/* ── Sidebar ── */}
      <div style={{
        position: "fixed", top: 0, right: showSidebar ? 0 : "-280px",
        width: 270, height: "100dvh", zIndex: 50,
        background: "#0d0d1a", borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column",
        transition: "right 0.3s cubic-bezier(.4,0,.2,1)",
        boxShadow: showSidebar ? "-8px 0 32px rgba(0,0,0,0.5)" : "none",
      }}>
        <div style={{ padding: "18px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#f97316" }}>💾 المحادثات المحفوظة</span>
          <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <button onClick={newChat} style={{
          margin: "0 12px 12px",
          background: "linear-gradient(135deg, #f97316, #ec4899)",
          border: "none", borderRadius: 10, color: "#fff",
          padding: "10px", fontWeight: 700, fontSize: 13,
          cursor: "pointer", fontFamily: "inherit",
        }}>+ محادثة جديدة</button>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          {[...sessions].reverse().map(s => (
            <div key={s.id} onClick={() => { setActiveId(s.id); setShowSidebar(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 10px", borderRadius: 10, cursor: "pointer",
                background: s.id === activeId ? "rgba(249,115,22,0.15)" : "transparent",
                border: s.id === activeId ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent",
                marginBottom: 4, transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 13 }}>💬</span>
              <span style={{ flex: 1, fontSize: 12.5, color: s.id === activeId ? "#fb923c" : "#9ca3af",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.name || "محادثة"}
              </span>
              <button onClick={e => { e.stopPropagation(); deleteChat(s.id); }} style={{
                background: "none", border: "none", color: "#4b5563",
                cursor: "pointer", fontSize: 14, padding: "2px 4px",
              }}>🗑</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <header style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        background: "rgba(7,7,15,0.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => setShowSidebar(true)} style={{
          width: 36, height: 36, borderRadius: 9,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          color: "#9ca3af", fontSize: 16, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>☰</button>

        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${activeTab?.color}, #ec4899)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, boxShadow: `0 0 20px ${activeTab?.color}55`,
          transition: "all 0.4s",
        }}>✦</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>ريان Pro</div>
          <div style={{ fontSize: 10.5, color: activeTab?.color, display: "flex", alignItems: "center", gap: 4, transition: "color 0.3s" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }}/>
            {activeTab?.icon} {activeTab?.label} • {messages.length} رسالة
          </div>
        </div>

        <button onClick={newChat} style={{
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)",
          borderRadius: 8, color: "#fb923c", padding: "5px 10px",
          fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
        }}>+ جديد</button>
      </header>

      {/* ── Tabs ── */}
      <div style={{
        flexShrink: 0, position: "relative", zIndex: 9,
        background: "rgba(7,7,15,0.8)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "8px 12px", display: "flex", gap: 6, overflowX: "auto",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 13px", borderRadius: 20, border: "none",
            background: tab === t.id ? t.color : "rgba(255,255,255,0.05)",
            color: tab === t.id ? "#fff" : "#9ca3af",
            fontWeight: tab === t.id ? 700 : 400,
            fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: tab === t.id ? `0 4px 14px ${t.color}50` : "none",
            transition: "all 0.2s", fontFamily: "inherit",
            flexShrink: 0,
          }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 0", position: "relative", zIndex: 1 }}>

        {/* Quick prompts */}
        {messages.length === 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px",
                background: `linear-gradient(135deg, ${activeTab?.color}, #ec4899)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, boxShadow: `0 0 40px ${activeTab?.color}40`,
              }}>✦</div>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900 }}>ريان Pro</h2>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>مساعدك الشامل — بحث · ترجمة · محتوى · كود · تخطيط · دخل</p>
            </div>
            <p style={{ color: "#4b5563", fontSize: 12, textAlign: "center", margin: "0 0 10px" }}>اقتراحات سريعة</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {QUICK[tab].map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeTab?.color}30`,
                  borderRadius: 11, padding: "10px 12px",
                  color: "#c9cde0", fontSize: 12, cursor: "pointer",
                  textAlign: "right", lineHeight: 1.5, fontFamily: "inherit",
                  transition: "all 0.18s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${activeTab?.color}15`; e.currentTarget.style.borderColor = `${activeTab?.color}60`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = `${activeTab?.color}30`; }}
                >{q}</button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const textContent = Array.isArray(msg.content)
              ? msg.content.find(b => b.type === "text")?.text || ""
              : msg.content;
            const imgContent = Array.isArray(msg.content)
              ? msg.content.find(b => b.type === "image")
              : null;
            return (
              <div key={i} style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                gap: 8, alignItems: "flex-start",
              }}>
                {!isUser && (
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${activeTab?.color}, #ec4899)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, marginTop: 2,
                  }}>✦</div>
                )}
                <div style={{
                  maxWidth: "84%",
                  background: isUser
                    ? `linear-gradient(135deg, ${activeTab?.color}dd, ${activeTab?.color}88)`
                    : "rgba(255,255,255,0.055)",
                  border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: isUser ? "16px 3px 16px 16px" : "3px 16px 16px 16px",
                  padding: "11px 14px 11px 14px",
                  color: isUser ? "#fff" : "#d4d8e8",
                  position: "relative",
                  boxShadow: isUser ? `0 4px 20px ${activeTab?.color}30` : "none",
                }}>
                  {imgContent && (
                    <img
                      src={`data:${imgContent.source.media_type};base64,${imgContent.source.data}`}
                      alt="مرفق"
                      style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 8, display: "block" }}
                    />
                  )}
                  {isUser
                    ? <div style={{ fontSize: 13.5, lineHeight: 1.75, direction: /[\u0600-\u06FF]/.test(textContent) ? "rtl" : "ltr", textAlign: /[\u0600-\u06FF]/.test(textContent) ? "right" : "left" }}>{textContent}</div>
                    : <MsgContent text={textContent} onCopy={copyText} copied={copied} />
                  }
                  {!isUser && (
                    <button onClick={() => copyText(textContent, "msg" + i)} style={{
                      position: "absolute", bottom: 7, left: 8,
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 6, color: "#9ca3af", fontSize: 10,
                      padding: "2px 7px", cursor: "pointer",
                    }}>{copied === "msg" + i ? "✓" : "نسخ"}</button>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: `linear-gradient(135deg, ${activeTab?.color}, #ec4899)`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
              }}>✦</div>
              <div style={{
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "3px 16px 16px 16px", padding: "12px 16px",
              }}>
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* ── Input area ── */}
      <div style={{
        flexShrink: 0, position: "relative", zIndex: 9,
        background: "rgba(7,7,15,0.95)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "10px 12px 14px",
      }}>
        {/* Image preview */}
        {imgPreview && (
          <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
            <img src={imgPreview} alt="معاينة" style={{ height: 56, borderRadius: 8, border: "2px solid rgba(249,115,22,0.4)" }} />
            <button onClick={() => { setImgFile(null); setImgPreview(null); }} style={{
              position: "absolute", top: -6, right: -6, width: 18, height: 18,
              background: "#ef4444", border: "none", borderRadius: "50%",
              color: "#fff", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setSearchMode(s => !s)} title="بحث ويب" style={{
            background: searchMode ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${searchMode ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 8, color: searchMode ? "#818cf8" : "#6b7280",
            padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s",
          }}>🔍 {searchMode ? "بحث فعّال" : "بحث ويب"}</button>

          <button onClick={() => fileRef.current?.click()} title="رفع صورة" style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#6b7280", padding: "5px 10px",
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4,
          }}>📷 صورة</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

          <button onClick={() => setShowSidebar(true)} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, color: "#6b7280", padding: "5px 10px",
            fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4, marginRight: "auto",
          }}>💾 {sessions.length} محادثة</button>
        </div>

        {/* Text input row */}
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${searchMode ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 14, padding: "8px 8px 8px 12px",
          transition: "border-color 0.2s",
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = `${activeTab?.color}80`}
          onBlurCapture={e => e.currentTarget.style.borderColor = searchMode ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.12)"}
        >
          <textarea ref={taRef} value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={TAB_HINTS[tab]}
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#e2e2ef", fontSize: 13.5, resize: "none",
              lineHeight: 1.6, fontFamily: "inherit", direction: "rtl",
              maxHeight: 120, overflowY: "auto", padding: "2px 0",
            }}
          />
          <button onClick={() => sendMessage()}
            disabled={(!input.trim() && !imgFile) || loading}
            style={{
              width: 36, height: 36, borderRadius: 9, border: "none",
              background: (input.trim() || imgFile) && !loading
                ? `linear-gradient(135deg, ${activeTab?.color}, #ec4899)`
                : "rgba(255,255,255,0.07)",
              cursor: (input.trim() || imgFile) && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0, transition: "all 0.2s",
              color: (input.trim() || imgFile) && !loading ? "#fff" : "#374151",
              boxShadow: (input.trim() || imgFile) && !loading ? `0 4px 14px ${activeTab?.color}50` : "none",
            }}>↑</button>
        </div>
        <p style={{ textAlign: "center", color: "#2d2d40", fontSize: 10.5, margin: "6px 0 0" }}>
          Enter للإرسال · Shift+Enter سطر جديد
        </p>
      </div>

      <style>{`
        @keyframes td { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-5px);opacity:1} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(249,115,22,.25);border-radius:4px}
        textarea::placeholder{color:#3d3d55}
        @media(max-width:480px){
          .ryan-grid{grid-template-columns:1fr!important}
        }
      `}</style>
    </div>
  );
}
