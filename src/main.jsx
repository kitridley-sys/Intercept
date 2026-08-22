import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';

const V='2.3.1';
// Typhoon simulation model (gameplay approximations based on public performance data).
// Internal game units: fuel is % of a 7,600 kg full-fuel load.
// External tanks/AAR are represented separately. Burn varies with speed and manoeuvre.
const TYPHOON = {
  internalFuelKg: 7600,
  maxSpeedKt: 1300,
  maxAltitudeFt: 55000,
  climbRateFtMin: 3200,
  descentRateFtMin: 5000
};
const fuelRateKgH=f=>{
 const altitude=(f.alt||0)*100;
 const level=altitude>=36000?'high':altitude>=20000?'medium':'sea';
 if(f.reheat)return {sea:30000,medium:22000,high:15500}[level];
 if((f.s||0)>=850)return {sea:30000,medium:8200,high:5500}[level];
 return {sea:4500,medium:3100,high:2200}[level];
};
const fuelBurnPercentPerMinute=f=>fuelRateKgH(f)/60/TYPHOON.internalFuelKg*100;
const fuelEnduranceMinutes=f=>Math.max(0,Math.floor((f.fuel||0)/fuelBurnPercentPerMinute(f)));
const climbMinutes = (fromFt,toFt) => {
  const delta=Math.max(0,toFt-fromFt);
  return delta/TYPHOON.climbRateFtMin;
};
const scrambleDelayMinutes = () => {
  // Triangular distribution: 2–6 minutes, weighted toward a four-minute response.
  const a=2,b=6,m=4;
  const u=Math.random();
  return u < (m-a)/(b-a)
    ? a+Math.sqrt(u*(b-a)*(m-a))
    : b-Math.sqrt((1-u)*(b-a)*(b-m));
};

const normaliseTargetAltitude=(t)=>{
  if(t.friendly) return t;
  // Most game targets operate in plausible high-level controlled airspace.
  const floors=[18000,22000,26000,28000,32000,36000];
  return {...t,altitude:t.altitude && t.altitude>=18000 ? t.altitude : floors[Math.floor(Math.random()*floors.length)]};
};

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const norm=a=>(a%360+360)%360;
const bearing=(a,b)=>Math.round(norm(Math.atan2(b.x-a.x,-(b.y-a.y))*180/Math.PI));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)*12;
const angleDiff=(a,b)=>Math.abs(((a-b+540)%360)-180);
const bases=[{id:'LOS',name:'RAF LOSSIEMOUTH · QRA NORTH',x:29,y:45},{id:'CON',name:'RAF CONINGSBY · QRA SOUTH',x:39,y:77.5}];
const seedTargets=[
 {id:'H178',name:'HOSTILE 178',x:52,y:56,h:70,s:380,alt:220,cls:'HOSTILE',source:'SIMULATED RADAR'}
];
const seedFighters=[
 {id:'PH11',name:'PHANTOM 11',x:17,y:24,h:90,s:0,alt:0,fuel:100,airborne:false,base:'LOS',pair:1,status:'READY'},
 {id:'PH12',name:'PHANTOM 12',x:17,y:24,h:90,s:0,alt:0,fuel:100,airborne:false,base:'LOS',pair:1,status:'READY'},
 {id:'PH21',name:'PHANTOM 21',x:17,y:24,h:90,s:0,alt:0,fuel:100,airborne:false,base:'LOS',pair:2,status:'STANDBY'},
 {id:'PH22',name:'PHANTOM 22',x:17,y:24,h:90,s:0,alt:0,fuel:100,airborne:false,base:'LOS',pair:2,status:'STANDBY'},
 {id:'RI11',name:'RIGID 11',x:25,y:72,h:20,s:0,alt:0,fuel:100,airborne:false,base:'CON',pair:1,status:'READY'},
 {id:'RI12',name:'RIGID 12',x:25,y:72,h:20,s:0,alt:0,fuel:100,airborne:false,base:'CON',pair:1,status:'READY'},
 {id:'RI21',name:'RIGID 21',x:25,y:72,h:20,s:0,alt:0,fuel:100,airborne:false,base:'CON',pair:2,status:'STANDBY'},
 {id:'RI22',name:'RIGID 22',x:25,y:72,h:20,s:0,alt:0,fuel:100,airborne:false,base:'CON',pair:2,status:'STANDBY'}
];

const NE_URL='https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_admin_0_countries.geojson';
const MAP={minLon:-12,maxLon:18,minLat:48,maxLat:66};
function projectCoord([lon,lat]){return [((lon-MAP.minLon)/(MAP.maxLon-MAP.minLon))*100,((MAP.maxLat-lat)/(MAP.maxLat-MAP.minLat))*100]}
function ringPath(ring){return ring.map((c,i)=>{const [x,y]=projectCoord(c);return `${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`}).join(' ')+' Z'}
function geometryPath(g){if(!g)return ''; if(g.type==='Polygon')return g.coordinates.map(ringPath).join(' '); if(g.type==='MultiPolygon')return g.coordinates.flat().map(ringPath).join(' '); return ''}
function useNaturalEarth(){
 const [data,setData]=useState(null);
 useEffect(()=>{let live=true;fetch(NE_URL).then(r=>r.json()).then(j=>{if(live)setData(j)}).catch(()=>{});return()=>{live=false}},[]);
 return data;
}
function AccurateCoast(){
 const data=useNaturalEarth();
 const wanted=new Set(['United Kingdom','Ireland','Norway','Denmark','Netherlands','Germany','Belgium','France']);
 if(!data)return <div className="mapLoading">LOADING COUNTRY OUTLINES…</div>;
 return <svg className="geoMap referenceCountryMap" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Country outlines around the North Sea">{data.features.filter(f=>wanted.has(f.properties?.ADMIN)).map((f,i)=><path key={i} className={'country '+(f.properties.ADMIN==='United Kingdom'?'countryUK':'')} d={geometryPath(f.geometry)}/>)}</svg>;
}

