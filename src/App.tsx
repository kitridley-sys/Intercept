import {useEffect,useMemo,useState} from 'react'
import './style.css'

const VERSION='0.7.0'
const BINGO=30, RESERVE=42
type P={id:string;name:string;x:number;y:number;heading:number;speed:number;alt:number;fuel:number;airborne:boolean;friendly:boolean;trail:{x:number;y:number}[]}
type Base={id:string;name:string;x:number;y:number;aircraft:number}

const bases:Base[]=[
 {id:'L',name:'LOSSIEMOUTH',x:18,y:30,aircraft:2},
 {id:'C',name:'CONINGSBY',x:30,y:77,aircraft:2}
]
const initialT:P[]=[
 {id:'T178',name:'HOSTILE 178',x:43,y:58,heading:70,speed:380,alt:220,fuel:100,airborne:true,friendly:false,trail:[]},
 {id:'T457',name:'UNKNOWN 457',x:60,y:20,heading:250,speed:480,alt:300,fuel:100,airborne:true,friendly:false,trail:[]},
 {id:'T391',name:'UNKNOWN 391',x:52,y:43,heading:230,speed:420,alt:280,fuel:100,airborne:true,friendly:false,trail:[]},
 {id:'T621',name:'UNKNOWN 621',x:36,y:17,heading:115,speed:450,alt:320,fuel:100,airborne:true,friendly:false,trail:[]},
 {id:'T722',name:'UNKNOWN 722',x:44,y:37,heading:90,speed:400,alt:240,fuel:100,airborne:true,friendly:false,trail:[]}
]
const initialF:P[]=[
 {id:'F21',name:'TYPHOON 21',x:30,y:77,heading:45,speed:480,alt:180,fuel:88,airborne:false,friendly:true,trail:[]},
 {id:'F11',name:'TYPHOON 11',x:18,y:30,heading:180,speed:480,alt:180,fuel:76,airborne:false,friendly:true,trail:[]}
]
const tanker={x:56,y:58,heading:180,speed:430}
const clamp=(n:number,a=2,b=98)=>Math.max(a,Math.min(b,n))
const move=(p:P):P=>{
 const r=p.heading*Math.PI/180, s=.00072
 return {...p,x:clamp(p.x+Math.sin(r)*p.speed*s),y:clamp(p.y-Math.cos(r)*p.speed*s),
  fuel:p.airborne&&p.friendly?Math.max(0,p.fuel-.045):p.fuel,
  trail:[...p.trail,{x:p.x,y:p.y}].slice(-18)}
}
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y)
const brg=(a:{x:number;y:number},b:{x:number;y:number})=>Math.round((Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI+360)%360)
const diff=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180)
function intercept(f:P,t:P){
 const dx=t.x-f.x,dy=t.y-f.y,r=t.heading*Math.PI/180
 const tvx=Math.sin(r)*t.speed,tvy=-Math.cos(r)*t.speed
 const aa=tvx*tvx+tvy*tvy-f.speed*f.speed, bb=2*(dx*tvx+dy*tvy), cc=dx*dx+dy*dy
 let sec=0,disc=bb*bb-4*aa*cc
 if(Math.abs(aa)>.0001&&disc>=0){
  const roots=[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)].filter(x=>x>0)
  if(roots.length)sec=Math.min(...roots)
 }
 if(!sec)sec=Math.max(1,dist(f,t)*1.2)
 const x=clamp(t.x+Math.sin(r)*t.speed*sec*.00072),y=clamp(t.y-Math.cos(r)*t.speed*sec*.00072)
 return {sec,x,y,heading:brg(f,{x,y})}
}
function Contact({p,selected,onClick}:{p:P;selected:boolean;onClick:()=>void}){
 return <button className={`contact ${p.friendly?'friendly':'hostile'} ${selected?'selected':''}`} style={{left:`${p.x}%`,top:`${p.y}%`}} onClick={onClick}>
   <span className="trail">{p.trail.map((q,i)=><i key={i} style={{left:`${(q.x-p.x)*5}px`,top:`${(q.y-p.y)*5}px`,opacity:(i+1)/p.trail.length*.45}}/>)}</span>
   <span className="bug" style={{transform:`translate(-50%,-100%) rotate(${p.heading}deg)`}}/>
   <span className="symbol">{p.friendly?'▲':'◆'}</span>
   <span className="label">{p.name}<br/><b>FL{p.alt} {p.speed}KT</b><br/>HDG {String(p.heading).padStart(3,'0')}°</span>
 </button>
}

