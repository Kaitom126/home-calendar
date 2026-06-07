import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const CATS = {
  sleep:    { label:"นอนหลับ",       color:"#5E9BFF", bg:"rgba(94,155,255,0.12)", dot:"#5E9BFF" },
  meal:     { label:"อาหาร",          color:"#FF9F40", bg:"rgba(255,159,64,0.12)", dot:"#FF9F40" },
  exercise: { label:"ออกกำลังกาย",   color:"#34C759", bg:"rgba(52,199,89,0.12)",  dot:"#34C759" },
  work:     { label:"งาน / นัดหมาย", color:"#FF375F", bg:"rgba(255,55,95,0.12)",  dot:"#FF375F" },
};
const STATUS_OPTS = [
  { v:"scheduled",   l:"กำหนดการ" },
  { v:"in_progress", l:"กำลังทำ"  },
  { v:"completed",   l:"เสร็จแล้ว" },
  { v:"skipped",     l:"ข้าม"     },
  { v:"rescheduled", l:"เลื่อน"   },
];

function todayStr() { return new Date().toISOString().split("T")[0]; }
function uid() { return crypto.randomUUID(); }
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day:"numeric", month:"long", year:"numeric" });
}
function fmtDateShort(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day:"numeric", month:"short" });
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function getDayName(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("th-TH", { weekday:"short" });
}