const tankerOnExercise=Math.random()<.5;
const initial={targets:seedTargets,fighters:seedFighters,selected:'U457',selectedF:'PH11',notes:{},score:1250,running:true,elapsed:0,mission:{firstScramble:{LOS:null,CON:null}},tanker:tankerOnExercise?{name:'TANSOR 10',x:53,y:43,h:180,s:430,alt:250,airborne:true,status:'ON EXERCISE · NORTH SEA',tasked:false}:{name:'TANSOR 10',x:35,y:80,h:20,s:0,alt:0,airborne:false,status:'ON GROUND · RAF BRIZE NORTON',tasked:false},radio:['12:24Z  CONTROL: FIGHTER CONTROLLER MISSION READY'],events:['12:24Z  UNKNOWN 457 DETECTED',tankerOnExercise?'12:22Z  TANSOR 10 ON NORTH SEA EXERCISE':'12:22Z  TANSOR 10 ON GROUND AT RAF BRIZE NORTON']};
const STATE_KEY='raf-intercept-state-v231';
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('raf-intercept-v231'):null;
function sendState(state){try{localStorage.setItem(STATE_KEY,JSON.stringify(state));}catch{} try{channel?.postMessage(state)}catch{}}
function useSharedState(){
 const [state,setState]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(STATE_KEY));if(!saved)return initial;const fighters=saved.fighters?.length===seedFighters.length?saved.fighters.map(f=>{const b=bases.find(x=>x.id===f.base);return f.airborne?f:{...f,x:b?.x??f.x,y:b?.y??f.y}}):seedFighters;return {...initial,...saved,targets:saved.targets?.length===seedTargets.length?saved.targets:seedTargets,fighters,mission:{...initial.mission,...saved.mission},tanker:saved.tanker||initial.tanker,radio:saved.radio||initial.radio}}catch{return initial}});
 useEffect(()=>{const onStorage=e=>{if(e.key==='raf-intercept-state'&&e.newValue)try{setState(JSON.parse(e.newValue))}catch{}};const onMsg=e=>e.data&&setState(e.data);addEventListener('storage',onStorage);channel?.addEventListener('message',onMsg);return()=>{removeEventListener('storage',onStorage);channel?.removeEventListener('message',onMsg)}} ,[]);
 const update=fn=>setState(prev=>{const next=fn(prev);sendState(next);return next});
 return [state,update];
}
function Contact({p,friendly=false,selected,onClick,compact=false}){const civil=p.cls==='CIVIL';return <button className={'contact '+(friendly?'friendly ':'')+(civil?'civil ':'')+(p.cls==='HOSTILE'?'hostile ':'')+(selected?'selected':'')} style={{left:p.x+'%',top:p.y+'%'}} onClick={e=>{e.stopPropagation();onClick()}}><span className="bug" style={{transform:`rotate(${p.h}deg)`}}/><span className="sym" aria-label={friendly?'RAF aircraft':civil?'Civilian traffic':p.cls==='HOSTILE'?'Hostile aircraft':'Unknown aircraft'}/>{compact?<span className="radarCallsign">{p.name}</span>:<span className="lbl">{p.name}<br/>FL{p.alt} {p.s}KT<br/>HDG {String(p.h).padStart(3,'0')}°</span>}</button>}
function ControlPage({state,update,onRadar}){
 const [note,setNote]=useState('');const [assist,setAssist]=useState(true);const [layers,setLayers]=useState({aircraft:true,qra:true,waypoints:true,airways:true,rings:true,latlon:true});
 const t=state.targets.find(x=>x.id===state.selected)||state.targets[0];const f=state.fighters.find(x=>x.id===state.selectedF)||state.fighters[0];const base=bases.find(x=>x.id===f.base)||bases[0];
 const intercept=useMemo(()=>({h:bearing(f,t),range:distance(f,t)}),[f,t]);
 const addEvent=s=>update(st=>({...st,events:[`${new Date().toISOString().slice(11,19)}Z  ${s}`,...st.events].slice(0,8)}));
 const scramble=()=>update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,airborne:true}:x),score:st.score+100,events:[`${new Date().toISOString().slice(11,19)}Z  ${f.name} SCRAMBLED FROM ${base.name}`,...st.events].slice(0,8)}));
 const vector=()=>update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,h:intercept.h}:x),score:st.score+Math.max(0,160-Math.round(angleDiff(f.h,intercept.h)*2)),events:[`${new Date().toISOString().slice(11,19)}Z  VECTOR ${String(intercept.h).padStart(3,'0')}°`,...st.events].slice(0,8)}));
 const rtb=()=>{const h=bearing(f,base);update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,h}:x),events:[`${new Date().toISOString().slice(11,19)}Z  ${f.name} RTB ${base.name}`,...st.events].slice(0,8)}))};
 const noteSave=()=>{if(!note.trim())return;update(st=>({...st,notes:{...st.notes,[t.id]:[...(st.notes[t.id]||[]),{time:new Date().toISOString().slice(11,19)+'Z',text:note.trim()}]},events:[`${new Date().toISOString().slice(11,19)}Z  NOTE ADDED TO ${t.name}`,...st.events].slice(0,8)}));setNote('')};
 return <div className="app controlOnly"><header><div className="title">RAF INTERCEPT <span>v{V}</span></div><div className="clock">12:24:{String(state.elapsed%60).padStart(2,'0')}Z</div><div className="headstat"><small>ROLE</small><b>FIGHTER CONTROL</b></div><div className="headstat"><small>SCORE</small><b>{state.score.toLocaleString()}</b></div><div className="headstat"><small>RANK</small><b>CONTROLLER</b></div><button onClick={()=>update(st=>({...st,running:!st.running}))}>{state.running?'Ⅱ PAUSE':'▶ RESUME'}</button><button className="openRadar" onClick={onRadar}>▣ OPEN RADAR SCREEN</button></header><div className="controlBody"><aside className="controlLeft"><section><h2>TACTICAL SITUATION</h2><div className="bigContact">{t.cls==='HOSTILE'?'HOSTILE':'UNKNOWN'} {t.id}</div><p>RANGE <b>{distance(f,t).toFixed(0)} NM</b></p><p>BEARING <b>{String(bearing(f,t)).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{t.alt}</b></p><p>SPEED <b>{t.s} KT</b></p><p>HEADING <b>{String(t.h).padStart(3,'0')}°</b></p><p>SOURCE <b>{t.source}</b></p></section><section><h2>CONTACTS</h2>{state.targets.map(x=><button className={'contactRow '+(x.id===t.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selected:x.id}))}><span className={x.cls==='CIVIL'?'blueDot':'redDot'}/><b>{x.name}</b><small>FL{x.alt} {x.s}KT</small></button>)}</section></aside><main className="controlMain"><section className="fighterDeck"><h2>SELECTED FIGHTER</h2><div className="fighterHeader"><div><div className="fighterName">{f.name}</div><div className="sub">{base.name} QRA · {f.airborne?'AIRBORNE':'READY'}</div></div><div className="fuelLarge"><span style={{width:f.fuel+'%'}}/><b>{f.fuel.toFixed(1)}% FUEL</b></div></div><div className="commandGrid"><button className="primary" onClick={scramble}>SCRAMBLE {f.name}</button><button className="primary" onClick={vector}>SEND INTERCEPT VECTOR <strong>{String(intercept.h).padStart(3,'0')}°</strong></button><button className="aar" onClick={()=>addEvent('AAR REQUESTED — VOYAGER 01')}>REQUEST VOYAGER AAR</button><button className="rtb" onClick={rtb}>RTB {base.name}</button><button className="hostile" onClick={()=>update(st=>({...st,targets:st.targets.map(x=>x.id===t.id?{...x,cls:'HOSTILE'}:x),events:[`${new Date().toISOString().slice(11,19)}Z  ${t.name} DECLARED HOSTILE`,...st.events].slice(0,8)}))}>DECLARE HOSTILE</button></div><div className="vectorPanel"><h3>INSTRUCTIONS</h3><div className="instruction"><span>HEADING</span><strong>{String(intercept.h).padStart(3,'0')}°</strong></div><div className="instruction"><span>RANGE</span><strong>{intercept.range.toFixed(0)} NM</strong></div><div className="instruction"><span>ALTITUDE</span><strong>FL{f.alt}</strong></div><div className="instruction"><span>SPEED</span><strong>{f.s} KT</strong></div><div className="nato">“TY21, TURN RIGHT HEADING {String(intercept.h).padStart(3,'0')}. VECTOR FOR INTERCEPT. REPORT VISUAL.”</div></div></section><section className="voyagerDeck"><h2>VOYAGER AAR</h2><div className="voyGrid"><div><b>VOYAGER 01</b><span>FL250 · 430 KT · HDG 180°</span></div><div><b>POSITION</b><span>560N 020E</span></div><div><b>STATUS</b><span className="green">ON STATION</span></div><button onClick={()=>addEvent('VOYAGER 01 CHECK IN')}>CHECK IN</button></div></section><section className="notesDeck"><h2>CONTACT NOTES — {t.name}</h2><div className="notesList">{(state.notes[t.id]||[]).map((n,i)=><div key={i}><small>{n.time}</small> {n.text}</div>)}{!(state.notes[t.id]||[]).length&&<div className="muted">No notes recorded.</div>}</div><div className="noteInput"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Enter controller note for selected contact..." onKeyDown={e=>e.key==='Enter'&&noteSave()}/><button onClick={noteSave}>ADD NOTE</button></div></section></main><aside className="controlRight"><section><h2>QRA STATUS</h2>{bases.map(b=>{const x=state.fighters.find(z=>z.base===b.id);return <button className="qraRow" key={b.id} onClick={()=>update(st=>({...st,selectedF:x?.id||st.selectedF}))}><b>{b.name}</b><span>{x?.name}</span><em className={x?.airborne?'green':''}>{x?.airborne?'AIRBORNE':'READY'}</em></button>})}</section><section><h2>EVENT LOG</h2>{state.events.map((e,i)=><div className="event" key={i}>{e}</div>)}</section><section><h2>TRAINING ASSISTANCE</h2><button className="assist" onClick={()=>setAssist(!assist)}>STANDARD ASSIST: {assist?'ON':'OFF'}</button><p className="muted">Assistance {assist?'provides predicted intercept vectors and suggested commands.':'is disabled; calculate and issue instructions manually.'}</p></section></aside></div></div>
}

