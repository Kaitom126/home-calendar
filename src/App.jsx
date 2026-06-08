import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPA_URL, SUPA_KEY);

const CATS = {
  sleep:    { label:"นอนหลับ",     color:"#5E9BFF", bg:"rgba(94,155,255,0.12)",  dot:"#5E9BFF" },
  meal:     { label:"อาหาร",        color:"#FF9F40", bg:"rgba(255,159,64,0.12)",  dot:"#FF9F40" },
  exercise: { label:"ออกกำลังกาย", color:"#34C759", bg:"rgba(52,199,89,0.12)",   dot:"#34C759" },
  work:     { label:"งาน/นัดหมาย", color:"#FF375F", bg:"rgba(255,55,95,0.12)",   dot:"#FF375F" },
};
const STATUS_OPTS = [
  { v:"scheduled",   l:"รอ",        color:"#555"    },
  { v:"in_progress", l:"กำลังทำ",  color:"#FF9500" },
  { v:"completed",   l:"เสร็จแล้ว",color:"#34C759" },
  { v:"skipped",     l:"ข้าม",      color:"#FF3B30" },
];

const GOAL_LABELS = { health:"สุขภาพดี", lose:"ลดน้ำหนัก", gain:"เพิ่มน้ำหนัก", muscle:"เพิ่มกล้ามเนื้อ" };
const DAY_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const MONTH_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function uid() { return crypto.randomUUID(); }
function parseDate(s) { return new Date(s + "T00:00:00"); }
function fmtDateFull(s) {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear()+543}`;
}
function fmtDateShort(s) {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getDate()} ${MONTH_TH[d.getMonth()]}`;
}
function addDays(s, n) {
  const d = parseDate(s); d.setDate(d.getDate() + n);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
function addMinutes(t, m) {
  const [h,mm] = t.split(":").map(Number), tot=h*60+mm+m;
  return `${String(Math.floor(tot/60)%24).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;
}
function getWeekDates(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const monday = new Date(d); monday.setDate(d.getDate() - (day===0?6:day-1));
  return Array.from({length:7}, (_,i) => {
    const x = new Date(monday); x.setDate(monday.getDate()+i);
    return x.toISOString().split("T")[0];
  });
}

async function callAI(prompt) {
  const res = await fetch(`${SUPA_URL}/functions/v1/ai-parse`, {
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${SUPA_KEY}`},
    body:JSON.stringify({prompt}),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "AI Error");
  return data.content?.[0]?.text || "";
}

// ── Push Notification helpers ──────────────────────────────
async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch { return null; }
}

