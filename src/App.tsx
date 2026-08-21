import {useEffect,useMemo,useState} from 'react'

const VERSION='0.3.0'
type Plane={id:string;name:string;x:number;y:number;heading:number;speed:number;alt:number;fuel:number;airborne:boolean;friendly:boolean}
type Base={id:string;name:string;x:number;y:number;aircraft:number}
const bases:Base[]=[
 {id:'L',name:'LOSSIEMOUTH',x:31,y:12,aircraft:2},
 {id:'C',name:'CONINGSBY',x:67,y:66,aircraft:2},
]
const initialTargets:Plane[]=[
 {id:'T421',name:'TRACK 421',x:87,y:31,heading:235,speed:430,alt:280,fuel:100,airborne:true,friendly:false},
 {id:'T315',name:'TRACK 315',x:12,y:78,heading:35,speed:390,alt:240,fuel:100,airborne:true,friendly:false},
]
const initialFighters:Plane[]=[
 {id:'F21',name:'TYPHOON 21',x:67,y:66,heading:315,speed:450,alt:250,fuel:88,airborne:false,friendly:true},
 {id:'F22',name:'TYPHOON 22',x:31,y:12,heading:135,speed:450,alt:250,fuel:78,airborne:false,friendly:true},
]
const clamp=(n:number,a=4,b=96)=>Math.max(a,Math.min(b,n))
const move=(p:Plane,dt:number)=>{const r=p.heading*Math.PI/180,s=.00115;return {...p,x:clamp(p.x+Math.sin(r)*p.speed*dt*s),y:clamp(p.y-Math.cos(r)*p.speed*dt*s)}}
const dist=(a:Plane,b:Plane)=>Math.hypot(a.x-b.x,a.y-b.y)
const brg=(a:Plane,b:Plane)=>Math.round((Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI+360)%360)
const ang=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180)

function predictIntercept(f:Plane,t:Plane){
 const dx=t.x-f.x,dy=t.y-f.y
 const tr=t.heading*Math.PI/180, fr=f.heading*Math.PI/180
 const tvx=Math.sin(tr)*t.speed, tvy=-Math.cos(tr)*t.speed
 const relx=dx,rely=dy
 const a=tvx*tvx+tvy*tvy-f.speed*f.speed
 const b=2*(relx*tvx+rely*tvy)
 const c=relx*relx+rely*rely
 let sec=0
 if(Math.abs(a)<.0001) sec=b?Math.max(0,-c/b):0
 else {const disc=b*b-4*a*c;if(disc>=0){const r1=(-b-Math.sqrt(disc))/(2*a),r2=(-b+Math.sqrt(disc))/(2*a);const roots=[r1,r2].filter(r=>r>0);sec=roots.length?Math.min(...roots):0}}
 if(!sec) sec=Math.max(1,dist(f,t)*.9)
 const px=t.x+Math.sin(tr)*t.speed*sec*.00115
 const py=t.y-Math.cos(tr)*t.speed*sec*.00115
 const point={x:clamp(px),y:clamp(py)}
 const heading=Math.round((Math.atan2(point.x-f.x,-(point.y-f.y))*180/Math.PI+360)%360)
 return {sec,point,heading}
}