function FighterController({state,update,onRadar}){
 const [heading,setHeading]=useState(70),[altitude,setAltitude]=useState(300),[speed,setSpeed]=useState(520),[reheat,setReheat]=useState(false),[audio,setAudio]=useState(true),[divert,setDivert]=useState('NEWCASTLE');
 const f=state.fighters.find(x=>x.id===state.selectedF)||state.fighters[0];
 const t=state.targets.find(x=>x.id===state.selected)||state.targets[0];
 const base=bases.find(x=>x.id===f.base)||bases[0];
 const tanker={name:'TANSOR 10',x:44,y:48,h:180,s:430,alt:250};
 const time=`${String(12+Math.floor(state.elapsed/60)).padStart(2,'0')}:${String(24+state.elapsed%60).padStart(2,'0')}Z`;
 const speak=(message)=>{if(!audio||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang='en-GB';u.rate=.88;const v=window.speechSynthesis.getVoices().find(x=>/^en-GB/i.test(x.lang));if(v)u.voice=v;window.speechSynthesis.speak(u)};
 const klaxon=()=>{if(!audio)return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='square';osc.frequency.value=660;gain.gain.value=.055;osc.connect(gain).connect(ctx.destination);osc.start();osc.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+.35);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1.4);osc.stop(ctx.currentTime+1.45)};
 const addRadio=(line,spoken)=>{update(st=>({...st,radio:[`${time}  ${line}`,...st.radio].slice(0,9),events:[`${time}  ${line}`,...st.events].slice(0,9)}));if(spoken)speak(spoken)};
 const lastRadio=useRef('');
 useEffect(()=>{const latest=state.radio?.[0]||'';if(!latest||latest===lastRadio.current)return;lastRadio.current=latest;if(latest.includes('AIRBORNE, REQUESTING INSTRUCTIONS'))speak(`${latest.split('  ').pop()}.`);},[state.radio]);
 useEffect(()=>{setHeading(f.h||70);setAltitude(f.alt||300);setSpeed(f.s||520);setReheat(!!f.reheat)},[f.id]);
 const firstPairScrambled=id=>state.mission.firstScramble?.[id]!=null;
 const secondPairReady=x=>x.pair===2&&x.crewReadyAt!=null&&state.elapsed>=x.crewReadyAt&&state.elapsed>=(state.mission.firstScramble?.[x.base]??Infinity)+10;
 const isReady=x=>x.status==='READY'||secondPairReady(x);
 const crewIn=()=>{if(f.pair===1||f.crewReadyAt!=null)return;update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,status:'CREWING',crewReadyAt:st.elapsed+2}:x),radio:[`${time}  QRA OPS: ${f.name} CREW IN — READY IN 2 MIN`,...st.radio].slice(0,9)}));speak(`${f.name}, crew in. Stand by.`)};
 const scramble=()=>{if(!isReady(f))return;const delay=scrambleDelayMinutes().toFixed(1);klaxon();const spoken=`Scramble. Scramble. Scramble. ${f.name}. Immediate launch.`;update(st=>{const first=st.mission.firstScramble[f.base];return {...st,mission:{...st.mission,firstScramble:{...st.mission.firstScramble,[f.base]:first??st.elapsed}},fighters:st.fighters.map(x=>x.id===f.id?{...x,status:`SCRAMBLING · ${delay} MIN`,scrambleAt:st.elapsed,scrambleDelay:+delay,airborne:false,fuel:100}:x),score:st.score+100,radio:[`${time}  QRA OPS: SCRAMBLE ${f.name} — PILOT REPORT ETA ${delay} MIN`,...st.radio].slice(0,9),events:[`${time}  ${f.name} SCRAMBLE ORDERED`,...st.events].slice(0,9)}});speak(spoken)};
 const sendVector=()=>{if(!f.airborne)return;const call=`${f.name}, roger. Heading ${String(heading).padStart(3,'0')}, flight level ${altitude}, speed ${speed} knots${reheat?', reheat selected':''}.`;update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,h:+heading,alt:+altitude,s:+speed,reheat,status:'VECTORING'}:x),score:st.score+20,radio:[`${time}  ${f.name}: ${call}`,...st.radio].slice(0,9)}));speak(call)};
 const tankerVector=()=>{if(!f.airborne)return;const h=bearing(f,tanker);setHeading(h);setAltitude(tanker.alt);setSpeed(430);update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,h,alt:tanker.alt,s:430,reheat:false,status:'RENDEZVOUS TANSOR 10'}:x),radio:[`${time}  ${f.name}: VECTORING TO TANSOR 10, HEADING ${String(h).padStart(3,'0')}`,...st.radio].slice(0,9)}));speak(`${f.name}, roger. Proceeding to Tansor 10.`)};
 const requestRefuel=()=>{if(!f.airborne)return;update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,status:'AAR WITH TANSOR 10',fuel:Math.min(100,x.fuel+20)}:x),radio:[`${time}  TANSOR 10: ${f.name}, cleared to pre-contact.`,...st.radio].slice(0,9)}));speak(`${f.name}, cleared to pre-contact with Tansor 10.`)};
 const recover=(emergency=false)=>{if(!f.airborne)return;const dest=emergency?divert:base.name;const h=emergency?Math.round((f.h+35)%360):bearing(f,base);update(st=>({...st,fighters:st.fighters.map(x=>x.id===f.id?{...x,h,status:emergency?`DIVERTING ${dest}`:`RTB ${base.name}`,reheat:false}:x),radio:[`${time}  ${f.name}: ${emergency?'DIVERTING':'RETURNING'} ${dest}`,...st.radio].slice(0,9)}));speak(`${f.name}, roger. ${emergency?'Diverting to':'Returning to'} ${dest}.`)};
 const targetVector=bearing(f,t);
 return <div className="app controlOnly missionControl"><header><div className="title">RAF INTERCEPT <span>v{V}</span></div><div className="clock">FIGHTER CONTROLLER · {time}</div><div className="headstat"><small>MISSION</small><b>LIVE AIR PICTURE</b></div><div className="headstat"><small>SCORE</small><b>{state.score.toLocaleString()}</b></div><button onClick={()=>setAudio(a=>!a)}>{audio?'🔊 RADIO ON':'🔇 RADIO OFF'}</button><button className="openRadar" onClick={onRadar}>▣ OPEN RADAR SCREEN</button></header><div className="controlBody"><aside className="controlLeft"><section><h2>TACTICAL SITUATION</h2><div className={'bigContact '+(t.cls==='CIVIL'?'civilText':'')}>{t.cls} {t.name}</div><p>RANGE <b>{distance(f,t).toFixed(0)} NM</b></p><p>BEARING <b>{String(targetVector).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{t.alt}</b></p><p>SPEED <b>{t.s} KT</b></p><p>SOURCE <b>{t.source}</b></p></section><section><h2>LIVE TRANSPONDER / RADAR</h2>{state.targets.map(x=><button className={'contactRow '+(x.id===t.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selected:x.id}))}><span className={x.cls==='CIVIL'?'amberDot':'redDot'}/><b>{x.name}</b><small>FL{x.alt} · {x.s} KT</small></button>)}</section><section><h2>RADIO LOG</h2><div className="radioLog">{state.radio.map((line,i)=><div key={i}>{line}</div>)}</div></section></aside><main className="controlMain"><section className="fighterDeck"><h2>AIRCRAFT COMMAND PANEL</h2><div className="fighterHeader"><div><div className="fighterName">{f.name}</div><div className="sub">{base.name} · {f.status}</div></div><div className="fuelLarge"><span className={f.fuel<30?'fuelLow':''} style={{width:f.fuel+'%'}}/><b>{f.fuel.toFixed(1)}% FUEL · {f.airborne?`${Math.max(0,Math.floor(f.fuel/(f.reheat?3.2:1.05)))} MIN EST.`:'ON GROUND'}</b></div></div><div className="fighterTabs">{state.fighters.map(x=><button key={x.id} className={x.id===f.id?'activeFighter':''} onClick={()=>update(st=>({...st,selectedF:x.id}))}>{x.name}<small>{x.status}</small></button>)}</div>{!f.airborne?<div className="groundActions"><div><b>{f.status}</b><p>{f.pair===1?'Immediate QRA pair. Ready for an urgent launch.':f.status==='CREWING'?`Crew In in progress — ${Math.max(0,(f.crewReadyAt||0)-state.elapsed)} min remaining.`:firstPairScrambled(f.base)?`Follow-on aircraft: ${Math.max(0,(state.mission.firstScramble[f.base]+10)-state.elapsed)} min until QRA window.`:'Follow-on aircraft: issue Crew In now to prepare the crew.'}</p></div>{f.pair===2&&f.crewReadyAt==null&&<button onClick={crewIn}>CREW IN · 2 MIN</button>}<button className="scramble" disabled={!isReady(f)} onClick={scramble}>⚠ SCRAMBLE {f.name}</button></div>:<><div className="commandInputs"><label>HEADING<input type="number" min="0" max="359" value={heading} onChange={e=>setHeading(clamp(+e.target.value,0,359))}/></label><label>ALTITUDE<input type="number" min="100" max="550" step="10" value={altitude} onChange={e=>setAltitude(clamp(+e.target.value,100,550))}/><small>FL</small></label><label>SPEED<input type="number" min="250" max="760" step="10" value={speed} onChange={e=>setSpeed(clamp(+e.target.value,250,760))}/><small>KT</small></label><label className="reheat"><input type="checkbox" checked={reheat} onChange={e=>setReheat(e.target.checked)}/> REHEAT</label><button className="primary" onClick={sendVector}>SEND VECTOR</button></div><div className="prediction">PREDICTED INTERCEPT: {distance(f,t).toFixed(0)} NM · VECTOR {String(targetVector).padStart(3,'0')}° · {Math.max(2,Math.round(distance(f,t)/9))} MIN</div><div className="supportGrid"><button className="aar" onClick={tankerVector}>VECTOR TO TANSOR 10</button><button className="aar" onClick={requestRefuel}>REQUEST AAR / REFUEL</button><button className="rtb" onClick={()=>recover(false)}>RETURN TO BASE</button><label className="divert"><select value={divert} onChange={e=>setDivert(e.target.value)}><option>NEWCASTLE</option><option>LEUCHARS</option><option>TEESSIDE</option></select><button onClick={()=>recover(true)}>EMERGENCY DIVERT</button></label></div></>}</section><section className="voyagerDeck"><h2>TANKER SUPPORT</h2><div className="voyGrid"><div><b>TANSOR 10</b><span>FL250 · 430 KT · RACETRACK</span></div><div><b>POSITION</b><span>NORTH SEA STATION</span></div><div><b>STATUS</b><span className="green">READY FOR RECEIVERS</span></div><button onClick={()=>addRadio('TANSOR 10: ON STATION, READY FOR RECEIVERS.','Tansor 10, on station. Ready for receivers.')}>RADIO CHECK</button></div></section></main><aside className="controlRight"><section><h2>QRA NORTH · LOSSIEMOUTH</h2>{state.fighters.filter(x=>x.base==='LOS').map(x=><button className={'qraRow '+(x.id===f.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selectedF:x.id}))}><b>{x.name}</b><span>PAIR {x.pair} · {x.fuel}% FUEL</span><em className={x.airborne?'green':''}>{x.status}</em></button>)}</section><section><h2>QRA SOUTH · CONINGSBY</h2>{state.fighters.filter(x=>x.base==='CON').map(x=><button className={'qraRow '+(x.id===f.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selectedF:x.id}))}><b>{x.name}</b><span>PAIR {x.pair} · {x.fuel}% FUEL</span><em className={x.airborne?'green':''}>{x.status}</em></button>)}</section><section><h2>TRAINING PROMPT</h2><p className="muted">Use bearing, range and closing speed to choose the best station and intercept vector. Reheat burns fuel quickly.</p></section></aside></div></div>
}

