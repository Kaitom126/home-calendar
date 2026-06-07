import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const CATS = {
  sleep:    { label:"นอนหลับ",       color:"#5E9BFF", bg:"rgba(94,155,255,0.1)",  dot:"#5E9BFF" },
  meal:     { label:"อาหาร",          color:"#FF9F40", bg:"rgba(255,159,64,0.1)",  dot:"#FF9F40" },
  exercise: { label:"ออกกำลังกาย",   color:"#34C759", bg:"rgba(52,199,89,0.1)",   dot:"#34C759" },
  work:     { label:"งาน / นัดหมาย", color:"#FF375F", bg:"rgba(255,55,95,0.1)",   dot:"#FF375F" },
};
const STATUS_OPTS = [
  { v:"scheduled",   l:"กำหนดการ"  },
  { v:"in_progress", l:"กำลังทำ"   },
  { v:"completed",   l:"เสร็จแล้ว" },
  { v:"skipped",     l:"ข้าม"      },
  { v:"rescheduled", l:"เลื่อน"    },
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
function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
}

async function callAI(prompt) {
  const res = await fetch(`${SUPA_URL}/functions/v1/ai-parse`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "AI Error");
  return data.content?.[0]?.text || "";
}

// ── UI Components ──────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background:"rgba(22,22,24,0.9)",
      backdropFilter:"blur(20px)",
      borderRadius:16,
      border:"1px solid rgba(255,255,255,0.07)",
      boxShadow:"0 4px 24px rgba(0,0,0,0.4)",
      ...style,
    }}>{children}</div>
  );
}

function Btn({ children, onClick, color="#007AFF", ghost=false, full=false, disabled=false, small=false, danger=false, style={} }) {
  const bg = danger ? (ghost ? "rgba(255,59,48,0.12)" : "#FF3B30")
           : ghost  ? `${color}18`
           : color;
  const cl = danger ? (ghost ? "#FF3B30" : "#fff")
           : ghost  ? color
           : "#fff";
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      border:"none", borderRadius:small?8:12,
      fontSize:small?12:14, fontWeight:600,
      padding:small?"6px 12px":"11px 20px",
      cursor:disabled?"not-allowed":"pointer",
      fontFamily:"inherit", width:full?"100%":"auto",
      opacity:disabled?0.35:1, transition:"opacity 0.15s",
      background:bg, color:cl,
      ...style,
    }}>{children}</button>
  );
}

function FieldLabel({ children }) {
  return <label style={{ fontSize:11, color:"#555", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase", display:"block", marginBottom:6 }}>{children}</label>;
}

function Input({ value, onChange, type="text", placeholder="", style={} }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ width:"100%", padding:"9px 12px", borderRadius:10, background:f?"rgba(0,122,255,0.08)":"rgba(255,255,255,0.05)", border:`1px solid ${f?"rgba(0,122,255,0.4)":"rgba(255,255,255,0.08)"}`, fontSize:13, color:"#f0f0f0", fontFamily:"inherit", outline:"none", boxSizing:"border-box", transition:"all 0.15s", ...style }}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    />
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={()=>onChange(!value)} style={{ background:value?"#34C759":"rgba(255,255,255,0.1)", border:"none", borderRadius:14, width:48, height:28, cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?23:3, width:22, height:22, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}/>
    </button>
  );
}

