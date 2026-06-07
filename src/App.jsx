// ============================================================
// CALENDAR TRACKER — Full App
// Dependencies (npm install):
//   @supabase/supabase-js
//
// .env.local:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//   VITE_ANTHROPIC_API_KEY=sk-ant-...  ← ใส่เฉพาะ dev local
//   (production: route ผ่าน Edge Function แทน)
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ─────────────────────────────────────────
const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const AI_KEY    = import.meta.env.VITE_GEMINI_API_KEY || "";
const supabase  = createClient(SUPA_URL, SUPA_KEY);

// ── Constants ───────────────────────────────────────────────
const CATS = {
  sleep:    { label:"นอนหลับ",       color:"#5E9BFF", bg:"rgba(94,155,255,0.12)",  dot:"#5E9BFF" },
  meal:     { label:"อาหาร",          color:"#FF9F40", bg:"rgba(255,159,64,0.12)",  dot:"#FF9F40" },
  exercise: { label:"ออกกำลังกาย",   color:"#34C759", bg:"rgba(52,199,89,0.12)",   dot:"#34C759" },
  work:     { label:"งาน / นัดหมาย", color:"#FF375F", bg:"rgba(255,55,95,0.12)",   dot:"#FF375F" },
};
const STATUS_OPTS = [
  { v:"scheduled",   l:"กำหนดการ" },
  { v:"in_progress", l:"กำลังทำ"  },
  { v:"completed",   l:"เสร็จแล้ว" },
  { v:"skipped",     l:"ข้าม"     },
  { v:"rescheduled", l:"เลื่อน"   },
];
const todayStr = () => new Date().toISOString().split("T")[0];

// ── Helpers ─────────────────────────────────────────────────
function uid() { return crypto.randomUUID(); }
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });
}
function fmtDateShort(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day:"numeric", month:"short" });
}

// ── Shared UI ────────────────────────────────────────────────
const S = {
  card: {
    background: "rgba(28,28,30,0.85)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 2px 28px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)",
  },
  label: {
    fontSize: 11, color: "#636366", fontWeight: 600,
    letterSpacing: 0.4, textTransform: "uppercase",
    display: "block", marginBottom: 6,
  },
};

function Card({ children, style = {} }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}

function Btn({ children, onClick, color = "#007AFF", ghost = false, full = false, disabled = false, style = {} }) {
  const base = {
    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
    padding: "10px 20px", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", transition: "all 0.15s", opacity: disabled ? 0.4 : 1,
    width: full ? "100%" : "auto",
  };
  const variant = ghost
    ? { background: `${color}18`, color }
    : { background: color, color: "#fff", boxShadow: `0 3px 12px ${color}44` };
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variant, ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
    >{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "", style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "9px 12px", borderRadius: 10,
        background: focused ? "rgba(0,122,255,0.15)" : "rgba(255,255,255,0.07)",
        border: `1px solid ${focused ? "rgba(0,122,255,0.4)" : "transparent"}`,
        fontSize: 13, color: "#f2f2f7", fontFamily: "inherit", outline: "none",
        transition: "all 0.15s", boxSizing: "border-box", ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Chips({ options, value, onChange, colorFn }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(({ v, l }) => {
        const col = colorFn ? colorFn(v) : "#007AFF";
        const active = value === v;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: "5px 13px", borderRadius: 20, border: "none",
            background: active ? col : "rgba(255,255,255,0.1)",
            color: active ? "#fff" : "#ebebf5",
            fontSize: 12, fontWeight: 500, cursor: "pointer",
            transition: "all 0.15s",
          }}>{l}</button>
        );
      })}
    </div>
  );
}