function FighterControllerV2({state,update,onRadar}){
  const [heading,setHeading]=useState(70),[altitude,setAltitude]=useState(300),[speed,setSpeed]=useState(520),[reheat,setReheat]=useState(false),[audio,setAudio]=useState(true),[divert,setDivert]=useState('NEWCASTLE');
  const fighter=state.fighters.find(x=>x.id===state.selectedF)||state.fighters[0];
  const target=state.targets.find(x=>x.id===state.selected)||state.targets[0];
  const base=bases.find(x=>x.id===fighter.base)||bases[0];
  const tanker=state.tanker;
  const clock=`${String(12+Math.floor(state.elapsed/60)).padStart(2,'0')}:${String(24+state.elapsed%60).padStart(2,'0')}Z`;
  const intelOptions=['NATO TRACK: first observed westbound over the Norwegian Sea 18 min ago.','NATO TRACK: intermittent IFF; no verified civil flight plan matched.','NATO TRACK: course altered 22° toward UK FIR boundary.','NATO TRACK: previous speed and altitude consistent for the last 12 min.'];
  const speak=message=>{if(!audio||!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang='en-GB';u.rate=.88;const v=window.speechSynthesis.getVoices().find(x=>/^en-GB/i.test(x.lang));if(v)u.voice=v;window.speechSynthesis.speak(u)};
  const radio=(line,spoken)=>{update(st=>({...st,radio:[`${clock}  ${line}`,...st.radio].slice(0,10),events:[`${clock}  ${line}`,...st.events].slice(0,10)}));if(spoken)speak(spoken)};
  const klaxon=()=>{if(!audio)return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const c=new Ctx(),o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=650;g.gain.value=.05;o.connect(g).connect(c.destination);o.start();o.frequency.exponentialRampToValueAtTime(900,c.currentTime+.35);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+1.4);o.stop(c.currentTime+1.45)};
  useEffect(()=>{setHeading(fighter.h||70);setAltitude(fighter.alt||300);setSpeed(fighter.s||520);setReheat(!!fighter.reheat)},[fighter.id]);
  useEffect(()=>{if(tanker.status==='SCRAMBLING'&&state.elapsed-tanker.scrambleAt>=4)update(st=>({...st,tanker:{...st.tanker,airborne:true,x:40,y:66,s:430,alt:250,status:'AIRBORNE · AWAITING TASKING'}}));},[state.elapsed,tanker.status]);
  useEffect(()=>{if(!tanker.airborne||!tanker.receiverId)return;update(st=>{const receiver=st.fighters.find(x=>x.id===st.tanker.receiverId);if(!receiver)return st;const h=bearing(st.tanker,receiver),step=.0015;return {...st,tanker:{...st.tanker,h,x:clamp(st.tanker.x+Math.sin(h*Math.PI/180)*st.tanker.s*step,0,100),y:clamp(st.tanker.y-Math.cos(h*Math.PI/180)*st.tanker.s*step,0,100)}}});},[state.elapsed,tanker.airborne,tanker.receiverId]);
  const isReady=f=>f.status==='READY'||(f.pair===2&&f.crewReadyAt!=null&&state.elapsed>=f.crewReadyAt&&state.elapsed>=(state.mission.firstScramble?.[f.base]??Infinity)+10);
  const crewIn=()=>{if(fighter.pair===1||fighter.crewReadyAt!=null)return;update(st=>({...st,fighters:st.fighters.map(x=>x.id===fighter.id?{...x,status:'CREWING',crewReadyAt:st.elapsed+2}:x),radio:[`${clock}  QRA OPS: ${fighter.name} CREW IN — READY IN 2 MIN`,...st.radio].slice(0,10)}));speak(`${fighter.name}, crew in. Stand by.`)};
  const scramble=()=>{if(!isReady(fighter))return;const delay=+scrambleDelayMinutes().toFixed(1);klaxon();update(st=>{const first=st.mission.firstScramble[fighter.base];return {...st,mission:{...st.mission,firstScramble:{...st.mission.firstScramble,[fighter.base]:first??st.elapsed}},fighters:st.fighters.map(x=>x.id===fighter.id?{...x,status:`SCRAMBLING · ${delay} MIN`,scrambleAt:st.elapsed,scrambleDelay:delay,airborne:false,fuel:100}:x),radio:[`${clock}  QRA OPS: SCRAMBLE ${fighter.name} — PILOT REPORT ETA ${delay} MIN`,...st.radio].slice(0,10)}});speak(`Scramble. Scramble. Scramble. ${fighter.name}. Immediate launch.`)};
  const tagTarget=()=>{if(target.cls==='CIVIL')return;update(st=>({...st,targets:st.targets.map(x=>x.id===target.id?{...x,tagged:true,trackStatus:'NATO DATA LINK ACTIVE',intel:x.intel||[]}:x),radio:[`${clock}  CONTROL: ${target.name} TAGGED — NATO TRACK REQUEST SENT`,...st.radio].slice(0,10)}));speak(`${target.name} tagged. NATO track request sent.`)};
  const collectIntel=()=>{if(!target.tagged)return;const item=intelOptions[(target.intel?.length||0)%intelOptions.length];update(st=>({...st,targets:st.targets.map(x=>x.id===target.id?{...x,intel:[...(x.intel||[]),item]}:x),score:st.score+25,radio:[`${clock}  NATO DATA LINK: ${item}`,...st.radio].slice(0,10)}));speak('NATO data link update received.')};
  const sendVector=()=>{if(!fighter.airborne)return;const call=`${fighter.name}, roger. Heading ${String(heading).padStart(3,'0')}, flight level ${altitude}, speed ${speed} knots${reheat?', reheat selected':''}.`;update(st=>({...st,fighters:st.fighters.map(x=>x.id===fighter.id?{...x,h:+heading,alt:+altitude,s:+speed,reheat,status:'VECTORING'}:x),radio:[`${clock}  ${fighter.name}: ${call}`,...st.radio].slice(0,10)}));speak(call)};
  const contactTanker=()=>{radio(`CONTROL: TANSOR 10, RADIO CHECK.`, 'Tansor 10, radio check.');update(st=>({...st,tanker:{...st.tanker,contacted:true,status:st.tanker.airborne?st.tanker.status:'ON GROUND · CONTACT ESTABLISHED'}}))};
  const taskTanker=()=>{if(!tanker.airborne||!tanker.contacted)return;const h=bearing(tanker,fighter);update(st=>({...st,tanker:{...st.tanker,tasked:true,receiverId:fighter.id,h,status:`VECTORING TO ${fighter.name}`},radio:[`${clock}  TANSOR 10: VECTORING TO ${fighter.name}`,...st.radio].slice(0,10)}));speak(`Tansor 10, roger. Vectoring to ${fighter.name}.`)};
  const scrambleTanker=()=>{if(tanker.airborne)return;update(st=>({...st,tanker:{...st.tanker,status:'SCRAMBLING',scrambleAt:st.elapsed,contacted:true},radio:[`${clock}  CONTROL: TANSOR 10 SCRAMBLE ORDERED FROM RAF BRIZE NORTON`,...st.radio].slice(0,10)}));speak('Tansor 10, scramble. Proceed to North Sea holding area.')};
  const tankerVector=()=>{if(!fighter.airborne||!tanker.airborne||!tanker.tasked)return;const h=bearing(fighter,tanker);setHeading(h);setAltitude(tanker.alt);setSpeed(430);update(st=>({...st,fighters:st.fighters.map(x=>x.id===fighter.id?{...x,h,alt:tanker.alt,s:430,reheat:false,status:'RENDEZVOUS TANSOR 10'}:x),radio:[`${clock}  ${fighter.name}: VECTORING TO TANSOR 10`,...st.radio].slice(0,10)}));speak(`${fighter.name}, roger. Proceeding to Tansor 10.`)};
  const refuel=()=>{if(!fighter.airborne||!tanker.tasked)return;update(st=>({...st,fighters:st.fighters.map(x=>x.id===fighter.id?{...x,status:'AAR WITH TANSOR 10',fuel:Math.min(100,x.fuel+20)}:x),radio:[`${clock}  TANSOR 10: ${fighter.name}, CLEARED TO PRE-CONTACT`,...st.radio].slice(0,10)}));speak(`${fighter.name}, cleared to pre-contact with Tansor 10.`)};
  const recover=emergency=>{if(!fighter.airborne)return;const dest=emergency?divert:base.name;update(st=>({...st,fighters:st.fighters.map(x=>x.id===fighter.id?{...x,status:emergency?`DIVERTING ${dest}`:`RTB ${base.name}`,reheat:false}:x),radio:[`${clock}  ${fighter.name}: ${emergency?'DIVERTING':'RETURNING'} ${dest}`,...st.radio].slice(0,10)}));speak(`${fighter.name}, roger. ${emergency?'Diverting to':'Returning to'} ${dest}.`)};
  const followOn=fighter.pair===2&&state.mission.firstScramble?.[fighter.base]!=null?Math.max(0,state.mission.firstScramble[fighter.base]+10-state.elapsed):null;
  return <div className="app controlOnly missionControl"><header><div className="title">RAF INTERCEPT <span>v{V}</span></div><div className="clock">FIGHTER CONTROLLER · {clock}</div><div className="headstat"><small>MISSION</small><b>LIVE AIR PICTURE</b></div><button onClick={()=>setAudio(a=>!a)}>{audio?'🔊 RADIO ON':'🔇 RADIO OFF'}</button><button className="openRadar" onClick={onRadar}>▣ OPEN RADAR SCREEN</button></header><div className="controlBody"><aside className="controlLeft"><section><h2>TRACKED CONTACT</h2><div className="bigContact">{target.cls} {target.name}</div><p>RANGE <b>{distance(fighter,target).toFixed(0)} NM</b></p><p>BEARING <b>{String(bearing(fighter,target)).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{target.alt}</b></p><p>SPEED <b>{target.s} KT</b></p><button className="trackButton" disabled={target.cls==='CIVIL'||target.tagged} onClick={tagTarget}>{target.tagged?'TAG ACTIVE':'TAG CONTACT / NATO QUERY'}</button><button className="intelButton" disabled={!target.tagged} onClick={collectIntel}>REQUEST PREVIOUS TRACK DATA</button>{target.tagged&&<div className="intelPanel"><b>NATO ALLIED TRACK</b>{(target.intel||[]).length?(target.intel||[]).map((x,i)=><p key={i}>{x}</p>):<p>Track tagged. Request a data update while fighters prepare.</p>}</div>}</section><section><h2>LIVE TRANSPONDER / RADAR</h2>{state.targets.map(x=><button className={'contactRow '+(x.id===target.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selected:x.id}))}><span className={x.cls==='CIVIL'?'amberDot':'redDot'}/><b>{x.name}</b><small>FL{x.alt} · {x.s} KT</small></button>)}</section><section><h2>RADIO LOG</h2><div className="radioLog">{state.radio.map((x,i)=><div key={i}>{x}</div>)}</div></section></aside><main className="controlMain"><section className="fighterDeck"><h2>AIRCRAFT COMMAND PANEL</h2><div className="fighterHeader"><div><div className="fighterName">{fighter.name}</div><div className="sub">{base.name} · {fighter.status}</div></div><div className="fuelLarge"><span className={fighter.fuel<30?'fuelLow':''} style={{width:fighter.fuel+'%'}}/><b>{fighter.fuel.toFixed(1)}% FUEL · {fighter.airborne?`${Math.floor(fighter.fuel/(fighter.reheat?3.2:1.05))} MIN EST.`:'ON GROUND'}</b></div></div><div className="fighterTabs">{state.fighters.map(x=><button key={x.id} className={x.id===fighter.id?'activeFighter':''} onClick={()=>update(st=>({...st,selectedF:x.id}))}>{x.name}<small>{x.status}</small></button>)}</div>{!fighter.airborne?<div className="groundActions"><div><b>{fighter.status}</b><p>{fighter.pair===1?'Immediate QRA pair — ready to launch.':fighter.status==='CREWING'?`Crew In in progress — ${Math.max(0,fighter.crewReadyAt-state.elapsed)} min remaining.`:followOn!=null?`Follow-on window opens in ${followOn} min.`:'Issue Crew In now; the team takes 2 min to prepare.'}</p></div>{fighter.pair===2&&fighter.crewReadyAt==null&&<button onClick={crewIn}>CREW IN · 2 MIN</button>}<button className="scramble" disabled={!isReady(fighter)} onClick={scramble}>⚠ SCRAMBLE {fighter.name}</button></div>:<><div className="commandInputs"><label>HEADING<input type="number" min="0" max="359" value={heading} onChange={e=>setHeading(clamp(+e.target.value,0,359))}/></label><label>ALTITUDE<input type="number" min="100" max="550" step="10" value={altitude} onChange={e=>setAltitude(clamp(+e.target.value,100,550))}/><small>FL</small></label><label>SPEED<input type="number" min="250" max="760" step="10" value={speed} onChange={e=>setSpeed(clamp(+e.target.value,250,760))}/><small>KT</small></label><label className="reheat"><input type="checkbox" checked={reheat} onChange={e=>setReheat(e.target.checked)}/> REHEAT</label><button className="primary" onClick={sendVector}>SEND VECTOR</button></div><div className="prediction">PREDICTED INTERCEPT: VECTOR {String(bearing(fighter,target)).padStart(3,'0')}° · {distance(fighter,target).toFixed(0)} NM</div><div className="supportGrid"><button className="aar" disabled={!tanker.tasked} onClick={tankerVector}>VECTOR TO TANSOR 10</button><button className="aar" disabled={!tanker.tasked} onClick={refuel}>REQUEST AAR / REFUEL</button><button className="rtb" onClick={()=>recover(false)}>RETURN TO BASE</button><label className="divert"><select value={divert} onChange={e=>setDivert(e.target.value)}><option>NEWCASTLE</option><option>LEUCHARS</option><option>TEESSIDE</option></select><button onClick={()=>recover(true)}>EMERGENCY DIVERT</button></label></div></>}</section><section className="voyagerDeck"><h2>TANKER SUPPORT · {tanker.name}</h2><div className="tankerStatus"><b>{tanker.status}</b><span>{tanker.airborne?`FL${tanker.alt} · ${tanker.s} KT`:'RAF BRIZE NORTON'}</span></div><div className="tankerActions"><button onClick={contactTanker}>{tanker.contacted?'CONTACT ESTABLISHED':'CONTACT TANSOR 10'}</button>{!tanker.airborne?<button className="scramble" disabled={!tanker.contacted||tanker.status==='SCRAMBLING'} onClick={scrambleTanker}>SCRAMBLE TANKER</button>:<button className="aar" disabled={!tanker.contacted||tanker.tasked} onClick={taskTanker}>TASK NORTH SEA RACETRACK</button>}</div></section></main><aside className="controlRight"><section><h2>QRA NORTH · RAF LOSSIEMOUTH</h2>{state.fighters.filter(x=>x.base==='LOS').map(x=><button className={'qraRow '+(x.id===fighter.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selectedF:x.id}))}><b>{x.name}</b><span>PAIR {x.pair} · {x.fuel}% FUEL</span><em className={x.airborne?'green':''}>{x.status}</em></button>)}</section><section><h2>QRA SOUTH · RAF CONINGSBY</h2>{state.fighters.filter(x=>x.base==='CON').map(x=><button className={'qraRow '+(x.id===fighter.id?'selectedRow':'')} key={x.id} onClick={()=>update(st=>({...st,selectedF:x.id}))}><b>{x.name}</b><span>PAIR {x.pair} · {x.fuel}% FUEL</span><em className={x.airborne?'green':''}>{x.status}</em></button>)}</section><section><h2>TRAINING PROMPT</h2><p className="muted">While the pilot prepares, tag the suspect track and build the NATO picture. Then use range, bearing and closing speed to issue a vector.</p></section></aside></div></div>
}

