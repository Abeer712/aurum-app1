import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";

/* ─── CONSTANTS ─────────────────────────────────────────────── */
const PAIRS     = ["EUR/USD","GBP/USD","USD/JPY","XAU/USD","USD/CAD","AUD/USD","NZD/USD","EUR/GBP","GBP/JPY","BTC/USD","ETH/USD","USD/CHF"];
const SESSIONS  = ["London","New York","Tokyo","Sydney","Overlap"];
const EMOTIONS  = ["Confident","Calm","Disciplined","Focused","Impatient","Frustrated","Anxious","Greedy","Fearful","Revenge"];
const DEF_STRATS= ["Breakout","Trend Follow","Scalp","Reversal","Support/Resistance","ICT","SMC","Price Action","EMA Cross","Fibonacci"];
const EQ        = [{d:"Apr 1",eq:10000,dd:0},{d:"Apr 5",eq:10340,dd:0},{d:"Apr 7",eq:10120,dd:-1.9},{d:"Apr 11",eq:10680,dd:0},{d:"Apr 15",eq:10490,dd:-1.8},{d:"Apr 17",eq:11020,dd:0},{d:"Apr 22",eq:11638,dd:0},{d:"Apr 25",eq:12588,dd:0},{d:"Apr 26",eq:12278,dd:-2.5},{d:"Apr 28",eq:13553,dd:0}];

/* ─── HELPERS ────────────────────────────────────────────────── */
const pC  = v => v >= 0 ? "#22d46a" : "#f5607a";
const fP  = v => `${v >= 0 ? "+" : ""}$${Math.abs(v).toLocaleString()}`;
const fPi = v => `${v >= 0 ? "+" : ""}${v}`;
// Sync hash — instant, no async, works everywhere
const hash = (s) => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i=0;i<s.length;i++){
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1^ch, 2654435761);
    h2 = Math.imul(h2^ch, 1597334677);
  }
  h1 = Math.imul(h1^(h1>>>16), 2246822519) ^ Math.imul(h2^(h2>>>13), 3266489917);
  h2 = Math.imul(h2^(h2>>>16), 2246822519) ^ Math.imul(h1^(h1>>>13), 3266489917);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16) + s.length.toString(36);
};

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800;900&family=Syne:wght@700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#05080b;--s1:#0a0e13;--s2:#101620;--s3:#16202b;--s4:#1c2a38;
  --b1:rgba(255,255,255,0.048);--b2:rgba(255,255,255,0.085);--b3:rgba(255,255,255,0.15);
  --gold:#b8963e;--gold2:#d4af5a;--gold3:#ecc96e;--goldg:linear-gradient(135deg,#b8963e,#ecc96e);
  --green:#18b85c;--green2:#22d46a;--red:#e03d55;--red2:#f5607a;
  --blue:#2472f5;--blue2:#4d8fff;--cyan:#00bba3;
  --text:#d8d3c8;--t2:rgba(216,211,200,0.62);--t3:rgba(216,211,200,0.36);--t4:rgba(216,211,200,0.18);
  --num:'Outfit',-apple-system,Arial,sans-serif;
  --ui:'Inter',-apple-system,'Segoe UI',sans-serif;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--ui);-webkit-font-smoothing:antialiased;}
::selection{background:rgba(184,150,62,0.28)}
input,select,textarea{background:var(--s2);border:1px solid var(--b2);border-radius:8px;color:var(--text);font-family:var(--ui);font-size:0.8rem;padding:10px 13px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;width:100%}
input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,150,62,0.1)}
select option{background:var(--s2)}
.btn{border:none;border-radius:8px;font-family:var(--ui);cursor:pointer;transition:all 0.18s;font-size:0.74rem;letter-spacing:0.04em;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-gold{background:var(--goldg);color:#05080b;padding:11px 26px;box-shadow:0 2px 14px rgba(184,150,62,0.28)}
.btn-gold:hover{opacity:0.88;transform:translateY(-1px);box-shadow:0 6px 22px rgba(184,150,62,0.38)}
.btn-gold:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{background:transparent;color:var(--t2);border:1px solid var(--b2);padding:9px 18px}
.btn-ghost:hover{border-color:var(--b3);color:var(--text);background:rgba(255,255,255,0.03)}
.btn-red{background:rgba(224,61,85,0.1);color:var(--red2);border:1px solid rgba(224,61,85,0.2);padding:5px 10px;border-radius:6px;font-size:0.65rem;cursor:pointer}
.btn-red:hover{background:rgba(224,61,85,0.22)}

/* AUTH SCREEN */
.auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(184,150,62,0.12),transparent),var(--bg)}
.auth-card{width:100%;max-width:420px;background:var(--s1);border:1px solid var(--b2);border-radius:18px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.6)}
.auth-header{padding:32px 32px 24px;text-align:center;border-bottom:1px solid var(--b1)}
.auth-body{padding:28px 32px 32px}
.auth-tab{flex:1;padding:9px;border:none;background:transparent;font-family:var(--ui);font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.18s;color:var(--t3);border-bottom:2px solid transparent}
.auth-tab.on{color:var(--gold3);border-bottom-color:var(--gold3)}
.field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.field label{font-size:0.65rem;color:var(--t3);letter-spacing:0.13em;text-transform:uppercase}
.auth-divider{display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--t4);font-size:0.7rem}
.auth-divider::before,.auth-divider::after{content:'';flex:1;height:1px;background:var(--b2)}
.google-btn{width:100%;padding:11px;background:var(--s2);border:1px solid var(--b2);border-radius:8px;color:var(--text);font-family:var(--ui);font-size:0.8rem;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.18s}
.google-btn:hover{border-color:var(--b3);background:var(--s3)}
.err-msg{background:rgba(224,61,85,0.1);border:1px solid rgba(224,61,85,0.25);border-radius:8px;padding:9px 12px;font-size:0.74rem;color:var(--red2);margin-bottom:12px}
.ok-msg{background:rgba(24,184,92,0.1);border:1px solid rgba(24,184,92,0.22);border-radius:8px;padding:9px 12px;font-size:0.74rem;color:var(--green2);margin-bottom:12px}

/* APP LAYOUT */
.app{display:flex;height:100vh;overflow:hidden}
.sidebar{width:224px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;transition:transform 0.28s cubic-bezier(.4,0,.2,1);z-index:300}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{height:54px;flex-shrink:0;border-bottom:1px solid var(--b1);display:flex;align-items:center;padding:0 20px;gap:12px;background:rgba(5,8,11,0.85);backdrop-filter:blur(20px)}
.page{flex:1;overflow-y:auto;padding:20px 22px}
.page::-webkit-scrollbar{width:3px}
.page::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
.nav-link{display:flex;align-items:center;gap:9px;padding:9px 14px;border-radius:8px;color:var(--t2);cursor:pointer;font-size:0.74rem;border:1px solid transparent;background:transparent;width:100%;text-align:left;transition:all 0.15s;margin:1px 0;font-family:var(--ui);font-weight:500}
.nav-link:hover{background:var(--s2);color:var(--text)}
.nav-link.on{background:rgba(184,150,62,0.1);color:var(--gold3);border-color:rgba(184,150,62,0.18)}
.nav-sep{height:1px;background:var(--b1);margin:8px 0}

/* CARDS */
.card{background:var(--s1);border:1px solid var(--b1);border-radius:12px}
.card-gold{border-color:rgba(184,150,62,0.22)}
.ch{padding:14px 18px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.sc{position:relative;overflow:hidden;padding:14px 16px}
.sc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent,var(--gold))}
.lbl{display:block;font-size:0.6rem;color:var(--t3);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px}
.badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:0.63rem;font-weight:500;flex-shrink:0}
.bl{background:rgba(24,184,92,0.1);color:var(--green2);border:1px solid rgba(24,184,92,0.22)}
.bs{background:rgba(224,61,85,0.1);color:var(--red2);border:1px solid rgba(224,61,85,0.2)}
.tag-pill{display:inline-flex;align-items:center;gap:4px;background:rgba(184,150,62,0.08);border:1px solid rgba(184,150,62,0.2);border-radius:20px;color:var(--gold2);font-size:0.62rem;padding:2px 8px}
.stitle{font-family:var(--ui);font-size:1.0rem;color:var(--gold3);font-weight:700;letter-spacing:-0.01em}
.sdesc{font-size:0.67rem;color:var(--t3);margin-top:2px}

