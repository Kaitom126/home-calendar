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
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});
}
function fmtDateShort(d) {
  if (!d) return "";
  return new Date(d+"T00:00:00").toLocaleDateString("th-TH",{day:"numeric",month:"short"});
}
function addDays(dateStr, n) {
  const d = new Date(dateStr+"T00:00:00"); d.setDate(d.getDate()+n);
  return d.toISOString().split("T")[0];
}
function getDayName(dateStr) {
  return new Date(dateStr+"T00:00:00").toLocaleDateString("th-TH",{weekday:"short"});
}
function addMinutes(t, m) {
  const [h,mm] = t.split(":").map(Number), tot=h*60+mm+m;
  return `${String(Math.floor(tot/60)%24).padStart(2,"0")}:${String(tot%60).padStart(2,"0")}`;
}
function fmtTime(t) {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  if (h===0) return `เที่ยงคืน`;
  if (h<12) return `${h}:${String(m).padStart(2,"0")} น.`;
  if (h===12) return `เที่ยง`;
  return `${h-12>0?h-12:""}:${String(m).padStart(2,"0")} ${h>=12?"น.":"น."}`;
}

async function callAI(prompt) {
  const res = await fetch(`${SUPA_URL}/functions/v1/ai-parse`,{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${SUPA_KEY}`},
    body:JSON.stringify({prompt}),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||"AI Error");
  return data.content?.[0]?.text||"";
}

// ── UI ──────────────────────────────────────────────────────
function Card({children,style={}}) {
  return <div style={{background:"rgba(22,22,24,0.95)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(255,255,255,0.07)",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",...style}}>{children}</div>;
}
function Btn({children,onClick,color="#007AFF",ghost=false,full=false,disabled=false,small=false,danger=false,style={}}) {
  const bg=danger?(ghost?"rgba(255,59,48,0.1)":"#FF3B30"):ghost?`${color}18`:color;
  const cl=danger?(ghost?"#FF3B30":"#fff"):ghost?color:"#fff";
  return <button onClick={disabled?undefined:onClick} style={{border:"none",borderRadius:small?8:12,fontSize:small?12:14,fontWeight:600,padding:small?"5px 11px":"11px 20px",cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",opacity:disabled?0.35:1,background:bg,color:cl,...style}}>{children}</button>;
}
function FieldLabel({children}) {
  return <label style={{fontSize:11,color:"#555",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",display:"block",marginBottom:6}}>{children}</label>;
}

// ── iOS-style Time Picker ──────────────────────────────────
function TimePicker({value, onChange, label}) {
  const [open, setOpen] = useState(false);
  const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,"0"));
  const mins  = ["00","15","30","45"];
  const [h,m] = (value||"00:00").split(":");
  const sel_h = h||"00";
  const sel_m = (["00","15","30","45"].includes(m)?m:["00","15","30","45"].reduce((a,b)=>Math.abs(parseInt(b)-parseInt(m))<Math.abs(parseInt(a)-parseInt(m))?b:a));

  function display() {
    const hh = parseInt(sel_h);
    const mm = sel_m;
    if (hh===0&&mm==="00") return "00:00";
    return `${sel_h}:${mm}`;
  }

  function thaiDisplay() {
    const hh = parseInt(sel_h);
    const mm = parseInt(sel_m);
    const mmStr = mm>0?` ${mm} นาที`:"";
    if (hh===0) return `เที่ยงคืน${mmStr}`;
    if (hh<12)  return `${hh} โมงเช้า${mmStr}`;
    if (hh===12) return `เที่ยง${mmStr}`;
    if (hh<18)  return `บ่าย ${hh-12}${mmStr}`;
    if (hh<19)  return `${hh-12} โมงเย็น${mmStr}`;
    return `${hh-18} ทุ่ม${mmStr}`;
  }

  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <button onClick={()=>setOpen(true)} style={{
        width:"100%", padding:"11px 14px", borderRadius:10,
        background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
        color:"#f0f0f0", fontSize:14, fontWeight:500,
        cursor:"pointer", fontFamily:"inherit", textAlign:"left",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span>{display()}</span>
        <span style={{fontSize:12,color:"#555"}}>{thaiDisplay()}</span>
      </button>
      {open && (
        <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:16}}>
          <div onClick={()=>setOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}}/>
          <div style={{position:"relative",width:"100%",maxWidth:360,zIndex:1,animation:"slideUp 0.2s ease"}}>
            <Card style={{overflow:"hidden"}}>
              <div style={{padding:"14px 18px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:600,color:"#f0f0f0"}}>{label||"เลือกเวลา"}</span>
                <button onClick={()=>setOpen(false)} style={{background:"rgba(255,255,255,0.08)",border:"none",padding:"4px 14px",borderRadius:20,color:"#007AFF",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>เสร็จ</button>
              </div>
              <div style={{display:"flex",padding:"8px 0"}}>
                {/* Hours */}
                <div style={{flex:1,maxHeight:220,overflowY:"auto",scrollSnapType:"y mandatory"}}>
                  {hours.map(hh=>(
                    <div key={hh} onClick={()=>onChange(`${hh}:${sel_m}`)} style={{padding:"10px 0",textAlign:"center",scrollSnapAlign:"start",fontSize:16,fontWeight:sel_h===hh?600:400,color:sel_h===hh?"#007AFF":"#888",background:sel_h===hh?"rgba(0,122,255,0.1)":"transparent",cursor:"pointer",transition:"all 0.1s"}}>
                      {hh}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",color:"#555",fontSize:18,padding:"0 4px"}}>:</div>
                {/* Minutes */}
                <div style={{flex:1,maxHeight:220,overflowY:"auto",scrollSnapType:"y mandatory"}}>
                  {mins.map(mm=>(
                    <div key={mm} onClick={()=>onChange(`${sel_h}:${mm}`)} style={{padding:"10px 0",textAlign:"center",scrollSnapAlign:"start",fontSize:16,fontWeight:sel_m===mm?600:400,color:sel_m===mm?"#007AFF":"#888",background:sel_m===mm?"rgba(0,122,255,0.1)":"transparent",cursor:"pointer",transition:"all 0.1s"}}>
                      {mm}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{padding:"10px 18px 16px",textAlign:"center",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:13,color:"#555"}}>{thaiDisplay()}</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date Picker with calendar ──────────────────────────────
function DatePicker({value, onChange, label}) {
  const inputRef = useRef(null);
  const today = todayStr();
  const isToday = value === today;

  function handleCalendar() {
    if (inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.click();
    }
  }

  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div style={{position:"relative"}}>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={()=>onChange(today)} style={{
            padding:"9px 12px", borderRadius:10, border:"none",
            background:isToday?"#007AFF":"rgba(255,255,255,0.05)",
            color:isToday?"#fff":"#888",
            fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit", flexShrink:0,
          }}>วันนี้</button>
          <button onClick={handleCalendar} style={{
            flex:1, padding:"9px 12px", borderRadius:10,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
            color:"#f0f0f0", fontSize:13, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit", textAlign:"left",
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span>{isToday?"วันนี้":fmtDateShort(value)}</span>
            <span style={{fontSize:11,color:"#555"}}>📅</span>
          </button>
        </div>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={e=>onChange(e.target.value)}
          style={{position:"absolute",opacity:0,width:1,height:1,top:0,left:0,pointerEvents:"none"}}
        />
      </div>
      {!isToday && value && (
        <div style={{fontSize:11,color:"#555",marginTop:4,paddingLeft:2}}>{fmtDate(value)}</div>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
  }
  return (
    <div style={{minHeight:"100vh",background:"#080808",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"-apple-system,'SF Pro Display',sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:360,textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:18,margin:"0 auto 24px",background:"linear-gradient(135deg,#007AFF,#5856D6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 8px 24px rgba(0,122,255,0.3)"}}>📅</div>
        <h1 style={{fontSize:26,fontWeight:700,color:"#f0f0f0",letterSpacing:-0.5,marginBottom:8}}>Calendar Tracker</h1>
        <p style={{fontSize:14,color:"#555",marginBottom:36,lineHeight:1.6}}>ติดตามกิจวัตรประจำวัน<br/>นอน · กิน · ออกกำลังกาย · งาน</p>
        <Card style={{padding:"24px"}}>
          <button onClick={signIn} disabled={loading} style={{width:"100%",padding:"12px 20px",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:12,fontSize:15,fontWeight:500,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit",color:"#f0f0f0"}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            {loading?"กำลังเข้าสู่ระบบ...":"เข้าสู่ระบบด้วย Google"}
          </button>
        </Card>
        <p style={{fontSize:11,color:"#333",marginTop:16}}>ข้อมูลเก็บใน Supabase · ปลอดภัย · ส่วนตัว</p>
      </div>
    </div>
  );
}

// ── ONBOARDING ─────────────────────────────────────────────
function Onboarding({userId, onComplete}) {
  const [step, setStep] = useState(1);
  const [p, setP] = useState({gender:"male",age:"",weight:"",height:"",goal:"health"});
  const [r, setR] = useState({sleep_start:"23:00",sleep_end:"07:00",work_start:"09:00",work_end:"18:00",exercise:true,exercise_start:"18:00",exercise_end:"19:00",meal_breakfast:"08:00",meal_lunch:"12:00",meal_dinner:"19:00"});
  const [saving, setSaving] = useState(false);

  const sp=(k,v)=>setP(x=>({...x,[k]:v}));
  const sr=(k,v)=>setR(x=>({...x,[k]:v}));

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").upsert({id:userId,gender:p.gender,age:parseInt(p.age)||0,weight_kg:parseFloat(p.weight)||0,height_cm:parseFloat(p.height)||0,goal:p.goal,routine:r,onboarded:true});
    const {data} = await supabase.from("user_profiles").select("*").eq("id",userId).single();
    onComplete(data);
  }

  const iStyle={width:"100%",padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",fontSize:14,color:"#f0f0f0",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.95)"}}>
      <div style={{width:"100%",maxWidth:440,maxHeight:"92vh",overflowY:"auto"}}>
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"20px 22px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div style={{fontSize:11,color:"#007AFF",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",marginBottom:4}}>{step}/2</div>
            <div style={{fontSize:19,fontWeight:700,color:"#f0f0f0"}}>{step===1?"ข้อมูลส่วนตัว":"ตารางประจำวัน"}</div>
            <div style={{fontSize:13,color:"#555",marginTop:3}}>{step===1?"AI จะใช้ข้อมูลนี้วิเคราะห์สุขภาพเฉพาะคุณ":"กำหนดเวลาที่ใช้ทุกวัน ระบบสร้างให้อัตโนมัติ"}</div>
          </div>
          <div style={{padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:16}}>
            {step===1 && <>
              <div>
                <FieldLabel>เพศ</FieldLabel>
                <div style={{display:"flex",gap:8}}>
                  {[{v:"male",l:"ชาย"},{v:"female",l:"หญิง"},{v:"other",l:"อื่นๆ"}].map(g=>(
                    <button key={g.v} onClick={()=>sp("gender",g.v)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:p.gender===g.v?"#007AFF":"rgba(255,255,255,0.05)",color:p.gender===g.v?"#fff":"#888",fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{g.l}</button>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[{k:"age",l:"อายุ (ปี)",ph:"25"},{k:"weight",l:"น้ำหนัก (กก.)",ph:"70"},{k:"height",l:"ส่วนสูง (ซม.)",ph:"170"}].map(f=>(
                  <div key={f.k}>
                    <FieldLabel>{f.l}</FieldLabel>
                    <input type="number" value={p[f.k]} onChange={e=>sp(f.k,e.target.value)} placeholder={f.ph} style={iStyle}/>
                  </div>
                ))}
              </div>
              <div>
                <FieldLabel>เป้าหมายสุขภาพ</FieldLabel>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {[{v:"health",l:"สุขภาพดี"},{v:"lose",l:"ลดน้ำหนัก"},{v:"gain",l:"เพิ่มน้ำหนัก"},{v:"muscle",l:"เพิ่มกล้ามเนื้อ"},{v:"other",l:"อื่นๆ"}].map(g=>(
                    <button key={g.v} onClick={()=>sp("goal",g.v)} style={{padding:"8px 14px",borderRadius:20,border:"none",background:p.goal===g.v?"#5856D6":"rgba(255,255,255,0.05)",color:p.goal===g.v?"#fff":"#888",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{g.l}</button>
                  ))}
                </div>
              </div>
              <Btn onClick={()=>setStep(2)} full disabled={!p.age||!p.weight||!p.height}>ถัดไป</Btn>
            </>}
            {step===2 && <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <TimePicker label="เข้านอน" value={r.sleep_start} onChange={v=>sr("sleep_start",v)}/>
                <TimePicker label="ตื่นนอน" value={r.sleep_end} onChange={v=>sr("sleep_end",v)}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <TimePicker label="เริ่มงาน" value={r.work_start} onChange={v=>sr("work_start",v)}/>
                <TimePicker label="เลิกงาน" value={r.work_end} onChange={v=>sr("work_end",v)}/>
              </div>
              <div>
                <FieldLabel>มื้ออาหาร</FieldLabel>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(m=>(
                    <TimePicker key={m.k} label={m.l} value={r[m.k]} onChange={v=>sr(m.k,v)}/>
                  ))}
                </div>
              </div>
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <FieldLabel>ออกกำลังกาย</FieldLabel>
                  <button onClick={()=>sr("exercise",!r.exercise)} style={{background:r.exercise?"#34C759":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:48,height:28,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:r.exercise?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
                  </button>
                </div>
                {r.exercise && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                    <TimePicker label="เริ่ม" value={r.exercise_start} onChange={v=>sr("exercise_start",v)}/>
                    <TimePicker label="สิ้นสุด" value={r.exercise_end} onChange={v=>sr("exercise_end",v)}/>
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
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

// ── AI PANEL (parse events) ────────────────────────────────
function AIPanel({onAdd, onClose, userId}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const catColors={sleep:"#5E9BFF",meal:"#FF9F40",exercise:"#34C759",work:"#FF375F"};
  const catLabels={sleep:"นอนหลับ",meal:"อาหาร",exercise:"ออกกำลังกาย",work:"งาน/นัด"};
  const EX=["พรุ่งนี้ประชุม 10.30-12.00","gym วันศุกร์ 18:00","นัดหมอ 15 มิ.ย. บ่าย 2","ประชุม board ปลายเดือนจันทร์ 9 โมง"];

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
    <Card style={{marginBottom:14}}>
      <div style={{padding:"13px 18px 11px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:"#5856D6",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>AI Parse</div>
          <div style={{fontSize:15,fontWeight:600,color:"#f0f0f0"}}>พิมพ์กิจกรรมแบบไหนก็ได้</div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:28,height:28,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:13}}>✕</button>
      </div>
      <div style={{padding:"13px 18px 18px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {EX.map(ex=>(<button key={ex} onClick={()=>setInput(ex)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",color:"#555",fontSize:11,padding:"3px 8px",borderRadius:20,cursor:"pointer",fontFamily:"inherit"}}>{ex}</button>))}
        </div>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) parse();}}
          placeholder={"พิมพ์กิจกรรมวันนี้หรือล่วงหน้า...\n\nเช่น: พรุ่งนี้ประชุม 10 โมง, gym 6 โมงเย็น, นัดหมอ 15 มิ.ย. บ่ายสอง"}
          rows={3} style={{width:"100%",resize:"none",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#f0f0f0",fontFamily:"-apple-system,'Noto Sans Thai',sans-serif",outline:"none",lineHeight:1.7,boxSizing:"border-box"}}
          onFocus={e=>{e.target.style.borderColor="rgba(88,86,214,0.5)"}}
          onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)"}}
        />
        <Btn onClick={parse} disabled={loading||!input.trim()} full color="#5856D6">{loading?"กำลังวิเคราะห์...":"วิเคราะห์กิจกรรม"}</Btn>
        {err && <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:8,padding:"9px 12px",fontSize:13,color:"#FF6B6B"}}>{err}</div>}
        {parsed&&parsed.length>0&&(
          <div>
            <div style={{fontSize:11,color:"#34C759",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8}}>พบ {parsed.length} กิจกรรม</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
              {parsed.map(ev=>(
                <div key={ev.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${catColors[ev.category]||"#333"}22`,borderLeft:`3px solid ${catColors[ev.category]||"#444"}`,borderRadius:8,padding:"9px 12px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:2}}>
                      <span style={{fontSize:13,fontWeight:500,color:"#f0f0f0"}}>{ev.title}</span>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:10,background:`${catColors[ev.category]}18`,color:catColors[ev.category]||"#888",fontWeight:600}}>{catLabels[ev.category]||ev.category}</span>
                    </div>
                    <div style={{fontSize:11,color:"#555"}}>{ev.date} · {ev.planned_start_time} – {ev.planned_end_time}</div>
                  </div>
                  <button onClick={()=>setParsed(prev=>prev.filter(e=>e.id!==ev.id))} style={{background:"transparent",border:"none",color:"#FF3B30",fontSize:16,cursor:"pointer",padding:"2px 4px"}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onAdd(parsed)} full color="#34C759">บันทึก {parsed.length} กิจกรรม</Btn>
              <Btn onClick={()=>{setParsed(null);setInput("");}} ghost full>ล้าง</Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── AI HEALTH CHAT ─────────────────────────────────────────
function AIHealthChat({events, userProfile, onClose}) {
  const [messages, setMessages] = useState([
    {role:"assistant", text:"สวัสดีครับ ผมคือผู้ช่วยวิเคราะห์สุขภาพส่วนตัวของคุณ ถามได้เลยครับ เช่น รูปร่างตอนนี้เป็นยังไง ควรปรับการนอนไหม หรือจะขอสรุปสัปดาห์ที่ผ่านมาก็ได้ครับ"}
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  async function send() {
    if (!input.trim()||loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(m=>[...m,{role:"user",text:userMsg}]);
    setLoading(true);

    try {
      const today = todayStr();
      const weekAgo = addDays(today,-7);
      const wEvs = events.filter(e=>e.date>=weekAgo&&e.date<=today);
      const byCat = Object.keys(CATS).map(k=>({
        category:k,
        total:wEvs.filter(e=>e.category===k).length,
        completed:wEvs.filter(e=>e.category===k&&e.status==="completed").length,
      }));
      const r = userProfile?.routine||{};
      const goalMap = {health:"สุขภาพดี",lose:"ลดน้ำหนัก",gain:"เพิ่มน้ำหนัก",muscle:"เพิ่มกล้ามเนื้อ"};

      const systemContext = `คุณคือผู้ช่วยวิเคราะห์สุขภาพส่วนตัว ตอบเป็นภาษาไทย ตอบสั้น กระชับ ตรงประเด็น ไม่เกิน 5 ประโยค ไม่ใช้ emoji

ข้อมูลผู้ใช้:
เพศ: ${userProfile?.gender||"ไม่ระบุ"} อายุ: ${userProfile?.age||"ไม่ระบุ"} ปี น้ำหนัก: ${userProfile?.weight_kg||"?"} กก. ส่วนสูง: ${userProfile?.height_cm||"?"} ซม.
BMI: ${userProfile?.weight_kg&&userProfile?.height_cm?(userProfile.weight_kg/Math.pow(userProfile.height_cm/100,2)).toFixed(1):"ไม่ทราบ"}
เป้าหมาย: ${goalMap[userProfile?.goal]||"สุขภาพดี"}
ตาราง: นอน ${r.sleep_start||"?"}-${r.sleep_end||"?"} ทำงาน ${r.work_start||"?"}-${r.work_end||"?"} ออกกำลังกาย: ${r.exercise?"ใช่":"ไม่"}

กิจกรรม 7 วันล่าสุด:
${byCat.map(c=>`${{"sleep":"นอน","meal":"อาหาร","exercise":"ออกกำลัง","work":"งาน"}[c.category]}: ${c.total} รายการ เสร็จ ${c.completed}`).join(", ")}

ตอบจากข้อมูลที่มี ถ้าข้อมูลน้อยให้บอกตรงๆ ว่าต้องบันทึกเพิ่มเพื่อวิเคราะห์ได้แม่นขึ้น`;

      const conversationHistory = messages.map(m=>m.role==="user"?`ผู้ใช้: ${m.text}`:`ผู้ช่วย: ${m.text}`).join("\n");
      const fullPrompt = `${systemContext}\n\nประวัติการสนทนา:\n${conversationHistory}\n\nผู้ใช้: ${userMsg}\n\nผู้ช่วย:`;

      const raw = await callAI(fullPrompt);
      setMessages(m=>[...m,{role:"assistant",text:raw.trim()}]);
    } catch(e) {
      setMessages(m=>[...m,{role:"assistant",text:"เกิดข้อผิดพลาด กรุณาลองใหม่"}]);
    }
    setLoading(false);
  }

  const quickQ = ["รูปร่างตอนนี้เป็นยังไง","สัปดาห์นี้เป็นยังไงบ้าง","ควรปรับการนอนไหม","ควรออกกำลังกายเพิ่มไหม","แนะนำการกินสำหรับเป้าหมายของฉัน"];

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(12px)"}}>
      <div style={{width:"100%",maxWidth:500,height:"80vh",display:"flex",flexDirection:"column"}}>
        <Card style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
          {/* Header */}
          <div style={{padding:"14px 18px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <div>
              <div style={{fontSize:10,color:"#34C759",fontWeight:600,letterSpacing:0.5,textTransform:"uppercase"}}>AI Health</div>
              <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>ผู้ช่วยวิเคราะห์สุขภาพ</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:28,height:28,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:13}}>✕</button>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 18px",display:"flex",flexDirection:"column",gap:10}}>
            {messages.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"82%",padding:"10px 13px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:m.role==="user"?"#007AFF":"rgba(255,255,255,0.06)",
                  fontSize:14,color:"#f0f0f0",lineHeight:1.7,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{padding:"10px 14px",borderRadius:"16px 16px 16px 4px",background:"rgba(255,255,255,0.06)",color:"#555",fontSize:13}}>
                  กำลังคิด...
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick questions */}
          <div style={{padding:"0 14px 8px",display:"flex",gap:5,overflowX:"auto",flexShrink:0}}>
            {quickQ.map(q=>(
              <button key={q} onClick={()=>{setInput(q);}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#666",fontSize:11,padding:"4px 10px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}>{q}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:"8px 14px 14px",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:8,flexShrink:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              placeholder="ถามอะไรก็ได้..."
              style={{flex:1,padding:"9px 12px",borderRadius:20,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",fontSize:14,color:"#f0f0f0",fontFamily:"inherit",outline:"none"}}
              onFocus={e=>e.target.style.borderColor="rgba(0,122,255,0.4)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.1)"}
            />
            <button onClick={send} disabled={loading||!input.trim()} style={{background:"#007AFF",border:"none",width:36,height:36,borderRadius:"50%",cursor:loading||!input.trim()?"not-allowed":"pointer",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",opacity:loading||!input.trim()?0.4:1,flexShrink:0}}>↑</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ROUTINE EDITOR ─────────────────────────────────────────
function RoutineEditor({userProfile, userId, onClose, onSave}) {
  const [r, setR] = useState(userProfile?.routine||{sleep_start:"23:00",sleep_end:"07:00",work_start:"09:00",work_end:"18:00",exercise:true,exercise_start:"18:00",exercise_end:"19:00",meal_breakfast:"08:00",meal_lunch:"12:00",meal_dinner:"19:00"});
  const [saving, setSaving] = useState(false);
  const sr=(k,v)=>setR(x=>({...x,[k]:v}));

  async function save() {
    setSaving(true);
    await supabase.from("user_profiles").update({routine:r}).eq("id",userId);
    onSave(r);
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(10px)"}}>
      <div style={{width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto"}}>
        <Card>
          <div style={{padding:"14px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>ตารางประจำวัน</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:28,height:28,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:13}}>✕</button>
          </div>
          <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <FieldLabel>การนอน</FieldLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <TimePicker label="เข้านอน" value={r.sleep_start} onChange={v=>sr("sleep_start",v)}/>
                <TimePicker label="ตื่นนอน" value={r.sleep_end} onChange={v=>sr("sleep_end",v)}/>
              </div>
            </div>
            <div>
              <FieldLabel>ทำงาน</FieldLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <TimePicker label="เริ่มงาน" value={r.work_start} onChange={v=>sr("work_start",v)}/>
                <TimePicker label="เลิกงาน" value={r.work_end} onChange={v=>sr("work_end",v)}/>
              </div>
            </div>
            <div>
              <FieldLabel>มื้ออาหาร</FieldLabel>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{k:"meal_breakfast",l:"เช้า"},{k:"meal_lunch",l:"กลางวัน"},{k:"meal_dinner",l:"เย็น"}].map(m=>(
                  <TimePicker key={m.k} label={m.l} value={r[m.k]} onChange={v=>sr(m.k,v)}/>
                ))}
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <FieldLabel>ออกกำลังกาย</FieldLabel>
                <button onClick={()=>sr("exercise",!r.exercise)} style={{background:r.exercise?"#34C759":"rgba(255,255,255,0.1)",border:"none",borderRadius:14,width:48,height:28,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                  <div style={{position:"absolute",top:3,left:r.exercise?23:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
                </button>
              </div>
              {r.exercise && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <TimePicker label="เริ่ม" value={r.exercise_start} onChange={v=>sr("exercise_start",v)}/>
                  <TimePicker label="สิ้นสุด" value={r.exercise_end} onChange={v=>sr("exercise_end",v)}/>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
              <Btn onClick={save} disabled={saving} full color="#34C759">{saving?"กำลังบันทึก...":"บันทึก"}</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── ADD/EDIT EVENT MODAL ───────────────────────────────────
function EventModal({initial, onSave, onClose, title="เพิ่มกิจกรรม"}) {
  const [form, setForm] = useState(initial||{title:"",category:"work",date:todayStr(),planned_start_time:"09:00",planned_end_time:"10:00",status:"scheduled",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const iStyle={width:"100%",padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",fontSize:14,color:"#f0f0f0",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0 16px 16px"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(12px)"}}/>
      <div style={{position:"relative",width:"100%",maxWidth:480,zIndex:1,animation:"slideUp 0.2s ease",maxHeight:"88vh",overflowY:"auto"}}>
        <Card>
          <div style={{padding:"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"rgba(22,22,24,0.98)",zIndex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0"}}>{title}</div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",width:28,height:28,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:13}}>✕</button>
          </div>
          <div style={{padding:"16px 20px 22px",display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <FieldLabel>ชื่อกิจกรรม</FieldLabel>
              <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="ชื่อกิจกรรม..." style={{...iStyle,fontSize:15,fontWeight:500}}
                onFocus={e=>e.target.style.borderColor="rgba(0,122,255,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
              />
            </div>
            <div>
              <FieldLabel>ประเภท</FieldLabel>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {Object.entries(CATS).map(([k,v])=>(
                  <button key={k} onClick={()=>set("category",k)} style={{padding:"7px 14px",borderRadius:20,border:"none",background:form.category===k?v.dot:"rgba(255,255,255,0.05)",color:form.category===k?"#fff":"#888",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{v.label}</button>
                ))}
              </div>
            </div>
            <DatePicker label="วันที่" value={form.date} onChange={v=>set("date",v)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <TimePicker label="เวลาเริ่ม" value={form.planned_start_time} onChange={v=>set("planned_start_time",v)}/>
              <TimePicker label="เวลาสิ้นสุด" value={form.planned_end_time} onChange={v=>set("planned_end_time",v)}/>
            </div>
            <div>
              <FieldLabel>หมายเหตุ</FieldLabel>
              <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." rows={2} style={{...iStyle,resize:"none",lineHeight:1.6}}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>{if(form.title.trim()) onSave(form);}} disabled={!form.title.trim()} full>{title}</Btn>
              <Btn onClick={onClose} ghost full>ยกเลิก</Btn>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────
function MainApp({session}) {
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [showAI, setShowAI]             = useState(false);
  const [showHealthChat, setShowHealthChat] = useState(false);
  const [showRoutine, setShowRoutine]   = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [viewMode, setViewMode]         = useState("day");
  const [currentDate, setCurrentDate]   = useState(todayStr());
  const [filter, setFilter]             = useState("all");
  const [search, setSearch]             = useState("");
  const [authProfile, setAuthProfile]   = useState(null);
  const [userProfile, setUserProfile]   = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast]               = useState(null);
  const routineGeneratedRef             = useRef(false);

  const user = session.user;

  function showToast(msg, color="#34C759") {
    setToast({msg,color});
    setTimeout(()=>setToast(null),3000);
  }

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
    if (!up||!up.onboarded) { setShowOnboarding(true); } else { setUserProfile(up); }
  },[user]);

  useEffect(()=>{ fetchEvents(); fetchProfile(); },[fetchEvents,fetchProfile]);

  // Auto-generate today's routine once
  useEffect(()=>{
    if (!userProfile?.routine||loading||routineGeneratedRef.current) return;
    const today = todayStr();
    const has = events.some(e=>e.date===today);
    if (!has) {
      routineGeneratedRef.current = true;
      generateRoutine(today);
    }
  },[userProfile,loading,events]);

  async function generateRoutine(date) {
    const r = userProfile?.routine;
    if (!r) return;
    const toAdd = [];
    if (r.sleep_start) toAdd.push({category:"sleep",title:"นอนหลับ",date,planned_start_time:r.sleep_start,planned_end_time:r.sleep_end||"07:00",status:"scheduled",notes:""});
    if (r.work_start)  toAdd.push({category:"work", title:"ทำงาน",  date,planned_start_time:r.work_start, planned_end_time:r.work_end||"18:00", status:"scheduled",notes:""});
    if (r.exercise&&r.exercise_start) toAdd.push({category:"exercise",title:"ออกกำลังกาย",date,planned_start_time:r.exercise_start,planned_end_time:r.exercise_end||"19:00",status:"scheduled",notes:""});
    if (r.meal_breakfast) toAdd.push({category:"meal",title:"มื้อเช้า",   date,planned_start_time:r.meal_breakfast,planned_end_time:addMinutes(r.meal_breakfast,30),status:"scheduled",notes:""});
    if (r.meal_lunch)     toAdd.push({category:"meal",title:"มื้อกลางวัน",date,planned_start_time:r.meal_lunch,    planned_end_time:addMinutes(r.meal_lunch,30),    status:"scheduled",notes:""});
    if (r.meal_dinner)    toAdd.push({category:"meal",title:"มื้อเย็น",   date,planned_start_time:r.meal_dinner,   planned_end_time:addMinutes(r.meal_dinner,30),   status:"scheduled",notes:""});
    let count=0;
    for (const ev of toAdd) {
      const {data} = await supabase.from("events").insert({...ev,user_id:user.id,id:uid()}).select().single();
      if (data) { setEvents(prev=>[data,...prev]); count++; }
    }
    if (count>0) showToast(`สร้าง ${count} กิจกรรมจากตารางประจำวันแล้ว`);
  }

  async function addEvent(form) {
    const {data} = await supabase.from("events").insert({...form,user_id:user.id,id:uid()}).select().single();
    if (data) { setEvents(prev=>[data,...prev]); setShowAdd(false); showToast("เพิ่มกิจกรรมแล้ว"); }
  }

  async function addEventsFromAI(evList) {
    let count=0;
    for (const ev of evList) {
      const {data} = await supabase.from("events").insert({...ev,user_id:user.id}).select().single();
      if (data) { setEvents(prev=>[data,...prev]); count++; }
    }
    setShowAI(false);
    showToast(`เพิ่ม ${count} กิจกรรมแล้ว`);
  }

  async function updateEvent(updated) {
    const {error} = await supabase.from("events").update(updated).eq("id",updated.id);
    if (!error) { setEvents(prev=>prev.map(e=>e.id===updated.id?updated:e)); setSelected(updated); setEditingEvent(null); }
  }

  async function deleteEvent(id) {
    await supabase.from("events").delete().eq("id",id);
    setEvents(prev=>prev.filter(e=>e.id!==id));
    setSelected(null);
    showToast("ลบกิจกรรมแล้ว","#FF3B30");
  }

  async function resetAccount() {
    await supabase.from("events").delete().eq("user_id",user.id);
    await supabase.from("user_profiles").update({onboarded:false,routine:{},goal:null}).eq("id",user.id);
    setEvents([]); setUserProfile(null);
    setShowResetConfirm(false); setShowProfileMenu(false);
    routineGeneratedRef.current = false;
    setShowOnboarding(true);
    showToast("รีเซ็ตบัญชีแล้ว กรุณาตั้งค่าใหม่");
  }

  async function signOut() { await supabase.auth.signOut(); }

  const today = todayStr();
  const weekStart = (()=>{ const d=new Date(currentDate+"T00:00:00"); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().split("T")[0]; })();
  const weekDates = Array.from({length:7},(_,i)=>addDays(weekStart,i));

  const dateEvts = viewMode==="day" ? events.filter(e=>e.date===currentDate) : events.filter(e=>weekDates.includes(e.date));
  const filtered = dateEvts.filter(e=>filter==="all"||e.category===filter).filter(e=>!search||e.title.toLowerCase().includes(search.toLowerCase()));
  const grouped  = filtered.reduce((acc,e)=>{ (acc[e.date]=acc[e.date]||[]).push(e); return acc; },{});

  const todayEvs = events.filter(e=>e.date===today);
  const done = todayEvs.filter(e=>e.status==="completed").length;
  const total = todayEvs.length;
  const pct = total?Math.round((done/total)*100):0;

  return (
    <div style={{minHeight:"100vh",background:"#080808",fontFamily:"-apple-system,'SF Pro Display',sans-serif",paddingBottom:60}}>
      <style>{`
        @keyframes slideUp{from{transform:translateY(28px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
      `}</style>

      {showOnboarding && <Onboarding userId={user.id} onComplete={up=>{setUserProfile(up);setShowOnboarding(false);showToast("ยินดีต้อนรับ ตั้งค่าเสร็จแล้ว");}}/>}

      {/* Navbar */}
      <div style={{background:"rgba(8,8,8,0.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50}}>
        <div style={{fontSize:16,fontWeight:700,color:"#f0f0f0",letterSpacing:-0.3}}>Calendar</div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <button onClick={()=>setShowRoutine(true)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",color:"#888",padding:"5px 11px",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>ตาราง</button>
          <button onClick={()=>setShowHealthChat(true)} style={{background:"rgba(52,199,89,0.1)",border:"1px solid rgba(52,199,89,0.2)",color:"#34C759",padding:"5px 11px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit"}}>วิเคราะห์</button>
          <button onClick={()=>setShowAI(!showAI)} style={{background:showAI?"rgba(88,86,214,0.25)":"rgba(88,86,214,0.1)",border:"1px solid rgba(88,86,214,0.25)",color:"#a78bfa",padding:"5px 11px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit"}}>AI</button>
          <button onClick={()=>setShowAdd(true)} style={{background:"#007AFF",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,122,255,0.3)"}}>+</button>
          <button onClick={()=>setShowProfileMenu(!showProfileMenu)} style={{border:"none",background:"none",cursor:"pointer",padding:0}}>
            {authProfile?.avatar_url
              ? <img src={authProfile.avatar_url} alt="" style={{width:30,height:30,borderRadius:"50%",objectFit:"cover",border:"1.5px solid rgba(255,255,255,0.12)"}}/>
              : <div style={{width:30,height:30,borderRadius:"50%",background:"#007AFF",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600}}>{(authProfile?.display_name||user.email||"?")[0].toUpperCase()}</div>
            }
          </button>
        </div>
      </div>

      {/* Profile menu */}
      {showProfileMenu && (
        <div style={{position:"fixed",top:52,right:12,zIndex:100,animation:"fadeIn 0.15s ease"}}>
          <Card style={{padding:"13px 15px",minWidth:200}}>
            <div style={{fontSize:14,fontWeight:600,color:"#f0f0f0"}}>{authProfile?.display_name||"ผู้ใช้"}</div>
            <div style={{fontSize:12,color:"#555",marginBottom:4}}>{user.email}</div>
            {userProfile&&(
              <div style={{fontSize:12,color:"#444",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8,marginBottom:8}}>
                {userProfile.age} ปี · {userProfile.weight_kg} กก. · {{health:"สุขภาพดี",lose:"ลดน้ำหนัก",gain:"เพิ่มน้ำหนัก",muscle:"เพิ่มกล้ามเนื้อ"}[userProfile.goal]||userProfile.goal}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <Btn onClick={()=>{setShowResetConfirm(true);setShowProfileMenu(false);}} ghost danger full small>รีเซ็ตบัญชี</Btn>
              <Btn onClick={signOut} ghost color="#666" full small>ออกจากระบบ</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Reset confirm */}
      {showResetConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)"}}>
          <Card style={{padding:"22px",maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f0",marginBottom:8}}>รีเซ็ตบัญชี</div>
            <div style={{fontSize:14,color:"#666",lineHeight:1.6,marginBottom:18}}>ข้อมูลกิจกรรมและการตั้งค่าทั้งหมดจะถูกลบ ยืนยันหรือไม่</div>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>setShowResetConfirm(false)} ghost full>ยกเลิก</Btn>
              <Btn onClick={resetAccount} danger full>ยืนยัน</Btn>
            </div>
          </Card>
        </div>
      )}

      <div style={{maxWidth:820,margin:"0 auto",padding:"14px 12px 0"}}>
        {/* Metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>
          {[{l:"วันนี้",v:total,col:"#007AFF"},{l:"เสร็จ",v:done,col:"#34C759"},{l:"Completion",v:`${pct}%`,col:"#FF9500"},{l:"รวม",v:events.length,col:"#5856D6"}].map(({l,v,col})=>(
            <div key={l} style={{background:"rgba(22,22,24,0.95)",borderRadius:12,padding:"10px 12px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{fontSize:20,fontWeight:700,color:col,letterSpacing:-0.5}}>{v}</div>
              <div style={{fontSize:10,color:"#555",fontWeight:500,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* AI Panel */}
        {showAI && <AIPanel onAdd={addEventsFromAI} onClose={()=>setShowAI(false)} userId={user.id}/>}

        {/* View toggle + Date nav */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",gap:4}}>
            {[{v:"day",l:"รายวัน"},{v:"week",l:"สัปดาห์"}].map(m=>(
              <button key={m.v} onClick={()=>setViewMode(m.v)} style={{padding:"5px 11px",borderRadius:20,border:"none",background:viewMode===m.v?"#007AFF":"rgba(22,22,24,0.9)",color:viewMode===m.v?"#fff":"#555",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{m.l}</button>
            ))}
          </div>
          {viewMode==="day"&&(
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <button onClick={()=>setCurrentDate(addDays(currentDate,-1))} style={{background:"rgba(255,255,255,0.06)",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:14}}>‹</button>
              <button onClick={()=>setCurrentDate(today)} style={{fontSize:13,color:currentDate===today?"#007AFF":"#f0f0f0",background:"none",border:"none",cursor:"pointer",minWidth:90,textAlign:"center",fontFamily:"inherit",fontWeight:currentDate===today?600:400}}>
                {currentDate===today?"วันนี้":fmtDateShort(currentDate)}
              </button>
              <button onClick={()=>setCurrentDate(addDays(currentDate,1))} style={{background:"rgba(255,255,255,0.06)",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:14}}>›</button>
              {/* Calendar picker */}
              <div style={{position:"relative"}}>
                <button onClick={()=>document.getElementById("main-date-picker").showPicker?.()||document.getElementById("main-date-picker").click()} style={{background:"rgba(255,255,255,0.06)",border:"none",color:"#888",width:26,height:26,borderRadius:"50%",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>📅</button>
                <input id="main-date-picker" type="date" value={currentDate} onChange={e=>setCurrentDate(e.target.value)} style={{position:"absolute",opacity:0,width:1,height:1,top:0,left:0,pointerEvents:"none"}}/>
              </div>
            </div>
          )}
        </div>

        {/* Week grid */}
        {viewMode==="week"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:12}}>
            {weekDates.map(d=>{
              const cnt=events.filter(e=>e.date===d).length;
              const isT=d===today, isSel=d===currentDate;
              return (
                <button key={d} onClick={()=>setCurrentDate(d)} style={{background:isSel?"#007AFF":isT?"rgba(0,122,255,0.1)":"rgba(22,22,24,0.9)",border:`1px solid ${isSel?"#007AFF":isT?"rgba(0,122,255,0.2)":"rgba(255,255,255,0.05)"}`,borderRadius:10,padding:"7px 4px",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:9,color:isSel?"rgba(255,255,255,0.6)":"#555"}}>{getDayName(d)}</div>
                  <div style={{fontSize:15,fontWeight:600,color:isSel?"#fff":isT?"#007AFF":"#f0f0f0"}}>{new Date(d+"T00:00:00").getDate()}</div>
                  {cnt>0&&<div style={{width:4,height:4,borderRadius:"50%",background:isSel?"rgba(255,255,255,0.5)":"#007AFF",margin:"2px auto 0"}}/>}
                </button>
              );
            })}
          </div>
        )}

        {/* Search + filter */}
        <div style={{position:"relative",marginBottom:9}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหา..." style={{width:"100%",padding:"9px 12px 9px 32px",background:"rgba(22,22,24,0.95)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,fontSize:13,color:"#f0f0f0",fontFamily:"inherit",outline:"none"}}/>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#333",fontSize:13,pointerEvents:"none"}}>⌕</span>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
          {[["all","ทั้งหมด","#007AFF"],...Object.entries(CATS).map(([k,v])=>[k,v.label,v.dot])].map(([k,l,col])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{padding:"5px 11px",borderRadius:20,border:"none",flexShrink:0,background:filter===k?col:"rgba(22,22,24,0.95)",color:filter===k?"#fff":"#555",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>

        {/* Split layout */}
        <div style={{display:"grid",gridTemplateColumns:selected||editingEvent?"1fr 320px":"1fr",gap:12,alignItems:"start"}}>
          <Card style={{overflow:"hidden"}}>
            {loading?(
              <div style={{padding:"40px 20px",textAlign:"center",color:"#444"}}><div style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</div></div>
            ):Object.keys(grouped).length===0?(
              <div style={{padding:"44px 20px",textAlign:"center"}}>
                <div style={{fontSize:14,color:"#444"}}>ไม่มีกิจกรรม</div>
                <div style={{fontSize:12,color:"#333",marginTop:4}}>กด AI หรือ + เพื่อเพิ่ม</div>
              </div>
            ):(
              Object.keys(grouped).sort().reverse().map(date=>(
                <div key={date}>
                  <div style={{padding:"7px 14px 3px",fontSize:10,fontWeight:700,color:"#444",letterSpacing:0.5,textTransform:"uppercase",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    {date===today?"วันนี้":fmtDateShort(date)}
                    <span style={{fontWeight:400,marginLeft:5,opacity:0.5}}>{fmtDate(date)}</span>
                  </div>
                  {grouped[date].sort((a,b)=>(a.planned_start_time||"").localeCompare(b.planned_start_time||"")).map(ev=>{
                    const c=CATS[ev.category];
                    const isSel=selected?.id===ev.id;
                    const stCol={completed:"#34C759",skipped:"#FF3B30",in_progress:"#FF9500",rescheduled:"#FF375F"}[ev.status]||"#444";
                    return (
                      <div key={ev.id} onClick={()=>{ setSelected(isSel?null:ev); setEditingEvent(null); }}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:isSel?c.bg:"transparent",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 0.1s"}}
                        onMouseEnter={e=>{if(!isSel) e.currentTarget.style.background="rgba(255,255,255,0.02)";}}
                        onMouseLeave={e=>{if(!isSel) e.currentTarget.style.background="transparent";}}
                      >
                        <div style={{width:8,height:8,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:500,color:"#f0f0f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                          <div style={{fontSize:11,color:"#555",marginTop:1}}>{ev.planned_start_time||""}{ev.planned_end_time?` – ${ev.planned_end_time}`:""}</div>
                        </div>
                        <span style={{fontSize:11,color:stCol,fontWeight:500,flexShrink:0}}>{STATUS_OPTS.find(s=>s.v===ev.status)?.l}</span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </Card>

          {/* Detail / Edit panel */}
          {(selected||editingEvent)&&!showAdd&&(
            <div style={{position:"sticky",top:58,animation:"fadeIn 0.15s ease"}}>
              {editingEvent?(
                <Card style={{overflow:"hidden"}}>
                  <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:15,fontWeight:600,color:"#f0f0f0"}}>แก้ไขกิจกรรม</div>
                    <button onClick={()=>setEditingEvent(null)} style={{background:"rgba(255,255,255,0.08)",border:"none",width:26,height:26,borderRadius:"50%",cursor:"pointer",color:"#666",fontSize:12}}>✕</button>
                  </div>
                  <div style={{padding:"14px 16px 18px",display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <FieldLabel>ชื่อ</FieldLabel>
                      <input value={editingEvent.title||""} onChange={e=>setEditingEvent(ev=>({...ev,title:e.target.value}))}
                        style={{width:"100%",padding:"9px 11px",borderRadius:9,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",fontSize:14,color:"#f0f0f0",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                    </div>
                    <div>
                      <FieldLabel>ประเภท</FieldLabel>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {Object.entries(CATS).map(([k,v])=>(
                          <button key={k} onClick={()=>setEditingEvent(ev=>({...ev,category:k}))} style={{padding:"4px 10px",borderRadius:20,border:"none",background:editingEvent.category===k?v.dot:"rgba(255,255,255,0.05)",color:editingEvent.category===k?"#fff":"#777",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{v.label}</button>
                        ))}
                      </div>
                    </div>
                    <DatePicker label="วันที่" value={editingEvent.date||todayStr()} onChange={v=>setEditingEvent(ev=>({...ev,date:v}))}/>
                    <TimePicker label="เวลาเริ่ม" value={editingEvent.planned_start_time||"09:00"} onChange={v=>setEditingEvent(ev=>({...ev,planned_start_time:v}))}/>
                    <TimePicker label="เวลาสิ้นสุด" value={editingEvent.planned_end_time||"10:00"} onChange={v=>setEditingEvent(ev=>({...ev,planned_end_time:v}))}/>
                    <div style={{display:"flex",gap:7}}>
                      <Btn onClick={()=>updateEvent(editingEvent)} disabled={!editingEvent.title?.trim()} full color="#007AFF" small>บันทึก</Btn>
                      <Btn onClick={()=>setEditingEvent(null)} ghost full small>ยกเลิก</Btn>
                    </div>
                  </div>
                </Card>
              ):selected&&(
                <Card style={{overflow:"hidden"}}>
                  <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <div style={{width:32,height:32,borderRadius:8,background:CATS[selected.category].bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:CATS[selected.category].dot}}/>
                        </div>
                        <div>
                          <div style={{fontSize:11,color:"#555"}}>{CATS[selected.category].label}</div>
                          <div style={{fontSize:15,fontWeight:600,color:"#f0f0f0"}}>{selected.title}</div>
                        </div>
                      </div>
                      <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,0.07)",border:"none",width:26,height:26,borderRadius:"50%",cursor:"pointer",color:"#555",fontSize:12}}>✕</button>
                    </div>
                    <div style={{display:"flex",gap:5,marginTop:10}}>
                      <Btn onClick={()=>setEditingEvent({...selected})} ghost color="#007AFF" small>แก้ไข</Btn>
                      <Btn onClick={()=>deleteEvent(selected.id)} ghost danger small>ลบ</Btn>
                    </div>
                  </div>
                  <div style={{padding:"11px 16px"}}>
                    {[["วันที่",fmtDate(selected.date)],["เวลา",`${selected.planned_start_time||"—"} – ${selected.planned_end_time||"—"}`],["หมายเหตุ",selected.notes||"—"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        <span style={{fontSize:12,color:"#555",minWidth:50,fontWeight:500}}>{l}</span>
                        <span style={{fontSize:13,color:"#ddd"}}>{v}</span>
                      </div>
                    ))}
                    <div style={{marginTop:10}}>
                      <div style={{fontSize:11,color:"#555",marginBottom:6}}>สถานะ</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {STATUS_OPTS.map(s=>{
                          const col={completed:"#34C759",skipped:"#FF3B30",in_progress:"#FF9500",rescheduled:"#FF375F",scheduled:"#555"}[s.v];
                          return <button key={s.v} onClick={()=>updateEvent({...selected,status:s.v})} style={{padding:"4px 9px",borderRadius:20,border:"none",background:selected.status===s.v?col:"rgba(255,255,255,0.05)",color:selected.status===s.v?"#fff":"#777",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>{s.l}</button>;
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {showAdd && <EventModal onSave={addEvent} onClose={()=>setShowAdd(false)} defaultDate={currentDate}/>}
      {showHealthChat && <AIHealthChat events={events} userProfile={userProfile} onClose={()=>setShowHealthChat(false)}/>}
      {showRoutine && <RoutineEditor userProfile={userProfile} userId={user.id} onClose={()=>setShowRoutine(false)} onSave={r=>{setUserProfile(p=>({...p,routine:r}));setShowRoutine(false);showToast("บันทึกตารางประจำวันแล้ว");}}/>}

      {toast&&(
        <div style={{position:"fixed",bottom:26,left:"50%",transform:"translateX(-50%)",background:toast.color||"#34C759",color:"#fff",padding:"9px 20px",borderRadius:20,fontSize:13,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,0.4)",zIndex:999,whiteSpace:"nowrap",animation:"fadeIn 0.2s ease"}}>{toast.msg}</div>
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
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#080808"}}>
      <div style={{width:34,height:34,border:"2.5px solid #007AFF",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return session ? <MainApp session={session}/> : <LoginPage/>;
}