function WorkflowController({state,update,onRadar}){
 const [heading,setHeading]=useState(70),[altitude,setAltitude]=useState(300),[speed,setSpeed]=useState(520),[reheat,setReheat]=useState(false),[audio,setAudio]=useState(true),[divert,setDivert]=useState('NEWCASTLE');
 const f=state.fighters.find(x=>x.id===state.selectedF)||state.fighters[0],t=state.targets.find(x=>x.id===state.selected)||state.targets[0],base=bases.find(x=>x.id===f.base)||bases[0],tanker=state.tanker;
 const clock=`${String(12+Math.floor(state.elapsed/60)).padStart(2,'0')}:${String(24+state.elapsed%60).padStart(2,'0')}Z`;
 const speak=m=>{if(!audio||!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(m);u.lang='en-GB';u.rate=.88;const v=speechSynthesis.getVoices().find(x=>/^en-GB/.test(x.lang));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)};
 const addRadio=(line,voice)=>{update(s=>({...s,radio:[`${clock}  ${line}`,...s.radio].slice(0,10)}));if(voice)speak(voice)};
 const canLaunch=x=>x.status==='READY'||(x.pair===2&&x.crewReadyAt!=null&&state.elapsed>=x.crewReadyAt&&state.elapsed>=(state.mission.firstScramble[x.base]??Infinity)+10);
 useEffect(()=>{setHeading(f.h||70);setAltitude(f.alt||300);setSpeed(f.s||520);setReheat(!!f.reheat)},[f.id]);
 useEffect(()=>{if(tanker.status==='SCRAMBLING'&&state.elapsed-tanker.scrambleAt>=4)update(s=>({...s,tanker:{...s.tanker,airborne:true,x:40,y:66,s:430,alt:250,status:'AIRBORNE · AWAITING TASKING'}}));},[state.elapsed,tanker.status]);
 useEffect(()=>{if(!tanker.airborne||!tanker.receiverId)return;update(s=>{const receiver=s.fighters.find(x=>x.id===s.tanker.receiverId);if(!receiver)return s;const h=bearing(s.tanker,receiver),step=.0015;return {...s,tanker:{...s.tanker,h,x:clamp(s.tanker.x+Math.sin(h*Math.PI/180)*s.tanker.s*step,0,100),y:clamp(s.tanker.y-Math.cos(h*Math.PI/180)*s.tanker.s*step,0,100)}}});},[state.elapsed,tanker.airborne,tanker.receiverId]);
 const crewIn=()=>{if(f.pair===1||f.crewReadyAt)return;update(s=>({...s,fighters:s.fighters.map(x=>x.id===f.id?{...x,status:'CREWING',crewReadyAt:s.elapsed+2}:x)}));addRadio(`QRA OPS: ${f.name} CREW IN — READY IN 2 MIN`,`${f.name}, crew in. Stand by.`)};
 const scramble=()=>{if(!canLaunch(f))return;const delay=+scrambleDelayMinutes().toFixed(1),failure=Math.random()<.05;update(s=>{const first=s.mission.firstScramble[f.base];return {...s,mission:{...s.mission,firstScramble:{...s.mission.firstScramble,[f.base]:first??s.elapsed}},fighters:s.fighters.map(x=>x.id===f.id?{...x,airborne:false,status:`SCRAMBLING · ${delay} MIN`,scrambleAt:s.elapsed,scrambleDelay:delay,failureAt:failure?s.elapsed+delay+5+Math.floor(Math.random()*12):null,fuel:100}:x),radio:[`${clock}  QRA OPS: SCRAMBLE ${f.name} — PILOT REPORT ETA ${delay} MIN`,...s.radio].slice(0,10)}});speak(`Scramble. Scramble. Scramble. ${f.name}. Immediate launch.`)};
 const sendVector=()=>{if(!f.airborne)return;update(s=>({...s,fighters:s.fighters.map(x=>x.id===f.id?{...x,h:+heading,alt:+altitude,s:+speed,reheat,status:'VECTORING'}:x)}));addRadio(`${f.name}: ROGER. HEADING ${String(heading).padStart(3,'0')}, FLIGHT LEVEL ${altitude}, SPEED ${speed} KNOTS.`,`${f.name}, roger. Heading ${String(heading).padStart(3,'0')}, flight level ${altitude}, speed ${speed} knots.`)};
 const recover=(emergency=false)=>{if(!f.airborne)return;const dest=emergency?divert:base.name;update(s=>({...s,fighters:s.fighters.map(x=>x.id===f.id?{...x,status:emergency?`DIVERTING ${dest}`:`RTB ${base.name}`,emergency:false,reheat:false}:x)}));addRadio(`${f.name}: ${emergency?'DIVERTING':'RETURNING'} ${dest}`,`${f.name}, roger. ${emergency?'Diverting to':'Returning to'} ${dest}.`)};
 const contactTanker=()=>{update(s=>({...s,tanker:{...s.tanker,contacted:true,status:s.tanker.airborne?s.tanker.status:'ON GROUND · CONTACT ESTABLISHED'}}));addRadio('CONTROL: TANSOR 10, RADIO CHECK.','Tansor 10, radio check.')};
 const vectorTanker=()=>{if(!tanker.airborne||!tanker.contacted)return;const h=bearing(tanker,f);update(s=>({...s,tanker:{...s.tanker,tasked:true,receiverId:f.id,h,status:`VECTORING TO ${f.name}`}}));addRadio(`TANSOR 10: VECTORING TO ${f.name}`,`Tansor 10, roger. Vectoring to ${f.name}.`)};
 const scrambleTanker=()=>{if(tanker.airborne)return;update(s=>({...s,tanker:{...s.tanker,contacted:true,status:'SCRAMBLING',scrambleAt:s.elapsed}}));addRadio('CONTROL: TANSOR 10 SCRAMBLE ORDERED','Tansor 10, scramble. Proceed to North Sea holding area.')};
 const tag=()=>{if(t.tagged)return;update(s=>({...s,targets:s.targets.map(x=>x.id===t.id?{...x,tagged:true,intel:['NATO TRACK: previous track indicates westbound movement from the Norwegian Sea.']}:x)}));addRadio(`CONTROL: ${t.name} TAGGED — NATO DATA LINK ACTIVE`)};
 const timer=f.scrambleAt!=null&&!f.airborne?`${Math.min(f.scrambleDelay||0,state.elapsed-f.scrambleAt).toFixed(1)} / ${f.scrambleDelay} MIN`:'';
 return <div className="app workflow"><header><div className="title">RAF INTERCEPT <span>v{V}</span></div><div className="clock">FIGHTER CONTROLLER · {clock}</div><button onClick={()=>setAudio(x=>!x)}>{audio?'🔊 RADIO ON':'🔇 RADIO OFF'}</button><button className="openRadar" onClick={onRadar}>▣ OPEN RADAR SCREEN</button></header><div className="workflowBody"><aside className="workflowAircraft"><h2>1 · SELECT AIRCRAFT</h2>{bases.map(b=><section key={b.id}><h3>{b.name}</h3>{state.fighters.filter(x=>x.base===b.id).map(x=><button key={x.id} className={'aircraftCard '+(x.id===f.id?'selectedAircraft':'')+(x.emergency?' emergency':'')} onClick={()=>update(s=>({...s,selectedF:x.id}))}><b>{x.name}</b><span>{x.status}</span><small>{x.scrambleAt!=null&&!x.airborne?`SCRAMBLE TIMER ${Math.min(x.scrambleDelay||0,state.elapsed-x.scrambleAt).toFixed(1)} / ${x.scrambleDelay} MIN`:`${x.fuel.toFixed(0)}% FUEL`}</small></button>)}</section>)}</aside><main className="workflowCommands"><h2>2 · ISSUE INSTRUCTIONS</h2><section className="selectedSummary"><b>{f.name}</b><span>{base.name}</span><em className={f.emergency?'emergencyText':''}>{f.status}</em></section>{!f.airborne?<section className="groundWorkflow"><p>{f.pair===1?'Immediate QRA aircraft.':'Follow-on aircraft requires Crew In and the QRA availability window.'}</p>{f.pair===2&&!f.crewReadyAt&&<button onClick={crewIn}>CREW IN · 2 MIN</button>}<button className="scramble" disabled={!canLaunch(f)} onClick={scramble}>⚠ SCRAMBLE {f.name}</button>{timer&&<strong>SCRAMBLE TIMER: {timer}</strong>}</section>:<><section className="vectorWorkflow"><label>HEADING<input type="number" value={heading} min="0" max="1300" onChange={e=>setHeading(clamp(+e.target.value,0,359))}/></label><label>ALTITUDE<input type="number" value={altitude} min="100" max="550" onChange={e=>setAltitude(clamp(+e.target.value,100,550))}/><small>FL</small></label><label>SPEED<input type="number" value={speed} min="250" max="1300" onChange={e=>setSpeed(clamp(+e.target.value,250,1300))}/><small>KT</small></label><label className="reheat"><input type="checkbox" checked={reheat} onChange={e=>setReheat(e.target.checked)}/> REHEAT</label><button className="primary" onClick={sendVector}>SEND ORDER</button></section><div className="vectorAdvice">TARGET VECTOR {String(bearing(f,t)).padStart(3,'0')}° · {distance(f,t).toFixed(0)} NM · FUEL {f.fuel.toFixed(0)}% · EST. {fuelEnduranceMinutes(f)} MIN</div><section className="recoveryWorkflow"><button className="rtb" onClick={()=>recover(false)}>RETURN TO BASE</button><select value={divert} onChange={e=>setDivert(e.target.value)}><option>NEWCASTLE</option><option>LEUCHARS</option><option>TEESSIDE</option></select><button className="emergencyButton" onClick={()=>recover(true)}>EMERGENCY DIVERT</button></section></>}<section className="tankerWorkflow"><h3>TANSOR 10 · {tanker.status}</h3><p>{tanker.airborne?`FL${tanker.alt} · ${tanker.s} KT`:'RAF BRIZE NORTON'}</p><button onClick={contactTanker}>{tanker.contacted?'CONTACT ESTABLISHED':'CONTACT TANKER'}</button>{!tanker.airborne?<button className="scramble" disabled={!tanker.contacted||tanker.status==='SCRAMBLING'} onClick={scrambleTanker}>SCRAMBLE TANKER</button>:<button className="aar" disabled={!tanker.contacted} onClick={vectorTanker}>VECTOR TANKER TO {f.name}</button>}</section></main><aside className="workflowContacts"><h2>3 · TRACK & RADIO</h2><section className="contactList">{state.targets.map(x=><button key={x.id} className={x.id===t.id?'selectedContact':''} onClick={()=>update(s=>({...s,selected:x.id}))}><b>{x.name}</b><span>{x.cls}</span></button>)}</section><section className="contactDetail"><h3>{t.name}</h3><p>HEADING <b>{String(t.h).padStart(3,'0')}°</b></p><p>ALTITUDE <b>FL{t.alt}</b></p><p>SPEED <b>{t.s} KT</b></p><p>TRACK <b>{t.source}</b></p><button className="trackButton" onClick={tag} disabled={t.tagged}>{t.tagged?'NATO TRACK ACTIVE':'TAG CONTACT / NATO QUERY'}</button>{t.tagged&&(t.intel||[]).map((x,i)=><div className="intelPanel" key={i}>{x}</div>)}</section><section><h3>RADIO LOG</h3><div className="radioLog">{state.radio.map((x,i)=><div key={i}>{x}</div>)}</div></section></aside></div></div>
}