async function requestPushPermission() {
  if (!("Notification" in window)) return false;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function scheduleLocalNotification(title, body, delayMs, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  setTimeout(() => {
    try {
      navigator.serviceWorker?.ready.then(reg => {
        reg.showNotification(title, {
          body, tag, icon: "/icon-192.png",
          badge: "/icon-192.png",
          silent: false,
        });
      });
    } catch {}
  }, delayMs);
}

// ── UI Components ──────────────────────────────────────────
function Card({ children, style = {} }) {
  return <div style={{ background:"rgba(20,20,22,0.97)", backdropFilter:"blur(20px)", borderRadius:16, border:"1px solid rgba(255,255,255,0.07)", ...style }}>{children}</div>;
}

function Btn({ children, onClick, color="#007AFF", ghost=false, full=false, disabled=false, danger=false, small=false, style={} }) {
  const bg = danger?(ghost?"rgba(255,59,48,0.1)":"#FF3B30"):ghost?`${color}18`:color;
  const cl = danger?(ghost?"#FF3B30":"#fff"):ghost?color:"#fff";
  return (
    <button onClick={disabled?undefined:onClick} style={{
      border:"none", borderRadius:small?8:12,
      fontSize:small?13:15, fontWeight:600,
      padding:small?"8px 14px":"12px 20px",
      cursor:disabled?"not-allowed":"pointer",
      fontFamily:"inherit", width:full?"100%":"auto",
      opacity:disabled?0.35:1, background:bg, color:cl,
      WebkitTapHighlightColor:"transparent",
      ...style,
    }}>{children}</button>
  );
}

function FL({ children }) {
  return <label style={{ fontSize:12, color:"#555", fontWeight:600, letterSpacing:0.5, textTransform:"uppercase", display:"block", marginBottom:7 }}>{children}</label>;
}

// ── iOS-style Time Picker ──────────────────────────────────
function TimePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [h, m] = (value||"08:00").split(":").map(Number);
  const HOURS = Array.from({length:24},(_,i)=>i);
  const MINS  = [0,15,30,45];
  const [selH, setSelH] = useState(h);
  const [selM, setSelM] = useState(MINS.reduce((a,b)=>Math.abs(b-m)<Math.abs(a-m)?b:a));
  const hRef = useRef(null);
  const mRef = useRef(null);

  useEffect(()=>{
    if(open) {
      setTimeout(()=>{
        hRef.current?.children[selH]?.scrollIntoView({block:"center"});
        mRef.current?.children[MINS.indexOf(selM)]?.scrollIntoView({block:"center"});
      },50);
    }
  },[open]);

  function confirm() {
    onChange(`${String(selH).padStart(2,"0")}:${String(selM).padStart(2,"0")}`);
    setOpen(false);
  }

  function thaiTime(hh,mm) {
    const s = mm>0?` ${mm}`:""
    if(hh===0) return `เที่ยงคืน${s}`;
    if(hh<12)  return `${hh} โมงเช้า${s}`;
    if(hh===12) return `เที่ยง${s}`;
    if(hh<18)  return `บ่าย ${hh-12}${s}`;
    if(hh===18) return `6 โมงเย็น${s}`;
    if(hh<19)  return `${hh-12} โมงเย็น${s}`;
    return `${hh-18} ทุ่ม${s}`;
  }

  const displayTime = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;

  return (
    <div>
      {label && <FL>{label}</FL>}
      <button onClick={()=>setOpen(true)} style={{
        width:"100%", padding:"12px 14px", borderRadius:12,
        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
        color:"#f0f0f0", fontSize:15, cursor:"pointer",
        fontFamily:"inherit", textAlign:"left",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        WebkitTapHighlightColor:"transparent",
      }}>
        <span style={{fontWeight:600}}>{displayTime}</span>
        <span style={{fontSize:13,color:"#555"}}>{thaiTime(h,m)}</span>
      </button>

      {open && (
        <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={()=>setOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}/>
          <div style={{position:"relative",width:"100%",maxWidth:380,zIndex:1,animation:"slideUp 0.25s ease"}}>
            <Card style={{borderRadius:"20px 20px 0 0",paddingBottom:"env(safe-area-inset-bottom)"}}>
              <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#FF3B30",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>ยกเลิก</button>
                <span style={{fontSize:15,fontWeight:600,color:"#f0f0f0"}}>{label||"เลือกเวลา"}</span>
                <button onClick={confirm} style={{background:"none",border:"none",color:"#007AFF",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>ตกลง</button>
              </div>
              <div style={{display:"flex",padding:"8px 0 16px",position:"relative"}}>
                {/* Selection highlight */}
                <div style={{position:"absolute",top:"50%",left:0,right:0,height:44,background:"rgba(255,255,255,0.06)",borderRadius:8,transform:"translateY(-50%)",pointerEvents:"none",zIndex:0,margin:"0 12px"}}/>
                {/* Hours */}
                <div ref={hRef} style={{flex:1,height:200,overflowY:"auto",scrollSnapType:"y mandatory",scrollbarWidth:"none"}}>
                  <div style={{height:78}}/>
                  {HOURS.map(hh=>(
                    <div key={hh} onClick={()=>setSelH(hh)} style={{
                      height:44,display:"flex",alignItems:"center",justifyContent:"center",
                      scrollSnapAlign:"center",cursor:"pointer",
                      fontSize:selH===hh?22:18,fontWeight:selH===hh?700:400,
                      color:selH===hh?"#fff":"#555",transition:"all 0.15s",
                    }}>{String(hh).padStart(2,"0")}</div>
                  ))}
                  <div style={{height:78}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",color:"#555",fontSize:22,padding:"0 4px",zIndex:1}}>:</div>
                {/* Minutes */}
                <div ref={mRef} style={{flex:1,height:200,overflowY:"auto",scrollSnapType:"y mandatory",scrollbarWidth:"none"}}>
                  <div style={{height:78}}/>
                  {MINS.map(mm=>(
                    <div key={mm} onClick={()=>setSelM(mm)} style={{
                      height:44,display:"flex",alignItems:"center",justifyContent:"center",
                      scrollSnapAlign:"center",cursor:"pointer",
                      fontSize:selM===mm?22:18,fontWeight:selM===mm?700:400,
                      color:selM===mm?"#fff":"#555",transition:"all 0.15s",
                    }}>{String(mm).padStart(2,"0")}</div>
                  ))}
                  <div style={{height:78}}/>
                </div>
              </div>
              <div style={{textAlign:"center",paddingBottom:16,fontSize:14,color:"#555"}}>{thaiTime(selH,selM)}</div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mini Calendar Date Picker ──────────────────────────────
function CalendarPicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDate(value||todayStr());
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const today = todayStr();
  const selDate = value||today;

  function getDays() {
    const { y, m } = viewMonth;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m+1, 0).getDate();
    const offset = first === 0 ? 6 : first - 1;
    const cells = [];
    for(let i=0;i<offset;i++) cells.push(null);
    for(let i=1;i<=days;i++) cells.push(i);
    return cells;
  }

  function selectDay(day) {
    const { y, m } = viewMonth;
    const s = `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onChange(s); setOpen(false);
  }

  const days = getDays();
  const isCurrent = value === today;

  return (
    <div>
      {label && <FL>{label}</FL>}
      <button onClick={()=>setOpen(true)} style={{
        width:"100%", padding:"12px 14px", borderRadius:12,
        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
        color:"#f0f0f0", fontSize:15, cursor:"pointer",
        fontFamily:"inherit", textAlign:"left",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        WebkitTapHighlightColor:"transparent",
      }}>
        <span style={{fontWeight:600}}>{isCurrent?"วันนี้":fmtDateShort(selDate)}</span>
        <span style={{fontSize:13,color:"#555"}}>{fmtDateFull(selDate)}</span>
      </button>

      {open && (
        <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={()=>setOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)"}}/>
          <div style={{position:"relative",width:"100%",maxWidth:380,zIndex:1,animation:"slideUp 0.25s ease"}}>
            <Card style={{borderRadius:"20px 20px 0 0",padding:"0 0 24px",paddingBottom:"calc(24px + env(safe-area-inset-bottom))"}}>
              {/* Header */}
              <div style={{padding:"14px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#FF3B30",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>ยกเลิก</button>
                <span style={{fontSize:15,fontWeight:600,color:"#f0f0f0"}}>{MONTH_TH[viewMonth.m]} {viewMonth.y+543}</span>
                <button onClick={()=>onChange(today)||setOpen(false)} style={{background:"none",border:"none",color:"#007AFF",fontSize:15,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>วันนี้</button>
              </div>
              {/* Month nav */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px 6px"}}>
                <button onClick={()=>setViewMonth(v=>({y:v.m===0?v.y-1:v.y,m:v.m===0?11:v.m-1}))} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#f0f0f0",width:36,height:36,borderRadius:"50%",cursor:"pointer",fontSize:18,WebkitTapHighlightColor:"transparent"}}>‹</button>
                <span style={{fontSize:14,color:"#aaa"}}>{viewMonth.y+543}</span>
                <button onClick={()=>setViewMonth(v=>({y:v.m===11?v.y+1:v.y,m:v.m===11?0:v.m+1}))} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#f0f0f0",width:36,height:36,borderRadius:"50%",cursor:"pointer",fontSize:18,WebkitTapHighlightColor:"transparent"}}>›</button>
              </div>
              {/* Day headers */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 12px",marginBottom:4}}>
                {DAY_TH.map(d=><div key={d} style={{textAlign:"center",fontSize:12,color:"#555",padding:"4px 0"}}>{d}</div>)}
              </div>
              {/* Days grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 12px",gap:2}}>
                {days.map((day,i)=>{
                  if(!day) return <div key={i}/>;
                  const ds = `${viewMonth.y}-${String(viewMonth.m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const isSel = ds===selDate, isT = ds===today;
                  return (
                    <button key={i} onClick={()=>selectDay(day)} style={{
                      aspectRatio:"1",borderRadius:"50%",border:"none",
                      background:isSel?"#007AFF":isT?"rgba(0,122,255,0.15)":"transparent",
                      color:isSel?"#fff":isT?"#007AFF":"#f0f0f0",
                      fontSize:15,fontWeight:isSel||isT?600:400,
                      cursor:"pointer",WebkitTapHighlightColor:"transparent",
                    }}>{day}</button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:340,textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:20,margin:"0 auto 28px",background:"linear-gradient(135deg,#007AFF,#5856D6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>📅</div>
        <h1 style={{fontSize:28,fontWeight:700,color:"#f0f0f0",marginBottom:8,letterSpacing:-0.5}}>Calendar Tracker</h1>
        <p style={{fontSize:15,color:"#555",marginBottom:40,lineHeight:1.6}}>ติดตามกิจวัตรประจำวัน</p>
        <Card style={{padding:24}}>
          <button onClick={async()=>{setLoading(true);await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});}} disabled={loading}
            style={{width:"100%",padding:"14px",background:"#1c1c1e",border:"1px solid #2c2c2e",borderRadius:14,fontSize:16,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontFamily:"inherit",color:"#f0f0f0",WebkitTapHighlightColor:"transparent"}}>
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {loading?"กำลังเข้าสู่ระบบ...":"เข้าสู่ระบบด้วย Google"}
          </button>
        </Card>
      </div>
    </div>
  );
}

// ── ONBOARDING ─────────────────────────────────────────────
function Onboarding({ userId, onComplete }) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState({ gender:"male", age:"", weight:"", height:"", goal:"health" });
  const [r, setR] = useState({ sleep_start:"23:00", sleep_end:"07:00", work_start:"09:00", work_end:"18:00", exercise:true, exercise_start:"18:00", exercise_end:"19:30", meal_breakfast:"08:00", meal_lunch:"12:00", meal_dinner:"19:00" });
  const [saving, setSaving] = useState(false);
  const sp=(k,v)=>setP(x=>({...x,[k]:v}));
  const sr=(k,v)=>setR(x=>({...x,[k]:v}));

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").upsert({ id:userId, gender:p.gender, age:parseInt(p.age)||0, weight_kg:parseFloat(p.weight)||0, height_cm:parseFloat(p.height)||0, goal:p.goal, routine:r, onboarded:true });
    const { data } = await supabase.from("user_profiles").select("*").eq("id",userId).single();
    onComplete(data);
  }

  const iStyle = { width:"100%", padding:"12px 14px", borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", fontSize:16, color:"#f0f0f0", fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"#080808",overflowY:"auto",fontFamily:"-apple-system,sans-serif"}}>
      <div style={{maxWidth:440,margin:"0 auto",padding:"40px 20px 60px"}}>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:13,color:"#007AFF",fontWeight:600,letterSpacing:0.5,marginBottom:6}}>{step} / 2</div>
          <div style={{fontSize:26,fontWeight:700,color:"#f0f0f0"}}>{step===1?"บอกเราเกี่ยวกับคุณ":"ตารางประจำวัน"}</div>
          <div style={{fontSize:15,color:"#555",marginTop:6}}>{step===1?"AI จะวิเคราะห์สุขภาพเฉพาะบุคคลได้แม่นขึ้น":"ระบบจะสร้างกิจกรรมให้อัตโนมัติทุกวัน"}</div>
        </div>

        {step===1 && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div>
              <FL>เพศ</FL>
              <div style={{display:"flex",gap:8}}>
                {[{v:"male",l:"ชาย"},{v:"female",l:"หญิง"},{v:"other",l:"อื่นๆ"}].map(g=>(
                  <button key={g.v} onClick={()=>sp("gender",g.v)} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:p.gender===g.v?"#007AFF":"rgba(255,255,255,0.06)",color:p.gender===g.v?"#fff":"#888",fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>{g.l}</button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[{k:"age",l:"อายุ (ปี)",ph:"25"},{k:"weight",l:"น้ำหนัก (กก.)",ph:"70"},{k:"height",l:"ส่วนสูง (ซม.)",ph:"170"}].map(f=>(
                <div key={f.k}><FL>{f.l}</FL><input type="number" inputMode="decimal" value={p[f.k]} onChange={e=>sp(f.k,e.target.value)} placeholder={f.ph} style={iStyle}/></div>
              ))}
            </div>
            <div>
              <FL>เป้าหมาย</FL>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {Object.entries(GOAL_LABELS).map(([v,l])=>(
                  <button key={v} onClick={()=>sp("goal",v)} style={{padding:"10px 16px",borderRadius:20,border:"none",background:p.goal===v?"#5856D6":"rgba(255,255,255,0.06)",color:p.goal===v?"#fff":"#888",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>{l}</button>
                ))}
              </div>
            </div>
            <Btn onClick={()=>setStep(2)} full disabled={!p.age||!p.weight||!p.height}>ถัดไป →</Btn>
          </div>
        )}

        {step===2 && (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div>
              <div style={{fontSize:14,color:"#5E9BFF",fontWeight:600,marginBottom:12}}>การนอนหลับ</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <TimePicker label="เข้านอน" value={r.sleep_start} onChange={v=>sr("sleep_start",v)}/>
                <TimePicker label="ตื่นนอน" value={r.sleep_end} onChange={v=>sr("sleep_end",v)}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:14,color:"#FF375F",fontWeight:600,marginBottom:12}}>การทำงาน</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <TimePicker label="เริ่มงาน" value={r.work_start} onChange={v=>sr("work_start",v)}/>
                <TimePicker label="เลิกงาน" value={r.work_end} onChange={v=>sr("work_end",v)}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:14,color:"#FF9F40",fontWeight:600,marginBottom:12}}>มื้ออาหาร</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <TimePicker label="เช้า" value={r.meal_breakfast} onChange={v=>sr("meal_breakfast",v)}/>
                <TimePicker label="กลางวัน" value={r.meal_lunch} onChange={v=>sr("meal_lunch",v)}/>
                <TimePicker label="เย็น" value={r.meal_dinner} onChange={v=>sr("meal_dinner",v)}/>
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:14,color:"#34C759",fontWeight:600}}>ออกกำลังกาย</div>
                <button onClick={()=>sr("exercise",!r.exercise)} style={{background:r.exercise?"#34C759":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:52,height:30,cursor:"pointer",position:"relative",transition:"background 0.2s",WebkitTapHighlightColor:"transparent"}}>
                  <div style={{position:"absolute",top:3,left:r.exercise?25:3,width:24,height:24,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
                </button>
              </div>
              {r.exercise && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <TimePicker label="เริ่ม" value={r.exercise_start} onChange={v=>sr("exercise_start",v)}/>
                  <TimePicker label="สิ้นสุด" value={r.exercise_end} onChange={v=>sr("exercise_end",v)}/>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>setStep(1)} ghost full>← ย้อนกลับ</Btn>
              <Btn onClick={save} disabled={saving} full color="#34C759">{saving?"กำลังบันทึก...":"เริ่มใช้งาน"}</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI PARSE PANEL ─────────────────────────────────────────
function AIPanel({ onAdd, onClose, userId }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const catColors={sleep:"#5E9BFF",meal:"#FF9F40",exercise:"#34C759",work:"#FF375F"};
  const catLabels={sleep:"นอนหลับ",meal:"อาหาร",exercise:"ออกกำลังกาย",work:"งาน"};
  const EX=["ประชุม sprint พรุ่งนี้ 10.30","gym วันศุกร์ 6 โมงเย็น","นัดหมอ 15 มิ.ย. บ่าย 2","ดินเนอร์กับแฟน 7 โมงเย็น"];

  async function parse() {
    if(!input.trim()) return;
    setLoading(true); setErr(""); setParsed(null);
    try {
      const raw = await callAI(input);
      const clean = raw.replace(/```json|```/g,"").trim();
      const items = JSON.parse(clean);
      if(!Array.isArray(items)||items.length===0) { setErr("ไม่พบกิจกรรม ลองพิมพ์ใหม่"); }
      else { setParsed(items.map(ev=>({...ev,id:uid(),user_id:userId}))); }
    } catch(e) { setErr("เกิดข้อผิดพลาด: "+e.message); }
    setLoading(false);
  }

  return (
    <Card style={{marginBottom:12}}>
      <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>เพิ่มกิจกรรมด้วย AI</div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:30,height:30,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:16,WebkitTapHighlightColor:"transparent"}}>✕</button>
      </div>
      <div style={{padding:"14px 16px 18px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {EX.map(ex=>(<button key={ex} onClick={()=>setInput(ex)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#666",fontSize:12,padding:"5px 10px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>{ex}</button>))}
        </div>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          placeholder={"พิมพ์กิจกรรมแบบธรรมชาติ...\n\nเช่น: ประชุม 10 โมงพรุ่งนี้, gym 6 โมงเย็น, นัดหมอ 15 มิ.ย. บ่าย 2"}
          rows={3} style={{width:"100%",resize:"none",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",fontSize:15,color:"#f0f0f0",fontFamily:"-apple-system,'Noto Sans Thai',sans-serif",outline:"none",lineHeight:1.7,boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor="rgba(88,86,214,0.5)"}
          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
        />
        <Btn onClick={parse} disabled={loading||!input.trim()} full color="#5856D6">{loading?"กำลังวิเคราะห์...":"วิเคราะห์กิจกรรม"}</Btn>
        {err && <div style={{background:"rgba(255,59,48,0.08)",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#FF6B6B"}}>{err}</div>}
        {parsed&&parsed.length>0&&(
          <div>
            <div style={{fontSize:12,color:"#34C759",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>พบ {parsed.length} กิจกรรม</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
              {parsed.map(ev=>(
                <div key={ev.id} style={{background:"rgba(255,255,255,0.03)",borderLeft:`3px solid ${catColors[ev.category]||"#444"}`,borderRadius:8,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:500,color:"#f0f0f0"}}>{ev.title}</span>
                      {ev.is_important && <span style={{fontSize:10,color:"#FF9500",fontWeight:700}}>สำคัญ</span>}
                    </div>
                    <div style={{fontSize:12,color:"#555"}}>{fmtDateShort(ev.date)} · {ev.planned_start_time} – {ev.planned_end_time}</div>
                  </div>
                  <button onClick={()=>setParsed(prev=>prev.map(e=>e.id===ev.id?{...e,is_important:!e.is_important}:e))} style={{background:ev.is_important?"rgba(255,149,0,0.15)":"rgba(255,255,255,0.04)",border:"none",borderRadius:8,padding:"4px 8px",color:ev.is_important?"#FF9500":"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>สำคัญ</button>
                  <button onClick={()=>setParsed(prev=>prev.filter(e=>e.id!==ev.id))} style={{background:"transparent",border:"none",color:"#FF3B30",fontSize:18,cursor:"pointer",padding:"2px 4px",WebkitTapHighlightColor:"transparent"}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onAdd(parsed)} full color="#34C759">บันทึก {parsed.length} รายการ</Btn>
              <Btn onClick={()=>{setParsed(null);setInput("");}} ghost full>ล้าง</Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── AI HEALTH CHAT ─────────────────────────────────────────
function AIHealthChat({ events, userProfile, onClose }) {
  const [messages, setMessages] = useState([
    {role:"assistant",text:"สวัสดีครับ ถามได้เลยนะครับ เช่น รูปร่างตอนนี้เป็นยังไง ควรปรับการนอนหรือกินไหม หรือสรุปสัปดาห์ที่ผ่านมาให้หน่อย"}
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  async function send() {
    if(!input.trim()||loading) return;
    const msg = input.trim(); setInput("");
    setMessages(m=>[...m,{role:"user",text:msg}]);
    setLoading(true);
    try {
      const today = todayStr(), weekAgo = addDays(today,-7);
      const wEvs = events.filter(e=>e.date>=weekAgo&&e.date<=today);
      const byCat = Object.keys(CATS).map(k=>({ cat:k, total:wEvs.filter(e=>e.category===k).length, done:wEvs.filter(e=>e.category===k&&e.status==="completed").length }));
      const up = userProfile;
      const bmi = up?.weight_kg&&up?.height_cm?(up.weight_kg/Math.pow(up.height_cm/100,2)).toFixed(1):null;
      const ctx = `ผู้ช่วยวิเคราะห์สุขภาพส่วนตัว ตอบภาษาไทย สั้น กระชับ ตรงจุด ไม่เกิน 4 ประโยค ไม่ใช้ emoji\nผู้ใช้: ${up?.gender||"?"} ${up?.age||"?"}ปี ${up?.weight_kg||"?"}กก. ${up?.height_cm||"?"}ซม.${bmi?` BMI ${bmi}`:""} เป้าหมาย: ${GOAL_LABELS[up?.goal]||"สุขภาพดี"}\n7 วันล่าสุด: ${byCat.map(c=>`${{"sleep":"นอน","meal":"กิน","exercise":"ออกกำลัง","work":"ทำงาน"}[c.cat]} ${c.done}/${c.total}`).join(" | ")}`;
      const history = messages.slice(-6).map(m=>`${m.role==="user"?"ผู้ใช้":"ผู้ช่วย"}: ${m.text}`).join("\n");
      const raw = await callAI(`${ctx}\n\n${history}\nผู้ใช้: ${msg}\nผู้ช่วย:`);
      setMessages(m=>[...m,{role:"assistant",text:raw.trim()}]);
    } catch { setMessages(m=>[...m,{role:"assistant",text:"เกิดข้อผิดพลาด ลองใหม่นะครับ"}]); }
    setLoading(false);
  }

  const QQ = ["รูปร่างตอนนี้เป็นยังไง","ควรปรับการนอนไหม","ออกกำลังกายเพียงพอไหม","สัปดาห์นี้เป็นยังไงบ้าง"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(12px)"}}>
      <div style={{width:"100%",maxWidth:520,height:"80vh",display:"flex",flexDirection:"column",animation:"slideUp 0.25s ease"}}>
        <Card style={{display:"flex",flexDirection:"column",height:"100%",borderRadius:"20px 20px 0 0"}}>
          <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>AI วิเคราะห์สุขภาพ</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:30,height:30,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:16,WebkitTapHighlightColor:"transparent"}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"82%",padding:"10px 14px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:m.role==="user"?"#007AFF":"rgba(255,255,255,0.07)",fontSize:15,color:"#f0f0f0",lineHeight:1.6}}>{m.text}</div>
              </div>
            ))}
            {loading&&<div style={{display:"flex"}}><div style={{padding:"10px 14px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,0.07)",color:"#555",fontSize:14}}>กำลังคิด...</div></div>}
            <div ref={bottomRef}/>
          </div>
          <div style={{padding:"8px 12px",display:"flex",gap:5,overflowX:"auto",flexShrink:0}}>
            {QQ.map(q=>(<button key={q} onClick={()=>setInput(q)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#666",fontSize:12,padding:"5px 11px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>{q}</button>))}
          </div>
          <div style={{padding:"8px 12px 16px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8,flexShrink:0,paddingBottom:"calc(16px + env(safe-area-inset-bottom))"}}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="ถามอะไรก็ได้..."
              style={{flex:1,padding:"10px 14px",borderRadius:22,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",fontSize:15,color:"#f0f0f0",fontFamily:"inherit",outline:"none"}}
            />
            <button onClick={send} disabled={loading||!input.trim()} style={{background:"#007AFF",border:"none",width:40,height:40,borderRadius:"50%",cursor:"pointer",color:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",opacity:loading||!input.trim()?0.4:1,flexShrink:0,WebkitTapHighlightColor:"transparent"}}>↑</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ROUTINE EDITOR ─────────────────────────────────────────
function RoutineEditor({ userProfile, userId, onClose, onSave }) {
  const [r, setR] = useState(userProfile?.routine||{sleep_start:"23:00",sleep_end:"07:00",work_start:"09:00",work_end:"18:00",exercise:true,exercise_start:"18:00",exercise_end:"19:30",meal_breakfast:"08:00",meal_lunch:"12:00",meal_dinner:"19:00"});
  const [saving, setSaving] = useState(false);
  const sr=(k,v)=>setR(x=>({...x,[k]:v}));

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(12px)"}}>
      <div style={{width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.25s ease"}}>
        <Card style={{borderRadius:"20px 20px 0 0",paddingBottom:"env(safe-area-inset-bottom)"}}>
          <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>ตารางประจำวัน</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:30,height:30,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:16,WebkitTapHighlightColor:"transparent"}}>✕</button>
          </div>
          <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:18}}>
            {[
              {label:"การนอน",color:"#5E9BFF",fields:[{k:"sleep_start",l:"เข้านอน"},{k:"sleep_end",l:"ตื่นนอน"}]},
              {label:"ทำงาน",color:"#FF375F",fields:[{k:"work_start",l:"เริ่มงาน"},{k:"work_end",l:"เลิกงาน"}]},
            ].map(sec=>(
              <div key={sec.label}>
                <div style={{fontSize:13,color:sec.color,fontWeight:600,marginBottom:10}}>{sec.label}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {sec.fields.map(f=>(<TimePicker key={f.k} label={f.l} value={r[f.k]} onChange={v=>sr(f.k,v)}/>))}
                </div>
              </div>
            ))}
            <div>
              <div style={{fontSize:13,color:"#FF9F40",fontWeight:600,marginBottom:10}}>มื้ออาหาร</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(f=>(<TimePicker key={f.k} label={f.l} value={r[f.k]} onChange={v=>sr(f.k,v)}/>))}
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,color:"#34C759",fontWeight:600}}>ออกกำลังกาย</div>
                <button onClick={()=>sr("exercise",!r.exercise)} style={{background:r.exercise?"#34C759":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:52,height:30,cursor:"pointer",position:"relative",transition:"background 0.2s",WebkitTapHighlightColor:"transparent"}}>
                  <div style={{position:"absolute",top:3,left:r.exercise?25:3,width:24,height:24,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                </button>
              </div>
              {r.exercise&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><TimePicker label="เริ่ม" value={r.exercise_start} onChange={v=>sr("exercise_start",v)}/><TimePicker label="สิ้นสุด" value={r.exercise_end} onChange={v=>sr("exercise_end",v)}/></div>}
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
              <Btn onClick={async()=>{setSaving(true);await supabase.from("user_profiles").update({routine:r}).eq("id",userId);onSave(r);}} disabled={saving} full color="#34C759">{saving?"บันทึก...":"บันทึก"}</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── EVENT MODAL ────────────────────────────────────────────
function EventModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial||{title:"",category:"work",date:todayStr(),planned_start_time:"09:00",planned_end_time:"10:00",status:"scheduled",notes:"",is_important:false});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(12px)"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0}}/>
      <div style={{position:"relative",width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",zIndex:1,animation:"slideUp 0.25s ease"}}>
        <Card style={{borderRadius:"20px 20px 0 0",paddingBottom:"env(safe-area-inset-bottom)"}}>
          <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"rgba(20,20,22,0.98)",zIndex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>{initial?"แก้ไขกิจกรรม":"เพิ่มกิจกรรม"}</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:30,height:30,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:16,WebkitTapHighlightColor:"transparent"}}>✕</button>
          </div>
          <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <FL>ชื่อกิจกรรม</FL>
              <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="ชื่อกิจกรรม..."
                style={{width:"100%",padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",fontSize:16,color:"#f0f0f0",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <FL>ประเภท</FL>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {Object.entries(CATS).map(([k,v])=>(
                  <button key={k} onClick={()=>set("category",k)} style={{padding:"8px 16px",borderRadius:20,border:"none",background:form.category===k?v.dot:"rgba(255,255,255,0.06)",color:form.category===k?"#fff":"#888",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>{v.label}</button>
                ))}
              </div>
            </div>
            <CalendarPicker label="วันที่" value={form.date} onChange={v=>set("date",v)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <TimePicker label="เวลาเริ่ม" value={form.planned_start_time} onChange={v=>set("planned_start_time",v)}/>
              <TimePicker label="เวลาสิ้นสุด" value={form.planned_end_time} onChange={v=>set("planned_end_time",v)}/>
            </div>
            {/* Important toggle */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"rgba(255,149,0,0.08)",borderRadius:12,border:"1px solid rgba(255,149,0,0.15)"}}>
              <div>
                <div style={{fontSize:15,color:"#f0f0f0",fontWeight:500}}>สำคัญ (แจ้งเตือนก่อน 30 นาที)</div>
                <div style={{fontSize:12,color:"#555",marginTop:2}}>ปกติแจ้งก่อน 10 นาที · งาน/gym แจ้งก่อน 30 นาทีอยู่แล้ว</div>
              </div>
              <button onClick={()=>set("is_important",!form.is_important)} style={{background:form.is_important?"#FF9500":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:52,height:30,cursor:"pointer",position:"relative",transition:"background 0.2s",WebkitTapHighlightColor:"transparent"}}>
                <div style={{position:"absolute",top:3,left:form.is_important?25:3,width:24,height:24,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </button>
            </div>
            <div>
              <FL>หมายเหตุ</FL>
              <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2}
                style={{width:"100%",resize:"none",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",fontSize:15,color:"#f0f0f0",fontFamily:"inherit",outline:"none",lineHeight:1.6,boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn onClick={()=>{if(form.title.trim()) onSave(form);}} disabled={!form.title.trim()} full>{initial?"บันทึก":"เพิ่มกิจกรรม"}</Btn>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Inline Calendar Picker Modal ──────────────────────────
function InlineCal({ value, onChange, onClose, today }) {
  const selDate = value || today;
  const initD = new Date(selDate + "T00:00:00");
  const [vy, setVy] = useState(initD.getFullYear());
  const [vm, setVm] = useState(initD.getMonth());

  function localStr(y,m,d) {
    return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }

  function getDays() {
    const first = new Date(vy,vm,1).getDay();
    const total = new Date(vy,vm+1,0).getDate();
    const offset = first===0?6:first-1;
    const cells = [];
    for(let i=0;i<offset;i++) cells.push(null);
    for(let i=1;i<=total;i++) cells.push(i);
    return cells;
  }

  function prevMonth() {
    if(vm===0) { setVy(y=>y-1); setVm(11); }
    else setVm(m=>m-1);
  }
  function nextMonth() {
    if(vm===11) { setVy(y=>y+1); setVm(0); }
    else setVm(m=>m+1);
  }

  const days = getDays();

  return (
    <div style={{position:"fixed",inset:0,zIndex:800,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.65)",backdropFilter:"blur(10px)"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0}}/>
      <div style={{position:"relative",width:"100%",maxWidth:400,zIndex:1,animation:"slideUp 0.25s ease"}}>
        <div style={{background:"rgba(20,20,22,0.99)",borderRadius:"22px 22px 0 0",border:"1px solid rgba(255,255,255,0.08)",borderBottom:"none",paddingBottom:"env(safe-area-inset-bottom)"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <button onClick={onClose} style={{background:"none",border:"none",color:"#FF3B30",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:500,WebkitTapHighlightColor:"transparent"}}>ยกเลิก</button>
            <span style={{fontSize:16,fontWeight:700,color:"#f0f0f0"}}>{MONTH_TH[vm]} {vy+543}</span>
            <button onClick={()=>onChange(today)} style={{background:"none",border:"none",color:"#007AFF",fontSize:15,cursor:"pointer",fontFamily:"inherit",fontWeight:600,WebkitTapHighlightColor:"transparent"}}>วันนี้</button>
          </div>
          {/* Month nav */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px 4px"}}>
            <button onClick={prevMonth} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#f0f0f0",width:40,height:40,borderRadius:"50%",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
            <span style={{fontSize:14,color:"#888"}}>{vy}</span>
            <button onClick={nextMonth} style={{background:"rgba(255,255,255,0.08)",border:"none",color:"#f0f0f0",width:40,height:40,borderRadius:"50%",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>›</button>
          </div>
          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 16px 4px"}}>
            {DAY_TH.map(d=>(<div key={d} style={{textAlign:"center",fontSize:12,color:"#555",padding:"4px 0",fontWeight:500}}>{d}</div>))}
          </div>
          {/* Days */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 16px 20px",gap:4}}>
            {days.map((day,i)=>{
              if(!day) return <div key={i}/>;
              const ds = localStr(vy,vm,day);
              const isSel = ds===selDate;
              const isT   = ds===today;
              return (
                <button key={i} onClick={()=>onChange(ds)} style={{
                  aspectRatio:"1",borderRadius:"50%",border:"none",
                  background:isSel?"#007AFF":isT?"rgba(0,122,255,0.18)":"transparent",
                  color:isSel?"#fff":isT?"#007AFF":"#f0f0f0",
                  fontSize:17,fontWeight:isSel||isT?700:400,
                  cursor:"pointer",WebkitTapHighlightColor:"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"background 0.1s",
                }}>{day}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
function MainApp({ session }) {
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [showAI, setShowAI]             = useState(false);
  const [showChat, setShowChat]         = useState(false);
  const [showRoutine, setShowRoutine]   = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [viewMode, setViewMode]         = useState("day");
  const [currentDate, setCurrentDate]   = useState(todayStr());
  const [showCalPicker, setShowCalPicker] = useState(false);
  const [filter, setFilter]             = useState("all");
  const [authProfile, setAuthProfile]   = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast]               = useState(null);
  const [pushEnabled, setPushEnabled]   = useState(false);
  const [showPushBanner, setShowPushBanner] = useState(false);
  const routineGenRef                   = useRef(false);
  const notifScheduledRef               = useRef(new Set());
  const user = session.user;

  function showToast(msg, color="#34C759") {
    setToast({msg,color}); setTimeout(()=>setToast(null),3000);
  }

  // ── Auto-refresh at midnight ──
  useEffect(()=>{
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24,0,0,0);
    const ms = midnight.getTime() - now.getTime();
    const t = setTimeout(()=>{
      setCurrentDate(todayStr());
      routineGenRef.current = false;
      window.location.reload();
    }, ms);
    return ()=>clearTimeout(t);
  },[]);

  // ── Register service worker + push ──
  useEffect(()=>{
    registerSW().then(async(reg)=>{
      if(!reg) return;
      if(Notification.permission==="granted") {
        setPushEnabled(true);
      } else if(Notification.permission==="denied") {
        setPushEnabled(false);
      }
      // ถ้า permission เป็น default จะแสดง banner แทนการถามทันที
    });
  },[]);

  // แสดง banner ขอแจ้งเตือนเมื่อ onboarding เสร็จหรือหลัง reset
  useEffect(()=>{
    if(!userProfile?.onboarded) return;
    if(Notification.permission==="default") {
      // รอ 2 วินาทีหลัง onboard เสร็จค่อยแสดง
      const t = setTimeout(()=>setShowPushBanner(true), 2000);
      return ()=>clearTimeout(t);
    }
  },[userProfile?.onboarded]);

  const fetchEvents = useCallback(async()=>{
    setLoading(true);
    const {data} = await supabase.from("events").select("*").eq("user_id",user.id).order("date",{ascending:false}).order("planned_start_time",{ascending:true});
    setEvents(data||[]);
    setLoading(false);
  },[user.id]);

  const fetchProfile = useCallback(async()=>{
    const {data:ap} = await supabase.from("profiles").select("*").eq("id",user.id).single();
    setAuthProfile(ap||{display_name:user.user_metadata?.full_name,avatar_url:user.user_metadata?.avatar_url});
    const {data:up} = await supabase.from("user_profiles").select("*").eq("id",user.id).single();
    if(!up||!up.onboarded) { setShowOnboarding(true); } else { setUserProfile(up); }
  },[user]);

  useEffect(()=>{ fetchEvents(); fetchProfile(); },[fetchEvents,fetchProfile]);

  // ── Auto-generate routine ──
  // Runs when: userProfile loaded, events loaded, or after onboarding
  const lastGenDateRef = useRef("");
  useEffect(()=>{
    if(!userProfile?.routine||!userProfile.onboarded||loading) return;
    const today = todayStr();
    if(lastGenDateRef.current === today) return; // already tried today
    const has = events.some(e=>e.date===today);
    if(!has) {
      lastGenDateRef.current = today;
      generateRoutine(today, userProfile.routine);
    }
  },[userProfile?.onboarded, userProfile?.routine, loading, events]);

  // ── Schedule notifications ──
  useEffect(()=>{
    if(!pushEnabled||events.length===0) return;
    const today = todayStr();
    const now = new Date();

    // กำหนดเวลาแจ้งเตือนล่วงหน้าตามประเภท
    // is_important = true → 30 นาที
    // work(ประชุม) หรือ exercise → 30 นาที
    // อื่นๆ → 10 นาที
    function getLeadMins(ev) {
      if(ev.is_important) return 30;
      if(ev.category==="work"||ev.category==="exercise") return 30;
      return 10;
    }

    function getCatLabel(cat) {
      return {sleep:"นอนหลับ",meal:"อาหาร",exercise:"ออกกำลังกาย",work:"งาน/นัดหมาย"}[cat]||cat;
    }

    // แจ้งเตือนทุก event วันนี้ที่ยังไม่ได้ schedule
    events.filter(e=>e.date===today&&e.status==="scheduled"&&e.planned_start_time).forEach(ev=>{
      const key = `${ev.id}-remind`;
      if(notifScheduledRef.current.has(key)) return;
      const [h,m] = ev.planned_start_time.split(":").map(Number);
      const evStart = new Date(); evStart.setHours(h,m,0,0);
      const leadMins = getLeadMins(ev);
      const notifAt = new Date(evStart.getTime() - leadMins*60*1000);
      const delay = notifAt.getTime() - now.getTime();
      if(delay>0 && delay<24*60*60*1000) {
        notifScheduledRef.current.add(key);
        const leadLabel = leadMins===30?"30 นาที":"10 นาที";
        scheduleLocalNotification(
          ev.title,
          `${getCatLabel(ev.category)} · เริ่ม ${ev.planned_start_time} น. อีก ${leadLabel}${ev.notes?`
${ev.notes}`:""}`,
          delay, key
        );
      }
    });

    // Morning summary 07:00
    if(!notifScheduledRef.current.has("morning-"+today)) {
      const morning = new Date(); morning.setHours(7,0,0,0);
      const morningDelay = morning.getTime()-now.getTime();
      if(morningDelay>0&&morningDelay<24*60*60*1000) {
        const todayEvs = events.filter(e=>e.date===today).sort((a,b)=>(a.planned_start_time||"").localeCompare(b.planned_start_time||""));
        if(todayEvs.length>0) {
          notifScheduledRef.current.add("morning-"+today);
          const lines = todayEvs.slice(0,4).map(e=>`${e.planned_start_time} ${e.title}`).join("
");
          const more = todayEvs.length>4?`
+${todayEvs.length-4} รายการ`:"";
          scheduleLocalNotification(
            `วันนี้มี ${todayEvs.length} กิจกรรม`,
            lines+more,
            morningDelay, "morning-"+today
          );
        }
      }
    }

    // Weekly report Sunday 20:00
    if(new Date().getDay()===0&&!notifScheduledRef.current.has("weekly-"+today)) {
      const sunday = new Date(); sunday.setHours(20,0,0,0);
      const sundayDelay = sunday.getTime()-now.getTime();
      if(sundayDelay>0) {
        notifScheduledRef.current.add("weekly-"+today);
        const weekAgo = addDays(today,-7);
        const wEvs = events.filter(e=>e.date>=weekAgo&&e.date<=today);
        const done = wEvs.filter(e=>e.status==="completed").length;
        const pct = wEvs.length>0?Math.round((done/wEvs.length)*100):0;
        scheduleLocalNotification(
          `รายงานสัปดาห์ · ${pct}%`,
          `เสร็จ ${done} จาก ${wEvs.length} รายการ
เปิดแอปเพื่อดูการวิเคราะห์`,
          sundayDelay, "weekly-"+today
        );
      }
    }
  },[pushEnabled,events]);

  async function generateRoutine(date, routineOverride) {
    const r = routineOverride || userProfile?.routine;
    if(!r) return;
    const toAdd = [];
    if(r.sleep_start) toAdd.push({category:"sleep",title:"นอนหลับ",date,planned_start_time:r.sleep_start,planned_end_time:r.sleep_end||"07:00",status:"scheduled",notes:"",is_important:false});
    if(r.work_start)  toAdd.push({category:"work", title:"ทำงาน",  date,planned_start_time:r.work_start, planned_end_time:r.work_end||"18:00", status:"scheduled",notes:"",is_important:false});
    if(r.exercise&&r.exercise_start) toAdd.push({category:"exercise",title:"ออกกำลังกาย",date,planned_start_time:r.exercise_start,planned_end_time:r.exercise_end||"19:30",status:"scheduled",notes:"",is_important:false});
    if(r.meal_breakfast) toAdd.push({category:"meal",title:"มื้อเช้า",   date,planned_start_time:r.meal_breakfast,planned_end_time:addMinutes(r.meal_breakfast,30),status:"scheduled",notes:"",is_important:false});
    if(r.meal_lunch)     toAdd.push({category:"meal",title:"มื้อกลางวัน",date,planned_start_time:r.meal_lunch,    planned_end_time:addMinutes(r.meal_lunch,30),    status:"scheduled",notes:"",is_important:false});
    if(r.meal_dinner)    toAdd.push({category:"meal",title:"มื้อเย็น",   date,planned_start_time:r.meal_dinner,   planned_end_time:addMinutes(r.meal_dinner,30),   status:"scheduled",notes:"",is_important:false});
    let count=0;
    for(const ev of toAdd) {
      const {data} = await supabase.from("events").insert({...ev,user_id:user.id,id:uid()}).select().single();
      if(data) { setEvents(prev=>[data,...prev]); count++; }
    }
    if(count>0) showToast(`สร้าง ${count} กิจกรรมจากตารางประจำวัน`);
  }

  async function saveEvent(form) {
    if(form.id) {
      const {error} = await supabase.from("events").update(form).eq("id",form.id);
      if(!error) { setEvents(prev=>prev.map(e=>e.id===form.id?form:e)); showToast("บันทึกแล้ว"); }
    } else {
      const {data} = await supabase.from("events").insert({...form,user_id:user.id,id:uid()}).select().single();
      if(data) { setEvents(prev=>[data,...prev]); showToast("เพิ่มกิจกรรมแล้ว"); }
    }
    setEditingEvent(null); setShowAdd(false);
  }

  async function quickStatus(ev, status) {
    const updated = {...ev,status};
    const {error} = await supabase.from("events").update({status}).eq("id",ev.id);
    if(!error) { setEvents(prev=>prev.map(e=>e.id===ev.id?updated:e)); }
  }

  async function addEventsFromAI(evList) {
    let count=0;
    for(const ev of evList) {
      const {data} = await supabase.from("events").insert({...ev,user_id:user.id}).select().single();
      if(data) { setEvents(prev=>[data,...prev]); count++; }
    }
    setShowAI(false); showToast(`เพิ่ม ${count} กิจกรรมแล้ว`);
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id",id);
    setEvents(prev=>prev.filter(e=>e.id!==id));
    showToast("ลบแล้ว","#FF3B30");
  }

  async function resetAccount() {
    await supabase.from("events").delete().eq("user_id",user.id);
    await supabase.from("user_profiles").update({onboarded:false,routine:{}}).eq("id",user.id);
    setEvents([]); setUserProfile(null);
    setShowResetConfirm(false); setShowProfileMenu(false);
    routineGenRef.current=false;
    setShowOnboarding(true);
    showToast("รีเซ็ตแล้ว กรุณาตั้งค่าใหม่");
  }

  const today = todayStr();
  const weekDates = getWeekDates(currentDate);
  const dateEvts = viewMode==="day" ? events.filter(e=>e.date===currentDate) : events.filter(e=>weekDates.includes(e.date));
  const filtered = dateEvts.filter(e=>filter==="all"||e.category===filter);
  const grouped  = filtered.reduce((acc,e)=>{ (acc[e.date]=acc[e.date]||[]).push(e); return acc;},{});
  const todayEvs = events.filter(e=>e.date===today);
  const done     = todayEvs.filter(e=>e.status==="completed").length;
  const pct      = todayEvs.length>0?Math.round((done/todayEvs.length)*100):0;

  return (
    <div style={{minHeight:"100vh",background:"#080808",fontFamily:"-apple-system,'SF Pro Display',sans-serif",paddingBottom:"calc(60px + env(safe-area-inset-bottom))"}}>
      <style>{`
        @keyframes slideUp{from{transform:translateY(32px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        input,textarea,button{-webkit-appearance:none}
      `}</style>

      {showOnboarding && <Onboarding userId={user.id} onComplete={async(up)=>{
        setUserProfile(up);
        setShowOnboarding(false);
        showToast("ยินดีต้อนรับ กำลังสร้างตาราง...");
        // Generate immediately after onboarding
        if(up?.routine) {
          const today = todayStr();
          await generateRoutine(today, up.routine);
        }
      }}/>}

      {/* Navbar */}
      <div style={{background:"rgba(8,8,8,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50,paddingTop:"calc(12px + env(safe-area-inset-top))"}}>
        <div style={{fontSize:17,fontWeight:700,color:"#f0f0f0"}}>Calendar</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setShowRoutine(true)} style={{background:"rgba(255,255,255,0.07)",border:"none",color:"#888",padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:13,fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>ตาราง</button>
          <button onClick={()=>setShowChat(true)} style={{background:"rgba(52,199,89,0.12)",border:"none",color:"#34C759",padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>วิเคราะห์</button>
          <button onClick={()=>setShowAI(!showAI)} style={{background:showAI?"rgba(88,86,214,0.25)":"rgba(88,86,214,0.12)",border:"none",color:"#a78bfa",padding:"6px 12px",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>AI</button>
          <button onClick={()=>setShowAdd(true)} style={{background:"#007AFF",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>+</button>
          <button onClick={()=>setShowProfileMenu(!showProfileMenu)} style={{border:"none",background:"none",cursor:"pointer",padding:0,WebkitTapHighlightColor:"transparent"}}>
            {authProfile?.avatar_url
              ? <img src={authProfile.avatar_url} alt="" style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:"1.5px solid rgba(255,255,255,0.15)"}}/>
              : <div style={{width:32,height:32,borderRadius:"50%",background:"#007AFF",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600}}>{(authProfile?.display_name||user.email||"?")[0].toUpperCase()}</div>
            }
          </button>
        </div>
      </div>

      {/* Profile menu */}
      {showProfileMenu&&(
        <div style={{position:"fixed",top:60,right:12,zIndex:100,animation:"fadeIn 0.15s ease"}}>
          <Card style={{padding:"14px 16px",minWidth:200}}>
            <div style={{fontSize:14,fontWeight:600,color:"#f0f0f0"}}>{authProfile?.display_name||"ผู้ใช้"}</div>
            <div style={{fontSize:12,color:"#555",marginBottom:6}}>{user.email}</div>
            {userProfile&&<div style={{fontSize:12,color:"#444",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8,marginBottom:10}}>{userProfile.age}ปี · {userProfile.weight_kg}กก. · {GOAL_LABELS[userProfile.goal]||"-"}</div>}
            {/* Push notification toggle row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:"1px solid rgba(255,255,255,0.06)",marginTop:4}}>
              <div>
                <div style={{fontSize:13,color:"#f0f0f0",fontWeight:500}}>การแจ้งเตือน</div>
                <div style={{fontSize:11,color:Notification.permission==="denied"?"#FF3B30":"#555",marginTop:1}}>
                  {Notification.permission==="granted"?"เปิดอยู่":Notification.permission==="denied"?"ถูกบล็อก กรุณาเปิดใน Settings":"ยังไม่ได้เปิด"}
                </div>
              </div>
              {Notification.permission!=="denied" && (
                <button onClick={async()=>{
                  if(pushEnabled) {
                    // ปิด — แจ้งให้รู้ว่าต้องไปปิดใน browser settings
                    showToast("ปิดได้ใน Settings → Notifications ของ browser","#FF9500");
                  } else {
                    const ok = await requestPushPermission();
                    setPushEnabled(ok);
                    setShowPushBanner(false);
                    if(ok) showToast("เปิดการแจ้งเตือนแล้ว");
                    else showToast("ไม่ได้รับอนุญาต","#FF3B30");
                  }
                }} style={{background:pushEnabled?"#34C759":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:48,height:28,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>
                  <div style={{position:"absolute",top:3,left:pushEnabled?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
                </button>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Btn onClick={()=>{setShowResetConfirm(true);setShowProfileMenu(false);}} ghost danger full small>รีเซ็ตบัญชี</Btn>
              <Btn onClick={()=>supabase.auth.signOut()} ghost color="#666" full small>ออกจากระบบ</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}>
          <Card style={{padding:24,maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:17,fontWeight:600,color:"#f0f0f0",marginBottom:10}}>รีเซ็ตบัญชี</div>
            <div style={{fontSize:14,color:"#666",lineHeight:1.6,marginBottom:20}}>ข้อมูลทั้งหมดจะถูกลบ และต้องตั้งค่าใหม่ ยืนยันหรือไม่</div>
            <div style={{display:"flex",gap:10}}><Btn onClick={()=>setShowResetConfirm(false)} ghost full>ยกเลิก</Btn><Btn onClick={resetAccount} danger full>ยืนยัน</Btn></div>
          </Card>
        </div>
      )}

      <div style={{maxWidth:680,margin:"0 auto",padding:"14px 12px 0"}}>
        {/* Metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {[{l:"วันนี้",v:todayEvs.length,col:"#007AFF"},{l:"เสร็จแล้ว",v:done,col:"#34C759"},{l:"Completion",v:`${pct}%`,col:"#FF9500"}].map(({l,v,col})=>(
            <div key={l} style={{background:"rgba(22,22,24,0.97)",borderRadius:14,padding:"12px 14px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:22,fontWeight:700,color:col}}>{v}</div>
              <div style={{fontSize:11,color:"#555",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* AI Panel */}
        {showAI&&<AIPanel onAdd={addEventsFromAI} onClose={()=>setShowAI(false)} userId={user.id}/>}

        {/* Date Navigation */}
        <div style={{marginBottom:12}}>
          {/* View toggle + Day nav */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",background:"rgba(22,22,24,0.97)",borderRadius:10,padding:3,border:"1px solid rgba(255,255,255,0.06)"}}>
              {[{v:"day",l:"วัน"},{v:"week",l:"สัปดาห์"}].map(m=>(
                <button key={m.v} onClick={()=>setViewMode(m.v)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:viewMode===m.v?"#007AFF":"transparent",color:viewMode===m.v?"#fff":"#555",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>{m.l}</button>
              ))}
            </div>
            {viewMode==="day"&&(
              <div style={{display:"flex",alignItems:"center",gap:0,background:"rgba(22,22,24,0.97)",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                {/* ← ย้อนหลัง */}
                <button
                  onClick={()=>{ const prev = addDays(currentDate,-1); setCurrentDate(prev); }}
                  style={{background:"none",border:"none",color:"#f0f0f0",width:46,height:42,cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}
                >‹</button>
                {/* วันที่ กดเปิดปฏิทิน */}
                <button
                  onClick={()=>setShowCalPicker(true)}
                  style={{background:"none",border:"none",borderLeft:"1px solid rgba(255,255,255,0.06)",borderRight:"1px solid rgba(255,255,255,0.06)",color:currentDate===today?"#007AFF":"#f0f0f0",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",minWidth:90,height:42,padding:"0 8px",WebkitTapHighlightColor:"transparent"}}
                >
                  {currentDate===today?"วันนี้":fmtDateShort(currentDate)}
                </button>
                {/* → ไปหน้า */}
                <button
                  onClick={()=>{ const next = addDays(currentDate,1); setCurrentDate(next); }}
                  style={{background:"none",border:"none",color:"#f0f0f0",width:46,height:42,cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",flexShrink:0}}
                >›</button>
              </div>
            )}
          </div>

          {/* Week grid */}
          {viewMode==="week"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
              {weekDates.map(d=>{
                const cnt=events.filter(e=>e.date===d).length;
                const isT=d===today, isSel=d===currentDate;
                return (
                  <button key={d} onClick={()=>setCurrentDate(d)} style={{background:isSel?"#007AFF":isT?"rgba(0,122,255,0.12)":"rgba(22,22,24,0.97)",border:`1px solid ${isSel?"#007AFF":isT?"rgba(0,122,255,0.2)":"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"8px 4px",cursor:"pointer",textAlign:"center",WebkitTapHighlightColor:"transparent"}}>
                    <div style={{fontSize:10,color:isSel?"rgba(255,255,255,0.6)":"#555"}}>{DAY_TH[parseDate(d).getDay()]}</div>
                    <div style={{fontSize:17,fontWeight:600,color:isSel?"#fff":isT?"#007AFF":"#f0f0f0",marginTop:2}}>{parseDate(d).getDate()}</div>
                    {cnt>0&&<div style={{width:5,height:5,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.6)":"#007AFF",margin:"3px auto 0"}}/>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
          {[["all","ทั้งหมด","#007AFF"],...Object.entries(CATS).map(([k,v])=>[k,v.label,v.dot])].map(([k,l,col])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 14px",borderRadius:20,border:"none",flexShrink:0,background:filter===k?col:"rgba(22,22,24,0.97)",color:filter===k?"#fff":"#555",fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>{l}</button>
          ))}
        </div>

        {/* Event List */}
        <Card style={{overflow:"hidden"}}>
          {loading?(
            <div style={{padding:"40px 20px",textAlign:"center",color:"#444",fontSize:24,animation:"spin 1s linear infinite",display:"block"}}>⟳</div>
          ):Object.keys(grouped).length===0?(
            <div style={{padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:15,color:"#444"}}>ไม่มีกิจกรรม</div>
              <div style={{fontSize:13,color:"#333",marginTop:4}}>กด + หรือ AI เพื่อเพิ่ม</div>
            </div>
          ):(
            Object.keys(grouped).sort().reverse().map(date=>(
              <div key={date}>
                <div style={{padding:"8px 16px 4px",fontSize:11,fontWeight:700,color:"#444",letterSpacing:0.5,textTransform:"uppercase",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  {date===today?"วันนี้":fmtDateShort(date)}
                  <span style={{fontWeight:400,marginLeft:6,opacity:0.6}}>{fmtDateFull(date)}</span>
                </div>
                {grouped[date].sort((a,b)=>(a.planned_start_time||"").localeCompare(b.planned_start_time||"")).map(ev=>{
                  const c=CATS[ev.category];
                  const isDone = ev.status==="completed";
                  const isSkip = ev.status==="skipped";
                  return (
                    <div key={ev.id} style={{display:"flex",alignItems:"center",gap:0,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                      {/* Quick status button */}
                      <button
                        onClick={()=>quickStatus(ev, isDone?"scheduled":"completed")}
                        style={{
                          width:52, flexShrink:0, alignSelf:"stretch",
                          background:"transparent", border:"none",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          cursor:"pointer", WebkitTapHighlightColor:"transparent",
                        }}
                      >
                        <div style={{
                          width:24, height:24, borderRadius:"50%",
                          background:isDone?"#34C759":"transparent",
                          border:`2px solid ${isDone?"#34C759":isSkip?"#FF3B30":"rgba(255,255,255,0.15)"}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all 0.15s",
                        }}>
                          {isDone&&<span style={{color:"#fff",fontSize:13,fontWeight:700}}>✓</span>}
                          {isSkip&&<span style={{color:"#FF3B30",fontSize:13}}>✕</span>}
                        </div>
                      </button>

                      {/* Event info */}
                      <div onClick={()=>setEditingEvent({...ev})} style={{flex:1,padding:"12px 12px 12px 0",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                          <span style={{fontSize:15,fontWeight:500,color:isDone?"#555":"#f0f0f0",textDecoration:isDone?"line-through":"none"}}>{ev.title}</span>
                          {ev.is_important&&<span style={{fontSize:10,color:"#FF9500",fontWeight:700,flexShrink:0}}>!</span>}
                        </div>
                        <div style={{fontSize:12,marginTop:3,paddingLeft:14,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{color:"#555"}}>{ev.planned_start_time}{ev.planned_end_time?` – ${ev.planned_end_time}`:""}</span>
                          {(()=>{
                            if(ev.status==="completed"||ev.status==="skipped") return null;
                            if(ev.date !== todayStr()) return null;
                            const now = new Date();
                            const [sh,sm] = (ev.planned_start_time||"00:00").split(":").map(Number);
                            const [eh,em] = (ev.planned_end_time||ev.planned_start_time||"00:00").split(":").map(Number);
                            // ข้ามวัน: เวลาสิ้นสุดน้อยกว่าเวลาเริ่ม (เช่น นอน 23:00 ตื่น 07:00)
                            const isOvernight = eh < sh || (eh===sh && em < sm);
                            if(isOvernight) {
                              // ถือว่ายังไม่เลยเวลา ถ้าเวลาปัจจุบันหลังเริ่ม หรือก่อนสิ้นสุดพรุ่งนี้
                              return null;
                            }
                            const evEnd = new Date(); evEnd.setHours(eh,em,0,0);
                            const evStart = new Date(); evStart.setHours(sh,sm,0,0);
                            if(now > evEnd) return <span style={{fontSize:10,color:"#FF3B30",fontWeight:600}}>เลยเวลาแล้ว</span>;
                            const diffMin = Math.round((evStart-now)/60000);
                            if(diffMin>0&&diffMin<=30) return <span style={{fontSize:10,color:"#FF9500",fontWeight:600}}>อีก {diffMin} นาที</span>;
                            if(now >= evStart && now <= evEnd) return <span style={{fontSize:10,color:"#34C759",fontWeight:600}}>กำลังดำเนินอยู่</span>;
                            return null;
                          })()}
                        </div>
                      </div>

                      {/* Swipe actions */}
                      <div style={{display:"flex",gap:5,padding:"0 12px 0 0",flexShrink:0}}>
                        {!isDone&&!isSkip&&(
                          <button onClick={()=>quickStatus(ev,"skipped")} style={{background:"rgba(255,59,48,0.1)",border:"none",borderRadius:8,padding:"6px 10px",color:"#FF3B30",fontSize:12,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>ข้าม</button>
                        )}
                        <button onClick={()=>deleteEvent(ev.id)} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,padding:"6px 10px",color:"#555",fontSize:12,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>ลบ</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </Card>
      </div>

      {(showAdd||editingEvent)&&<EventModal initial={editingEvent} onSave={saveEvent} onClose={()=>{setShowAdd(false);setEditingEvent(null);}}/>}
      {showChat&&<AIHealthChat events={events} userProfile={userProfile} onClose={()=>setShowChat(false)}/>}
      {showRoutine&&<RoutineEditor userProfile={userProfile} userId={user.id} onClose={()=>setShowRoutine(false)} onSave={async(r)=>{
        setUserProfile(p=>({...p,routine:r}));
        setShowRoutine(false);
        showToast("บันทึกตารางแล้ว");
        // ลบ routine events เดิมของวันนี้แล้วสร้างใหม่
        const tod = todayStr();
        const autoTitles = ["นอนหลับ","ทำงาน","ออกกำลังกาย","มื้อเช้า","มื้อกลางวัน","มื้อเย็น"];
        const toDelete = events.filter(e=>e.date===tod&&autoTitles.includes(e.title)&&!e.is_important);
        for(const ev of toDelete) await supabase.from("events").delete().eq("id",ev.id);
        setEvents(prev=>prev.filter(e=>!(e.date===tod&&autoTitles.includes(e.title)&&!e.is_important)));
        lastGenDateRef.current = "";
        await generateRoutine(tod, r);
      }}/>}

      {/* Inline Calendar Picker Modal */}
      {showCalPicker&&(
        <InlineCal
          value={currentDate}
          onChange={v=>{ setCurrentDate(v); setShowCalPicker(false); }}
          onClose={()=>setShowCalPicker(false)}
          today={today}
        />
      )}

      {/* Push notification banner */}
      {showPushBanner && Notification.permission==="default" && (
        <div style={{
          position:"fixed",bottom:"calc(20px + env(safe-area-inset-bottom))",
          left:12,right:12,zIndex:998,
          animation:"slideUp 0.3s ease",
          maxWidth:440,margin:"0 auto",
        }}>
          <div style={{background:"rgba(22,22,24,0.98)",border:"1px solid rgba(0,122,255,0.3)",borderRadius:16,padding:"14px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:600,color:"#f0f0f0",marginBottom:4}}>เปิดการแจ้งเตือน</div>
                <div style={{fontSize:13,color:"#888",lineHeight:1.5}}>รับแจ้งเตือนก่อนกิจกรรมสำคัญ สรุปกิจกรรมทุกเช้า และรายงานสัปดาห์</div>
              </div>
              <button onClick={()=>setShowPushBanner(false)} style={{background:"rgba(255,255,255,0.08)",border:"none",width:26,height:26,borderRadius:"50%",cursor:"pointer",color:"#555",fontSize:13,flexShrink:0,WebkitTapHighlightColor:"transparent"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={async()=>{
                const ok = await requestPushPermission();
                setPushEnabled(ok);
                setShowPushBanner(false);
                if(ok) showToast("เปิดการแจ้งเตือนแล้ว");
                else showToast("ไม่ได้รับอนุญาต","#FF3B30");
              }} style={{flex:1,padding:"10px",background:"#007AFF",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                เปิด
              </button>
              <button onClick={()=>setShowPushBanner(false)} style={{flex:1,padding:"10px",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:10,color:"#888",fontSize:14,cursor:"pointer",fontFamily:"inherit",WebkitTapHighlightColor:"transparent"}}>
                ไม่ตอนนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",bottom:"calc(24px + env(safe-area-inset-bottom))",left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#fff",padding:"10px 20px",borderRadius:20,fontSize:14,fontWeight:600,zIndex:999,whiteSpace:"nowrap",animation:"fadeIn 0.2s ease",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}>{toast.msg}</div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  if(session===undefined) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080808"}}>
      <div style={{width:36,height:36,border:"2.5px solid #007AFF",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return session?<MainApp session={session}/>:<LoginPage/>;
}