// ── LOGIN PAGE ───────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function signInGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0a0a0f 0%, #0d0a1a 50%, #0a0f0a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        {/* Logo */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px",
          background: "linear-gradient(135deg, #007AFF, #5856D6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, boxShadow: "0 8px 28px rgba(0,122,255,0.35)",
        }}>📅</div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f2f2f7", letterSpacing: -0.6, marginBottom: 8 }}>
          Calendar Tracker
        </h1>
        <p style={{ fontSize: 15, color: "#8e8e93", marginBottom: 40, lineHeight: 1.5 }}>
          ติดตามกิจวัตรประจำวัน<br />นอน · กิน · ออกกำลังกาย · งาน
        </p>

        <Card style={{ padding: "28px 24px" }}>
          <p style={{ fontSize: 13, color: "#8e8e93", marginBottom: 20 }}>
            เข้าสู่ระบบด้วย Google Account<br />
            <span style={{ fontSize: 11 }}>สำหรับสมาชิกในบ้านเท่านั้น</span>
          </p>

          <button onClick={signInGoogle} disabled={loading} style={{
            width: "100%", padding: "13px 20px",
            background: loading ? "#2c2c2e" : "#1c1c1e",
            border: "1px solid #3a3a3c", borderRadius: 12,
            fontSize: 15, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "inherit", transition: "all 0.15s",
            boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
            color: "#f2f2f7",
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 3px 14px rgba(0,0,0,0.1)"; }}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)"}
          >
            {/* Google SVG */}
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
          </button>
        </Card>

        <p style={{ fontSize: 11, color: "#c7c7cc", marginTop: 20 }}>
          ข้อมูลเก็บใน Supabase · ปลอดภัย · ส่วนตัว
        </p>
      </div>
    </div>
  );
}