function RadarMap({state,zoom,setZoom,pan,setPan,layers,setLayers}){
  const [drag,setDrag]=useState(null);
  const reset=()=>{setZoom(1);setPan({x:0,y:0})};
  const wheel=e=>{
    e.preventDefault();
    setZoom(z=>clamp(z*(e.deltaY<0?1.12:.89),.65,4));
  };
  const down=e=>{
    if(e.button!==0)return;
    setDrag({x:e.clientX,y:e.clientY,px:pan.x,py:pan.y});
  };
  const move=e=>{
    if(!drag)return;
    setPan({x:drag.px+e.clientX-drag.x,y:drag.py+e.clientY-drag.y});
  };
  const up=()=>setDrag(null);

  return <div className="radarPage radarReferencePage">
    <header>
      <div className="title">RAF INTERCEPT <span>v{V}</span></div>
      <div className="clock">TACTICAL RADAR DISPLAY</div>
      <div className="headstat"><small>CONTACTS</small><b>{state.targets.length+state.fighters.length}</b></div>
      <div className="headstat"><small>SCORE</small><b>{state.score.toLocaleString()}</b></div>
      <button onClick={()=>window.close()}>✕ CLOSE RADAR</button>
    </header>

    <div className="referenceRadarBody">
      <aside className="radarTools">
        <h3>MAP VIEW</h3>
        <button onClick={()=>setZoom(z=>clamp(z*1.18,.65,4))}>＋ ZOOM IN</button>
        <button onClick={()=>setZoom(z=>clamp(z*.85,.65,4))}>− ZOOM OUT</button>
        <button onClick={reset}>↺ RESET VIEW</button>

        <h3>OVERLAYS</h3>
        {[
          ['aircraft','AIRCRAFT'],
          ['trails','GHOST TRAILS'],
          ['headings','HEADING BUGS'],
          ['qra','QRA BASES']
        ].map(([key,label])=>
          <button className="layer" key={key}
            onClick={()=>setLayers(l=>({...l,[key]:!l[key]}))}>
            <i className={layers[key]?'on':''}/> {label}
          </button>
        )}

        <section className="radarLegend" aria-label="Map legend">
          <h3>LEGEND</h3>
          <span><b className="legendBlue">■</b> RAF AIRCRAFT</span>
          <span><b className="legendRed">■</b> UNKNOWN / HOSTILE</span>
          <span><b className="legendCivil">●</b> CIVILIAN TRAFFIC — AIRLINERS / GA</span>
          <span><b className="legendQra">▣</b> QRA BASE</span>
          <span><b className="legendLine">—</b> HEADING / TRAIL</span>
        </section>

        <div className="radarScale">
          VIEW<br/><b>{zoom.toFixed(1)}×</b>
          <hr/>
          DRAG TO PAN<br/>
          WHEEL TO ZOOM
        </div>
      </aside>

      <main className="referenceRadarViewport"
        onWheel={wheel}
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={up}
        onMouseLeave={up}>

        <div className="referenceRadarCanvas"
          style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
          <AccurateCoast />

          {layers.aircraft && state.targets.map(p=>
            <Contact
              key={p.id}
              p={p}
              compact
              selected={p.id===state.selected}
              onClick={()=>{}}
            />
          )}

          {layers.aircraft && state.fighters.map(p=>
            <Contact
              key={p.id}
              p={{...p,cls:'FRIENDLY'}}
              friendly
              compact
              selected={p.id===state.selectedF}
              onClick={()=>{}}
            />
          )}

          {layers.aircraft && state.tanker &&
            <Contact
              p={{...state.tanker,id:'TANSOR10',name:'TANSOR 10',cls:'FRIENDLY'}}
              friendly
              compact
              selected={false}
              onClick={()=>{}}
            />
          }

          {layers.trails && state.targets.map(p=>
            <div key={'trail-'+p.id}
              className="liveTrail"
              style={{
                left:p.x+'%',
                top:p.y+'%',
                transform:`rotate(${p.h||0}deg)`
              }}
            />
          )}

          {layers.headings && state.targets.map(p=>
            <div key={'heading-'+p.id}
              className="headingBug"
              style={{
                left:p.x+'%',
                top:p.y+'%',
                transform:`rotate(${p.h||0}deg)`
              }}
            />
          )}

          {layers.headings && state.fighters.map(p=>
            <div key={'fheading-'+p.id}
              className="headingBug friendlyBug"
              style={{
                left:p.x+'%',
                top:p.y+'%',
                transform:`rotate(${p.h||0}deg)`
              }}
            />
          )}

          {layers.qra && bases.map(b=>
            <div key={b.id}
              className="referenceQra"
              style={{left:b.x+'%',top:b.y+'%'}}
            >▣ <span>{b.name.split(' ·')[0].replace('RAF ','')}</span></div>
          )}
        </div>

        <div className="referenceZoomControls">
          <button onClick={()=>setZoom(z=>clamp(z*1.2,.65,4))}>+</button>
          <button onClick={()=>setZoom(z=>clamp(z*.83,.65,4))}>−</button>
          <button onClick={reset}>↺</button>
        </div>

      </main>
    </div>
  </div>;
}