export default function App(){
 const [targets,setTargets]=useState(initialT),[fighters,setFighters]=useState(initialF)
 const [selT,setSelT]=useState('T178'),[selF,setSelF]=useState('F21')
 const [vector,setVector]=useState(45),[base,setBase]=useState('C')
 const [score,setScore]=useState(12450),[running,setRunning]=useState(true),[assist,setAssist]=useState(true)
 const [message,setMessage]=useState('HOSTILE 178 DETECTED — assess, scramble and vector.')
 const [events,setEvents]=useState(['14:32Z  HOSTILE 178 DETECTED','14:31Z  QRA READY','14:30Z  VOYAGER OFF STATION'])
 const target=targets.find(x=>x.id===selT)!, fighter=fighters.find(x=>x.id===selF)!, baseObj=bases.find(x=>x.id===base)!, sol=useMemo(()=>intercept(fighter,target),[fighter,target])
 const range=dist(fighter,target)*14, bearing=brg(fighter,target), baseRange=dist(fighter,baseObj)*14, tankerRange=dist(fighter,tanker)*14
 const fuelAtIntercept=Math.max(0,fighter.fuel-sol.sec*.045), fuelAtBase=Math.max(0,fighter.fuel-(baseRange/Math.max(1,fighter.speed)*.6)*.045)
 const recommendation=fighter.airborne&&(fighter.fuel<=BINGO||fuelAtBase<RESERVE)?'RTB':fighter.airborne&&fuelAtIntercept<RESERVE&&tankerRange<25?'AAR':'INTERCEPT'
 const log=(s:string)=>setEvents(e=>[`${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}Z  ${s}`,...e].slice(0,6))
 useEffect(()=>{if(!running)return;const id=setInterval(()=>{setTargets(a=>a.map(move));setFighters(a=>a.map(x=>x.airborne?move(x):x))},1000);return()=>clearInterval(id)},[running])
 const scramble=()=>{if(fighter.airborne){setMessage(`${fighter.name} already airborne.`);return}setFighters(a=>a.map(x=>x.id===fighter.id?{...x,airborne:true}:x));setScore(s=>s+120);log(`${fighter.name} AIRBORNE`);setMessage(`${fighter.name} scrambled from ${baseObj.name}.`)}
 const issueVector=()=>{if(!fighter.airborne){setMessage('SCRAMBLE QRA FIRST.');return}if(fighter.fuel<=BINGO){setMessage('BINGO FUEL — ORDER RTB.');return}const err=diff(vector,sol.heading),pts=Math.max(0,150-Math.round(err*2));setFighters(a=>a.map(x=>x.id===fighter.id?{...x,heading:vector}:x));setScore(s=>s+pts);log(`VECTOR ${String(vector).padStart(3,'0')}°  +${pts}`);setMessage(err<=8?`GOOD VECTOR — ${pts} points.`:`VECTOR ACCEPTED — ${pts} points.`)}
 const orderRTB=()=>{if(!fighter.airborne){setMessage('FIGHTER IS QRA.');return}const h=brg(fighter,baseObj);setFighters(a=>a.map(x=>x.id===fighter.id?{...x,heading:h}:x));setScore(s=>s+60);log(`${fighter.name} RTB ${baseObj.name}`);setMessage(`RTB ${String(h).padStart(3,'0')}° to ${baseObj.name}.`)}
 const aar=()=>{if(!fighter.airborne){setMessage('AIRBORNE FIGHTER REQUIRED.');return}if(tankerRange>25){setMessage(`VOYAGER ${tankerRange.toFixed(0)} NM — outside AAR range.`);return}const gain=Math.min(35,100-fighter.fuel);setFighters(a=>a.map(x=>x.id===fighter.id?{...x,fuel:x.fuel+gain}:x));setScore(s=>s+gain*3);log(`AAR +${gain}% FUEL`);setMessage(`AAR COMPLETE — +${gain}% fuel.`)}
 const quick=(delta:number)=>setVector(v=>(v+delta+360)%360)
 return <main>
  <header className="topbar">
   <button className="iconbtn">☰</button><div className="brand">RAF INTERCEPT <span>v{VERSION}</span></div>
   <div className="topstat"><b>SCORE</b><strong>{score.toLocaleString()}</strong></div><div className="topstat"><b>RANK</b><strong>CONTROLLER</strong></div><div className="topstat mission"><b>MISSION</b><strong>00:18:42</strong></div>
   <button className="pause" onClick={()=>setRunning(!running)}>{running?'PAUSE':'RESUME'}</button><button className="iconbtn">⚙</button>
  </header>
  <div className="workspace">
   <aside className="leftcol">
    <section><h3>SCENARIO</h3><p>TIME <b>14:32Z</b></p><p>WEATHER <b>CAVOK</b></p><p>WIND <b>210/15KT</b></p><p>VISIBILITY <b>&gt;10KM</b></p></section>
    <section><h3>QRA STATUS</h3>{bases.map(b=><button className={`basecard ${base===b.id?'active':''}`} key={b.id} onClick={()=>setBase(b.id)}><b>{b.name}</b><span>TYPHOON READY</span><span>FUEL {b.id==='C'?'6.8':'6.6'} / 7.2</span></button>)}</section>
    <section><h3>VOYAGER</h3><p>ZZ336 <b>OFF STATION</b></p><p>FUEL <b>48.0 / 50.0</b></p><p>POS <b>560N 020E</b></p><p>HDG <b>090°</b></p></section>
    <section className="scorebox"><h3>SCORE BREAKDOWN</h3><p>INTERCEPT <b>+8,000</b></p><p>FUEL MANAGEMENT <b>+2,800</b></p><p>VECTORS <b>+1,650</b></p><p>BONUS <b>+0</b></p><hr/><p>TOTAL <b>{score.toLocaleString()}</b></p></section>
   </aside>
   <section className="mapwrap">
    <div className="map">
      <div className="latlon l1">55°N</div><div className="latlon l2">0°</div><div className="latlon l3">10°E</div>
      <div className="gridlines"/>
      <div className="land uk"><span>UNITED<br/>KINGDOM</span></div>
      <div className="land norway"><span>NORWAY</span></div>
      <div className="land denmark"><span>DENMARK</span></div>
      <div className="land nl"><span>NETHERLANDS</span></div>
      <div className="sea-title">NORTH SEA</div>
      {bases.map(b=><button className="mapbase" key={b.id} style={{left:`${b.x}%`,top:`${b.y}%`}} onClick={()=>setBase(b.id)}>✦<small>{b.name}<br/>QRA</small></button>)}
      <div className="tanker" style={{left:`${tanker.x}%`,top:`${tanker.y}%`}}>✈<small>VOYAGER 01<br/>FL250 430KT<br/>HDG 180°</small></div>
      {targets.map(x=><Contact key={x.id} p={x} selected={selT===x.id} onClick={()=>setSelT(x.id)}/>)}
      {fighters.map(x=><Contact key={x.id} p={x} selected={selF===x.id} onClick={()=>setSelF(x.id)}/>)}
      {assist&&<><div className="pip" style={{left:`${sol.x}%`,top:`${sol.y}%`}}>×<small>PIP</small></div><div className="vectorline" style={{left:`${fighter.x}%`,top:`${fighter.y}%`,width:`${Math.hypot(sol.x-fighter.x,sol.y-fighter.y)}%`,transform:`rotate(${sol.heading}deg)`}}/></>}
    </div>
   </section>
   <aside className="rightcol">
    <section><h3>CONTACT INFO</h3><div className="contactname">◆ {target.name}</div><p>RANGE <b>{range.toFixed(0)} NM</b></p><p>BEARING <b>{String(bearing).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{target.alt}</b></p><p>SPEED <b>{target.speed} KT</b></p><p>HEADING <b>{String(target.heading).padStart(3,'0')}°</b></p></section>
    <section><h3>SELECTED AIRCRAFT</h3><div className="contactname">{fighter.name}</div><p>{baseObj.name} QRA <b>{fighter.airborne?'AIRBORNE':'READY'}</b></p><div className="fuelmeter"><span style={{width:`${fighter.fuel}%`}}/></div><p>FUEL <b>{fighter.fuel.toFixed(1)}%</b></p><p>FUEL STATE <b>{fighter.fuel<=BINGO?'BINGO':fighter.fuel<=RESERVE?'LOW':'GOOD'}</b></p><p>BINGO <b>{BINGO}%</b></p><p>AT INTERCEPT <b>{fuelAtIntercept.toFixed(1)}%</b></p><p>AT RTB <b>{fuelAtBase.toFixed(1)}%</b></p></section>
    <section className={`recommend ${recommendation.toLowerCase()}`}><h3>RECOMMENDATION</h3><strong>{recommendation}</strong><p>AT INTERCEPT <b>{fuelAtIntercept.toFixed(1)}</b></p><p>AT RTB <b>{fuelAtBase.toFixed(1)}</b></p><p>PROBABILITY <b>{recommendation==='INTERCEPT'?'87%':recommendation==='AAR'?'71%':'94%'}</b></p></section>
   </aside>
  </div>
  <footer className="commandbar">
   <section><h3>VECTOR / COMMAND</h3><div className="adjust"><button onClick={()=>quick(-5)}>−</button><strong>{String(vector).padStart(3,'0')}°</strong><button onClick={()=>quick(5)}>+</button></div><div className="adjust"><button onClick={()=>quick(-10)}>−10</button><span>HDG</span><button onClick={()=>quick(10)}>+10</button></div></section>
   <section><h3>QUICK COMMANDS</h3><div className="twocol"><button onClick={()=>quick(-15)}>TURN LEFT</button><button onClick={()=>quick(15)}>TURN RIGHT</button><button>CLIMB</button><button>DESCEND</button><button onClick={()=>setVector(v=>v)}>SPEED UP</button><button>SLOW DOWN</button></div></section>
   <section><h3>ENGAGEMENT COMMANDS</h3><button className="engage" onClick={issueVector}>INTERCEPT</button><div className="twocol"><button className="aar" onClick={aar}>AAR</button><button className="rtb" onClick={orderRTB}>RTB</button></div></section>
   <section><h3>OTHER</h3><div className="twocol"><button onClick={scramble}>SCRAMBLE</button><button onClick={()=>setMessage('CONTACT DECLARED — training simulation.')}>DECLARE</button><button onClick={()=>setMessage('LAST COMMAND UNDONE')}>UNDO</button><button onClick={()=>setMessage('COMMAND CLEARED')}>CLEAR</button></div></section>
   <section className="eventlog"><h3>EVENT LOG</h3>{events.map((e,i)=><div key={i}>{e}</div>)}</section>
  </footer>
  <div className="mobilecontrols"><button onClick={scramble}>SCRAMBLE</button><button onClick={issueVector}>INTERCEPT</button><button onClick={aar}>AAR</button><button onClick={orderRTB}>RTB</button><button onClick={()=>setAssist(!assist)}>ASSIST</button></div>
  <div className="toast">{message}</div>
 </main>
}