// ── LOGIN ──────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:window.location.origin } });
  }
  return (
    <div style={{ minHeight:"100vh", background:"#080808", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"-apple-system,'SF Pro Display',sans-serif", padding:20 }}>
      <div style={{ width:"100%", maxWidth:360, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:18, margin:"0 auto 24px", background:"linear-gradient(135deg,#007AFF,#5856D6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, boxShadow:"0 8px 24px rgba(0,122,255,0.3)" }}>📅</div>
        <h1 style={{ fontSize:26, fontWeight:700, color:"#f0f0f0", letterSpacing:-0.5, marginBottom:8 }}>Calendar Tracker</h1>
        <p style={{ fontSize:14, color:"#555", marginBottom:36, lineHeight:1.6 }}>ติดตามกิจวัตรประจำวัน<br/>นอน · กิน · ออกกำลังกาย · งาน</p>
        <Card style={{ padding:"24px" }}>
          <button onClick={signIn} disabled={loading} style={{ width:"100%", padding:"12px 20px", background:"#1a1a1a", border:"1px solid #333", borderRadius:12, fontSize:15, fontWeight:500, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontFamily:"inherit", color:"#f0f0f0", transition:"border-color 0.15s" }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
          </button>
        </Card>
        <p style={{ fontSize:11, color:"#333", marginTop:16 }}>ข้อมูลเก็บใน Supabase · ปลอดภัย · ส่วนตัว</p>
      </div>
    </div>
  );
}

// ── ONBOARDING ─────────────────────────────────────────────
function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState({ gender:"male", age:"", weight:"", height:"", goal:"health" });
  const [r, setR] = useState({ sleep_start:"23:00", sleep_end:"07:00", work_start:"09:00", work_end:"18:00", exercise:true, exercise_start:"18:00", exercise_end:"19:00", meal_breakfast:"08:00", meal_lunch:"12:00", meal_dinner:"19:00" });
  const [saving, setSaving] = useState(false);

  const sp = (k,v) => setP(x=>({...x,[k]:v}));
  const sr = (k,v) => setR(x=>({...x,[k]:v}));

  const iStyle = { width:"100%", padding:"9px 12px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", fontSize:13, color:"#f0f0f0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lStyle = { fontSize:10, color:"#555", display:"block", marginBottom:4 };

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").upsert({ id:userId, gender:p.gender, age:parseInt(p.age)||0, weight_kg:parseFloat(p.weight)||0, height_cm:parseFloat(p.height)||0, goal:p.goal, routine:r, onboarded:true });
    const { data } = await supabase.from("user_profiles").select("*").eq("id", userId).single();
    onComplete(data);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.92)" }}>
      <div style={{ width:"100%", maxWidth:460, maxHeight:"92vh", overflowY:"auto" }}>
        <Card style={{ overflow:"hidden" }}>
          <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:11, color:"#007AFF", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase", marginBottom:4 }}>{step}/2</div>
            <div style={{ fontSize:19, fontWeight:700, color:"#f0f0f0" }}>{step===1?"ข้อมูลส่วนตัว":"ตารางประจำวัน"}</div>
            <div style={{ fontSize:13, color:"#555", marginTop:3 }}>{step===1?"AI จะใช้ข้อมูลนี้วิเคราะห์สุขภาพเฉพาะคุณ":"กำหนดเวลาประจำวัน ระบบสร้างให้อัตโนมัติทุกวัน"}</div>
          </div>
          <div style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16 }}>
            {step===1 && <>
              <div>
                <FieldLabel>เพศ</FieldLabel>
                <div style={{ display:"flex", gap:8 }}>
                  {[{v:"male",l:"ชาย"},{v:"female",l:"หญิง"},{v:"other",l:"อื่นๆ"}].map(g=>(
                    <button key={g.v} onClick={()=>sp("gender",g.v)} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:p.gender===g.v?"#007AFF":"rgba(255,255,255,0.05)", color:p.gender===g.v?"#fff":"#aaa", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{g.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[{k:"age",l:"อายุ (ปี)",ph:"25"},{k:"weight",l:"น้ำหนัก (กก.)",ph:"70"},{k:"height",l:"ส่วนสูง (ซม.)",ph:"170"}].map(f=>(
                  <div key={f.k}><label style={lStyle}>{f.l}</label><input type="number" value={p[f.k]} onChange={e=>sp(f.k,e.target.value)} placeholder={f.ph} style={iStyle}/></div>
                ))}
              </div>
              <div>
                <FieldLabel>เป้าหมายสุขภาพ</FieldLabel>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {[{v:"health",l:"สุขภาพดี"},{v:"lose",l:"ลดน้ำหนัก"},{v:"gain",l:"เพิ่มน้ำหนัก"},{v:"muscle",l:"เพิ่มกล้ามเนื้อ"},{v:"other",l:"อื่นๆ"}].map(g=>(
                    <button key={g.v} onClick={()=>sp("goal",g.v)} style={{ padding:"7px 14px", borderRadius:20, border:"none", background:p.goal===g.v?"#5856D6":"rgba(255,255,255,0.05)", color:p.goal===g.v?"#fff":"#aaa", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{g.l}</button>
                  ))}
                </div>
              </div>
              <Btn onClick={()=>setStep(2)} full disabled={!p.age||!p.weight||!p.height}>ถัดไป</Btn>
            </>}
            {step===2 && <>
              <div>
                <FieldLabel>การนอน</FieldLabel>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}><label style={lStyle}>เข้านอน</label><input type="time" value={r.sleep_start} onChange={e=>sr("sleep_start",e.target.value)} style={iStyle}/></div>
                  <div style={{ flex:1 }}><label style={lStyle}>ตื่นนอน</label><input type="time" value={r.sleep_end} onChange={e=>sr("sleep_end",e.target.value)} style={iStyle}/></div>
                </div>
              </div>
              <div>
                <FieldLabel>ทำงาน</FieldLabel>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}><label style={lStyle}>เริ่มงาน</label><input type="time" value={r.work_start} onChange={e=>sr("work_start",e.target.value)} style={iStyle}/></div>
                  <div style={{ flex:1 }}><label style={lStyle}>เลิกงาน</label><input type="time" value={r.work_end} onChange={e=>sr("work_end",e.target.value)} style={iStyle}/></div>
                </div>
              </div>
              <div>
                <FieldLabel>มื้ออาหาร</FieldLabel>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(m=>(
                    <div key={m.k}><label style={lStyle}>{m.l}</label><input type="time" value={r[m.k]} onChange={e=>sr(m.k,e.target.value)} style={iStyle}/></div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <FieldLabel>ออกกำลังกาย</FieldLabel>
                  <Toggle value={r.exercise} onChange={v=>sr("exercise",v)}/>
                </div>
                {r.exercise && (
                  <div style={{ display:"flex", gap:8 }}>
                    <div style={{ flex:1 }}><label style={lStyle}>เริ่ม</label><input type="time" value={r.exercise_start} onChange={e=>sr("exercise_start",e.target.value)} style={iStyle}/></div>
                    <div style={{ flex:1 }}><label style={lStyle}>สิ้นสุด</label><input type="time" value={r.exercise_end} onChange={e=>sr("exercise_end",e.target.value)} style={iStyle}/></div>
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>setStep(1)} ghost full>ย้อนกลับ</Btn>
                <Btn onClick={save} disabled={saving} full color="#34C759">{saving?"กำลังบันทึก...":"เริ่มใช้งาน"}</Btn>
              </div>
            </>}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── AI PANEL ───────────────────────────────────────────────
function AIPanel({ onAdd, onClose, userId }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");

  const catColors = { sleep:"#5E9BFF", meal:"#FF9F40", exercise:"#34C759", work:"#FF375F" };
  const catLabels = { sleep:"นอนหลับ", meal:"อาหาร", exercise:"ออกกำลังกาย", work:"งาน/นัด" };
  const EXAMPLES = ["พรุ่งนี้ประชุม 10.30-12.00","gym วันศุกร์ 18:00","นัดหมอ 15 มิ.ย. บ่าย 2","มื้อเช้า 8 โมง + gym 6 โมงเย็น","ประชุม board meeting สัปดาห์หน้าจันทร์ 9 โมง"];

  async function parse() {
    if (!input.trim()) return;
    setLoading(true); setErr(""); setParsed(null);
    try {
      const raw = await callAI(input);
      const clean = raw.replace(/```json|```/g,"").trim();
      const items = JSON.parse(clean);
      if (!Array.isArray(items)||items.length===0) { setErr("ไม่พบกิจกรรม ลองพิมพ์ใหม่"); } 
      else { setParsed(items.map(ev=>({...ev,id:uid(),user_id:userId}))); }
    } catch(e) { setErr("เกิดข้อผิดพลาด: "+e.message); }
    setLoading(false);
  }

  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:11, color:"#5856D6", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase" }}>AI Parse</div>
          <div style={{ fontSize:15, fontWeight:600, color:"#f0f0f0" }}>พิมพ์กิจกรรมแบบไหนก็ได้</div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#888", fontSize:13 }}>✕</button>
      </div>
      <div style={{ padding:"14px 18px 18px", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {EXAMPLES.map(ex=>(
            <button key={ex} onClick={()=>setInput(ex)} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#666", fontSize:11, padding:"3px 9px", borderRadius:20, cursor:"pointer", fontFamily:"inherit" }}>{ex}</button>
          ))}
        </div>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) parse(); }}
          placeholder={"พิมพ์กิจกรรมวันนี้หรือวันข้างหน้า...\n\nเช่น: พรุ่งนี้ประชุม 10 โมง, gym 6 โมงเย็น, ประชุม board ปลายเดือน"}
          rows={3} style={{ width:"100%", resize:"none", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 12px", fontSize:14, color:"#f0f0f0", fontFamily:"-apple-system,'Noto Sans Thai',sans-serif", outline:"none", lineHeight:1.7, boxSizing:"border-box" }}
          onFocus={e=>{e.target.style.borderColor="rgba(88,86,214,0.5)"}}
          onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)"}}
        />
        <Btn onClick={parse} disabled={loading||!input.trim()} full color="#5856D6" style={{ background:loading?"rgba(88,86,214,0.15)":"#5856D6", color:loading?"#5856D6":"#fff" }}>
          {loading?"กำลังวิเคราะห์...":"วิเคราะห์กิจกรรม"}
        </Btn>
        {err && <div style={{ background:"rgba(255,59,48,0.08)", border:"1px solid rgba(255,59,48,0.2)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#FF6B6B" }}>{err}</div>}
        {parsed&&parsed.length>0&&(
          <div>
            <div style={{ fontSize:11, color:"#34C759", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase", marginBottom:8 }}>พบ {parsed.length} กิจกรรม</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
              {parsed.map(ev=>(
                <div key={ev.id} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${catColors[ev.category]||"#444"}22`, borderLeft:`3px solid ${catColors[ev.category]||"#444"}`, borderRadius:8, padding:"9px 12px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:"#f0f0f0" }}>{ev.title}</span>
                      <span style={{ fontSize:9, padding:"1px 6px", borderRadius:10, background:`${catColors[ev.category]}18`, color:catColors[ev.category]||"#888", fontWeight:600 }}>{catLabels[ev.category]||ev.category}</span>
                    </div>
                    <div style={{ fontSize:11, color:"#555" }}>{ev.date} · {ev.planned_start_time} – {ev.planned_end_time}</div>
                  </div>
                  <button onClick={()=>setParsed(prev=>prev.filter(e=>e.id!==ev.id))} style={{ background:"transparent", border:"none", color:"#FF3B30", fontSize:16, cursor:"pointer", padding:"2px 4px" }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>onAdd(parsed)} full color="#34C759">บันทึก {parsed.length} กิจกรรม</Btn>
              <Btn onClick={()=>{setParsed(null);setInput("");}} ghost full>ล้าง</Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── WEEKLY ANALYSIS ─────────────────────────────────────────
function WeeklyAnalysis({ events, userProfile, onClose }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");

  const analyze = useCallback(async () => {
    setLoading(true); setErr(""); setResult("");
    try {
      const today = todayStr();
      const weekAgo = addDays(today, -7);
      const wEvs = events.filter(e=>e.date>=weekAgo&&e.date<=today);
      const byCat = Object.keys(CATS).map(k=>({
        category: k,
        total: wEvs.filter(e=>e.category===k).length,
        completed: wEvs.filter(e=>e.category===k&&e.status==="completed").length,
        skipped: wEvs.filter(e=>e.category===k&&e.status==="skipped").length,
      }));
      const r = userProfile?.routine || {};
      const sleepGoalH = r.sleep_start && r.sleep_end ? (() => {
        const [sh,sm] = r.sleep_start.split(":").map(Number);
        const [eh,em] = r.sleep_end.split(":").map(Number);
        const diff = (eh*60+em) - (sh*60+sm);
        return ((diff < 0 ? diff+1440 : diff)/60).toFixed(1);
      })() : 8;

      const prompt = `คุณคือผู้ช่วยวิเคราะห์สุขภาพส่วนตัว ตอบเป็นภาษาไทยเท่านั้น ไม่ต้องใช้ emoji ตอบแบบกระชับ ตรงประเด็น

ข้อมูลผู้ใช้:
- เพศ: ${userProfile?.gender||"ไม่ระบุ"}
- อายุ: ${userProfile?.age||"ไม่ระบุ"} ปี
- น้ำหนัก: ${userProfile?.weight_kg||"ไม่ระบุ"} กก. ส่วนสูง: ${userProfile?.height_cm||"ไม่ระบุ"} ซม.
- เป้าหมาย: ${{"health":"สุขภาพดี","lose":"ลดน้ำหนัก","gain":"เพิ่มน้ำหนัก","muscle":"เพิ่มกล้ามเนื้อ"}[userProfile?.goal]||"สุขภาพดี"}
- เป้าหมายนอน: ${sleepGoalH} ชั่วโมง/คืน
- กำหนดออกกำลังกาย: ${r.exercise?"ใช่ "+r.exercise_start+"-"+r.exercise_end:"ไม่ได้กำหนด"}

สรุปกิจกรรม 7 วันที่ผ่านมา (${weekAgo} ถึง ${today}):
${byCat.map(c=>`- ${{"sleep":"นอนหลับ","meal":"อาหาร","exercise":"ออกกำลังกาย","work":"งาน"}[c.category]}: ทั้งหมด ${c.total} รายการ เสร็จ ${c.completed} ข้าม ${c.skipped}`).join("\n")}

วิเคราะห์ใน 4 หัวข้อนี้:
1. สรุปภาพรวมสัปดาห์ที่ผ่านมา
2. การนอนหลับ — เพียงพอหรือไม่ และควรปรับอย่างไร
3. การออกกำลังกายและอาหาร — เหมาะกับเป้าหมายของผู้ใช้ไหม
4. คำแนะนำสำหรับสัปดาห์หน้า (3 ข้อ)

ตอบตรงๆ ไม่ต้องพูดว่า "ฉัน" หรือ "AI" ไม่ต้องบอกว่าข้อมูลไม่เพียงพอ ให้วิเคราะห์จากข้อมูลที่มีทั้งหมด`;

      const raw = await callAI(prompt);
      setResult(raw);
    } catch(e) { setErr("เกิดข้อผิดพลาด: "+e.message); }
    setLoading(false);
  }, [events, userProfile]);

  useEffect(()=>{ analyze(); },[analyze]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(10px)" }}>
      <div style={{ width:"100%", maxWidth:500, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <Card style={{ display:"flex", flexDirection:"column", maxHeight:"85vh", overflow:"hidden" }}>
          <div style={{ padding:"16px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <div>
              <div style={{ fontSize:11, color:"#34C759", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase" }}>รายงานสุขภาพ</div>
              <div style={{ fontSize:17, fontWeight:600, color:"#f0f0f0" }}>วิเคราะห์สัปดาห์ที่ผ่านมา</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#888", fontSize:13 }}>✕</button>
          </div>
          <div style={{ padding:"16px 20px", overflowY:"auto", flex:1 }}>
            {loading && <div style={{ textAlign:"center", padding:"40px 0", color:"#555" }}><div style={{ fontSize:24, marginBottom:10, display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</div><br/>กำลังวิเคราะห์...</div>}
            {err && <div style={{ color:"#FF6B6B", fontSize:13 }}>{err}</div>}
            {result && <div style={{ fontSize:14, color:"#ddd", lineHeight:1.85, whiteSpace:"pre-wrap" }}>{result}</div>}
          </div>
          {!loading && (
            <div style={{ padding:"0 20px 18px", flexShrink:0, display:"flex", gap:8 }}>
              <Btn onClick={analyze} ghost full color="#34C759" small>วิเคราะห์ใหม่</Btn>
              <Btn onClick={onClose} ghost full small>ปิด</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── ROUTINE EDITOR ─────────────────────────────────────────
function RoutineEditor({ userProfile, userId, onClose, onSave }) {
  const [r, setR] = useState(userProfile?.routine || { sleep_start:"23:00", sleep_end:"07:00", work_start:"09:00", work_end:"18:00", exercise:true, exercise_start:"18:00", exercise_end:"19:00", meal_breakfast:"08:00", meal_lunch:"12:00", meal_dinner:"19:00" });
  const [saving, setSaving] = useState(false);
  const sr = (k,v) => setR(x=>({...x,[k]:v}));
  const iStyle = { width:"100%", padding:"8px 10px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", fontSize:13, color:"#f0f0f0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
  const lStyle = { fontSize:10, color:"#555", display:"block", marginBottom:3 };

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").update({ routine:r }).eq("id", userId);
    onSave(r);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(10px)" }}>
      <div style={{ width:"100%", maxWidth:420, maxHeight:"85vh", overflowY:"auto" }}>
        <Card>
          <div style={{ padding:"16px 20px 14px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:17, fontWeight:600, color:"#f0f0f0" }}>ตารางประจำวัน</div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#888", fontSize:13 }}>✕</button>
          </div>
          <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div><FieldLabel>การนอน</FieldLabel><div style={{ display:"flex", gap:8 }}><div style={{ flex:1 }}><label style={lStyle}>เข้านอน</label><input type="time" value={r.sleep_start} onChange={e=>sr("sleep_start",e.target.value)} style={iStyle}/></div><div style={{ flex:1 }}><label style={lStyle}>ตื่นนอน</label><input type="time" value={r.sleep_end} onChange={e=>sr("sleep_end",e.target.value)} style={iStyle}/></div></div></div>
            <div><FieldLabel>ทำงาน</FieldLabel><div style={{ display:"flex", gap:8 }}><div style={{ flex:1 }}><label style={lStyle}>เริ่มงาน</label><input type="time" value={r.work_start} onChange={e=>sr("work_start",e.target.value)} style={iStyle}/></div><div style={{ flex:1 }}><label style={lStyle}>เลิกงาน</label><input type="time" value={r.work_end} onChange={e=>sr("work_end",e.target.value)} style={iStyle}/></div></div></div>
            <div><FieldLabel>มื้ออาหาร</FieldLabel><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>{[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(m=>(<div key={m.k}><label style={lStyle}>{m.l}</label><input type="time" value={r[m.k]} onChange={e=>sr(m.k,e.target.value)} style={iStyle}/></div>))}</div></div>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}><FieldLabel>ออกกำลังกาย</FieldLabel><Toggle value={r.exercise} onChange={v=>sr("exercise",v)}/></div>
              {r.exercise&&<div style={{ display:"flex", gap:8 }}><div style={{ flex:1 }}><label style={lStyle}>เริ่ม</label><input type="time" value={r.exercise_start} onChange={e=>sr("exercise_start",e.target.value)} style={iStyle}/></div><div style={{ flex:1 }}><label style={lStyle}>สิ้นสุด</label><input type="time" value={r.exercise_end} onChange={e=>sr("exercise_end",e.target.value)} style={iStyle}/></div></div>}
            </div>
            <div style={{ display:"flex", gap:8 }}><Btn onClick={onClose} ghost full>ยกเลิก</Btn><Btn onClick={save} disabled={saving} full color="#34C759">{saving?"กำลังบันทึก...":"บันทึก"}</Btn></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ADD FORM ───────────────────────────────────────────────
function AddEventModal({ onSave, onClose, defaultDate }) {
  const [form, setForm] = useState({ title:"", category:"work", date:defaultDate||todayStr(), planned_start_time:"09:00", planned_end_time:"10:00", status:"scheduled", notes:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const iStyle = { width:"100%", padding:"9px 12px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", fontSize:13, color:"#f0f0f0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(12px)" }}/>
      <div style={{ position:"relative", width:"100%", maxWidth:480, zIndex:1, animation:"slideUp 0.2s ease" }}>
        <Card>
          <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:16, fontWeight:600, color:"#f0f0f0" }}>เพิ่มกิจกรรม</div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:28, height:28, borderRadius:"50%", cursor:"pointer", color:"#888", fontSize:13 }}>✕</button>
          </div>
          <div style={{ padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:12 }}>
            <div><FieldLabel>ชื่อ</FieldLabel><input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="ชื่อกิจกรรม..." style={{...iStyle,fontSize:15,fontWeight:500}}/></div>
            <div><FieldLabel>ประเภท</FieldLabel>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(CATS).map(([k,v])=>(
                  <button key={k} onClick={()=>set("category",k)} style={{ padding:"5px 12px", borderRadius:20, border:"none", background:form.category===k?v.dot:"rgba(255,255,255,0.05)", color:form.category===k?"#fff":"#888", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{v.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[{k:"date",l:"วันที่",t:"date"},{k:"planned_start_time",l:"เริ่ม",t:"time"},{k:"planned_end_time",l:"สิ้นสุด",t:"time"}].map(f=>(
                <div key={f.k}><FieldLabel>{f.l}</FieldLabel><input type={f.t} value={form[f.k]} onChange={e=>set(f.k,e.target.value)} style={iStyle}/></div>
              ))}
            </div>
            <div><FieldLabel>หมายเหตุ</FieldLabel><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="รายละเอียด..." rows={2} style={{...iStyle,resize:"none",lineHeight:1.6}}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>{ if(form.title.trim()) onSave(form); }} disabled={!form.title.trim()} full>เพิ่มกิจกรรม</Btn>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
function MainApp({ session }) {
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [showAI, setShowAI]           = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [viewMode, setViewMode]       = useState("day");
  const [currentDate, setCurrentDate] = useState(todayStr());
  const [filter, setFilter]           = useState("all");
  const [search, setSearch]           = useState("");
  const [authProfile, setAuthProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast]             = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const user = session.user;

  function showToast(msg, color="#34C759") {
    setToast({ msg, color });
    setTimeout(()=>setToast(null), 3000);
  }

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").eq("user_id", user.id).order("date",{ascending:false}).order("planned_start_time",{ascending:true});
    setEvents(data||[]);
    setLoading(false);
  }, [user.id]);

  const fetchProfile = useCallback(async () => {
    const { data:ap } = await supabase.from("profiles").select("*").eq("id",user.id).single();
    setAuthProfile(ap||{ display_name:user.user_metadata?.full_name, avatar_url:user.user_metadata?.avatar_url });
    const { data:up } = await supabase.from("user_profiles").select("*").eq("id",user.id).single();
    if (!up||!up.onboarded) { setShowOnboarding(true); } else { setUserProfile(up); }
  }, [user]);

  useEffect(()=>{ fetchEvents(); fetchProfile(); },[fetchEvents,fetchProfile]);

  // Auto-generate routine for today if no events exist
  useEffect(()=>{
    if (!userProfile?.routine || loading) return;
    const today = todayStr();
    const todayEvents = events.filter(e=>e.date===today);
    if (todayEvents.length === 0) generateRoutineForDate(today);
  }, [userProfile, loading]);

  async function generateRoutineForDate(date) {
    const r = userProfile?.routine;
    if (!r) return;
    const toAdd = [];
    if (r.sleep_start) toAdd.push({ category:"sleep", title:"นอนหลับ", date, planned_start_time:r.sleep_start, planned_end_time:r.sleep_end||"07:00", status:"scheduled", notes:"" });
    if (r.work_start)  toAdd.push({ category:"work",  title:"ทำงาน",   date, planned_start_time:r.work_start,  planned_end_time:r.work_end||"18:00",  status:"scheduled", notes:"" });
    if (r.exercise&&r.exercise_start) toAdd.push({ category:"exercise", title:"ออกกำลังกาย", date, planned_start_time:r.exercise_start, planned_end_time:r.exercise_end||"19:00", status:"scheduled", notes:"" });
    if (r.meal_breakfast) toAdd.push({ category:"meal", title:"มื้อเช้า",    date, planned_start_time:r.meal_breakfast, planned_end_time:addMinutes(r.meal_breakfast,30), status:"scheduled", notes:"" });
    if (r.meal_lunch)     toAdd.push({ category:"meal", title:"มื้อกลางวัน", date, planned_start_time:r.meal_lunch,     planned_end_time:addMinutes(r.meal_lunch,30),     status:"scheduled", notes:"" });
    if (r.meal_dinner)    toAdd.push({ category:"meal", title:"มื้อเย็น",    date, planned_start_time:r.meal_dinner,    planned_end_time:addMinutes(r.meal_dinner,30),    status:"scheduled", notes:"" });
    let count = 0;
    for (const ev of toAdd) {
      const { data } = await supabase.from("events").insert({...ev,user_id:user.id,id:uid()}).select().single();
      if (data) { setEvents(prev=>[data,...prev]); count++; }
    }
    if (count > 0) showToast(`สร้าง ${count} กิจกรรมจากตารางประจำวันแล้ว`);
  }

  async function addEvent(form) {
    const { data } = await supabase.from("events").insert({...form,user_id:user.id,id:uid()}).select().single();
    if (data) { setEvents(prev=>[data,...prev]); setShowAdd(false); showToast("เพิ่มกิจกรรมแล้ว"); }
  }

  async function addEventsFromAI(evList) {
    let count = 0;
    for (const ev of evList) {
      const { data } = await supabase.from("events").insert({...ev,user_id:user.id}).select().single();
      if (data) { setEvents(prev=>[data,...prev]); count++; }
    }
    setShowAI(false);
    showToast(`เพิ่ม ${count} กิจกรรมแล้ว`);
  }

  async function updateEvent(updated) {
    const { error } = await supabase.from("events").update(updated).eq("id",updated.id);
    if (!error) { setEvents(prev=>prev.map(e=>e.id===updated.id?updated:e)); setSelected(updated); setEditingEvent(null); }
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id",id);
    setEvents(prev=>prev.filter(e=>e.id!==id));
    setSelected(null);
    showToast("ลบกิจกรรมแล้ว", "#FF3B30");
  }

  async function resetAccount() {
    await supabase.from("events").delete().eq("user_id",user.id);
    await supabase.from("user_profiles").update({onboarded:false,routine:{},goal:null}).eq("id",user.id);
    setEvents([]);
    setUserProfile(null);
    setShowResetConfirm(false);
    setShowProfileMenu(false);
    setShowOnboarding(true);
    showToast("รีเซ็ตบัญชีแล้ว กรุณาตั้งค่าใหม่");
  }

  async function signOut() { await supabase.auth.signOut(); }

  // Week dates
  const weekStart = (() => { const d = new Date(currentDate+"T00:00:00"); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().split("T")[0]; })();
  const weekDates = Array.from({length:7},(_,i)=>addDays(weekStart,i));

  const today = todayStr();
  const dateEvts = viewMode==="day" ? events.filter(e=>e.date===currentDate) : events.filter(e=>weekDates.includes(e.date));
  const filtered = dateEvts.filter(e=>filter==="all"||e.category===filter).filter(e=>!search||e.title.toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered.reduce((acc,e)=>{ (acc[e.date]=acc[e.date]||[]).push(e); return acc; },{});
  const todayEvs = events.filter(e=>e.date===today);
  const done = todayEvs.filter(e=>e.status==="completed").length;
  const total = todayEvs.length;
  const pct = total ? Math.round((done/total)*100) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#080808", fontFamily:"-apple-system,'SF Pro Display',sans-serif", paddingBottom:60 }}>
      <style>{`
        @keyframes slideUp { from{transform:translateY(28px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        input[type="time"]::-webkit-calendar-picker-indicator { filter:invert(1) opacity(0.4); cursor:pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(1) opacity(0.4); cursor:pointer; }
      `}</style>

      {showOnboarding && (
        <Onboarding userId={user.id} onComplete={up=>{ setUserProfile(up); setShowOnboarding(false); showToast("ยินดีต้อนรับ ตั้งค่าเสร็จแล้ว"); }} />
      )}

      {/* Navbar */}
      <div style={{ background:"rgba(8,8,8,0.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"11px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#f0f0f0", letterSpacing:-0.3 }}>Calendar</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>setShowRoutine(true)} title="ตารางประจำวัน" style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)", color:"#888", padding:"5px 12px", borderRadius:20, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>ตาราง</button>
          <button onClick={()=>setShowAnalysis(true)} style={{ background:"rgba(52,199,89,0.1)", border:"1px solid rgba(52,199,89,0.2)", color:"#34C759", padding:"5px 12px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit" }}>วิเคราะห์</button>
          <button onClick={()=>setShowAI(!showAI)} style={{ background:showAI?"rgba(88,86,214,0.3)":"rgba(88,86,214,0.12)", border:"1px solid rgba(88,86,214,0.3)", color:"#a78bfa", padding:"5px 12px", borderRadius:20, cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"inherit" }}>AI</button>
          <button onClick={()=>setShowAdd(true)} style={{ background:"#007AFF", border:"none", color:"#fff", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,122,255,0.3)" }}>+</button>
          <button onClick={()=>setShowProfileMenu(!showProfileMenu)} style={{ border:"none", background:"none", cursor:"pointer", padding:0 }}>
            {authProfile?.avatar_url
              ? <img src={authProfile.avatar_url} alt="" style={{ width:30, height:30, borderRadius:"50%", objectFit:"cover", border:"1.5px solid rgba(255,255,255,0.15)" }}/>
              : <div style={{ width:30, height:30, borderRadius:"50%", background:"#007AFF", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600 }}>{(authProfile?.display_name||user.email||"?")[0].toUpperCase()}</div>
            }
          </button>
        </div>
      </div>

      {/* Profile menu */}
      {showProfileMenu && (
        <div style={{ position:"fixed", top:54, right:14, zIndex:100, animation:"fadeIn 0.15s ease" }}>
          <Card style={{ padding:"14px 16px", minWidth:210 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0f0f0" }}>{authProfile?.display_name||"ผู้ใช้"}</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:4 }}>{user.email}</div>
            {userProfile && (
              <div style={{ fontSize:12, color:"#444", borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:8, marginBottom:8 }}>
                {userProfile.age} ปี · {userProfile.weight_kg} กก. · {{"health":"สุขภาพดี","lose":"ลดน้ำหนัก","gain":"เพิ่มน้ำหนัก","muscle":"เพิ่มกล้ามเนื้อ"}[userProfile.goal]||userProfile.goal}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <Btn onClick={()=>{ setShowResetConfirm(true); setShowProfileMenu(false); }} ghost danger full small>รีเซ็ตบัญชี</Btn>
              <Btn onClick={signOut} ghost color="#888" full small>ออกจากระบบ</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm && (
        <div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:20, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)" }}>
          <Card style={{ padding:"24px", maxWidth:340, width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:17, fontWeight:600, color:"#f0f0f0", marginBottom:10 }}>รีเซ็ตบัญชี</div>
            <div style={{ fontSize:14, color:"#666", lineHeight:1.6, marginBottom:20 }}>ข้อมูลกิจกรรมและการตั้งค่าทั้งหมดจะถูกลบ และต้องตั้งค่าใหม่ ยืนยันหรือไม่</div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>setShowResetConfirm(false)} ghost full>ยกเลิก</Btn>
              <Btn onClick={resetAccount} danger full>ยืนยัน รีเซ็ต</Btn>
            </div>
          </Card>
        </div>
      )}

      <div style={{ maxWidth:820, margin:"0 auto", padding:"16px 14px 0" }}>

        {/* Metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
          {[{l:"วันนี้",v:total,col:"#007AFF"},{l:"เสร็จแล้ว",v:done,col:"#34C759"},{l:"Completion",v:`${pct}%`,col:"#FF9500"},{l:"รวม",v:events.length,col:"#5856D6"}].map(({l,v,col})=>(
            <div key={l} style={{ background:"rgba(22,22,24,0.9)", borderRadius:12, padding:"11px 12px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize:20, fontWeight:700, color:col, letterSpacing:-0.5 }}>{v}</div>
              <div style={{ fontSize:10, color:"#555", fontWeight:500, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* AI Panel */}
        {showAI && <AIPanel onAdd={addEventsFromAI} onClose={()=>setShowAI(false)} userId={user.id}/>}

        {/* View toggle + date nav */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", gap:4 }}>
            {[{v:"day",l:"รายวัน"},{v:"week",l:"สัปดาห์"}].map(m=>(
              <button key={m.v} onClick={()=>setViewMode(m.v)} style={{ padding:"5px 12px", borderRadius:20, border:"none", background:viewMode===m.v?"#007AFF":"rgba(22,22,24,0.9)", color:viewMode===m.v?"#fff":"#666", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{m.l}</button>
            ))}
          </div>
          {viewMode==="day" && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>setCurrentDate(addDays(currentDate,-1))} style={{ background:"rgba(255,255,255,0.06)", border:"none", color:"#888", width:26, height:26, borderRadius:"50%", cursor:"pointer", fontSize:13 }}>‹</button>
              <span onClick={()=>setCurrentDate(today)} style={{ fontSize:13, color:currentDate===today?"#007AFF":"#f0f0f0", minWidth:100, textAlign:"center", cursor:"pointer" }}>
                {currentDate===today?"วันนี้":fmtDateShort(currentDate)}
              </span>
              <button onClick={()=>setCurrentDate(addDays(currentDate,1))} style={{ background:"rgba(255,255,255,0.06)", border:"none", color:"#888", width:26, height:26, borderRadius:"50%", cursor:"pointer", fontSize:13 }}>›</button>
            </div>
          )}
        </div>

        {/* Week grid */}
        {viewMode==="week" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, marginBottom:12 }}>
            {weekDates.map(d=>{
              const cnt = events.filter(e=>e.date===d).length;
              const isT = d===today;
              const isSel = d===currentDate;
              return (
                <button key={d} onClick={()=>setCurrentDate(d)} style={{ background:isSel?"#007AFF":isT?"rgba(0,122,255,0.12)":"rgba(22,22,24,0.9)", border:`1px solid ${isSel?"#007AFF":isT?"rgba(0,122,255,0.25)":"rgba(255,255,255,0.06)"}`, borderRadius:10, padding:"7px 4px", cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:isSel?"rgba(255,255,255,0.7)":"#555" }}>{getDayName(d)}</div>
                  <div style={{ fontSize:15, fontWeight:600, color:isSel?"#fff":isT?"#007AFF":"#f0f0f0" }}>{new Date(d+"T00:00:00").getDate()}</div>
                  {cnt>0&&<div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"rgba(255,255,255,0.6)":"#007AFF", margin:"2px auto 0" }}/>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search + filter */}
        <div style={{ position:"relative", marginBottom:10 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{ width:"100%", padding:"9px 12px 9px 34px", background:"rgba(22,22,24,0.9)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, fontSize:13, color:"#f0f0f0", fontFamily:"inherit", outline:"none" }}/>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#333", fontSize:14, pointerEvents:"none" }}>⌕</span>
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
          {[["all","ทั้งหมด","#007AFF"],...Object.entries(CATS).map(([k,v])=>[k,v.label,v.dot])].map(([k,l,col])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{ padding:"5px 12px", borderRadius:20, border:"none", flexShrink:0, background:filter===k?col:"rgba(22,22,24,0.9)", color:filter===k?"#fff":"#666", fontSize:12, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>

        {/* Split layout */}
        <div style={{ display:"grid", gridTemplateColumns:selected?"1fr 340px":"1fr", gap:12, alignItems:"start" }}>
          <Card style={{ overflow:"hidden" }}>
            {loading ? (
              <div style={{ padding:"40px 20px", textAlign:"center", color:"#444" }}><div style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⟳</div></div>
            ) : Object.keys(grouped).length===0 ? (
              <div style={{ padding:"48px 20px", textAlign:"center" }}>
                <div style={{ fontSize:14, color:"#444" }}>ไม่มีกิจกรรม</div>
                <div style={{ fontSize:12, color:"#333", marginTop:4 }}>กด AI หรือ + เพื่อเพิ่ม</div>
              </div>
            ) : (
              Object.keys(grouped).sort().reverse().map(date=>(
                <div key={date}>
                  <div style={{ padding:"7px 16px 3px", fontSize:10, fontWeight:700, color:"#444", letterSpacing:0.5, textTransform:"uppercase", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    {date===today?"วันนี้":fmtDateShort(date)}
                    <span style={{ fontWeight:400, marginLeft:5, opacity:0.5 }}>{fmtDate(date)}</span>
                  </div>
                  {grouped[date].sort((a,b)=>(a.planned_start_time||"").localeCompare(b.planned_start_time||"")).map(ev=>{
                    const c = CATS[ev.category];
                    const isSel = selected?.id===ev.id;
                    const stCol = {completed:"#34C759",skipped:"#FF3B30",in_progress:"#FF9500",rescheduled:"#FF375F"}[ev.status]||"#444";
                    return (
                      <div key={ev.id} onClick={()=>setSelected(isSel?null:ev)}
                        style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", background:isSel?c.bg:"transparent", borderBottom:"1px solid rgba(255,255,255,0.04)", cursor:"pointer", transition:"background 0.1s" }}
                        onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background="rgba(255,255,255,0.02)"; }}
                        onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}
                      >
                        <div style={{ width:8, height:8, borderRadius:"50%", background:c.dot, flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:500, color:"#f0f0f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ev.title}</div>
                          <div style={{ fontSize:11, color:"#555", marginTop:1 }}>{ev.planned_start_time||""}{ev.planned_end_time?` – ${ev.planned_end_time}`:""}</div>
                        </div>
                        <span style={{ fontSize:11, color:stCol, fontWeight:500, flexShrink:0 }}>{STATUS_OPTS.find(s=>s.v===ev.status)?.l}</span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </Card>

          {/* Detail panel */}
          {selected && !editingEvent && (
            <Card style={{ position:"sticky", top:60, overflow:"hidden", animation:"fadeIn 0.15s ease" }}>
              <div style={{ padding:"16px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:CATS[selected.category].bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:CATS[selected.category].dot }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:"#555" }}>{CATS[selected.category].label}</div>
                      <div style={{ fontSize:15, fontWeight:600, color:"#f0f0f0" }}>{selected.title}</div>
                    </div>
                  </div>
                  <button onClick={()=>setSelected(null)} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:26, height:26, borderRadius:"50%", cursor:"pointer", color:"#666", fontSize:12 }}>✕</button>
                </div>
                <div style={{ display:"flex", gap:6, marginTop:10 }}>
                  <Btn onClick={()=>setEditingEvent({...selected})} ghost color="#007AFF" small>แก้ไข</Btn>
                  <Btn onClick={()=>deleteEvent(selected.id)} ghost danger small>ลบ</Btn>
                </div>
              </div>
              <div style={{ padding:"12px 18px" }}>
                {[["วันที่",fmtDate(selected.date)],["เวลา",`${selected.planned_start_time||"—"} – ${selected.planned_end_time||"—"}`],["หมายเหตุ",selected.notes||"—"]].map(([l,v])=>(
                  <div key={l} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize:12, color:"#555", minWidth:52, fontWeight:500 }}>{l}</span>
                    <span style={{ fontSize:13, color:"#ddd" }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:11, color:"#555", marginBottom:7 }}>สถานะ</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {STATUS_OPTS.map(s=>{
                      const col={completed:"#34C759",skipped:"#FF3B30",in_progress:"#FF9500",rescheduled:"#FF375F",scheduled:"#555"}[s.v];
                      return <button key={s.v} onClick={()=>updateEvent({...selected,status:s.v})} style={{ padding:"4px 10px", borderRadius:20, border:"none", background:selected.status===s.v?col:"rgba(255,255,255,0.05)", color:selected.status===s.v?"#fff":"#888", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{s.l}</button>;
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Edit panel */}
          {editingEvent && (
            <Card style={{ position:"sticky", top:60, overflow:"hidden", animation:"fadeIn 0.15s ease" }}>
              <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:15, fontWeight:600, color:"#f0f0f0" }}>แก้ไขกิจกรรม</div>
                <button onClick={()=>setEditingEvent(null)} style={{ background:"rgba(255,255,255,0.08)", border:"none", width:26, height:26, borderRadius:"50%", cursor:"pointer", color:"#666", fontSize:12 }}>✕</button>
              </div>
              <div style={{ padding:"14px 18px 18px", display:"flex", flexDirection:"column", gap:11 }}>
                {[{k:"title",l:"ชื่อ",t:"text"},{k:"date",l:"วันที่",t:"date"},{k:"planned_start_time",l:"เริ่ม",t:"time"},{k:"planned_end_time",l:"สิ้นสุด",t:"time"}].map(f=>(
                  <div key={f.k}>
                    <FieldLabel>{f.l}</FieldLabel>
                    <Input type={f.t} value={editingEvent[f.k]||""} onChange={v=>setEditingEvent(ev=>({...ev,[f.k]:v}))}/>
                  </div>
                ))}
                <div>
                  <FieldLabel>ประเภท</FieldLabel>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {Object.entries(CATS).map(([k,v])=>(
                      <button key={k} onClick={()=>setEditingEvent(ev=>({...ev,category:k}))} style={{ padding:"4px 10px", borderRadius:20, border:"none", background:editingEvent.category===k?v.dot:"rgba(255,255,255,0.05)", color:editingEvent.category===k?"#fff":"#888", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>{v.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={()=>updateEvent(editingEvent)} disabled={!editingEvent.title?.trim()} full color="#007AFF">บันทึก</Btn>
                  <Btn onClick={()=>setEditingEvent(null)} ghost full>ยกเลิก</Btn>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {showAdd && <AddEventModal onSave={addEvent} onClose={()=>setShowAdd(false)} defaultDate={currentDate}/>}
      {showAnalysis && <WeeklyAnalysis events={events} userProfile={userProfile} onClose={()=>setShowAnalysis(false)}/>}
      {showRoutine && <RoutineEditor userProfile={userProfile} userId={user.id} onClose={()=>setShowRoutine(false)} onSave={r=>{ setUserProfile(p=>({...p,routine:r})); setShowRoutine(false); showToast("บันทึกตารางประจำวันแล้ว"); }}/>}

      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:toast.color||"#34C759", color:"#fff", padding:"10px 22px", borderRadius:20, fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,0.4)", zIndex:999, whiteSpace:"nowrap", animation:"fadeIn 0.2s ease" }}>{toast.msg}</div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  if (session===undefined) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080808" }}>
      <div style={{ width:36,height:36,border:"2.5px solid #007AFF",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return session ? <MainApp session={session}/> : <LoginPage/>;
}