function App(){
 const [state,update]=useSharedState();const view=new URLSearchParams(location.search).get('view')||'control';const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});const [assist,setAssist]=useState(true);const [layers,setLayers]=useState({aircraft:true,qra:true,trails:true,headings:true});
 useEffect(()=>{if(view!=='control'||!state.running)return;const id=setInterval(()=>update(st=>{const now=st.elapsed+1;const airborne=[],emergencies=[],movement=.002;const fighters=st.fighters.map(p=>{if(p.scrambleAt!=null&&!p.airborne&&now-p.scrambleAt>=p.scrambleDelay){airborne.push(p.name);return {...p,airborne:true,status:'AIRBORNE — REQUESTING INSTRUCTIONS',s:450,alt:180};}if(p.status==='CREWING'&&now>=p.crewReadyAt)return {...p,status:'CREWED — AWAITING QRA WINDOW'};if(p.airborne&&p.failureAt!=null&&!p.emergency&&now>=p.failureAt){emergencies.push(p.name);return {...p,emergency:true,reheat:false,status:'EMERGENCY — REQUESTING RTB'};}if(!p.airborne)return p;const burn=fuelBurnPercentPerMinute(p);return {...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*movement),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*movement),fuel:Math.max(0,p.fuel-burn)};});const reports=[...airborne.map(x=>`${x}: AIRBORNE, REQUESTING INSTRUCTIONS`),...emergencies.map(x=>`${x}: EMERGENCY DECLARED, REQUESTING RETURN TO BASE`)];const radio=reports.length?[`${String(12+Math.floor(now/60)).padStart(2,'0')}:${String(24+now%60).padStart(2,'0')}Z  ${reports.join(' / ')}`,...st.radio].slice(0,9):st.radio;return {...st,elapsed:now,targets:st.targets.map(p=>({...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*movement),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*movement)})),fighters,radio}}),10000);return()=>clearInterval(id)},[view,state.running,update]);
 const openRadar=()=>window.open(location.pathname+'?view=radar','raf-intercept-radar','noopener,noreferrer');
 if(view==='radar')return <RadarMap state={state} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} assist={assist} layers={layers} setLayers={setLayers} full/>;
 return <WorkflowController state={state} update={update} onRadar={openRadar}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