// ── AI EDIT MODAL ────────────────────────────────────────────
function AIEditModal({ event, onApply, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true); setErr(""); setPreview(null);

    const today = todayStr();
    const sys = `You are a calendar event editor. Given the current event JSON and a Thai/English instruction, return ONLY a JSON object with the fields to update. Do not include unchanged fields. Today is ${today}.

Editable fields: title, category (sleep/meal/exercise/work), date (YYYY-MM-DD), planned_start_time (HH:MM), planned_end_time (HH:MM), status (scheduled/in_progress/completed/skipped/rescheduled), notes.

Return ONLY valid JSON, no markdown, no explanation.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${AI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${sys}\n\nCurrent event:\n${JSON.stringify(event, null, 2)}\n\nInstruction: ${prompt}` }]
            }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
          }),
        }
      );
      const data = await res.json();
      if (data.error) { setErr(data.error.message); setLoading(false); return; }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      setPreview(JSON.parse(clean));
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  const merged = preview ? { ...event, ...preview } : null;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center",
      padding: 16,
    }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(12px)" }} />
      <div style={{ position:"relative", width:"100%", maxWidth:440, zIndex:1, animation:"slideUp 0.22s ease" }}>
        <Card style={{ overflow:"hidden" }}>
          <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase" }}>AI Assistant</div>
                <div style={{ fontSize:16, fontWeight:600, color:"#f2f2f7" }}>แก้ไขด้วย AI ✦</div>
              </div>
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:14 }}>✕</button>
            </div>
          </div>

          <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:14 }}>
            {/* Current event summary */}
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:11, color:"#636366", marginBottom:4 }}>กิจกรรมปัจจุบัน</div>
              <div style={{ fontSize:13, fontWeight:500, color:"#f2f2f7" }}>{event.title}</div>
              <div style={{ fontSize:11, color:"#636366" }}>{fmtDate(event.date)} · {event.planned_start_time}–{event.planned_end_time}</div>
            </div>

            {/* Prompt */}
            <Field label="บอก AI ว่าต้องการแก้อะไร">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
                placeholder={"เช่น:\n\"เลื่อนไปพรุ่งนี้ บ่าย 3\"\n\"เปลี่ยนเป็นออกกำลังกาย 1 ชั่วโมง\"\n\"mark เป็น completed\""}
                rows={3}
                style={{
                  width:"100%", resize:"none", background:"rgba(255,255,255,0.07)",
                  border:"1px solid transparent", borderRadius:10, padding:"9px 12px",
                  fontSize:13, color:"#f2f2f7", fontFamily:"inherit", outline:"none", lineHeight:1.65,
                  boxSizing:"border-box",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(0,122,255,0.4)"; e.target.style.background = "rgba(0,122,255,0.04)"; }}
                onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "rgba(0,0,0,0.04)"; }}
              />
              <div style={{ fontSize:10, color:"#3a3a3c", marginTop:4 }}>Enter เพื่อ generate · Shift+Enter ขึ้นบรรทัดใหม่</div>
            </Field>

            <Btn onClick={generate} disabled={loading || !prompt.trim()} full>
              {loading ? "✦ กำลังวิเคราะห์..." : "✦ Generate"}
            </Btn>

            {err && <div style={{ background:"rgba(255,59,48,0.08)", color:"#FF3B30", fontSize:12, padding:"8px 12px", borderRadius:8 }}>{err}</div>}

            {/* Preview */}
            {preview && merged && (
              <div>
                <div style={{ fontSize:11, color:"#34C759", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", marginBottom:8 }}>✓ ตัวอย่างผลลัพธ์</div>
                <div style={{ background:"rgba(52,199,89,0.06)", border:"1px solid rgba(52,199,89,0.2)", borderRadius:10, padding:"12px 14px" }}>
                  {Object.entries(preview).map(([k, v]) => (
                    <div key={k} style={{ display:"flex", gap:8, fontSize:12, padding:"3px 0" }}>
                      <span style={{ color:"#8e8e93", minWidth:120 }}>{k}</span>
                      <span style={{ color:"#1c1c1e", fontWeight:500 }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <Btn onClick={() => onApply(preview)} color="#34C759" full>✓ ใช้งาน</Btn>
                  <Btn onClick={() => setPreview(null)} ghost full>ล้าง</Btn>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ADD / EDIT FORM ──────────────────────────────────────────
function EventForm({ initial, onSave, onClose, title: formTitle = "เพิ่มกิจกรรม" }) {
  const [form, setForm] = useState(initial || {
    title:"", category:"work", date: todayStr(),
    planned_start_time:"09:00", planned_end_time:"10:00",
    status:"scheduled", notes:"",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ padding:"18px 20px 22px", display:"flex", flexDirection:"column", gap:14 }}>
      <Field label="ชื่อกิจกรรม">
        <Input value={form.title} onChange={v => set("title", v)} placeholder="ชื่อกิจกรรม..." style={{ fontSize:15, fontWeight:500 }} />
      </Field>

      <Field label="ประเภท">
        <Chips options={Object.entries(CATS).map(([v,{label:l}])=>({v,l}))} value={form.category}
          onChange={v => set("category", v)}
          colorFn={v => CATS[v]?.dot} />
      </Field>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <Field label="วันที่"><Input type="date" value={form.date} onChange={v => set("date", v)} /></Field>
        <Field label="เริ่ม"><Input type="time" value={form.planned_start_time} onChange={v => set("planned_start_time", v)} /></Field>
        <Field label="สิ้นสุด"><Input type="time" value={form.planned_end_time} onChange={v => set("planned_end_time", v)} /></Field>
      </div>

      <Field label="สถานะ">
        <Chips options={STATUS_OPTS} value={form.status} onChange={v => set("status", v)}
          colorFn={v => ({ completed:"#34C759", skipped:"#FF3B30", in_progress:"#FF9500", rescheduled:"#FF375F", scheduled:"#8e8e93" }[v])} />
      </Field>

      <Field label="หมายเหตุ">
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          placeholder="รายละเอียดเพิ่มเติม..." rows={2}
          style={{
            width:"100%", resize:"none", background:"rgba(255,255,255,0.07)",
            border:"1px solid transparent", borderRadius:10, padding:"9px 12px",
            fontSize:13, color:"#f2f2f7", fontFamily:"inherit", outline:"none", lineHeight:1.6,
            boxSizing:"border-box",
          }}
          onFocus={e => { e.target.style.borderColor = "rgba(0,122,255,0.4)"; e.target.style.background = "rgba(0,122,255,0.04)"; }}
          onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.background = "rgba(0,0,0,0.04)"; }}
        />
      </Field>

      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={() => onSave(form)} disabled={!form.title.trim()} full>{formTitle}</Btn>
        <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
      </div>
    </div>
  );
}

// ── EVENT DETAIL PANEL ────────────────────────────────────────
function DetailPanel({ ev, onUpdate, onDelete, onClose }) {
  const [editing, setEditing] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const c = CATS[ev.category];

  function applyAI(patch) {
    onUpdate({ ...ev, ...patch });
    setAiModal(false);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:c.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:c.dot }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:"#636366" }}>{c.label}</div>
              <div style={{ fontSize:16, fontWeight:600, color:"#f2f2f7", letterSpacing:-0.3 }}>{ev.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:13 }}>✕</button>
        </div>

        <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap" }}>
          <Btn onClick={() => setEditing(true)} ghost color="#007AFF" style={{ fontSize:12, padding:"6px 14px" }}>แก้ไข</Btn>
          <Btn onClick={() => setAiModal(true)} ghost color="#5856D6" style={{ fontSize:12, padding:"6px 14px" }}>✦ AI แก้ไข</Btn>
          <Btn onClick={() => onDelete(ev.id)} ghost color="#FF3B30" style={{ fontSize:12, padding:"6px 14px" }}>ลบ</Btn>
        </div>
      </div>

      {editing ? (
        <EventForm
          initial={ev}
          onSave={updated => { onUpdate(updated); setEditing(false); }}
          onClose={() => setEditing(false)}
          title="บันทึกการแก้ไข"
        />
      ) : (
        <div style={{ padding:"16px 20px" }}>
          {[
            ["วันที่", fmtDate(ev.date)],
            ["เวลา", `${ev.planned_start_time || "—"} – ${ev.planned_end_time || "—"}`],
            ["สถานะ", STATUS_OPTS.find(s => s.v === ev.status)?.l],
            ["หมายเหตุ", ev.notes || "—"],
          ].map(([l,v]) => (
            <div key={l} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize:12, color:"#636366", minWidth:60, fontWeight:500 }}>{l}</span>
              <span style={{ fontSize:13, color:"#f2f2f7" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {aiModal && <AIEditModal event={ev} onApply={applyAI} onClose={() => setAiModal(false)} />}
    </div>
  );
}

// ── MAIN APP (authenticated) ─────────────────────────────────
function MainApp({ session }) {
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [showAIParse, setShowAIParse] = useState(false);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [profile, setProfile]   = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const user = session.user;

  // ── Fetch events ──
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("planned_start_time", { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  }, [user.id]);

  // ── Fetch profile ──
  const fetchProfile = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data || { display_name: user.user_metadata?.full_name, avatar_url: user.user_metadata?.avatar_url });
  }, [user]);

  useEffect(() => { fetchEvents(); fetchProfile(); }, [fetchEvents, fetchProfile]);

  // ── CRUD ──
  async function addEvent(form) {
    const payload = { ...form, user_id: user.id, id: uid() };
    const { data, error } = await supabase.from("events").insert(payload).select().single();
    if (!error && data) { setEvents(prev => [data, ...prev]); setShowAdd(false); setSelected(data); }
  }

  async function updateEvent(updated) {
    const { planned_start_time: ps, planned_end_time: pe, actual_start_time: as_, actual_end_time: ae, ...rest } = updated;
    const payload = { ...rest, planned_start_time: ps, planned_end_time: pe };
    const { error } = await supabase.from("events").update(payload).eq("id", updated.id);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
      setSelected(updated);
    }
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id", id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelected(null);
  }

  async function signOut() { await supabase.auth.signOut(); }

  // ── Filtered list ──
  const today = todayStr();
  const filtered = events
    .filter(e => filter === "all" || e.category === filter)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.notes||"").toLowerCase().includes(search.toLowerCase()));

  const todayEvs  = events.filter(e => e.date === today);
  const done      = todayEvs.filter(e => e.status === "completed").length;
  const total     = todayEvs.length;
  const pct       = total ? Math.round((done / total) * 100) : 0;

  // Group by date
  const grouped = filtered.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e);
    return acc;
  }, {});

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(135deg, #000000 0%, #0d0d0f 50%, #000000 100%)",
      fontFamily:"-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      padding:"0 0 60px",
    }}>
      <style>{`
        @keyframes slideUp { from { transform:translateY(30px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#ddd; border-radius:2px; }
      `}</style>

      {/* ── Nav Bar ── */}
      <div style={{
        background:"rgba(0,0,0,0.8)", backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.08)",
        padding:"12px 20px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        position:"sticky", top:0, zIndex:50,
      }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#f2f2f7", letterSpacing:-0.4 }}>📅 Calendar</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={() => setShowAIParse(true)} style={{
            background:"rgba(88,86,214,0.2)", border:"1px solid rgba(88,86,214,0.5)",
            color:"#a78bfa", height:32, borderRadius:16,
            cursor:"pointer", fontSize:12, fontWeight:600,
            padding:"0 12px", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:4,
          }}>✦ AI</button>
          <button onClick={() => setShowAdd(true)} style={{
            background:"#007AFF", border:"none", color:"#fff",
            width:32, height:32, borderRadius:"50%",
            cursor:"pointer", fontSize:20, display:"flex",
            alignItems:"center", justifyContent:"center",
            boxShadow:"0 2px 10px rgba(0,122,255,0.35)",
          }}>＋</button>
          {/* Avatar */}
          <button onClick={() => setShowProfile(!showProfile)} style={{ border:"none", background:"none", cursor:"pointer", padding:0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(0,122,255,0.3)" }} />
              : <div style={{ width:32, height:32, borderRadius:"50%", background:"#007AFF", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:600 }}>
                  {(profile?.display_name || user.email || "?")[0].toUpperCase()}
                </div>
            }
          </button>
        </div>
      </div>

      {/* Profile Dropdown */}
      {showProfile && (
        <div style={{ position:"fixed", top:58, right:16, zIndex:100, animation:"fadeIn 0.15s ease" }}>
          <Card style={{ padding:"12px 16px", minWidth:200 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#f2f2f7" }}>{profile?.display_name || "ผู้ใช้"}</div>
            <div style={{ fontSize:11, color:"#636366", marginBottom:12 }}>{user.email}</div>
            <Btn onClick={signOut} ghost color="#FF3B30" full style={{ fontSize:13 }}>ออกจากระบบ</Btn>
          </Card>
        </div>
      )}

      <div style={{ maxWidth:820, margin:"0 auto", padding:"18px 16px 0" }}>

        {/* ── Metric Row ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
          {[
            { l:"วันนี้",     v: total,  col:"#007AFF" },
            { l:"เสร็จแล้ว", v: done,   col:"#34C759" },
            { l:"Completion", v:`${pct}%`, col:"#FF9500" },
            { l:"รวมทั้งหมด",v: events.length, col:"#5856D6" },
          ].map(({ l, v, col }) => (
            <div key={l} style={{
              background:"rgba(28,28,30,0.8)", backdropFilter:"blur(12px)",
              borderRadius:14, padding:"12px 14px", textAlign:"center",
              border:"1px solid rgba(255,255,255,0.08)",
              boxShadow:"0 1px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ fontSize:22, fontWeight:700, color:col, letterSpacing:-0.5 }}>{v}</div>
              <div style={{ fontSize:10, color:"#636366", fontWeight:500, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div style={{ position:"relative", marginBottom:12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหากิจกรรม..."
            style={{
              width:"100%", padding:"10px 14px 10px 36px",
              background:"rgba(28,28,30,0.8)", backdropFilter:"blur(12px)",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,
              fontSize:14, color:"#f2f2f7", fontFamily:"inherit", outline:"none",
              boxShadow:"0 1px 6px rgba(0,0,0,0.05)",
            }}
          />
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"#3a3a3c", fontSize:16, pointerEvents:"none" }}>⌕</span>
        </div>

        {/* ── Category Filter ── */}
        <div style={{ display:"flex", gap:6, marginBottom:18, overflowX:"auto", paddingBottom:4 }}>
          {[["all","ทั้งหมด","#007AFF"], ...Object.entries(CATS).map(([k,v])=>[k,v.label,v.dot])].map(([k,l,col]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:"6px 14px", borderRadius:20, border:"none", flexShrink:0,
              background: filter===k ? col : "rgba(28,28,30,0.8)",
              backdropFilter:"blur(8px)",
              color: filter===k ? "#fff" : "#aeaeb2",
              fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap",
              boxShadow: filter===k ? `0 2px 10px ${col}44` : "0 1px 4px rgba(0,0,0,0.3)",
              transition:"all 0.15s",
            }}>{l}</button>
          ))}
        </div>

        {/* ── Split Layout ── */}
        <div style={{ display:"grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap:14, alignItems:"start" }}>

          {/* List */}
          <Card style={{ overflow:"hidden" }}>
            {loading ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:"#3a3a3c" }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.5 }}>⟳</div>กำลังโหลด...
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div style={{ padding:"48px 20px", textAlign:"center", color:"#3a3a3c" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:500 }}>ยังไม่มีกิจกรรม</div>
                <div style={{ fontSize:13, marginTop:6 }}>กด ＋ เพื่อเพิ่มกิจกรรมแรก</div>
              </div>
            ) : (
              Object.keys(grouped).sort().reverse().map(date => (
                <div key={date}>
                  <div style={{
                    padding:"8px 16px 4px", fontSize:11, fontWeight:700, color:"#48484a",
                    letterSpacing:0.5, textTransform:"uppercase",
                    background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)",
                  }}>
                    {date === today ? "🗓 วันนี้" : fmtDateShort(date)}
                    <span style={{ fontWeight:400, marginLeft:6, opacity:0.6 }}>{fmtDate(date)}</span>
                  </div>
                  {grouped[date]
                    .sort((a,b) => (a.planned_start_time||"").localeCompare(b.planned_start_time||""))
                    .map(ev => {
                      const c = CATS[ev.category];
                      const isSel = selected?.id === ev.id;
                      const statusCol = { completed:"#34C759", skipped:"#FF3B30", in_progress:"#FF9500", rescheduled:"#FF375F" }[ev.status] || "#8e8e93";
                      return (
                        <div key={ev.id} onClick={() => setSelected(isSel ? null : ev)}
                          style={{
                            display:"flex", alignItems:"center", gap:12, padding:"11px 16px",
                            background: isSel ? c.bg : "transparent",
                            borderBottom:"1px solid rgba(255,255,255,0.05)",
                            cursor:"pointer", transition:"background 0.15s",
                          }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ width:10, height:10, borderRadius:"50%", background:c.dot, flexShrink:0, boxShadow:`0 0 0 3px ${c.dot}22` }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ fontSize:14, fontWeight:500, color:"#f2f2f7" }}>{ev.title}</span>
                              {date === today && <span style={{ fontSize:9, background:"#007AFF", color:"#fff", padding:"1px 5px", borderRadius:8, fontWeight:700 }}>TODAY</span>}
                            </div>
                            <div style={{ fontSize:11, color:"#636366", marginTop:1 }}>{ev.planned_start_time||""}{ ev.planned_end_time ? ` – ${ev.planned_end_time}` : ""}</div>
                          </div>
                          <span style={{ fontSize:11, color:statusCol, fontWeight:500, flexShrink:0 }}>
                            {STATUS_OPTS.find(s => s.v === ev.status)?.l}
                          </span>
                          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity:0.2 }}>
                            <path d="M1 1l4 4-4 4" stroke="#1c1c1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      );
                    })}
                </div>
              ))
            )}
          </Card>

          {/* Detail / Edit Panel */}
          {selected && (
            <Card style={{ position:"sticky", top:70, overflow:"hidden", animation:"fadeIn 0.2s ease" }}>
              <DetailPanel
                ev={selected}
                onUpdate={updateEvent}
                onDelete={deleteEvent}
                onClose={() => setSelected(null)}
              />
            </Card>
          )}
        </div>
      </div>

      {/* AI Parse Modal */}
      {showAIParse && (
        <AIParseModal
          onAdd={async (events) => {
            for (const ev of events) {
              const payload = { ...ev, user_id: user.id };
              const { data } = await supabase.from("events").insert(payload).select().single();
              if (data) setEvents(prev => [data, ...prev]);
            }
            setShowAIParse(false);
          }}
          onClose={() => setShowAIParse(false)}
          userId={user.id}
        />
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:16 }}>
          <div onClick={() => setShowAdd(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(16px)" }} />
          <div style={{ position:"relative", width:"100%", maxWidth:480, zIndex:1, animation:"slideUp 0.22s ease" }}>
            <Card style={{ overflow:"hidden" }}>
              <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:17, fontWeight:600, color:"#f2f2f7" }}>เพิ่มกิจกรรมใหม่</span>
                <button onClick={() => setShowAdd(false)} style={{ background:"rgba(0,0,0,0.06)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:14, color:"#8e8e93" }}>✕</button>
              </div>
              <EventForm onSave={addEvent} onClose={() => setShowAdd(false)} title="เพิ่มกิจกรรม" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#000000" }}>
      <div style={{ width:40, height:40, border:"3px solid #007AFF", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  return session ? <MainApp session={session} /> : <LoginPage />;
}