async function callAI(prompt) {
  const res = await fetch(`${SUPA_URL}/functions/v1/ai-parse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "AI Error");
  return data.content?.[0]?.text || "";
}

// ── Shared UI ─────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background:"rgba(28,28,30,0.85)",
      backdropFilter:"blur(24px)",
      borderRadius:18,
      border:"1px solid rgba(255,255,255,0.08)",
      boxShadow:"0 2px 28px rgba(0,0,0,0.5)",
      ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, color="#007AFF", ghost=false, full=false, disabled=false, small=false, style={} }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      border:"none", borderRadius:small?8:12,
      fontSize:small?12:14, fontWeight:600,
      padding:small?"6px 12px":"11px 20px",
      cursor:disabled?"not-allowed":"pointer",
      fontFamily:"inherit", width:full?"100%":"auto",
      opacity:disabled?0.4:1, transition:"all 0.15s",
      background:ghost?`${color}22`:color,
      color:ghost?color:"#fff",
      boxShadow:ghost?"none":`0 2px 10px ${color}44`,
      ...style,
    }}>{children}</button>
  );
}

// ── LOGIN ─────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.origin } });
  }
  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(145deg,#0a0a0f,#0d0a1a,#0a0f0a)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif",
      padding:20,
    }}>
      <div style={{ width:"100%", maxWidth:360, textAlign:"center" }}>
        <div style={{
          width:72, height:72, borderRadius:20, margin:"0 auto 24px",
          background:"linear-gradient(135deg,#007AFF,#5856D6)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:32, boxShadow:"0 8px 28px rgba(0,122,255,0.35)",
        }}>📅</div>
        <h1 style={{ fontSize:28, fontWeight:700, color:"#f2f2f7", letterSpacing:-0.6, marginBottom:8 }}>Calendar Tracker</h1>
        <p style={{ fontSize:15, color:"#636366", marginBottom:40, lineHeight:1.5 }}>
          ติดตามกิจวัตรประจำวัน<br/>นอน · กิน · ออกกำลังกาย · งาน
        </p>
        <Card style={{ padding:"28px 24px" }}>
          <p style={{ fontSize:13, color:"#636366", marginBottom:20 }}>เข้าสู่ระบบด้วย Google Account<br/><span style={{fontSize:11}}>สำหรับสมาชิกในบ้านเท่านั้น</span></p>
          <button onClick={signIn} disabled={loading} style={{
            width:"100%", padding:"13px 20px",
            background:loading?"#2c2c2e":"#1c1c1e",
            border:"1px solid #3a3a3c", borderRadius:12,
            fontSize:15, fontWeight:500, cursor:loading?"not-allowed":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            fontFamily:"inherit", color:"#f2f2f7",
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
          </button>
        </Card>
        <p style={{ fontSize:11, color:"#3a3a3c", marginTop:20 }}>ข้อมูลเก็บใน Supabase · ปลอดภัย · ส่วนตัว</p>
      </div>
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────
function OnboardingModal({ userId, onComplete }) {
  const [step, setStep] = useState(1); // 1=profile, 2=routine
  const [profile, setProfile] = useState({ gender:"male", age:"25", weight:"70", height:"170", goal:"health" });
  const [routine, setRoutine] = useState({
    sleep_start:"23:00", sleep_end:"07:00",
    work_start:"09:00", work_end:"18:00",
    exercise:true, exercise_start:"18:00", exercise_end:"19:00", exercise_days:"จ,อ,พ,พฤ,ศ",
    meal_breakfast:"08:00", meal_lunch:"12:00", meal_dinner:"19:00",
  });
  const [saving, setSaving] = useState(false);

  const GOALS = [
    { v:"health", l:"🏃 สุขภาพดี" },
    { v:"lose",   l:"⬇️ ลดน้ำหนัก" },
    { v:"gain",   l:"⬆️ เพิ่มน้ำหนัก" },
    { v:"muscle", l:"💪 เพิ่มกล้ามเนื้อ" },
    { v:"other",  l:"✨ อื่นๆ" },
  ];

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").upsert({
      id: userId,
      gender: profile.gender,
      age: parseInt(profile.age),
      weight_kg: parseFloat(profile.weight),
      height_cm: parseFloat(profile.height),
      goal: profile.goal,
      routine: routine,
      onboarded: true,
    });
    onComplete({ profile, routine });
  }

  const labelStyle = { fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", display:"block", marginBottom:6 };
  const inputStyle = {
    width:"100%", padding:"9px 12px", borderRadius:10,
    background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)",
    fontSize:13, color:"#f2f2f7", fontFamily:"inherit", outline:"none", boxSizing:"border-box",
  };
  const timeStyle = { ...inputStyle, width:"calc(50% - 4px)" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(20px)" }}>
      <div style={{ width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }}>
        <Card style={{ overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize:11, color:"#a78bfa", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>
              {step === 1 ? "ขั้นที่ 1 / 2" : "ขั้นที่ 2 / 2"}
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:"#f2f2f7" }}>
              {step === 1 ? "👋 ยินดีต้อนรับ! บอกเราเกี่ยวกับคุณ" : "⏰ ตั้งตารางประจำวัน"}
            </div>
            <div style={{ fontSize:13, color:"#636366", marginTop:4 }}>
              {step === 1 ? "ข้อมูลนี้ช่วยให้ AI วิเคราะห์สุขภาพได้แม่นยำขึ้น" : "AI จะสร้าง event ตามตารางนี้ให้อัตโนมัติ"}
            </div>
          </div>

          <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16 }}>

            {step === 1 && (
              <>
                {/* Gender */}
                <div>
                  <label style={labelStyle}>เพศ</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {[{v:"male",l:"ชาย"},{v:"female",l:"หญิง"},{v:"other",l:"อื่นๆ"}].map(g => (
                      <button key={g.v} onClick={() => setProfile(p=>({...p,gender:g.v}))} style={{
                        flex:1, padding:"9px", borderRadius:10, border:"none",
                        background:profile.gender===g.v?"#007AFF":"rgba(255,255,255,0.07)",
                        color:profile.gender===g.v?"#fff":"#aeaeb2",
                        fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                      }}>{g.l}</button>
                    ))}
                  </div>
                </div>

                {/* Age/Weight/Height */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  {[
                    {k:"age",l:"อายุ (ปี)",p:"25"},
                    {k:"weight",l:"น้ำหนัก (กก.)",p:"70"},
                    {k:"height",l:"ส่วนสูง (ซม.)",p:"170"},
                  ].map(f => (
                    <div key={f.k}>
                      <label style={labelStyle}>{f.l}</label>
                      <input type="number" value={profile[f.k]} onChange={e=>setProfile(p=>({...p,[f.k]:e.target.value}))}
                        placeholder={f.p} style={inputStyle}
                        onFocus={e=>{e.target.style.borderColor="rgba(0,122,255,0.4)"}}
                        onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.1)"}}
                      />
                    </div>
                  ))}
                </div>

                {/* Goal */}
                <div>
                  <label style={labelStyle}>เป้าหมายสุขภาพ</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {GOALS.map(g => (
                      <button key={g.v} onClick={() => setProfile(p=>({...p,goal:g.v}))} style={{
                        padding:"8px 14px", borderRadius:20, border:"none",
                        background:profile.goal===g.v?"#7c3aed":"rgba(255,255,255,0.07)",
                        color:profile.goal===g.v?"#fff":"#aeaeb2",
                        fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                      }}>{g.l}</button>
                    ))}
                  </div>
                </div>

                <Btn onClick={() => setStep(2)} full>ถัดไป →</Btn>
              </>
            )}

            {step === 2 && (
              <>
                {/* Sleep */}
                <div>
                  <label style={labelStyle}>🌙 เวลานอน</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>เข้านอน</div>
                      <input type="time" value={routine.sleep_start} onChange={e=>setRoutine(r=>({...r,sleep_start:e.target.value}))} style={timeStyle}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>ตื่นนอน</div>
                      <input type="time" value={routine.sleep_end} onChange={e=>setRoutine(r=>({...r,sleep_end:e.target.value}))} style={timeStyle}/>
                    </div>
                  </div>
                </div>

                {/* Work */}
                <div>
                  <label style={labelStyle}>💼 เวลาทำงาน</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>เริ่มงาน</div>
                      <input type="time" value={routine.work_start} onChange={e=>setRoutine(r=>({...r,work_start:e.target.value}))} style={timeStyle}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>เลิกงาน</div>
                      <input type="time" value={routine.work_end} onChange={e=>setRoutine(r=>({...r,work_end:e.target.value}))} style={timeStyle}/>
                    </div>
                  </div>
                </div>

                {/* Meals */}
                <div>
                  <label style={labelStyle}>🍽️ มื้ออาหาร</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                    {[
                      {k:"meal_breakfast",l:"เช้า"},
                      {k:"meal_lunch",l:"กลางวัน"},
                      {k:"meal_dinner",l:"เย็น"},
                    ].map(m => (
                      <div key={m.k}>
                        <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>{m.l}</div>
                        <input type="time" value={routine[m.k]} onChange={e=>setRoutine(r=>({...r,[m.k]:e.target.value}))} style={{...inputStyle, padding:"8px 10px"}}/>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exercise */}
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <label style={{...labelStyle, marginBottom:0}}>🏋️ ออกกำลังกาย</label>
                    <button onClick={() => setRoutine(r=>({...r,exercise:!r.exercise}))} style={{
                      background:routine.exercise?"#34C759":"rgba(255,255,255,0.1)",
                      border:"none", borderRadius:12, width:44, height:26, cursor:"pointer",
                      transition:"background 0.2s", position:"relative",
                    }}>
                      <div style={{
                        position:"absolute", top:3, left:routine.exercise?21:3,
                        width:20, height:20, borderRadius:"50%", background:"#fff",
                        transition:"left 0.2s",
                      }}/>
                    </button>
                  </div>
                  {routine.exercise && (
                    <div style={{ display:"flex", gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>เริ่ม</div>
                        <input type="time" value={routine.exercise_start} onChange={e=>setRoutine(r=>({...r,exercise_start:e.target.value}))} style={timeStyle}/>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:"#48484a", marginBottom:4 }}>สิ้นสุด</div>
                        <input type="time" value={routine.exercise_end} onChange={e=>setRoutine(r=>({...r,exercise_end:e.target.value}))} style={timeStyle}/>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={() => setStep(1)} ghost full>← ย้อนกลับ</Btn>
                  <Btn onClick={save} disabled={saving} full color="#34C759">
                    {saving ? "กำลังบันทึก..." : "✓ เริ่มใช้งาน"}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── AI PARSE MODAL ────────────────────────────────────────
function AIParseModal({ onAdd, onClose, userId }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");

  const EXAMPLES = [
    "พรุ่งนี้ประชุม sprint 10.30-12.00",
    "gym วันศุกร์ 18:00-19:30",
    "นัดหมอ 15 มิ.ย. บ่าย 2",
    "มื้อเช้า 8 โมง + gym 6 โมงเย็น",
  ];
  const catColors = { sleep:"#5E9BFF", meal:"#FF9F40", exercise:"#34C759", work:"#FF375F" };
  const catLabels = { sleep:"นอนหลับ", meal:"อาหาร", exercise:"ออกกำลังกาย", work:"งาน/นัด" };

  async function parse() {
    if (!input.trim()) return;
    setLoading(true); setErr(""); setParsed(null);
    try {
      const raw = await callAI(input);
      const clean = raw.replace(/```json|```/g,"").trim();
      const items = JSON.parse(clean);
      if (!Array.isArray(items) || items.length === 0) {
        setErr("ไม่พบกิจกรรม ลองพิมพ์ใหม่ครับ");
      } else {
        setParsed(items.map(ev => ({ ...ev, id: uid(), user_id: userId })));
      }
    } catch(e) { setErr("Error: " + e.message); }
    setLoading(false);
  }

  return (
    <div style={{ background:"rgba(18,18,20,0.98)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, margin:"0 0 16px 0", overflow:"hidden" }}>
      <div style={{ padding:"16px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:11, color:"#a78bfa", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>✦ AI Parse</div>
          <div style={{ fontSize:16, fontWeight:600, color:"#f2f2f7", marginTop:2 }}>พิมพ์แบบไหนก็ได้</div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:30, height:30, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:15 }}>✕</button>
      </div>
      <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setInput(ex)} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#8e8e93", fontSize:11, padding:"4px 10px", borderRadius:20, cursor:"pointer", fontFamily:"inherit" }}>{ex}</button>
          ))}
        </div>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) parse(); }}
          placeholder={"พิมพ์กิจกรรมวันนี้หรือวันข้างหน้า...\n\nเช่น: พรุ่งนี้ประชุม 10 โมง, gym 6 โมงเย็น"}
          rows={3} style={{
            width:"100%", resize:"none",
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:12, padding:"11px 14px",
            fontSize:14, color:"#f2f2f7",
            fontFamily:"-apple-system,'Noto Sans Thai',sans-serif",
            outline:"none", lineHeight:1.7, boxSizing:"border-box",
          }}
          onFocus={e=>e.target.style.borderColor="rgba(167,139,250,0.6)"}
          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}
        />
        <Btn onClick={parse} disabled={loading||!input.trim()} full color="linear-gradient(135deg,#7c3aed,#a78bfa)"
          style={{ background:loading?"rgba(167,139,250,0.15)":"linear-gradient(135deg,#7c3aed,#a78bfa)", color:loading?"#a78bfa":"#fff" }}>
          {loading ? "✦ กำลังวิเคราะห์..." : "✦ วิเคราะห์กิจกรรม"}
        </Btn>
        {err && <div style={{ background:"rgba(255,59,48,0.1)", border:"1px solid rgba(255,59,48,0.3)", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#FF6B6B" }}>{err}</div>}
        {parsed && parsed.length > 0 && (
          <div>
            <div style={{ fontSize:11, color:"#34C759", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>✓ พบ {parsed.length} กิจกรรม</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
              {parsed.map(ev => (
                <div key={ev.id} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${catColors[ev.category]||"#555"}33`, borderLeft:`3px solid ${catColors[ev.category]||"#555"}`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:"#f2f2f7" }}>{ev.title}</span>
                      <span style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:`${catColors[ev.category]}22`, color:catColors[ev.category]||"#888", fontWeight:600 }}>{catLabels[ev.category]||ev.category}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#48484a" }}>{ev.date} · {ev.planned_start_time}–{ev.planned_end_time}</div>
                  </div>
                  <button onClick={() => setParsed(prev=>prev.filter(e=>e.id!==ev.id))} style={{ background:"transparent", border:"none", color:"#FF3B30", fontSize:18, cursor:"pointer", padding:"2px 6px" }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={() => onAdd(parsed)} full color="#34C759">✓ บันทึก {parsed.length} กิจกรรม</Btn>
              <Btn onClick={() => { setParsed(null); setInput(""); }} ghost full>ล้าง</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── WEEKLY ANALYSIS MODAL ─────────────────────────────────
function WeeklyAnalysisModal({ events, userProfile, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  async function analyze() {
    setLoading(true); setErr(""); setResult("");
    try {
      const today = todayStr();
      const weekAgo = addDays(today, -7);
      const weekEvents = events.filter(e => e.date >= weekAgo && e.date <= today);

      const summary = {
        total: weekEvents.length,
        completed: weekEvents.filter(e=>e.status==="completed").length,
        skipped: weekEvents.filter(e=>e.status==="skipped").length,
        byCategory: Object.entries(CATS).map(([k]) => ({
          category: k,
          count: weekEvents.filter(e=>e.category===k).length,
          completed: weekEvents.filter(e=>e.category===k&&e.status==="completed").length,
        })),
      };

      const prompt = `You are a personal health coach AI. Analyze this person's weekly activity data and give warm, personalized advice in Thai language.

USER PROFILE:
- Gender: ${userProfile?.gender || "unknown"}
- Age: ${userProfile?.age || "unknown"} years
- Weight: ${userProfile?.weight_kg || "unknown"} kg
- Height: ${userProfile?.height_cm || "unknown"} cm
- Goal: ${userProfile?.goal || "health"}

WEEKLY SUMMARY (last 7 days):
- Total events: ${summary.total}
- Completed: ${summary.completed}
- Skipped: ${summary.skipped}
- By category: ${JSON.stringify(summary.byCategory)}

ROUTINE TARGETS:
${JSON.stringify(userProfile?.routine || {})}

Please analyze in Thai and provide:
1. 📊 สรุปสัปดาห์ที่ผ่านมา (2-3 ประโยค)
2. 😴 การนอนหลับ — พอไหม? ควรปรับอะไร?
3. 💪 การออกกำลังกาย — เพียงพอสำหรับเป้าหมายไหม?
4. 🍽️ การกิน — สม่ำเสมอไหม?
5. 💼 การทำงาน — หนักเกินไปไหม?
6. 💡 คำแนะนำสำหรับสัปดาห์หน้า (3 ข้อ)

Keep it conversational, warm, and personalized. NOT generic. Reference their specific data.`;

      const raw = await callAI(prompt);
      setResult(raw);
    } catch(e) { setErr("Error: " + e.message); }
    setLoading(false);
  }

  useEffect(() => { analyze(); }, []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)" }}>
      <div style={{ width:"100%", maxWidth:520, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <Card style={{ overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"85vh" }}>
          <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div>
              <div style={{ fontSize:11, color:"#34C759", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>AI วิเคราะห์</div>
              <div style={{ fontSize:17, fontWeight:600, color:"#f2f2f7" }}>รายงานสัปดาห์ที่ผ่านมา</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:30, height:30, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:14 }}>✕</button>
          </div>
          <div style={{ padding:"16px 20px 20px", overflowY:"auto", flex:1 }}>
            {loading && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#636366" }}>
                <div style={{ fontSize:32, marginBottom:12, animation:"spin 1s linear infinite", display:"inline-block" }}>⟳</div>
                <div>AI กำลังวิเคราะห์...</div>
              </div>
            )}
            {err && <div style={{ color:"#FF6B6B", fontSize:13 }}>{err}</div>}
            {result && (
              <div style={{ fontSize:14, color:"#e0e0e0", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{result}</div>
            )}
          </div>
          {!loading && (
            <div style={{ padding:"0 20px 20px", flexShrink:0 }}>
              <Btn onClick={analyze} full ghost color="#34C759">🔄 วิเคราะห์ใหม่</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── ROUTINE EDITOR ────────────────────────────────────────
function RoutineEditor({ userProfile, userId, onClose, onSave }) {
  const [routine, setRoutine] = useState(userProfile?.routine || {
    sleep_start:"23:00", sleep_end:"07:00",
    work_start:"09:00", work_end:"18:00",
    exercise:true, exercise_start:"18:00", exercise_end:"19:00",
    meal_breakfast:"08:00", meal_lunch:"12:00", meal_dinner:"19:00",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").update({ routine }).eq("id", userId);
    onSave(routine);
  }

  const inputStyle = { width:"100%", padding:"8px 10px", borderRadius:8, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", fontSize:13, color:"#f2f2f7", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const labelStyle = { fontSize:10, color:"#48484a", marginBottom:4, display:"block" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(12px)" }}>
      <div style={{ width:"100%", maxWidth:420, maxHeight:"85vh", overflowY:"auto" }}>
        <Card style={{ overflow:"hidden" }}>
          <div style={{ padding:"16px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:17, fontWeight:600, color:"#f2f2f7" }}>⚙️ แก้ไขตารางประจำวัน</div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:30, height:30, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:14 }}>✕</button>
          </div>
          <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div style={{ fontSize:11, color:"#5E9BFF", fontWeight:700, marginBottom:8 }}>🌙 การนอน</div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}><label style={labelStyle}>เข้านอน</label><input type="time" value={routine.sleep_start} onChange={e=>setRoutine(r=>({...r,sleep_start:e.target.value}))} style={inputStyle}/></div>
                <div style={{ flex:1 }}><label style={labelStyle}>ตื่นนอน</label><input type="time" value={routine.sleep_end} onChange={e=>setRoutine(r=>({...r,sleep_end:e.target.value}))} style={inputStyle}/></div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#FF375F", fontWeight:700, marginBottom:8 }}>💼 การทำงาน</div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}><label style={labelStyle}>เริ่มงาน</label><input type="time" value={routine.work_start} onChange={e=>setRoutine(r=>({...r,work_start:e.target.value}))} style={inputStyle}/></div>
                <div style={{ flex:1 }}><label style={labelStyle}>เลิกงาน</label><input type="time" value={routine.work_end} onChange={e=>setRoutine(r=>({...r,work_end:e.target.value}))} style={inputStyle}/></div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#FF9F40", fontWeight:700, marginBottom:8 }}>🍽️ มื้ออาหาร</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(m=>(
                  <div key={m.k}><label style={labelStyle}>{m.l}</label><input type="time" value={routine[m.k]} onChange={e=>setRoutine(r=>({...r,[m.k]:e.target.value}))} style={inputStyle}/></div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#34C759", fontWeight:700 }}>🏋️ ออกกำลังกาย</div>
                <button onClick={() => setRoutine(r=>({...r,exercise:!r.exercise}))} style={{ background:routine.exercise?"#34C759":"rgba(255,255,255,0.1)", border:"none", borderRadius:12, width:44, height:26, cursor:"pointer", transition:"background 0.2s", position:"relative" }}>
                  <div style={{ position:"absolute", top:3, left:routine.exercise?21:3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                </button>
              </div>
              {routine.exercise && (
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}><label style={labelStyle}>เริ่ม</label><input type="time" value={routine.exercise_start} onChange={e=>setRoutine(r=>({...r,exercise_start:e.target.value}))} style={inputStyle}/></div>
                  <div style={{ flex:1 }}><label style={labelStyle}>สิ้นสุด</label><input type="time" value={routine.exercise_end} onChange={e=>setRoutine(r=>({...r,exercise_end:e.target.value}))} style={inputStyle}/></div>
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
              <Btn onClick={save} disabled={saving} full color="#34C759">{saving?"กำลังบันทึก...":"✓ บันทึก"}</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
function MainApp({ session }) {
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [showAIParse, setShowAIParse] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [viewMode, setViewMode]       = useState("day"); // "day" | "week"
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [profile, setProfile]         = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast]             = useState(null);

  const user = session.user;

  function showToast(msg, color="#34C759") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").eq("user_id", user.id)
      .order("date", { ascending:false }).order("planned_start_time", { ascending:true });
    setEvents(data || []);
    setLoading(false);
  }, [user.id]);

  const fetchProfile = useCallback(async () => {
    const { data: authProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(authProfile || { display_name: user.user_metadata?.full_name, avatar_url: user.user_metadata?.avatar_url });

    const { data: up } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();
    if (!up || !up.onboarded) {
      setShowOnboarding(true);
    } else {
      setUserProfile(up);
    }
  }, [user]);

  useEffect(() => { fetchEvents(); fetchProfile(); }, [fetchEvents, fetchProfile]);

  async function addEvent(form) {
    const payload = { ...form, user_id: user.id, id: uid() };
    const { data } = await supabase.from("events").insert(payload).select().single();
    if (data) { setEvents(prev => [data, ...prev]); setShowAdd(false); }
  }

  async function addEventsFromAI(evList) {
    let count = 0;
    for (const ev of evList) {
      const { data } = await supabase.from("events").insert({ ...ev, user_id: user.id }).select().single();
      if (data) { setEvents(prev => [data, ...prev]); count++; }
    }
    setShowAIParse(false);
    showToast(`✓ เพิ่ม ${count} กิจกรรมแล้ว`);
  }

  async function generateTodayRoutine() {
    if (!userProfile?.routine) return;
    const r = userProfile.routine;
    const today = todayStr();
    const tomorrow = addDays(today, 1);
    const toAdd = [];

    if (r.sleep_start) toAdd.push({ category:"sleep", title:"นอนหลับ", date:today, planned_start_time:r.sleep_start, planned_end_time:r.sleep_end||"07:00", status:"scheduled", notes:"" });
    if (r.work_start) toAdd.push({ category:"work", title:"ทำงาน", date:today, planned_start_time:r.work_start, planned_end_time:r.work_end||"18:00", status:"scheduled", notes:"" });
    if (r.exercise && r.exercise_start) toAdd.push({ category:"exercise", title:"ออกกำลังกาย", date:today, planned_start_time:r.exercise_start, planned_end_time:r.exercise_end||"19:00", status:"scheduled", notes:"" });
    if (r.meal_breakfast) toAdd.push({ category:"meal", title:"มื้อเช้า", date:today, planned_start_time:r.meal_breakfast, planned_end_time:addTime(r.meal_breakfast,30), status:"scheduled", notes:"" });
    if (r.meal_lunch) toAdd.push({ category:"meal", title:"มื้อกลางวัน", date:today, planned_start_time:r.meal_lunch, planned_end_time:addTime(r.meal_lunch,30), status:"scheduled", notes:"" });
    if (r.meal_dinner) toAdd.push({ category:"meal", title:"มื้อเย็น", date:today, planned_start_time:r.meal_dinner, planned_end_time:addTime(r.meal_dinner,30), status:"scheduled", notes:"" });

    let count = 0;
    for (const ev of toAdd) {
      const { data } = await supabase.from("events").insert({ ...ev, user_id: user.id, id: uid() }).select().single();
      if (data) { setEvents(prev => [data, ...prev]); count++; }
    }
    showToast(`✓ สร้าง ${count} กิจกรรมจาก routine แล้ว`);
  }

  function addTime(timeStr, minutes) {
    const [h, m] = timeStr.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }

  async function updateEvent(updated) {
    const { error } = await supabase.from("events").update(updated).eq("id", updated.id);
    if (!error) { setEvents(prev => prev.map(e => e.id === updated.id ? updated : e)); setSelected(updated); }
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id", id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelected(null);
  }

  async function signOut() { await supabase.auth.signOut(); }

  // Week dates
  const weekDates = Array.from({length:7}, (_,i) => {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() - d.getDay() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const today = todayStr();
  const displayEvents = viewMode === "day"
    ? events.filter(e => e.date === currentDate)
    : events.filter(e => weekDates.includes(e.date));

  const filtered = displayEvents
    .filter(e => filter === "all" || e.category === filter)
    .filter(e => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  const todayEvs = events.filter(e => e.date === today);
  const done = todayEvs.filter(e => e.status === "completed").length;
  const total = todayEvs.length;
  const pct = total ? Math.round((done/total)*100) : 0;

  const grouped = filtered.reduce((acc, e) => { (acc[e.date] = acc[e.date] || []).push(e); return acc; }, {});

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#000000,#0d0d0f,#000000)", fontFamily:"-apple-system,'SF Pro Display','Helvetica Neue',sans-serif", paddingBottom:60 }}>
      <style>{`
        @keyframes slideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
      `}</style>

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={async (data) => {
          const { data: up } = await supabase.from("user_profiles").select("*").eq("id", user.id).single();
          setUserProfile(up);
          setShowOnboarding(false);
          showToast("✓ ตั้งค่าเสร็จแล้ว! ยินดีต้อนรับ 🎉");
        }} />
      )}

      {/* Navbar */}
      <div style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ fontSize:17, fontWeight:700, color:"#f2f2f7", letterSpacing:-0.4 }}>📅 Calendar</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Routine button */}
          <button onClick={() => setShowRoutine(true)} title="แก้ไข Routine" style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", color:"#aeaeb2", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙️</button>
          {/* Weekly analysis */}
          <button onClick={() => setShowAnalysis(true)} style={{ background:"rgba(52,199,89,0.15)", border:"1px solid rgba(52,199,89,0.3)", color:"#34C759", height:32, borderRadius:16, cursor:"pointer", fontSize:11, fontWeight:600, padding:"0 12px", fontFamily:"inherit" }}>📊 วิเคราะห์</button>
          {/* AI button */}
          <button onClick={() => setShowAIParse(!showAIParse)} style={{ background:"rgba(88,86,214,0.2)", border:"1px solid rgba(88,86,214,0.5)", color:"#a78bfa", height:32, borderRadius:16, cursor:"pointer", fontSize:12, fontWeight:600, padding:"0 12px", fontFamily:"inherit" }}>✦ AI</button>
          {/* Add button */}
          <button onClick={() => setShowAdd(true)} style={{ background:"#007AFF", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 10px rgba(0,122,255,0.35)" }}>＋</button>
          {/* Avatar */}
          <button onClick={() => setShowProfile(!showProfile)} style={{ border:"none", background:"none", cursor:"pointer", padding:0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(0,122,255,0.3)" }}/>
              : <div style={{ width:32, height:32, borderRadius:"50%", background:"#007AFF", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:600 }}>{(profile?.display_name||user.email||"?")[0].toUpperCase()}</div>
            }
          </button>
        </div>
      </div>

      {/* Profile dropdown */}
      {showProfile && (
        <div style={{ position:"fixed", top:58, right:16, zIndex:100, animation:"fadeIn 0.15s ease" }}>
          <Card style={{ padding:"12px 16px", minWidth:200 }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#f2f2f7" }}>{profile?.display_name || "ผู้ใช้"}</div>
            <div style={{ fontSize:11, color:"#636366", marginBottom:8 }}>{user.email}</div>
            {userProfile && (
              <div style={{ fontSize:11, color:"#48484a", marginBottom:10, borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:8 }}>
                {userProfile.age} ปี · {userProfile.weight_kg} กก. · {userProfile.height_cm} ซม.
              </div>
            )}
            <Btn onClick={signOut} ghost color="#FF3B30" full style={{ fontSize:13 }}>ออกจากระบบ</Btn>
          </Card>
        </div>
      )}

      <div style={{ maxWidth:820, margin:"0 auto", padding:"18px 16px 0" }}>

        {/* Metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
          {[
            { l:"วันนี้",     v:total,          col:"#007AFF" },
            { l:"เสร็จแล้ว", v:done,            col:"#34C759" },
            { l:"Completion", v:`${pct}%`,       col:"#FF9500" },
            { l:"รวมทั้งหมด",v:events.length,   col:"#5856D6" },
          ].map(({ l, v, col }) => (
            <div key={l} style={{ background:"rgba(28,28,30,0.8)", backdropFilter:"blur(12px)", borderRadius:14, padding:"12px 14px", textAlign:"center", border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 1px 8px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize:22, fontWeight:700, color:col, letterSpacing:-0.5 }}>{v}</div>
              <div style={{ fontSize:10, color:"#636366", fontWeight:500, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* AI Parse Panel */}
        {showAIParse && <AIParseModal onAdd={addEventsFromAI} onClose={() => setShowAIParse(false)} userId={user.id} />}

        {/* View toggle + Date nav */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", gap:4 }}>
            {[{v:"day",l:"รายวัน"},{v:"week",l:"รายสัปดาห์"}].map(m => (
              <button key={m.v} onClick={() => setViewMode(m.v)} style={{ padding:"6px 14px", borderRadius:20, border:"none", background:viewMode===m.v?"#007AFF":"rgba(28,28,30,0.8)", color:viewMode===m.v?"#fff":"#aeaeb2", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{m.l}</button>
            ))}
          </div>
          {viewMode === "day" && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={() => setCurrentDate(addDays(currentDate,-1))} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#aeaeb2", width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>‹</button>
              <span style={{ fontSize:13, color:"#f2f2f7", minWidth:120, textAlign:"center" }}>
                {currentDate === today ? "🗓 วันนี้" : fmtDateShort(currentDate)}
              </span>
              <button onClick={() => setCurrentDate(addDays(currentDate,1))} style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#aeaeb2", width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>›</button>
            </div>
          )}
        </div>

        {/* Week view dates */}
        {viewMode === "week" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:14 }}>
            {weekDates.map(d => {
              const dayEvs = events.filter(e=>e.date===d);
              const isToday = d === today;
              const isSelected = d === currentDate;
              return (
                <button key={d} onClick={() => setCurrentDate(d)} style={{ background:isSelected?"#007AFF":isToday?"rgba(0,122,255,0.15)":"rgba(28,28,30,0.8)", border:`1px solid ${isSelected?"#007AFF":isToday?"rgba(0,122,255,0.3)":"rgba(255,255,255,0.06)"}`, borderRadius:10, padding:"8px 4px", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:isSelected?"#fff":"#636366" }}>{getDayName(d)}</div>
                  <div style={{ fontSize:15, fontWeight:600, color:isSelected?"#fff":isToday?"#007AFF":"#f2f2f7" }}>{new Date(d+"T00:00:00").getDate()}</div>
                  {dayEvs.length > 0 && <div style={{ width:4, height:4, borderRadius:"50%", background:isSelected?"#fff":"#007AFF", margin:"3px auto 0" }}/>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div style={{ position:"relative", marginBottom:12 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหากิจกรรม..."
            style={{ width:"100%", padding:"10px 14px 10px 36px", background:"rgba(28,28,30,0.8)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, fontSize:14, color:"#f2f2f7", fontFamily:"inherit", outline:"none", boxShadow:"0 1px 6px rgba(0,0,0,0.3)" }}
          />
          <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"#3a3a3c", fontSize:16, pointerEvents:"none" }}>⌕</span>
        </div>

        {/* Category filter */}
        <div style={{ display:"flex", gap:6, marginBottom:18, overflowX:"auto", paddingBottom:4 }}>
          {[["all","ทั้งหมด","#007AFF"],...Object.entries(CATS).map(([k,v])=>[k,v.label,v.dot])].map(([k,l,col]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding:"6px 14px", borderRadius:20, border:"none", flexShrink:0, background:filter===k?col:"rgba(28,28,30,0.8)", backdropFilter:"blur(8px)", color:filter===k?"#fff":"#aeaeb2", fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap", boxShadow:filter===k?`0 2px 10px ${col}44`:"0 1px 4px rgba(0,0,0,0.3)", transition:"all 0.15s" }}>{l}</button>
          ))}
        </div>

        {/* Routine quick-generate */}
        {userProfile?.routine && events.filter(e=>e.date===today).length === 0 && (
          <div style={{ background:"rgba(0,122,255,0.08)", border:"1px solid rgba(0,122,255,0.2)", borderRadius:14, padding:"14px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"#f2f2f7" }}>วันนี้ยังไม่มีกิจกรรม</div>
              <div style={{ fontSize:11, color:"#636366" }}>สร้างจาก routine ของคุณได้เลย</div>
            </div>
            <Btn onClick={generateTodayRoutine} small color="#007AFF">สร้างวันนี้</Btn>
          </div>
        )}

        {/* Split layout */}
        <div style={{ display:"grid", gridTemplateColumns:selected?"1fr 360px":"1fr", gap:14, alignItems:"start" }}>
          <Card style={{ overflow:"hidden" }}>
            {loading ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:"#3a3a3c" }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.5 }}>⟳</div>กำลังโหลด...
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div style={{ padding:"48px 20px", textAlign:"center", color:"#3a3a3c" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:500, color:"#48484a" }}>ยังไม่มีกิจกรรม</div>
                <div style={{ fontSize:13, marginTop:6 }}>กด ✦ AI หรือ ＋ เพื่อเพิ่ม</div>
              </div>
            ) : (
              Object.keys(grouped).sort().reverse().map(date => (
                <div key={date}>
                  <div style={{ padding:"8px 16px 4px", fontSize:11, fontWeight:700, color:"#48484a", letterSpacing:0.5, textTransform:"uppercase", background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    {date===today?"🗓 วันนี้":fmtDateShort(date)}
                    <span style={{ fontWeight:400, marginLeft:6, opacity:0.6 }}>{fmtDate(date)}</span>
                  </div>
                  {grouped[date].sort((a,b)=>(a.planned_start_time||"").localeCompare(b.planned_start_time||"")).map(ev => {
                    const c = CATS[ev.category];
                    const isSel = selected?.id === ev.id;
                    const statusCol = { completed:"#34C759", skipped:"#FF3B30", in_progress:"#FF9500", rescheduled:"#FF375F" }[ev.status] || "#48484a";
                    return (
                      <div key={ev.id} onClick={() => setSelected(isSel?null:ev)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 16px", background:isSel?c.bg:"transparent", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer", transition:"background 0.15s" }}
                        onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background="rgba(255,255,255,0.02)"; }}
                        onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}
                      >
                        <div style={{ width:10, height:10, borderRadius:"50%", background:c.dot, flexShrink:0, boxShadow:`0 0 0 3px ${c.dot}22` }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:14, fontWeight:500, color:"#f2f2f7" }}>{ev.title}</span>
                            {date===today && <span style={{ fontSize:9, background:"#007AFF", color:"#fff", padding:"1px 5px", borderRadius:8, fontWeight:700 }}>TODAY</span>}
                          </div>
                          <div style={{ fontSize:11, color:"#636366", marginTop:1 }}>{ev.planned_start_time||""}{ev.planned_end_time?` – ${ev.planned_end_time}`:""}</div>
                        </div>
                        <span style={{ fontSize:11, color:statusCol, fontWeight:500, flexShrink:0 }}>{STATUS_OPTS.find(s=>s.v===ev.status)?.l}</span>
                        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity:0.2 }}><path d="M1 1l4 4-4 4" stroke="#f2f2f7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </Card>

          {/* Detail panel */}
          {selected && (
            <Card style={{ position:"sticky", top:70, overflow:"hidden", animation:"fadeIn 0.2s ease" }}>
              <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:CATS[selected.category].bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ width:12, height:12, borderRadius:"50%", background:CATS[selected.category].dot }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:"#636366" }}>{CATS[selected.category].label}</div>
                      <div style={{ fontSize:16, fontWeight:600, color:"#f2f2f7" }}>{selected.title}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#aeaeb2", fontSize:13 }}>✕</button>
                </div>
                <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
                  <Btn onClick={() => {}} ghost color="#007AFF" small>แก้ไข</Btn>
                  <Btn onClick={() => deleteEvent(selected.id)} ghost color="#FF3B30" small>ลบ</Btn>
                </div>
              </div>
              <div style={{ padding:"14px 20px" }}>
                {[["วันที่",fmtDate(selected.date)],["เวลา",`${selected.planned_start_time||"—"} – ${selected.planned_end_time||"—"}`],["สถานะ",STATUS_OPTS.find(s=>s.v===selected.status)?.l],["หมายเหตุ",selected.notes||"—"]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize:12, color:"#636366", minWidth:60, fontWeight:500 }}>{l}</span>
                    <span style={{ fontSize:13, color:"#f2f2f7" }}>{v}</span>
                  </div>
                ))}
                {/* Status change */}
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:11, color:"#636366", marginBottom:8 }}>เปลี่ยนสถานะ</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {STATUS_OPTS.map(s => {
                      const col = {completed:"#34C759",skipped:"#FF3B30",in_progress:"#FF9500",rescheduled:"#FF375F",scheduled:"#636366"}[s.v];
                      return <button key={s.v} onClick={() => updateEvent({...selected,status:s.v})} style={{ padding:"5px 10px", borderRadius:20, border:"none", background:selected.status===s.v?col:"rgba(255,255,255,0.07)", color:selected.status===s.v?"#fff":"#aeaeb2", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{s.l}</button>;
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:16 }}>
          <div onClick={() => setShowAdd(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(16px)" }}/>
          <div style={{ position:"relative", width:"100%", maxWidth:480, zIndex:1, animation:"slideUp 0.22s ease" }}>
            <Card style={{ overflow:"hidden" }}>
              <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:17, fontWeight:600, color:"#f2f2f7" }}>เพิ่มกิจกรรมใหม่</span>
                <button onClick={() => setShowAdd(false)} style={{ background:"rgba(255,255,255,0.1)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:14, color:"#aeaeb2" }}>✕</button>
              </div>
              <AddForm onSave={addEvent} onClose={() => setShowAdd(false)} defaultDate={currentDate} />
            </Card>
          </div>
        </div>
      )}

      {/* Weekly Analysis Modal */}
      {showAnalysis && <WeeklyAnalysisModal events={events} userProfile={userProfile} onClose={() => setShowAnalysis(false)} />}

      {/* Routine Editor */}
      {showRoutine && <RoutineEditor userProfile={userProfile} userId={user.id} onClose={() => setShowRoutine(false)} onSave={(r) => { setUserProfile(p=>({...p,routine:r})); setShowRoutine(false); showToast("✓ บันทึก Routine แล้ว"); }} />}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", background:toast.color, color:"#fff", padding:"12px 24px", borderRadius:20, fontSize:14, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.4)", zIndex:999, whiteSpace:"nowrap", animation:"fadeIn 0.2s ease" }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ── ADD FORM ──────────────────────────────────────────────
function AddForm({ onSave, onClose, defaultDate }) {
  const [form, setForm] = useState({ title:"", category:"work", date:defaultDate||todayStr(), planned_start_time:"09:00", planned_end_time:"10:00", status:"scheduled", notes:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const inputStyle = { width:"100%", padding:"9px 12px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", fontSize:13, color:"#f2f2f7", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:14 }}>
      <div>
        <label style={{ fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", display:"block", marginBottom:6 }}>ชื่อกิจกรรม</label>
        <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="ชื่อกิจกรรม..." style={{...inputStyle,fontSize:15,fontWeight:500}}/>
      </div>
      <div>
        <label style={{ fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", display:"block", marginBottom:6 }}>ประเภท</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {Object.entries(CATS).map(([k,v]) => (
            <button key={k} onClick={() => set("category",k)} style={{ padding:"5px 13px", borderRadius:20, border:"none", background:form.category===k?v.dot:"rgba(255,255,255,0.07)", color:form.category===k?"#fff":"#aeaeb2", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{v.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[{k:"date",l:"วันที่",t:"date"},{k:"planned_start_time",l:"เริ่ม",t:"time"},{k:"planned_end_time",l:"สิ้นสุด",t:"time"}].map(f=>(
          <div key={f.k}>
            <label style={{ fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", display:"block", marginBottom:6 }}>{f.l}</label>
            <input type={f.t} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} style={inputStyle}/>
          </div>
        ))}
      </div>
      <div>
        <label style={{ fontSize:11, color:"#636366", fontWeight:600, letterSpacing:0.4, textTransform:"uppercase", display:"block", marginBottom:6 }}>หมายเหตุ</label>
        <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2} style={{...inputStyle,resize:"none",lineHeight:1.6}}/>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={() => { if(form.title.trim()) onSave(form); }} disabled={!form.title.trim()} full>เพิ่มกิจกรรม</Btn>
        <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#000" }}>
      <div style={{ width:40, height:40, border:"3px solid #007AFF", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return session ? <MainApp session={session} /> : <LoginPage />;
}
