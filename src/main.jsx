import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import radarReference from './assets/radar-reference.png';

const V='2.2.3';
// Typhoon simulation model (gameplay approximations based on public performance data).
// Internal game units: fuel is % of a notional 4,500 kg internal fuel load.
// External tanks/AAR are represented separately. Burn varies with speed and manoeuvre.
const TYPHOON = {
  internalFuelKg: 4500,
  maxSpeedKt: 760,
  maxAltitudeFt: 55000,
  cruiseBurnKgMin: 32,
  combatBurnKgMin: 58,
  climbRateFtMin: 3200,
  descentRateFtMin: 5000
};
const FUEL_PER_MIN = 100/(TYPHOON.internalFuelKg/TYPHOON.cruiseBurnKgMin);
const climbMinutes = (fromFt,toFt) => {
  const delta=Math.max(0,toFt-fromFt);
  return delta/TYPHOON.climbRateFtMin;
};
const scrambleDelayMinutes = () => {
  // Triangular distribution: 3–5 minutes, mode/mean pulled toward 4.
  const a=3,b=5,m=4;
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
const bases=[{id:'CON',name:'CONINGSBY',x:25,y:72},{id:'LOS',name:'LOSSIEMOUTH',x:17,y:24},{id:'LEU',name:'LEUCHARS',x:25,y:45}];
const seedTargets=[
{id:'H178',name:'HOSTILE 178',x:48,y:57,h:70,s:380,alt:220,cls:'HOSTILE',source:'RADAR'},
{id:'U457',name:'UNKNOWN 457',x:51,y:22,h:245,s:420,alt:280,cls:'UNKNOWN',source:'RADAR'},
{id:'U391',name:'UNKNOWN 391',x:68,y:43,h:230,s:410,alt:260,cls:'UNKNOWN',source:'RADAR'},
{id:'U722',name:'UNKNOWN 722',x:51,y:39,h:90,s:400,alt:240,cls:'UNKNOWN',source:'RADAR'},
{id:'S61',name:'SAS61W',x:39,y:24,h:160,s:460,alt:360,cls:'CIVIL',source:'ADS-B'},
{id:'F55',name:'FIN55A',x:73,y:28,h:215,s:460,alt:360,cls:'CIVIL',source:'ADS-B'}];
const seedFighters=[
{id:'TY21',name:'TYPHOON 21',x:25,y:72,h:45,s:480,alt:180,fuel:100,airborne:false,base:'CON'},
{id:'TY11',name:'TYPHOON 11',x:17,y:24,h:180,s:480,alt:180,fuel:100,airborne:false,base:'LOS'},
{id:'TY41',name:'TYPHOON 41',x:25,y:45,h:45,s:480,alt:180,fuel:100,airborne:false,base:'LEU'}];

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
 if(!data)return <div className="mapLoading"><img className="radar-v2-bg" src="/assets/radar-v2-background.png" alt="" draggable="false" />LOADING 10M COASTLINE DATA…</div>;
 return <svg className="geoMap" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="North Sea tactical map">{data.features.filter(f=>wanted.has(f.properties?.ADMIN)).map((f,i)=><path key={i} className={'country '+(f.properties.ADMIN==='United Kingdom'?'countryUK':'')} d={geometryPath(f.geometry)}/>)}</svg>;
}

const initial={targets:seedTargets,fighters:seedFighters,selected:'U457',selectedF:'TY21',notes:{},score:1250,running:true,elapsed:0,events:['12:24:12Z  UNKNOWN 457 DETECTED','12:22:45Z  TYPHOON 21 SCRAMBLED','12:22:30Z  HOSTILE 178 DETECTED','12:21:05Z  VOYAGER 01 CHECK IN']};
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('raf-intercept-v11'):null;
function sendState(state){try{localStorage.setItem('raf-intercept-state',JSON.stringify(state));}catch{} try{channel?.postMessage(state)}catch{}}
function useSharedState(){
 const [state,setState]=useState(()=>{try{return JSON.parse(localStorage.getItem('raf-intercept-state'))||initial}catch{return initial}});
 useEffect(()=>{const onStorage=e=>{if(e.key==='raf-intercept-state'&&e.newValue)try{setState(JSON.parse(e.newValue))}catch{}};const onMsg=e=>e.data&&setState(e.data);addEventListener('storage',onStorage);channel?.addEventListener('message',onMsg);return()=>{removeEventListener('storage',onStorage);channel?.removeEventListener('message',onMsg)}} ,[]);
 const update=fn=>setState(prev=>{const next=fn(prev);sendState(next);return next});
 return [state,update];
}
function Contact({p,friendly=false,selected,onClick,compact=false}){return <button className={'contact '+(friendly?'friendly ':'')+(p.cls==='HOSTILE'?'hostile ':'')+(selected?'selected':'')} style={{left:p.x+'%',top:p.y+'%'}} onClick={e=>{e.stopPropagation();onClick()}}><span className="bug" style={{transform:`rotate(${p.h}deg)`}}/><span className="sym" aria-label={friendly?'RAF aircraft':p.cls==='HOSTILE'?'Hostile aircraft':'Unknown aircraft'}/>{!compact&&<span className="lbl">{p.name}<br/>FL{p.alt} {p.s}KT<br/>HDG {String(p.h).padStart(3,'0')}°</span>}</button>}
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
        <h3>RADAR</h3>
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

          <img
            className="referenceRadarImage"
            src={radarReference}
            alt="RAF radar display"
            draggable="false"
          />

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
            >▣</div>
          )}
        </div>

        <div className="referenceZoomControls">
          <button onClick={()=>setZoom(z=>clamp(z*1.2,.65,4))}>+</button>
          <button onClick={()=>setZoom(z=>clamp(z*.83,.65,4))}>−</button>
          <button onClick={reset}>↺</button>
        </div>

        <div className="referenceLegend">
          <span><b className="legendBlue">■</b> RAF</span>
          <span><b className="legendRed">■</b> UNKNOWN / HOSTILE</span>
          <span><b>▣</b> QRA</span>
        </div>
      </main>
    </div>
  </div>;
}

function App(){
 const [state,update]=useSharedState();const view=new URLSearchParams(location.search).get('view')||'control';const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});const [assist,setAssist]=useState(true);const [layers,setLayers]=useState({aircraft:true,qra:true,waypoints:true,airways:true,rings:true,latlon:true});
 useEffect(()=>{if(view!=='control')return; if(!state.running)return; const id=setInterval(()=>update(st=>({...st,elapsed:st.elapsed+1,targets:st.targets.map(p=>({...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*.00012),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*.00012)})),fighters:st.fighters.map(p=>p.airborne?{...p,x:clamp(p.x+Math.sin(p.h*Math.PI/180)*p.s*.00012),y:clamp(p.y-Math.cos(p.h*Math.PI/180)*p.s*.00012),fuel:Math.max(0,p.fuel-.015)}:p)})),1000);return()=>clearInterval(id)},[view,state.running,update]);
 const openRadar=()=>window.open(location.pathname+'?view=radar','raf-intercept-radar','noopener,noreferrer');
 if(view==='radar')return <RadarMap state={state} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan} assist={assist} layers={layers} setLayers={setLayers} full/>;
 return <ControlPage state={state} update={update} onRadar={openRadar}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