/* GRIDS */
.g-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media(min-width:600px){.g-stats{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1100px){.g-stats{grid-template-columns:repeat(6,1fr)}}
.g2{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:840px){.g2{grid-template-columns:1fr 1fr}}
.g3{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:960px){.g3{grid-template-columns:1fr 1fr 1fr}}
.g-charts{display:grid;grid-template-columns:1fr;gap:14px}
@media(min-width:900px){.g-charts{grid-template-columns:3fr 2fr}}
.g-form{display:grid;grid-template-columns:1fr;gap:11px}
@media(min-width:520px){.g-form{grid-template-columns:1fr 1fr}}
@media(min-width:860px){.g-form{grid-template-columns:1fr 1fr 1fr}}

/* SCREENSHOT */
.drop{border:2px dashed var(--b2);border-radius:10px;cursor:pointer;transition:all 0.2s;overflow:hidden;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px;position:relative}
.drop:hover,.drop.drag{border-color:var(--gold);background:rgba(184,150,62,0.04)}
.drop.has-img{padding:0;border-style:solid;border-color:var(--b2)}
.drop-img{width:100%;height:210px;object-fit:cover;display:block}
.drop-overlay{position:absolute;inset:0;background:rgba(5,8,11,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s}
.drop:hover .drop-overlay{opacity:1}
.drop-caption{position:absolute;bottom:0;left:0;right:0;background:rgba(5,8,11,0.88);backdrop-filter:blur(8px);padding:8px 12px;display:flex;justify-content:space-between;align-items:center}

/* MODAL */
.overlay{position:fixed;inset:0;background:rgba(5,8,11,0.9);backdrop-filter:blur(12px);z-index:400;display:flex;align-items:center;justify-content:center;padding:14px}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:14px;width:100%;max-width:780px;max-height:92vh;overflow-y:auto}
.modal::-webkit-scrollbar{width:3px}
.modal::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

/* INSIGHT */
.irow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b1)}
.irow:last-child{border-bottom:none}
.ibar{flex:1;height:5px;background:var(--s3);border-radius:3px;overflow:hidden}
.ifill{height:100%;border-radius:3px;transition:width 0.9s cubic-bezier(.4,0,.2,1)}

/* TABLE */
.tbl{width:100%;border-collapse:collapse;font-size:0.73rem}
.tbl th{padding:10px 12px;text-align:left;color:var(--t3);font-size:0.59rem;letter-spacing:0.13em;text-transform:uppercase;white-space:nowrap;border-bottom:1px solid var(--b2);font-weight:400}
.tbl td{padding:10px 12px;border-bottom:1px solid var(--b1);white-space:nowrap;vertical-align:middle}
.tbl tbody tr{cursor:pointer;transition:background 0.12s}
.tbl tbody tr:hover td{background:var(--s2)}

/* SWITCH */
.sw{display:flex;background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:3px;gap:2px}
.swb{flex:1;padding:5px 10px;border:none;border-radius:6px;font-family:var(--ui);font-size:0.66rem;letter-spacing:0.04em;cursor:pointer;transition:all 0.15s;background:transparent;color:var(--t2);text-transform:uppercase;font-weight:500}
.swb.on{background:var(--s3);color:var(--text)}

/* EMOTION PILLS */
.em-pill{background:transparent;border:1px solid var(--b2);border-radius:20px;color:var(--t2);font-size:0.68rem;padding:5px 12px;cursor:pointer;transition:all 0.15s;font-family:var(--ui)}
.em-pill.on{background:rgba(184,150,62,0.14);border-color:var(--gold);color:var(--gold3)}

/* TOOLTIP */
.tip{background:var(--s2);border:1px solid var(--b2);border-radius:8px;padding:9px 13px;font-size:0.7rem;font-family:var(--ui)}

/* MOBILE */
@media(max-width:700px){
  .sidebar{position:fixed;inset:0 auto 0 0;transform:translateX(-100%)}
  .sidebar.open{transform:translateX(0);box-shadow:6px 0 40px rgba(0,0,0,0.7)}
  .page{padding:14px}
  .hide-sm{display:none!important}
}
.mob-card{background:var(--s2);border:1px solid var(--b1);border-radius:10px;padding:13px 14px;cursor:pointer;transition:border-color 0.15s}
.mob-card:hover{border-color:var(--b3)}
.show-sm{display:none}
@media(max-width:700px){.show-sm{display:block}}

/* ANIMS */
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.38s ease forwards}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.fi{animation:fadeIn 0.3s ease forwards}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.spin{animation:spin 0.85s linear infinite;display:inline-block}

