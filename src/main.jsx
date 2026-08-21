import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const V='1.0.0';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const norm=a=>(a%360+360)%360;
const bearing=(a,b)=>Math.round(norm(Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)*12;
const angleDiff=(a,b)=>Math.abs(((a-b+540)%360)-180);

const bases=[{id:'CON',name:'CONINGSBY',x:25,y:72},{id:'LOS',name:'LOSSIEMOUTH',x:17,y:24},{id:'LEU',name:'LEUCHARS',x:25,y:45}];
const seedTargets=[
{id:'H178',name:'HOSTILE 178',x:48,y:57,h:70,s:380,alt:220,cls:'HOSTILE',source:'RADAR'},
{id:'U457',name:'UNKNOWN 457',x:51,y:22,h:245,s:420,alt:280,cls:'UNKNOWN',source:'RADAR'},
{id:'U391',name:'UNKNOWN 391',x:68,y:43,h:230,s:410,alt:260,cls:'UNKNOWN',source:'RADAR'},
{id:'U722',name:'UNKNOWN 722',x:51,y:39,h:90,s:400,alt:240,cls:'UNKNOWN',source:'RADAR'},
{id:'S61',name:'SAS61W',x:39,y:24,h:160,s:460,alt:360,cls:'CIVIL',source:'ADS-B'},
{id:'F55',name:'FIN55A',x:73,y:28,h:215,s:460,alt:360,cls:'CIVIL',source:'ADS-B'}
];
const seedFighters=[
{id:'TY21',name:'TYPHOON 21',x:25,y:72,h:45,s:480,alt:180,fuel:88,airborne:false,base:'CON'},
{id:'TY11',name:'TYPHOON 11',x:17,y:24,h:180,s:480,alt:180,fuel:76,airborne:false,base:'LOS'},
{id:'TY41',name:'TYPHOON 41',x:25,y:45,h:45,s:480,alt:180,fuel:91,airborne:false,base:'LEU'}
];

function App(){
 const [targets,setTargets]=useState(seedTargets),[fighters,setFighters]=useState(seedFighters);
 const [selected,setSelected]=useState('U457'),[selectedF,setSelectedF]=useState('TY21');
 const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[drag,setDrag]=useState(null);
 const [notes,setNotes]=useState({}),[note,setNote]=useState('');
 const [assist,setAssist]=useState(true),[layers,setLayers]=useState({aircraft:true,qra:true,waypoints:true,airways:true,rings:true,latlon:true});
 const [score,setScore]=useState(1250),[running,setRunning]=useState(true),[elapsed,setElapsed]=useState(0),[events,setEvents]=useState(['12:24:12Z  UNKNOWN 457 DETECTED','12:22:45Z  TYPHOON 21 SCRAMBLED','12:22:30Z  HOSTILE 178 DETECTED','12:21:05Z  VOYAGER 01 CHECK IN']);
 const mapRef=useRef(null); const t=targets.find(x=>x.id===selected)||targets[0]; const f=fighters.find(x=>x.id===selectedF)||fighters[0];
 const base=bases.find(x=>x.id===f.base)||bases[0];
 const intercept=useMemo(()=>{const h=bearing(f,t); const r=distance(f,t); return {h,range:r,x:clamp(t.x-Math.sin(t.h*Math.PI/180)*8),y:clamp(t.y+Math.cos(t.h*Math.PI/180)*8),time:Math.max(2.5,r/Math.max(1,f.s)*60/3)}},[f,t]);
 const addEvent=s=>setEvents(e=>[`${new Date().toISOString().slice(11,19)}Z  ${s}`,...e].slice(0,8));
 useEffect(()=>{if(!running)return; const id=setInterval(()=>{setElapsed(e=>e+1);setTargets(a=>a.map(p=>({...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*.00012),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*.00012)})));setFighters(a=>a.map(p=>p.airborne?{...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*.00012),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*.00012),fuel:Math.max(0,p.fuel-.015)}:p));},1000);return()=>clearInterval(id)},[running]);
 const onWheel=e=>{e.preventDefault();setZoom(z=>clamp(z*(e.deltaY<0?1.12:.89),.75,3.2))};
 const onDown=e=>{if(e.button!==0)return;setDrag({sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y})};
 const onMove=e=>{if(!drag)return;setPan({x:drag.px+e.clientX-drag.sx,y:drag.py+e.clientY-drag.sy})};
 const onUp=()=>setDrag(null);
 const zoomTo=n=>setZoom(z=>clamp(z*n,.75,3.2));
 const scramble=()=>{setFighters(a=>a.map(x=>x.id===f.id?{...x,airborne:true}:x));addEvent(`${f.name} SCRAMBLED FROM ${base.name}`);setScore(s=>s+100)};
 const vector=()=>{setFighters(a=>a.map(x=>x.id===f.id?{...x,h:intercept.h}:x));const err=angleDiff(f.h,intercept.h);const pts=Math.max(0,160-Math.round(err*2));setScore(s=>s+pts);addEvent(`VECTOR ${String(intercept.h).padStart(3,'0')}°  +${pts}`)};
 const noteSave=()=>{if(!note.trim())return;setNotes(n=>({...n,[t.id]:[...(n[t.id]||[]),{time:new Date().toISOString().slice(11,19)+'Z',text:note.trim()}]}));setNote('');addEvent(`NOTE ADDED TO ${t.name}`)};
 const resetView=()=>{setZoom(1);setPan({x:0,y:0})};
 return <div className="app">
  <header><div className="title">RAF INTERCEPT <span>v{V}</span></div><div className="clock">12:24:{String(elapsed%60).padStart(2,'0')}Z</div><div className="headstat"><small>CLASSIFICATION</small><b>REALISTIC</b></div><div className="headstat"><small>SCORE</small><b>{score.toLocaleString()}</b></div><div className="headstat"><small>RANK</small><b>CONTROLLER</b></div><button onClick={()=>setRunning(!running)}>{running?'Ⅱ PAUSE':'▶ RESUME'}</button><button>⚙ SETTINGS</button><button>?</button></header>
  <div className="body">
   <aside className="left"><h3>MAP TOOLS</h3><button onClick={()=>zoomTo(1.18)}>⌕ ZOOM IN</button><button onClick={()=>zoomTo(.84)}>⌕ ZOOM OUT</button><button onClick={resetView}>◉ AUTO ZOOM</button><button onClick={()=>setPan({x:0,y:0})}>◎ CENTER</button><button>⌁ MEASURE</button><button onClick={()=>setLayers(l=>({...l,rings:!l.rings}))}>◌ RANGE RINGS</button><h3>MAP LAYERS</h3>{Object.entries(layers).map(([k,v])=><button className="layer" key={k} onClick={()=>setLayers(l=>({...l,[k]:!l[k]}))}><i className={v?'on':''}/> {k.replace('aircraft','AIRCRAFT').toUpperCase()}</button>)}<div className="scale">RANGE SCALE<br/><b>{Math.round(100/zoom)} NM</b><hr/>0 ─── 50 ─── 100 ─── 150</div></aside>
   <main className="mapFrame"><div className="mapViewport" ref={mapRef} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
    <div className="mapCanvas" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
      <div className="grid"/><div className="coast uk">UNITED<br/>KINGDOM</div><div className="ie">IRELAND</div><div className="coast nor">NORWAY</div><div className="coast dk">DENMARK</div><div className="coast nl">NETHERLANDS</div><div className="coast fr">FRANCE</div><div className="sea">NORTH SEA</div>
      {layers.rings&&<div className="rings"><i/><i/><i/><i/></div>}
      {layers.waypoints&&Array.from({length:36}).map((_,i)=><span key={i} className="wp" style={{left:(8+(i*19)%84)+'%',top:(12+(i*31)%74)+'%'}}>•</span>)}
      {layers.airways&&<><div className="airway a1"/><div className="airway a2"/><div className="airway a3"/></>}
      {layers.qra&&bases.map(b=><div className="qra" key={b.id} style={{left:b.x+'%',top:b.y+'%'}} onClick={()=>setSelectedF(seedFighters.find(x=>x.base===b.id)?.id||selectedF)}>▣<small>{b.name}<br/>QRA</small></div>)}
      <div className="voyager" style={{left:'63%',top:'62%'}}>✈<small>VOYAGER 01<br/>FL250 430KT<br/>HDG 180°</small></div>
      {layers.aircraft&&targets.map(p=><Contact key={p.id} p={p} selected={p.id===selected} onClick={()=>setSelected(p.id)}/>)}
      {layers.aircraft&&fighters.map(p=><Contact key={p.id} p={{...p,cls:'FRIENDLY'}} friendly selected={p.id===selectedF} onClick={()=>setSelectedF(p.id)}/>)}
      {assist&&<div className="interceptLine" style={{left:f.x+'%',top:f.y+'%',width:intercept.range/12+'%',transform:`rotate(${intercept.h}deg)`}}/>}
    </div><div className="zoomCtl"><button onClick={()=>zoomTo(1.2)}>+</button><button onClick={()=>zoomTo(.83)}>−</button><button onClick={resetView}>↺</button><div>{zoom.toFixed(1)}×</div></div><div className="north">N<br/><span>↑</span></div>
   </div></main>
   <aside className="right"><h3>CONTACT INFORMATION</h3><div className="contactTitle">{t.cls==='HOSTILE'?'◆':'✦'} {t.name}</div><p>CLASS <b>{t.cls}</b></p><p>RANGE <b>{distance(f,t).toFixed(0)} NM</b></p><p>BEARING <b>{String(bearing(f,t)).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{t.alt}</b></p><p>SPEED <b>{t.s} KT</b></p><p>HEADING <b>{String(t.h).padStart(3,'0')}°</b></p><p>SOURCE <b>{t.source}</b></p><h3>CONTACT NOTES ({(notes[t.id]||[]).length})</h3><div className="notes">{(notes[t.id]||[]).map((n,i)=><div key={i}><small>{n.time}</small><br/>{n.text}</div>)}</div><div className="noteBox"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add note..." onKeyDown={e=>e.key==='Enter'&&noteSave()}/><button onClick={noteSave}>＋ ADD NOTE</button></div><h3>SELECTED AIRCRAFT</h3><div className="contactTitle">✈ {f.name}</div><p>BASE <b>{base.name}</b></p><p>STATUS <b className={f.airborne?'green':''}>{f.airborne?'AIRBORNE':'READY'}</b></p><p>FUEL <b>{f.fuel.toFixed(1)}%</b></p><div className="fuel"><i style={{width:f.fuel+'%'}}/></div><p>SPEED <b>{f.s} KT</b></p><p>ALTITUDE <b>FL{f.alt}</b></p><p>ROLE <b>INTERCEPTOR</b></p></aside>
  </div>
  <footer><section><h3>QRA STATUS</h3>{bases.map(b=><div className="qrow" key={b.id}><span>{b.name}</span><b>{fighters.find(x=>x.base===b.id)?.name}</b><em>{fighters.find(x=>x.base===b.id)?.airborne?'AIRBORNE':'READY'}</em></div>)}</section><section><h3>EVENT LOG</h3>{events.map((e,i)=><div className="event" key={i}>{e}</div>)}</section><section><h3>QUICK COMMANDS</h3><div className="commands"><button onClick={scramble}>SCRAMBLE</button><button onClick={vector}>INTERCEPT</button><button onClick={()=>addEvent('AAR REQUESTED — VOYAGER 01')}>AAR</button><button onClick={()=>{setFighters(a=>a.map(x=>x.id===f.id?{...x,h:bearing(f,base)}:x));addEvent(`${f.name} RTB ${base.name}`)}}>RTB</button><button className="hostile" onClick={()=>{setTargets(a=>a.map(x=>x.id===t.id?{...x,cls:'HOSTILE'}:x));addEvent(`${t.name} DECLARED HOSTILE`)}}>DECLARE HOSTILE</button></div></section><section><h3>VECTOR / ALTITUDE</h3><label>HDG <output>{String(intercept.h).padStart(3,'0')}°</output></label><label>SPD <output>{f.s} KT</output></label><label>ALT <output>FL{f.alt}</output></label><button className="send" onClick={vector}>SEND VECTOR</button></section><section><h3>MISSION STATUS</h3><p>MISSION TIME <b>{Math.floor(elapsed/60).toString().padStart(2,'0')}:{String(elapsed%60).padStart(2,'0')} / 15:00</b></p><p>OBJECTIVE <b>INTERCEPT {t.name}</b></p><p>PROGRESS <b>{Math.min(100,Math.round(elapsed/9))}%</b></p><p>ASSISTANCE <button className="toggle" onClick={()=>setAssist(!assist)}>{assist?'STANDARD':'OFF'}</button></p></section></footer><div className="mobileBar"><button onClick={scramble}>SCRAMBLE</button><button onClick={vector}>INTERCEPT</button><button onClick={()=>addEvent('AAR REQUESTED')}>AAR</button><button onClick={()=>setFighters(a=>a.map(x=>x.id===f.id?{...x,h:bearing(f,base)}:x))}>RTB</button><button onClick={()=>setAssist(!assist)}>ASSIST</button></div>
 </div>
}
function Contact({p,friendly=false,selected,onClick}){return <button className={'contact '+(friendly?'friendly ':'')+(p.cls==='HOSTILE'?'hostile ':'')+(selected?'selected':'')} style={{left:p.x+'%',top:p.y+'%'}} onClick={e=>{e.stopPropagation();onClick()}}><span className="bug" style={{transform:`rotate(${p.h}deg)`}}/><span className="sym" aria-label={friendly?'RAF aircraft':p.cls==='HOSTILE'?'Hostile aircraft':'Unknown aircraft'}></span><span className="lbl">{p.name}<br/>FL{p.alt} {p.s}KT<br/>HDG {String(p.h).padStart(3,'0')}°</span></button>}

createRoot(document.getElementById('root')).render(<App/>);