export default function App(){
 const [targets,setTargets]=useState(initialTargets),[fighters,setFighters]=useState(initialFighters)
 const [selT,setSelT]=useState('T421'),[selF,setSelF]=useState('F21'),[vector,setVector]=useState(285)
 const [base,setBase]=useState('C'),[score,setScore]=useState(0),[running,setRunning]=useState(true)
 const [assist,setAssist]=useState(true),[scrambled,setScrambled]=useState<string[]>([])
 const [msg,setMsg]=useState('CONTACT! Assess the track, select QRA, then scramble.')
 const [debrief,setDebrief]=useState<string[]>([])
 const target=targets.find(p=>p.id===selT)!,fighter=fighters.find(p=>p.id===selF)!
 const range=dist(fighter,target)*14,bearing=brg(fighter,target)
 const prediction=useMemo(()=>predictIntercept(fighter,target),[fighter,target])
 const targetEta=Math.max(0,range/Math.max(1,fighter.speed-target.speed*.35)*60)
 const interceptRange=Math.hypot(prediction.point.x-fighter.x,prediction.point.y-fighter.y)*14
 useEffect(()=>{if(!running)return;const id=setInterval(()=>{setTargets(ts=>ts.map(t=>move(t,1)));setFighters(fs=>fs.map(f=>f.airborne?{...move(f,1),fuel:Math.max(0,f.fuel-.035)}:f))},1000);return()=>clearInterval(id)},[running])
 function scramble(){
  if(scrambled.includes(selF)){setMsg(`${fighter.name} already airborne.`);return}
  setScrambled(s=>[...s,selF]);setFighters(fs=>fs.map(f=>f.id===selF?{...f,airborne:true}:f))
  const chosen=bases.find(b=>b.id===base)!
  const d=Math.hypot(fighter.x-chosen.x,fighter.y-chosen.y),pts=Math.max(0,150-Math.round(d*4))
  setScore(s=>s+pts);setDebrief(d=>[`QRA: ${chosen.name} selected — +${pts}`,...d].slice(0,5));setMsg(`${chosen.name} QRA scrambled. ${pts} points.`)
 }
 function issueVector(){
  if(!fighter.airborne){setMsg('FIGHTER NOT AIRBORNE — SCRAMBLE QRA FIRST.');return}
  const e=ang(vector,prediction.heading),pts=Math.max(0,140-Math.round(e*2))
  setScore(s=>s+pts);setFighters(fs=>fs.map(f=>f.id===selF?{...f,heading:vector}:f))
  setDebrief(d=>[`VECTOR ${vector.toString().padStart(3,'0')}° — error ${e}° — +${pts}`,...d].slice(0,5))
  setMsg(e<=8?`EXCELLENT VECTOR. ${pts} points. Predicted intercept in ${prediction.sec.toFixed(1)} sec.`:`VECTOR ACCEPTED. ${pts} points. Predicted intercept heading ${prediction.heading.toString().padStart(3,'0')}°.`)
 }
 function reset(){setTargets(initialTargets);setFighters(initialFighters);setScrambled([]);setScore(0);setRunning(true);setDebrief([]);setMsg('NEW SCENARIO — CONTACT!')}
 return <main>
  <header><div><div className="eyebrow">AIR DEFENCE TRAINING SYSTEM</div><h1>RAF INTERCEPT <span>STAGE 3</span></h1></div><div className="topright"><span>VERSION {VERSION}</span><b>SECTOR: NORTH SEA / UK EAST</b><i>● LIVE</i></div></header>
  <section className="layout">
   <div className="map"><div className="gridlines"/><div className="sea-label">NORTH SEA</div><div className="land uk"><span>UNITED KINGDOM</span></div><div className="land eu"><span>CONTINENTAL EUROPE</span></div>
    {bases.map(b=><button key={b.id} className={`base ${base===b.id?'chosen':''}`} style={{left:`${b.x}%`,top:`${b.y}%`}} onClick={()=>setBase(b.id)}>✦<small>{b.name}</small></button>)}
    {targets.map(t=><button key={t.id} className={`contact target ${selT===t.id?'selected':''}`} style={{left:`${t.x}%`,top:`${t.y}%`}} onClick={()=>setSelT(t.id)}>◆<small>{t.name}</small></button>)}
    {fighters.map(f=><button key={f.id} className={`contact fighter ${selF===f.id?'selected':''}`} style={{left:`${f.x}%`,top:`${f.y}%`}} onClick={()=>setSelF(f.id)}>▲<small>{f.name}</small></button>)}
    {assist&&<><div className="intercept-line" style={{left:`${fighter.x}%`,top:`${fighter.y}%`,width:`${interceptRange/14}%`,transform:`rotate(${prediction.heading}deg)`}}/><div className="predicted" style={{left:`${prediction.point.x}%`,top:`${prediction.point.y}%`}}>×<small>PIP</small></div></>}
    <div className="mapnote">SCHEMATIC GAME MAP — NOT FOR NAVIGATION</div>
   </div>
   <aside>
    <div className="panel"><h2>CONTACT ASSESSMENT</h2><div className="big">{target.name}</div><div className="grid"><label>BRG <strong>{bearing.toString().padStart(3,'0')}°</strong></label><label>RNG <strong>{range.toFixed(0)} NM</strong></label><label>SPD <strong>{target.speed} KT</strong></label><label>ALT <strong>FL{target.alt}</strong></label><label>HDG <strong>{target.heading.toString().padStart(3,'0')}°</strong></label><label>ETA <strong>{targetEta.toFixed(1)} MIN</strong></label></div></div>
    <div className="panel"><h2>QRA SELECTION</h2>{bases.map(b=><button className={`baseRow ${base===b.id?'active':''}`} key={b.id} onClick={()=>setBase(b.id)}><span>{b.name}</span><b>{b.aircraft} READY</b></button>)}<button className="primary" onClick={scramble}>SCRAMBLE SELECTED QRA</button></div>
    <div className="panel"><h2>INTERCEPT PREDICTION</h2><div className="grid"><label>PIP HDG <strong>{prediction.heading.toString().padStart(3,'0')}°</strong></label><label>TIME <strong>{prediction.sec.toFixed(1)} SEC</strong></label><label>PIP RNG <strong>{interceptRange.toFixed(0)} NM</strong></label><label>CPA <strong>{prediction.sec<90?'GOOD':'LONG'}</strong></label></div></div>
    <div className="panel"><h2>FIGHTER STATUS</h2><select value={selF} onChange={e=>setSelF(e.target.value)}>{fighters.map(f=><option key={f.id} value={f.id}>{f.name} — {f.airborne?'AIRBORNE':'QRA'} — {Math.round(f.fuel)}%</option>)}</select><div className="grid"><label>STATE <strong>{fighter.airborne?'AIRBORNE':'QRA'}</strong></label><label>FUEL <strong>{Math.round(fighter.fuel)}%</strong></label><label>HDG <strong>{fighter.heading.toString().padStart(3,'0')}°</strong></label><label>SPD <strong>{fighter.speed} KT</strong></label></div></div>
    <div className="panel command"><h2>VECTOR COMMAND</h2><input type="range" min="0" max="359" value={vector} onChange={e=>setVector(+e.target.value)}/><div className="vector"><span>VECTOR</span><strong>{vector.toString().padStart(3,'0')}°</strong></div>{assist&&<div className="hint">TRAINING: predicted intercept heading {prediction.heading.toString().padStart(3,'0')}°</div>}<button className="primary" onClick={issueVector}>ISSUE VECTOR</button></div>
    <div className="panel"><h2>CONTROLLER ASSESSMENT</h2><div className="score">{score}</div><p className="message">{msg}</p><label className="toggle"><input type="checkbox" checked={assist} onChange={e=>setAssist(e.target.checked)}/> Training assistance</label><div className="debrief">{debrief.map((x,i)=><div key={i}>{x}</div>)}</div><div className="actions"><button onClick={()=>setRunning(!running)}>{running?'PAUSE':'RESUME'}</button><button onClick={reset}>NEW SCENARIO</button></div></div>
   </aside>
  </section>
 </main>
}