/* LOADING SCREEN */
.loading-screen{position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:999}
`;

/* ─── NUM STYLE ─────────────────────────────────────────────── */
const N = (size="1rem", weight=700, color="var(--text)", extra={}) => ({
  fontFamily:"'Outfit',-apple-system,Arial,sans-serif",
  fontSize:size, fontWeight:weight, color,
  fontFeatureSettings:"'tnum'",
  letterSpacing:"-0.025em",
  lineHeight:1,
  ...extra
});

/* ─── TOOLTIP ────────────────────────────────────────────────── */
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div style={{color:"var(--t3)",marginBottom:4,fontSize:"0.65rem"}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color||"var(--gold3)"}}>
          {p.name}: {typeof p.value==="number"
            ? p.name==="Equity"?"$"+p.value.toLocaleString()
            : p.name==="Drawdown"?p.value+"%"
            : (p.value>=0?"+":"")+p.value : p.value}
        </div>
      ))}
    </div>
  );
};

/* ─── DROP ZONE ──────────────────────────────────────────────── */
let _dz=0;
function DropZone({label,icon,value,onChange}){
  const [drag,setDrag]=useState(false);
  const uid=useRef(`dz_${++_dz}`).current;
  const load=f=>{if(!f)return;const r=new FileReader();r.onload=ev=>onChange(ev.target.result);r.readAsDataURL(f);};
  return(
    <div>
      <div className="lbl" style={{marginBottom:8}}>{icon} {label}</div>
      <input id={uid} type="file" accept="image/*" style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none",overflow:"hidden"}} onChange={e=>{load(e.target.files[0]);e.target.value="";}}/>
      <label htmlFor={uid} className={`drop${drag?" drag":""}${value?" has-img":""}`} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={e=>{e.preventDefault();setDrag(false)}} onDrop={e=>{e.preventDefault();setDrag(false);load(e.dataTransfer.files[0]);}}>
        {value?(
          <><img src={value} alt={label} className="drop-img"/>
            <div className="drop-overlay"><span style={{fontSize:"1.6rem"}}>🔄</span><span style={{fontSize:"0.7rem",color:"var(--t2)",marginTop:5}}>Click to replace</span></div>
            <div className="drop-caption"><span style={{fontSize:"0.63rem",color:"var(--t2)"}}>{label}</span><span style={{background:"rgba(224,61,85,0.15)",color:"var(--red2)",border:"1px solid rgba(224,61,85,0.25)",borderRadius:6,fontSize:"0.6rem",padding:"3px 10px",cursor:"pointer"}} onClick={e=>{e.preventDefault();e.stopPropagation();onChange("");}}>Remove</span></div>
          </>
        ):(
          <><div style={{fontSize:"2.4rem",marginBottom:10,opacity:0.38,lineHeight:1}}>{icon}</div>
            <div style={{fontSize:"0.78rem",color:"var(--t2)",marginBottom:4,fontWeight:500}}>Click to upload screenshot</div>
            <div style={{fontSize:"0.63rem",color:"var(--t4)"}}>or drag & drop · PNG, JPG, WebP</div>
          </>
        )}
      </label>
    </div>
  );
}

/* ─── STRATEGY MANAGER ───────────────────────────────────────── */
function StratMgr({strats,setStrats,onClose}){
  const [val,setVal]=useState(""); const [edit,setEdit]=useState(null); const [eVal,setEVal]=useState("");
  const add=()=>{const v=val.trim();if(v&&!strats.includes(v)){setStrats(p=>[...p,v]);setVal("");}};
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div className="ch"><div><div className="stitle">Strategy Manager</div><div className="sdesc">Add, rename or remove your strategies</div></div><button className="btn btn-ghost" style={{padding:"5px 12px"}} onClick={onClose}>✕</button></div>
        <div style={{padding:18,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:8}}><input value={val} onChange={e=>setVal(e.target.value)} placeholder="New strategy name…" onKeyDown={e=>e.key==="Enter"&&add()} style={{flex:1}}/><button className="btn btn-gold" onClick={add}>+ Add</button></div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto"}}>
            {strats.map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:8,background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:8,padding:"9px 12px"}}>
                <span style={{fontSize:"0.65rem",color:"var(--t3)",width:20,flexShrink:0}}>{i+1}.</span>
                {edit===s
                  ?<><input value={eVal} onChange={e=>setEVal(e.target.value)} style={{flex:1,padding:"5px 9px"}} autoFocus onKeyDown={e=>e.key==="Enter"&&(setStrats(p=>p.map(x=>x===s?eVal.trim():x)),setEdit(null))}/><button className="btn btn-gold" style={{padding:"5px 12px",fontSize:"0.68rem"}} onClick={()=>{setStrats(p=>p.map(x=>x===s?eVal.trim():x));setEdit(null);}}>Save</button><button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:"0.68rem"}} onClick={()=>setEdit(null)}>✕</button></>
                  :<><span style={{flex:1,fontSize:"0.78rem"}}>{s}</span><button className="btn btn-ghost" style={{padding:"4px 10px",fontSize:"0.65rem"}} onClick={()=>{setEdit(s);setEVal(s);}}>Edit</button><button className="btn btn-red" onClick={()=>setStrats(p=>p.filter(x=>x!==s))}>✕</button></>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TRADE MODAL ────────────────────────────────────────────── */
function TradeModal({trade,onClose}){
  if(!trade)return null;
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{background:trade.pnl>0?"rgba(24,184,92,0.06)":"rgba(224,61,85,0.06)",borderBottom:"1px solid var(--b1)",padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span className={`badge ${trade.direction==="LONG"?"bl":"bs"}`}>{trade.direction}</span>
              <span style={N("1.5rem",800,"var(--gold3)")}>{trade.pair}</span>
              <span style={{fontSize:"0.65rem",color:"var(--t3)"}}>{trade.date}</span>
            </div>
            <div style={N("2.4rem",900,pC(trade.pnl),{letterSpacing:"-0.04em"})}>{fP(trade.pnl)}</div>
            <div style={{fontSize:"0.7rem",color:"var(--t3)",marginTop:6}}>{fPi(trade.pips)} pips · R:R {trade.rr} · {trade.session}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:20,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[["Date",trade.date],["Session",trade.session],["Strategy",trade.strategy],["Entry",trade.entry],["Exit",trade.exit],["Lots",trade.lots],["Pips",fPi(trade.pips)],["R:R",trade.rr],["Emotion",trade.emotions]].map(([k,v])=>(
              <div key={k} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:8,padding:"10px 12px"}}>
                <div className="lbl" style={{marginBottom:3}}>{k}</div>
                <div style={{fontSize:"0.82rem",fontWeight:600,color:k==="Pips"?pC(trade.pips):"var(--text)"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(224,61,85,0.07)",border:"1px solid rgba(224,61,85,0.18)",borderRadius:8,padding:"12px 14px"}}>
              <div className="lbl" style={{color:"var(--red2)",marginBottom:3}}>🔴 Stop Loss</div>
              <div style={N("1rem",700,"var(--red2)")}>{trade.sl||"—"}</div>
            </div>
            <div style={{background:"rgba(24,184,92,0.07)",border:"1px solid rgba(24,184,92,0.18)",borderRadius:8,padding:"12px 14px"}}>
              <div className="lbl" style={{color:"var(--green2)",marginBottom:3}}>🟢 Take Profit</div>
              <div style={N("1rem",700,"var(--green2)")}>{trade.tp||"—"}</div>
            </div>
          </div>
          {trade.tags?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{trade.tags.map(t=><span key={t} className="tag-pill"># {t}</span>)}</div>}
          <div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,padding:14}}>
            <div className="lbl" style={{marginBottom:8}}>📝 Trade Notes</div>
            <div style={{fontSize:"0.78rem",color:"var(--t2)",lineHeight:1.75,fontStyle:trade.notes?"normal":"italic"}}>{trade.notes||"No notes recorded."}</div>
          </div>
          <div>
            <div className="lbl" style={{marginBottom:10}}>📸 Chart Screenshots</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{k:"before",label:"Before Entry",icon:"🟡"},{k:"after",label:"After Exit",icon:"🏁"}].map(({k,label,icon})=>(
                <div key={k} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,overflow:"hidden"}}>
                  <div style={{padding:"8px 12px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:6}}>
                    <span>{icon}</span><span style={{fontSize:"0.68rem",color:"var(--t2)",fontWeight:500}}>{label}</span>
                  </div>
                  {trade.screenshots?.[k]
                    ?<img src={trade.screenshots[k]} alt={label} style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}}/>
                    :<div style={{height:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}><span style={{fontSize:"1.8rem",opacity:0.22}}>📷</span><span style={{fontSize:"0.66rem",color:"var(--t4)"}}>No screenshot</span></div>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── AUTH SCREEN ────────────────────────────────────────────── */
function AuthScreen({onLogin}){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [pw2,setPw2]=useState("");
  const [err,setErr]=useState(""); const [ok,setOk]=useState(""); const [loading,setLoading]=useState(false);

  const handleSubmit = () => {
    setErr(""); setOk(""); setLoading(true);
    setTimeout(() => {
      try {
        if(mode === "register"){
          if(!name.trim()){setErr("Please enter your name.");setLoading(false);return;}
          if(!email.includes("@")){setErr("Please enter a valid email.");setLoading(false);return;}
          if(pw.length < 6){setErr("Password must be at least 6 characters.");setLoading(false);return;}
          if(pw !== pw2){setErr("Passwords do not match.");setLoading(false);return;}
          const key = `aurum_user_${email.toLowerCase().replace(/[^a-z0-9]/g,"_")}`;
          const existing = localStorage.getItem(key);
          if(existing){setErr("Account already exists. Please sign in.");setLoading(false);return;}
          const pwHash = hash(pw + email.toLowerCase());
          const user = {id:`u_${Date.now()}`,name:name.trim(),email:email.toLowerCase(),pwHash,createdAt:new Date().toISOString()};
          localStorage.setItem(key, JSON.stringify(user));
          setOk("✓ Account created! Signing you in…");
          setTimeout(()=>{setLoading(false);onLogin(user);}, 700);
        } else {
          if(!email.trim()||!pw.trim()){setErr("Please enter email and password.");setLoading(false);return;}
          const key = `aurum_user_${email.toLowerCase().replace(/[^a-z0-9]/g,"_")}`;
          const raw = localStorage.getItem(key);
          if(!raw){setErr("No account found. Please create an account first.");setLoading(false);return;}
          const user = JSON.parse(raw);
          const pwHash = hash(pw + email.toLowerCase());
          if(pwHash !== user.pwHash){setErr("Incorrect password. Please try again.");setLoading(false);return;}
          setLoading(false);
          onLogin(user);
        }
      } catch(e){
        setErr("Error: " + e.message);
        setLoading(false);
      }
    }, 50);
  };

  return(
    <div className="auth-wrap fi">
      <div style={{width:"100%",maxWidth:420}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:42,height:42,background:"var(--goldg)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",boxShadow:"0 4px 20px rgba(184,150,62,0.4)"}}>◈</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:"2rem",fontWeight:800,color:"var(--gold3)",letterSpacing:"0.1em"}}>AURUM</div>
          </div>
          <div style={{fontSize:"0.74rem",color:"var(--t3)",letterSpacing:"0.12em",textTransform:"uppercase"}}>Professional Forex Trading Journal</div>
        </div>

        <div className="auth-card">
          {/* Tab switcher */}
          <div style={{display:"flex",borderBottom:"1px solid var(--b1)"}}>
            {[["login","Sign In"],["register","Create Account"]].map(([m,l])=>(
              <button key={m} className={`auth-tab${mode===m?" on":""}`} onClick={()=>{setMode(m);setErr("");setOk("");}}>
                {l}
              </button>
            ))}
          </div>

          <div className="auth-body">
            {err&&<div className="err-msg">⚠ {err}</div>}
            {ok&&<div className="ok-msg">✓ {ok}</div>}

            {mode==="register"&&(
              <div className="field">
                <label>Full Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="John Smith" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
              </div>
            )}
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder={mode==="register"?"Min. 6 characters":"Your password"} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
            </div>
            {mode==="register"&&(
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Re-enter password" onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
              </div>
            )}

            <button className="btn btn-gold" style={{width:"100%",marginTop:4,padding:"13px"}} onClick={handleSubmit} disabled={loading}>
              {loading?<><span className="spin">◈</span> Please wait…</>: mode==="login"?"Sign In →":"Create Account →"}
            </button>

            <div className="auth-divider">or</div>

            {/* Google placeholder — shows instructions */}
            <button className="google-btn" onClick={()=>setErr("Google login requires backend setup. See the guide below.")}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <div style={{textAlign:"center",marginTop:16,fontSize:"0.7rem",color:"var(--t3)"}}>
              {mode==="login"?"Don't have an account? ":"Already have an account? "}
              <span style={{color:"var(--gold2)",cursor:"pointer"}} onClick={()=>{setMode(mode==="login"?"register":"login");setErr("");setOk("");}}>
                {mode==="login"?"Create one →":"Sign in →"}
              </span>
            </div>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:20,fontSize:"0.65rem",color:"var(--t4)"}}>
          🔒 Your data is encrypted and stored privately · Each account is completely separate
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────── */
export default function AurumPro(){
  const [authState, setAuthState] = useState("loading"); // loading | auth | app
  const [user,      setUser]      = useState(null);
  const [tab,       setTab]       = useState("dashboard");
  const [sideOpen,  setSideOpen]  = useState(false);
  const [trades,    setTrades]    = useState([]);
  const [strats,    setStrats]    = useState(DEF_STRATS);
  const [showSM,    setShowSM]    = useState(false);
  const [selTrade,  setSelTrade]  = useState(null);
  const [aiText,    setAiText]    = useState("");
  const [aiLoad,    setAiLoad]    = useState(false);
  const [chartV,    setChartV]    = useState("equity");
  const [fPair,     setFPair]     = useState("All");
  const [fDir,      setFDir]      = useState("All");
  const [fSort,     setFSort]     = useState("date");
  const [saving,    setSaving]    = useState(false);

  /* ── LOAD SESSION ── */
  useEffect(()=>{
    try {
      const s = localStorage.getItem("aurum_session");
      if(s){
        const u = JSON.parse(s);
        setUser(u);
        loadUserData(u);
        setAuthState("app");
      } else {
        setAuthState("auth");
      }
    } catch(e) {
      setAuthState("auth");
    }
  },[]);

  /* ── LOAD USER DATA ── */
  const loadUserData = (u) => {
    try {
      const td = localStorage.getItem(`aurum_trades_${u.id}`);
      const sd = localStorage.getItem(`aurum_strats_${u.id}`);
      if(td) setTrades(JSON.parse(td));
      if(sd) setStrats(JSON.parse(sd));
    } catch(e) { console.log('loadUserData error:', e); }
  };

  /* ── SAVE TRADES ── */
  const saveTrades = useCallback((t, u) => {
    if(!u) return;
    setSaving(true);
    try { localStorage.setItem(`aurum_trades_${u.id}`, JSON.stringify(t)); }
    catch(e) {}
    setTimeout(() => setSaving(false), 400);
  }, []);

  /* ── SAVE STRATS ── */
  const saveStrats = useCallback((s, u) => {
    if(!u) return;
    try { localStorage.setItem(`aurum_strats_${u.id}`, JSON.stringify(s)); }
    catch(e) {}
  }, []);

  /* ── LOGIN ── */
  const handleLogin = (u) => {
    setUser(u);
    try { localStorage.setItem("aurum_session", JSON.stringify(u)); } catch(e){}
    loadUserData(u);
    setAuthState("app");
  };

  /* ── LOGOUT ── */
  const handleLogout = () => {
    try { localStorage.removeItem("aurum_session"); } catch(e){}
    setUser(null); setTrades([]); setStrats(DEF_STRATS);
    setAuthState("auth"); setTab("dashboard");
  };

  /* ── TRADES WRAPPER ── */
  const updateTrades = (fn)=>{
    setTrades(prev=>{
      const next = typeof fn==="function" ? fn(prev) : fn;
      saveTrades(next, user);
      return next;
    });
  };

  /* ── STRATS WRAPPER ── */
  const updateStrats = (fn)=>{
    setStrats(prev=>{
      const next = typeof fn==="function" ? fn(prev) : fn;
      saveStrats(next, user);
      return next;
    });
  };

  /* ── BLANK FORM ── */
  const blankForm = {
    date:new Date().toISOString().split("T")[0],pair:"EUR/USD",direction:"LONG",
    entry:"",exit:"",lots:"",sl:"",tp:"",session:"London",strategy:strats[0]||"",
    notes:"",emotions:"Calm",tags:[],newTag:"",screenshots:{before:"",after:""}
  };
  const [form,setForm]=useState(blankForm);
  const [fErr,setFErr]=useState("");
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));

  /* ── STATS ── */
  const S=useMemo(()=>{
    const all=trades, wins=all.filter(t=>t.pnl>0), losses=all.filter(t=>t.pnl<0), be=all.filter(t=>t.pnl===0);
    const total=all.length;
    const totalPnl=all.reduce((s,t)=>s+t.pnl,0);
    const winRate=total?(wins.length/total*100).toFixed(1):"0.0";
    const avgWin=wins.length?Math.round(wins.reduce((s,t)=>s+t.pnl,0)/wins.length):0;
    const avgLoss=losses.length?Math.round(Math.abs(losses.reduce((s,t)=>s+t.pnl,0)/losses.length)):0;
    const rr=avgLoss>0?(avgWin/avgLoss).toFixed(2):"—";
    const profFactor=(avgLoss>0&&losses.length>0)?((wins.length*avgWin)/(losses.length*avgLoss)).toFixed(2):"—";
    const avgPips=total?Math.round(all.reduce((s,t)=>s+t.pips,0)/total):0;
    const totalLots=all.reduce((s,t)=>s+parseFloat(t.lots||0),0).toFixed(1);
    const expectancy=total?Math.round((wins.length/total*avgWin)-(losses.length/total*avgLoss)):0;
    const best=total?all.reduce((m,t)=>t.pnl>m.pnl?t:m,all[0]):null;
    const worst=total?all.reduce((m,t)=>t.pnl<m.pnl?t:m,all[0]):null;
    let streak=0,maxStreak=0,lStreak=0,maxLStreak=0;
    [...all].sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{
      if(t.pnl>0){streak++;maxStreak=Math.max(maxStreak,streak);lStreak=0;}
      else{lStreak++;maxLStreak=Math.max(maxLStreak,lStreak);streak=0;}
    });
    const bySession=SESSIONS.map(s=>{const st=all.filter(t=>t.session===s);const sp=st.reduce((a,t)=>a+t.pnl,0);return{session:s,pnl:sp,trades:st.length,wr:st.length?(st.filter(t=>t.pnl>0).length/st.length*100).toFixed(0):"0"};});
    const mkBreak=key=>{const m={};all.forEach(t=>{if(!m[t[key]])m[t[key]]={pnl:0,trades:0,wins:0};m[t[key]].pnl+=t.pnl;m[t[key]].trades++;if(t.pnl>0)m[t[key]].wins++;});return Object.entries(m).map(([k,v])=>({name:k,pnl:v.pnl,trades:v.trades,wr:(v.wins/v.trades*100).toFixed(0)})).sort((a,b)=>b.pnl-a.pnl);};
    const byPair=mkBreak("pair"),byStrategy=mkBreak("strategy"),byEmotion=mkBreak("emotions");
    const pieDdata=[{name:"Wins",value:wins.length},{name:"Losses",value:losses.length},{name:"BE",value:be.length}];
    const radarData=[{subject:"Win Rate",A:Math.min(parseFloat(winRate),100)},{subject:"R:R",A:Math.min((parseFloat(rr)||0)*25,100)},{subject:"Profit F",A:Math.min((parseFloat(profFactor)||0)*20,100)},{subject:"Discipline",A:Math.min(maxStreak*12,100)},{subject:"Consistency",A:Math.min(total*6,100)},{subject:"Expectancy",A:Math.min(Math.max(expectancy/4+50,0),100)}];
    return{total,totalPnl,winRate,avgWin,avgLoss,rr,profFactor,avgPips,totalLots,expectancy,wins:wins.length,losses:losses.length,be:be.length,best,worst,maxStreak,maxLStreak,bySession,byPair,byStrategy,byEmotion,pieDdata,radarData};
  },[trades]);

  /* ── ADD TRADE ── */
  const addTrade=()=>{
    if(!form.entry||!form.exit||!form.lots){setFErr("Entry, exit and lot size are required.");return;}
    setFErr("");
    const dir=form.direction==="SHORT"?-1:1, mult=form.pair.includes("JPY")?100:10000;
    const pips=Math.round((parseFloat(form.exit)-parseFloat(form.entry))*dir*mult);
    const pnl=Math.round(parseFloat(form.lots)*pips*(form.pair.includes("JPY")?0.91:10));
    const slD=form.sl?Math.abs((parseFloat(form.entry)-parseFloat(form.sl))*mult):0;
    const tpD=form.tp?Math.abs((parseFloat(form.tp)-parseFloat(form.entry))*mult):0;
    const rr=slD>0?`1:${(tpD/slD).toFixed(1)}`:"N/A";
    const t={...form,id:Date.now(),pips,pnl,rr,entry:parseFloat(form.entry),exit:parseFloat(form.exit),lots:parseFloat(form.lots),sl:form.sl?parseFloat(form.sl):null,tp:form.tp?parseFloat(form.tp):null,tags:[...form.tags],screenshots:{...form.screenshots}};
    updateTrades(p=>[t,...p]);
    setForm({...blankForm,strategy:form.strategy});
    setTab("trades");
  };

  /* ── AI ── */
  const getAI=async()=>{
    setAiLoad(true);setAiText("");
    const sum=`Trades:${S.total}, WinRate:${S.winRate}%, PnL:$${S.totalPnl}, AvgWin:$${S.avgWin}, AvgLoss:$${S.avgLoss}, R:R:${S.rr}, ProfitFactor:${S.profFactor}, Expectancy:$${S.expectancy}, Pips:${S.avgPips}, WinStreak:${S.maxStreak}, LoseStreak:${S.maxLStreak}. Strategy:${S.byStrategy.map(x=>`${x.name}:$${x.pnl}(${x.wr}%)`).join(",")}. Session:${S.bySession.map(x=>`${x.session}:$${x.pnl}`).join(",")}. Emotion:${S.byEmotion.map(x=>`${x.name}:$${x.pnl}`).join(",")}.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,system:`You are an elite prop-firm performance analyst. Format response as:\n## Performance Summary\n[2 sentences]\n\n## ✅ Key Strengths\n- [data-backed strength]\n- [data-backed strength]\n- [data-backed strength]\n\n## ⚠️ Weaknesses\n- [specific fix]\n- [specific fix]\n\n## 🎯 Action\n[one rule to implement tomorrow]\n\nDirect and data-driven.`,messages:[{role:"user",content:`Analyze: ${sum}`}]})});
      const d=await res.json();setAiText(d.content?.[0]?.text||"Unable to generate.");
    }catch{setAiText("Connection error. Try again.");}
    setAiLoad(false);
  };

  const filtered=useMemo(()=>trades.filter(t=>(fPair==="All"||t.pair===fPair)&&(fDir==="All"||t.direction===fDir)).sort((a,b)=>fSort==="date"?b.date.localeCompare(a.date):fSort==="pnl"?b.pnl-a.pnl:b.pips-a.pips),[trades,fPair,fDir,fSort]);
  const nav=[{id:"dashboard",ic:"▦",lb:"Dashboard"},{id:"trades",ic:"≡",lb:"Trade Log"},{id:"log",ic:"✦",lb:"New Trade"},{id:"insights",ic:"◎",lb:"Insights"},{id:"psychology",ic:"◈",lb:"Psychology"}];
  const go=t=>{setTab(t);setSideOpen(false);};

  /* ── RENDER ── */
  if(authState==="loading") return(
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div style={{width:44,height:44,background:"var(--goldg)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem"}}>◈</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.5rem",fontWeight:800,color:"var(--gold3)",letterSpacing:"0.1em"}}>AURUM</div>
        <div style={{width:28,height:28,border:"2px solid var(--b2)",borderTopColor:"var(--gold)",borderRadius:"50%"}} className="spin"/>
      </div>
    </>
  );

  if(authState==="auth") return(
    <>
      <style>{CSS}</style>
      <AuthScreen onLogin={handleLogin}/>
    </>
  );

  return(
    <>
      <style>{CSS}</style>
      {showSM&&<StratMgr strats={strats} setStrats={updateStrats} onClose={()=>setShowSM(false)}/>}
      {selTrade&&<TradeModal trade={selTrade} onClose={()=>setSelTrade(null)}/>}
      {sideOpen&&<div style={{position:"fixed",inset:0,zIndex:200}} onClick={()=>setSideOpen(false)}/>}

      <div className="app">
        {/* ── SIDEBAR ── */}
        <aside className={`sidebar${sideOpen?" open":""}`}>
          <div style={{padding:"16px 14px 12px",borderBottom:"1px solid var(--b1)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,background:"var(--goldg)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",boxShadow:"0 2px 10px rgba(184,150,62,0.3)",flexShrink:0}}>◈</div>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontSize:"1.1rem",fontWeight:800,color:"var(--gold3)",letterSpacing:"0.1em",lineHeight:1}}>AURUM</div>
                <div style={{fontSize:"0.52rem",color:"var(--t3)",letterSpacing:"0.2em",textTransform:"uppercase",marginTop:1}}>Pro Journal</div>
              </div>
            </div>
          </div>

          <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
            {nav.map(n=>(
              <button key={n.id} className={`nav-link${tab===n.id?" on":""}`} onClick={()=>go(n.id)}>
                <span style={{fontSize:"0.95rem",width:18,textAlign:"center",opacity:0.8}}>{n.ic}</span>
                <span>{n.lb}</span>
              </button>
            ))}
            <div className="nav-sep"/>
            <button className="nav-link" onClick={()=>setShowSM(true)}>
              <span style={{fontSize:"0.95rem",width:18,textAlign:"center",opacity:0.8}}>⚙</span>
              <span>Strategies</span>
            </button>
          </nav>

          {/* User panel */}
          <div style={{padding:"12px 14px",borderTop:"1px solid var(--b1)",flexShrink:0}}>
            <div style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"var(--goldg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",fontWeight:700,color:"#05080b",flexShrink:0}}>
                  {user?.name?.[0]?.toUpperCase()||"U"}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:"0.78rem",fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name||"Trader"}</div>
                  <div style={{fontSize:"0.6rem",color:"var(--t3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email}</div>
                </div>
              </div>
              {saving&&<div style={{fontSize:"0.62rem",color:"var(--gold2)",display:"flex",alignItems:"center",gap:5}}><span className="spin" style={{fontSize:"0.7rem"}}>◈</span>Saving…</div>}
              {!saving&&<div style={{fontSize:"0.62rem",color:"var(--green2)",display:"flex",alignItems:"center",gap:5}}>✓ Data synced</div>}
            </div>
            <button className="btn btn-ghost" style={{width:"100%",padding:"8px",fontSize:"0.7rem",justifyContent:"center"}} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="main">
          <div className="topbar">
            <button className="btn btn-ghost" style={{padding:"7px 11px",fontSize:"1rem",flexShrink:0}} onClick={()=>setSideOpen(o=>!o)}>☰</button>
            <div style={{flex:1,fontSize:"0.88rem",color:"var(--t2)",fontWeight:500,textTransform:"capitalize"}}>
              {nav.find(n=>n.id===tab)?.lb||tab}
            </div>
            <div className="hide-sm" style={{display:"flex",alignItems:"center",gap:20,fontSize:"0.68rem"}}>
              {[["EUR/USD","1.0762","var(--text)"],["XAU/USD","2,341.80","var(--gold2)"],["GBP/JPY","192.80","var(--red2)"]].map(([p,v,c])=>(
                <span key={p} style={{color:"var(--t3)"}}>{p} <span style={{color:c,fontWeight:600}}>{v}</span></span>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}} className="hide-sm">
              <div style={{width:6,height:6,borderRadius:"50%",background:"var(--green2)",boxShadow:"0 0 5px var(--green2)"}} className="pulse"/>
              <span style={{fontSize:"0.63rem",color:"var(--t3)"}}>Welcome, {user?.name?.split(" ")[0]}</span>
            </div>
          </div>

          <div className="page">
            <div style={{maxWidth:1300,margin:"0 auto"}}>

              {/* ══ DASHBOARD ══ */}
              {tab==="dashboard"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {trades.length===0?(
                    <div style={{textAlign:"center",padding:"60px 20px"}}>
                      <div style={{fontSize:"3rem",marginBottom:16}}>📊</div>
                      <div style={{fontSize:"1.2rem",fontWeight:700,color:"var(--gold3)",marginBottom:8}}>Welcome to AURUM, {user?.name?.split(" ")[0]}!</div>
                      <div style={{fontSize:"0.82rem",color:"var(--t2)",marginBottom:24,maxWidth:400,margin:"0 auto 24px"}}>Your trading journal is ready. Start by logging your first trade to see your dashboard come to life.</div>
                      <button className="btn btn-gold" onClick={()=>go("log")}>Log Your First Trade →</button>
                    </div>
                  ):(
                    <>
                      <div className="g-stats">
                        {[
                          {l:"Total P&L",   v:fP(S.totalPnl),       s:`${S.total} trades`,              c:pC(S.totalPnl),  d:0},
                          {l:"Win Rate",    v:`${S.winRate}%`,       s:`${S.wins}W · ${S.losses}L`,      c:"var(--blue2)",  d:55},
                          {l:"Risk:Reward", v:S.rr,                  s:`Avg win $${S.avgWin}`,            c:"var(--gold2)",  d:110},
                          {l:"Profit Factor",v:S.profFactor,         s:"Target > 2.0",                   c:"var(--cyan)",   d:165},
                          {l:"Expectancy",  v:`$${S.expectancy}`,    s:"per trade",                      c:"var(--green2)", d:220},
                          {l:"Best Streak", v:`${S.maxStreak} wins`, s:`Max loss: ${S.maxLStreak}`,      c:"var(--gold3)",  d:275},
                        ].map(({l,v,s,c,d})=>(
                          <div key={l} className="card sc fu" style={{"--accent":c,animationDelay:`${d}ms`}}>
                            <div className="lbl">{l}</div>
                            <div style={N("clamp(1.1rem,2vw,1.5rem)",800,c,{marginTop:4})}>{v}</div>
                            <div style={{fontSize:"0.62rem",color:"var(--t3)",marginTop:5}}>{s}</div>
                          </div>
                        ))}
                      </div>

                      <div className="g-charts">
                        <div className="card">
                          <div className="ch">
                            <div><div className="stitle">Equity Curve</div><div style={{fontSize:"0.65rem",color:"var(--t3)",marginTop:2}}>Performance over time</div></div>
                            <div className="sw">{["equity","drawdown"].map(v=><button key={v} className={`swb${chartV===v?" on":""}`} onClick={()=>setChartV(v)}>{v}</button>)}</div>
                          </div>
                          <div style={{padding:"14px 16px"}}>
                            <ResponsiveContainer width="100%" height={160}>
                              {chartV==="equity"
                                ?<AreaChart data={EQ}><defs><linearGradient id="geq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d4af5a" stopOpacity={0.28}/><stop offset="100%" stopColor="#d4af5a" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="d" tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} width={46} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="eq" name="Equity" stroke="#d4af5a" strokeWidth={2} fill="url(#geq)" dot={false}/></AreaChart>
                                :<AreaChart data={EQ}><defs><linearGradient id="gdd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e03d55" stopOpacity={0.28}/><stop offset="100%" stopColor="#e03d55" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="d" tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} width={34} tickFormatter={v=>`${v}%`}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="dd" name="Drawdown" stroke="#e03d55" strokeWidth={2} fill="url(#gdd)" dot={false}/></AreaChart>
                              }
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="card">
                          <div className="ch"><div className="stitle">Win / Loss Split</div></div>
                          <div style={{padding:"14px 16px"}}>
                            <ResponsiveContainer width="100%" height={120}>
                              <PieChart><Pie data={S.pieDdata} cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}><Cell fill="#18b85c"/><Cell fill="#e03d55"/><Cell fill="#2472f5"/></Pie><Tooltip content={<Tip/>}/></PieChart>
                            </ResponsiveContainer>
                            <div style={{display:"flex",justifyContent:"center",gap:14,margin:"6px 0 12px"}}>
                              {[{c:"#18b85c",l:`Wins (${S.wins})`},{c:"#e03d55",l:`Losses (${S.losses})`},{c:"#2472f5",l:`BE (${S.be})`}].map(({c,l})=>(
                                <div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/><span style={{fontSize:"0.63rem",color:"var(--t2)"}}>{l}</span></div>
                              ))}
                            </div>
                            <div style={{borderTop:"1px solid var(--b1)",paddingTop:8}}>
                              {[{l:"Avg Win",v:`+$${S.avgWin}`,c:"var(--green2)"},{l:"Avg Loss",v:`-$${S.avgLoss}`,c:"var(--red2)"},{l:"Avg Pips",v:fPi(S.avgPips),c:pC(S.avgPips)},{l:"Total Lots",v:S.totalLots+" lots",c:"var(--t2)"}].map(({l,v,c},i,arr)=>(
                                <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 2px",borderBottom:i<arr.length-1?"1px solid var(--b1)":"none"}}>
                                  <span style={{fontSize:"0.68rem",color:"var(--t3)"}}>{l}</span>
                                  <span style={N("0.88rem",700,c)}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="ch"><div className="stitle">Recent Trades</div><button className="btn btn-ghost" style={{padding:"4px 12px",fontSize:"0.65rem"}} onClick={()=>go("trades")}>View All →</button></div>
                        <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                          {trades.slice(0,5).map(t=>(
                            <div key={t.id} onClick={()=>setSelTrade(t)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,cursor:"pointer",transition:"border-color 0.15s",gap:8,flexWrap:"wrap"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--b3)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--b1)"}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <span className={`badge ${t.direction==="LONG"?"bl":"bs"}`}>{t.direction}</span>
                                <span style={{fontWeight:600,fontSize:"0.82rem"}}>{t.pair}</span>
                                <span style={{fontSize:"0.68rem",color:"var(--t3)"}} className="hide-sm">{t.strategy} · {t.session}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:14}}>
                                <span style={{fontSize:"0.67rem",color:"var(--t3)"}}>{t.date}</span>
                                <span style={N("0.95rem",700,pC(t.pnl),{minWidth:64,textAlign:"right"})}>{fP(t.pnl)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ══ TRADES ══ */}
              {tab==="trades"&&(
                <div style={{display:"flex",flexDirection:"column",gap:13}}>
                  <div className="card" style={{padding:"11px 16px"}}>
                    <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
                      <select value={fPair} onChange={e=>setFPair(e.target.value)} style={{width:"auto",minWidth:116}}><option>All</option>{PAIRS.map(p=><option key={p}>{p}</option>)}</select>
                      <select value={fDir} onChange={e=>setFDir(e.target.value)} style={{width:"auto",minWidth:96}}>{["All","LONG","SHORT"].map(d=><option key={d}>{d}</option>)}</select>
                      <select value={fSort} onChange={e=>setFSort(e.target.value)} style={{width:"auto",minWidth:108}}><option value="date">Date ↓</option><option value="pnl">P&L ↓</option><option value="pips">Pips ↓</option></select>
                      <span style={{marginLeft:"auto",fontSize:"0.68rem",color:"var(--t3)"}}>{filtered.length} trades</span>
                    </div>
                  </div>
                  {filtered.length===0?(
                    <div style={{textAlign:"center",padding:"50px 20px",color:"var(--t3)"}}>
                      <div style={{fontSize:"2rem",marginBottom:12}}>📋</div>
                      <div style={{fontSize:"0.88rem",marginBottom:16}}>No trades yet. Start logging!</div>
                      <button className="btn btn-gold" onClick={()=>go("log")}>Log First Trade →</button>
                    </div>
                  ):(
                    <>
                      <div className="card hide-sm" style={{overflow:"hidden"}}>
                        <div style={{overflowX:"auto"}}>
                          <table className="tbl">
                            <thead><tr>{["Date","Pair","Dir","Entry","Exit","SL","TP","Lots","Pips","P&L","R:R","Session","Strategy","Emotion","Tags",""].map(h=><th key={h}>{h}</th>)}</tr></thead>
                            <tbody>
                              {filtered.map(t=>(
                                <tr key={t.id} onClick={()=>setSelTrade(t)}>
                                  <td style={{color:"var(--t3)"}}>{t.date}</td>
                                  <td style={{fontWeight:600}}>{t.pair}</td>
                                  <td><span className={`badge ${t.direction==="LONG"?"bl":"bs"}`}>{t.direction}</span></td>
                                  <td style={{color:"var(--t2)"}}>{t.entry}</td><td style={{color:"var(--t2)"}}>{t.exit}</td>
                                  <td style={{color:"var(--red2)",opacity:0.75}}>{t.sl||"—"}</td>
                                  <td style={{color:"var(--green2)",opacity:0.75}}>{t.tp||"—"}</td>
                                  <td style={{color:"var(--t2)"}}>{t.lots}</td>
                                  <td style={{...N("0.78rem",600,pC(t.pips))}}>{fPi(t.pips)}</td>
                                  <td style={N("0.88rem",700,pC(t.pnl))}>{fP(t.pnl)}</td>
                                  <td style={{color:"var(--t3)"}}>{t.rr}</td>
                                  <td style={{color:"var(--t3)"}}>{t.session}</td><td style={{color:"var(--t3)"}}>{t.strategy}</td><td style={{color:"var(--t3)"}}>{t.emotions}</td>
                                  <td><div style={{display:"flex",flexWrap:"wrap",gap:3,maxWidth:110}}>{t.tags?.slice(0,2).map(tg=><span key={tg} style={{background:"rgba(184,150,62,0.08)",border:"1px solid rgba(184,150,62,0.18)",borderRadius:10,color:"var(--gold2)",fontSize:"0.58rem",padding:"1px 6px"}}>{tg}</span>)}</div></td>
                                  <td onClick={e=>e.stopPropagation()}><button className="btn btn-red" onClick={()=>updateTrades(p=>p.filter(x=>x.id!==t.id))}>✕</button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}} className="show-sm">
                        {filtered.map(t=>(
                          <div key={t.id} className="mob-card" onClick={()=>setSelTrade(t)}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}><span className={`badge ${t.direction==="LONG"?"bl":"bs"}`}>{t.direction}</span><span style={{fontWeight:600,fontSize:"0.85rem"}}>{t.pair}</span></div>
                              <span style={N("1.05rem",700,pC(t.pnl))}>{fP(t.pnl)}</span>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,fontSize:"0.64rem",color:"var(--t3)"}}><span>{t.date}</span><span>{t.strategy}</span><span>{t.session}</span><span style={{color:pC(t.pips)}}>{fPi(t.pips)} pips</span><span>R:R {t.rr}</span><span>{t.emotions}</span></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ══ LOG ══ */}
              {tab==="log"&&(
                <div style={{maxWidth:880,margin:"0 auto",display:"flex",flexDirection:"column",gap:14}}>
                  <div className="card">
                    <div className="ch"><div><div className="stitle">Log New Trade</div><div className="sdesc">Capture every detail for deeper analysis</div></div></div>
                    <div style={{padding:18,display:"flex",flexDirection:"column",gap:14}}>
                      <div className="g-form">
                        {[{l:"Date",k:"date",t:"date"},{l:"Pair",k:"pair",t:"sel",o:PAIRS},{l:"Direction",k:"direction",t:"sel",o:["LONG","SHORT"]},{l:"Entry Price",k:"entry",t:"number",p:"e.g. 1.08420"},{l:"Exit Price",k:"exit",t:"number",p:"e.g. 1.08650"},{l:"Lot Size",k:"lots",t:"number",p:"e.g. 0.5"},{l:"Stop Loss",k:"sl",t:"number",p:"e.g. 1.08100"},{l:"Take Profit",k:"tp",t:"number",p:"e.g. 1.09000"},{l:"Session",k:"session",t:"sel",o:SESSIONS}].map(f=>(
                          <div key={f.k}><label className="lbl">{f.l}</label>{f.t==="sel"?<select value={form[f.k]} onChange={e=>sf(f.k,e.target.value)}>{f.o.map(o=><option key={o}>{o}</option>)}</select>:<input type={f.t} value={form[f.k]} placeholder={f.p} onChange={e=>sf(f.k,e.target.value)}/>}</div>
                        ))}
                        <div><label className="lbl">Strategy</label><div style={{display:"flex",gap:7}}><select value={form.strategy} onChange={e=>sf("strategy",e.target.value)} style={{flex:1}}>{strats.map(s=><option key={s}>{s}</option>)}</select><button className="btn btn-ghost" title="Manage" onClick={()=>setShowSM(true)} style={{padding:"9px 12px",flexShrink:0}}>⚙</button></div></div>
                      </div>
                      <div><label className="lbl">Emotional State</label><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>{EMOTIONS.map(e=><button key={e} className={`em-pill${form.emotions===e?" on":""}`} onClick={()=>sf("emotions",e)}>{e}</button>)}</div></div>
                      <div>
                        <label className="lbl">Tags</label>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:7}}>{form.tags.map(t=><span key={t} className="tag-pill">{t}<span style={{cursor:"pointer",opacity:0.55,marginLeft:3}} onClick={()=>sf("tags",form.tags.filter(x=>x!==t))}>✕</span></span>)}</div>
                        <div style={{display:"flex",gap:7}}><input value={form.newTag} placeholder='Add tag (e.g. "HTF Aligned"), press Enter' onChange={e=>sf("newTag",e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&form.newTag.trim()){setForm(p=>({...p,tags:[...p.tags,p.newTag.trim()],newTag:""}));}}}/><button className="btn btn-ghost" style={{whiteSpace:"nowrap"}} onClick={()=>{if(form.newTag.trim())setForm(p=>({...p,tags:[...p.tags,p.newTag.trim()],newTag:""}));}}>+ Tag</button></div>
                      </div>
                      <div><label className="lbl">Trade Notes</label><textarea rows={3} value={form.notes} placeholder="What did you see? Why did you enter? What would you do differently?" onChange={e=>sf("notes",e.target.value)} style={{resize:"vertical"}}/></div>
                      {fErr&&<div style={{background:"rgba(224,61,85,0.09)",border:"1px solid rgba(224,61,85,0.22)",borderRadius:8,padding:"9px 12px",fontSize:"0.74rem",color:"var(--red2)"}}>⚠ {fErr}</div>}
                      <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><button className="btn btn-ghost" onClick={()=>setForm(blankForm)}>Clear</button><button className="btn btn-gold" onClick={addTrade}>Record & Save Trade →</button></div>
                    </div>
                  </div>
                  <div className="card card-gold">
                    <div className="ch">
                      <div><div className="stitle">Chart Screenshots</div><div className="sdesc">Saved permanently with your trade</div></div>
                      {(form.screenshots.before||form.screenshots.after)&&<button className="btn btn-ghost" style={{fontSize:"0.65rem",padding:"4px 10px"}} onClick={()=>sf("screenshots",{before:"",after:""})}>Clear All</button>}
                    </div>
                    <div style={{padding:18}}>
                      <div className="g2">
                        <DropZone label="Before Entry — Setup" icon="🟡" value={form.screenshots.before} onChange={v=>setForm(p=>({...p,screenshots:{...p.screenshots,before:v}}))}/>
                        <DropZone label="After Exit — Result" icon="🏁" value={form.screenshots.after} onChange={v=>setForm(p=>({...p,screenshots:{...p.screenshots,after:v}}))}/>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ INSIGHTS ══ */}
              {tab==="insights"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div className="card card-gold" style={{position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"var(--goldg)"}}/>
                    <div className="ch">
                      <div><div className="stitle">AI Performance Coach</div><div className="sdesc">Powered by Claude · Real-time analysis of your journal</div></div>
                      <button className="btn btn-gold" onClick={getAI} disabled={aiLoad||S.total===0}>
                        {aiLoad?<><span className="spin">◈</span>Analyzing…</>:"Generate Analysis ✦"}
                      </button>
                    </div>
                    <div style={{padding:"0 18px 18px"}}>
                      {S.total===0?<div style={{textAlign:"center",padding:"28px",color:"var(--t3)",fontSize:"0.78rem"}}>Log some trades first to get AI coaching.</div>
                      :aiText?<div style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:10,padding:"16px 18px",fontSize:"0.78rem",lineHeight:1.85,color:"var(--t2)",whiteSpace:"pre-wrap"}}>{aiText}</div>
                      :<div style={{textAlign:"center",padding:"28px",color:"var(--t3)",fontSize:"0.76rem"}}>Click 'Generate Analysis' for a structured AI coaching report</div>}
                    </div>
                  </div>
                  <div className="g2">
                    <div className="card"><div className="ch"><div className="stitle">Performance Radar</div></div><div style={{padding:"14px 16px"}}><ResponsiveContainer width="100%" height={220}><RadarChart data={S.radarData}><PolarGrid stroke="var(--b2)"/><PolarAngleAxis dataKey="subject" tick={{fill:"var(--t3)",fontSize:9}}/><Radar name="Score" dataKey="A" stroke="#d4af5a" fill="#d4af5a" fillOpacity={0.16} strokeWidth={2}/></RadarChart></ResponsiveContainer></div></div>
                    <div className="card"><div className="ch"><div className="stitle">P&L by Pair</div></div><div style={{padding:"14px 16px"}}><ResponsiveContainer width="100%" height={220}><BarChart data={S.byPair} layout="vertical"><XAxis type="number" tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/><YAxis type="category" dataKey="name" tick={{fill:"var(--t3)",fontSize:9}} axisLine={false} tickLine={false} width={60}/><Tooltip content={<Tip/>}/><Bar dataKey="pnl" name="P&L" radius={4}>{S.byPair.map((e,i)=><Cell key={i} fill={e.pnl>=0?"#18b85c":"#e03d55"}/>)}</Bar></BarChart></ResponsiveContainer></div></div>
                  </div>
                  <div className="g2">
                    <div className="card"><div className="ch"><div className="stitle">Session Performance</div></div><div style={{padding:"12px 18px"}}>{S.bySession.map(s=><div key={s.session} className="irow"><div style={{width:80,fontSize:"0.7rem",color:"var(--t2)",flexShrink:0}}>{s.session}</div><div className="ibar"><div className="ifill" style={{width:`${Math.min(100,Math.abs(s.pnl)/18)}%`,background:s.pnl>=0?"var(--green)":"var(--red)"}}/></div><div style={{width:62,textAlign:"right",fontSize:"0.72rem",color:pC(s.pnl),flexShrink:0,fontWeight:600}}>{fP(s.pnl)}</div><div style={{width:30,textAlign:"right",fontSize:"0.63rem",color:"var(--t3)",flexShrink:0}}>{s.wr}%</div></div>)}</div></div>
                    <div className="card"><div className="ch"><div className="stitle">Strategy Breakdown</div></div><div style={{padding:"12px 18px"}}>{S.byStrategy.length?S.byStrategy.map(s=><div key={s.name} className="irow"><div style={{width:96,fontSize:"0.68rem",color:"var(--t2)",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div><div className="ibar"><div className="ifill" style={{width:`${Math.min(100,Math.abs(s.pnl)/12)}%`,background:s.pnl>=0?"var(--blue)":"var(--red)"}}/></div><div style={{width:58,textAlign:"right",fontSize:"0.7rem",color:pC(s.pnl),flexShrink:0,fontWeight:600}}>{fP(s.pnl)}</div><div style={{width:30,textAlign:"right",fontSize:"0.63rem",color:"var(--t3)",flexShrink:0}}>{s.wr}%</div></div>):<div style={{textAlign:"center",padding:"24px",color:"var(--t3)",fontSize:"0.76rem"}}>Log trades to see strategy breakdown</div>}</div></div>
                  </div>
                  <div className="card"><div className="ch"><div className="stitle">Advanced Metrics</div></div><div style={{padding:16}}><div className="g3" style={{gap:10}}>{[{l:"Profit Factor",v:S.profFactor,d:"Target > 2.0",ok:parseFloat(S.profFactor)>=2},{l:"Expectancy",v:`$${S.expectancy}/trade`,d:"Expected per trade",ok:S.expectancy>0},{l:"Avg Win",v:`+$${S.avgWin}`,d:"Avg winning trade",ok:true},{l:"Avg Loss",v:`-$${S.avgLoss}`,d:"Avg losing trade",ok:false},{l:"Avg Pips",v:fPi(S.avgPips),d:"Pips per trade",ok:S.avgPips>0},{l:"Total Lots",v:S.totalLots,d:"Volume traded",ok:true},{l:"Win Streak",v:`${S.maxStreak}`,d:"Consecutive wins",ok:true},{l:"Loss Streak",v:`${S.maxLStreak}`,d:"Consecutive losses",ok:S.maxLStreak<=3},{l:"Total Trades",v:`${S.total}`,d:"Journal entries",ok:true}].map(({l,v,d,ok})=>(
                    <div key={l} style={{background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:ok?"var(--green2)":"var(--red2)",borderRadius:"0 3px 3px 0"}}/>
                      <div className="lbl" style={{marginBottom:4}}>{l}</div>
                      <div style={N("1.15rem",800,ok?"var(--green2)":"var(--red2)")}>{v}</div>
                      <div style={{fontSize:"0.61rem",color:"var(--t3)",marginTop:4}}>{d}</div>
                    </div>
                  ))}</div></div></div>
                </div>
              )}

              {/* ══ PSYCHOLOGY ══ */}
              {tab==="psychology"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  <div className="card" style={{background:"linear-gradient(135deg,rgba(0,187,163,0.06),transparent)",border:"1px solid rgba(0,187,163,0.16)",padding:18}}>
                    <div style={{...N("1.15rem",700,"var(--cyan)"),marginBottom:4}}>Trading Psychology Dashboard</div>
                    <div style={{fontSize:"0.68rem",color:"var(--t3)"}}>Understanding your emotional patterns is the edge that separates consistent traders</div>
                  </div>
                  {S.byEmotion.length?(
                    <>
                      <div className="card"><div className="ch"><div className="stitle">Emotion → P&L Map</div></div><div style={{padding:16}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:9}}>{S.byEmotion.map(e=><div key={e.name} style={{background:"var(--s2)",border:`1px solid ${e.pnl>=0?"rgba(24,184,92,0.2)":"rgba(224,61,85,0.18)"}`,borderRadius:10,padding:"12px 14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:e.pnl>=0?"var(--green)":"var(--red)"}}/><div style={{fontSize:"0.7rem",color:"var(--t2)",marginBottom:5}}>{e.name}</div><div style={N("1.15rem",800,pC(e.pnl))}>{fP(e.pnl)}</div><div style={{fontSize:"0.62rem",color:"var(--t3)",marginTop:4}}>{e.trades} trade{e.trades>1?"s":""} · {e.wr}% WR</div></div>)}</div></div></div>
                      <div className="card"><div className="ch"><div className="stitle">P&L by Emotional State</div></div><div style={{padding:"14px 16px"}}><ResponsiveContainer width="100%" height={200}><BarChart data={S.byEmotion}><XAxis dataKey="name" tick={{fill:"var(--t3)",fontSize:9}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"var(--t4)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/><Tooltip content={<Tip/>}/><Bar dataKey="pnl" name="P&L" radius={[4,4,0,0]}>{S.byEmotion.map((e,i)=><Cell key={i} fill={e.pnl>=0?"#18b85c":"#e03d55"}/>)}</Bar></BarChart></ResponsiveContainer></div></div>
                      <div className="card"><div className="ch"><div className="stitle">Psychology Insights</div></div><div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>{[{icon:"🏆",title:"Your peak state",body:`You perform best when "${S.byEmotion[0]?.name}" — ${S.byEmotion[0]?.wr}% WR, ${fP(S.byEmotion[0]?.pnl||0)} P&L. Build a pre-trade checklist to consistently reach this state.`},{icon:"⛔",title:"Your danger state",body:`Trades when "${S.byEmotion[S.byEmotion.length-1]?.name}" have been costly. Add it to your rules: if you feel this way, do NOT open a trade.`},{icon:"🔥",title:"Streak management",body:`Your longest win streak is ${S.maxStreak} trades. After ${Math.max(Math.ceil(S.maxStreak*0.6),2)} consecutive wins, reduce size by 25% to protect profits from overconfidence.`},{icon:"🛡️",title:"Loss recovery rule",body:`Max loss streak: ${S.maxLStreak} trades. Set a daily max loss of 2% — after ${Math.min(S.maxLStreak,3)} consecutive losses, step away and review before trading again.`},{icon:"📊",title:"Sample size",body:`You have ${S.total} trades journaled. ${S.total>=30?"Your edge is statistically meaningful — trust the system.":"Keep logging — aim for 30+ trades before drawing major conclusions."}`}].map(({icon,title,body})=><div key={title} style={{display:"flex",gap:12,background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:10,padding:14}}><span style={{fontSize:"1.2rem",flexShrink:0,lineHeight:1.4}}>{icon}</span><div><div style={{fontSize:"0.76rem",fontWeight:700,color:"var(--text)",marginBottom:4}}>{title}</div><div style={{fontSize:"0.72rem",color:"var(--t2)",lineHeight:1.7}}>{body}</div></div></div>)}</div></div>
                    </>
                  ):(
                    <div style={{textAlign:"center",padding:"50px 20px",color:"var(--t3)"}}>
                      <div style={{fontSize:"2rem",marginBottom:12}}>◈</div>
                      <div>Log trades with emotional states to unlock psychology insights</div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
