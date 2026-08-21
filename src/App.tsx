import { useEffect, useMemo, useState } from 'react'

type Aircraft = {
  id: string
  callsign: string
  x: number
  y: number
  heading: number
  speed: number
  altitude: number
  fuel: number
  friendly?: boolean
}

const initialTargets: Aircraft[] = [
  { id: 'T421', callsign: 'TRACK 421', x: 79, y: 28, heading: 235, speed: 420, altitude: 280, fuel: 100 },
  { id: 'T315', callsign: 'TRACK 315', x: 20, y: 67, heading: 35, speed: 390, altitude: 240, fuel: 100 },
]

const initialFighters: Aircraft[] = [
  { id: 'F21', callsign: 'TYPHOON 21', x: 57, y: 73, heading: 315, speed: 450, altitude: 250, fuel: 82, friendly: true },
  { id: 'F22', callsign: 'TYPHOON 22', x: 35, y: 40, heading: 90, speed: 450, altitude: 250, fuel: 64, friendly: true },
]

function destination(x: number, y: number, heading: number, speed: number, dt: number) {
  const scale = 0.00125
  const r = heading * Math.PI / 180
  return {
    x: x + Math.sin(r) * speed * dt * scale,
    y: y - Math.cos(r) * speed * dt * scale,
  }
}

function bearing(a: Aircraft, b: Aircraft) {
  const dx = b.x - a.x
  const dy = -(b.y - a.y)
  let deg = Math.atan2(dx, dy) * 180 / Math.PI
  if (deg < 0) deg += 360
  return Math.round(deg)
}

function distance(a: Aircraft, b: Aircraft) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2)
}

export default function App() {
  const [targets, setTargets] = useState(initialTargets)
  const [fighters, setFighters] = useState(initialFighters)
  const [selectedTarget, setSelectedTarget] = useState('T421')
  const [selectedFighter, setSelectedFighter] = useState('F21')
  const [vector, setVector] = useState(315)
  const [running, setRunning] = useState(true)
  const [score, setScore] = useState(0)
  const [message, setMessage] = useState('TRAINING: Select a track and fighter, then issue a vector.')
  const [assistance, setAssistance] = useState(true)

  const target = targets.find(t => t.id === selectedTarget)!
  const fighter = fighters.find(f => f.id === selectedFighter)!
  const range = distance(fighter, target) * 12
  const brg = bearing(fighter, target)
  const suggestedVector = useMemo(() => {
    const lead = Math.min(55, Math.max(8, range / 3))
    return Math.round((brg + (target.heading - brg) * lead / 55 + 360) % 360)
  }, [brg, range, target.heading])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      setTargets(ts => ts.map(t => {
        const p = destination(t.x, t.y, t.heading, t.speed, 1)
        return { ...t, x: p.x, y: p.y }
      }))
      setFighters(fs => fs.map(f => {
        const p = destination(f.x, f.y, f.heading, f.speed, 1)
        return { ...f, x: p.x, y: p.y, fuel: Math.max(0, f.fuel - 0.025) }
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [running])

  function issueVector() {
    const error = Math.abs(((vector - suggestedVector + 540) % 360) - 180)
    const points = Math.max(0, 100 - Math.round(error * 2))
    setScore(s => s + points)
    setFighters(fs => fs.map(f => f.id === selectedFighter ? { ...f, heading: vector } : f))
    setMessage(error <= 8
      ? `GOOD VECTOR. ${points} points awarded.`
      : `VECTOR ACCEPTED. ${points} points. Try to lead the target more effectively.`)
  }

  function reset() {
    setTargets(initialTargets)
    setFighters(initialFighters)
    setScore(0)
    setRunning(true)
    setMessage('TRAINING RESET.')
  }

  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">AIR DEFENCE TRAINING SYSTEM</div>
          <h1>RAF INTERCEPT <span>MVP</span></h1>
        </div>
        <div className="status"><b>SECTOR:</b> UK EAST <i>● LIVE</i></div>
      </header>

      <section className="layout">
        <div className="radar">
          <div className="rings" />
          <div className="crosshair" />
          <div className="north">N</div>
          {targets.map(t => (
            <button key={t.id} className={`contact target ${selectedTarget===t.id?'selected':''}`}
              style={{left:`${t.x}%`, top:`${t.y}%`}} onClick={() => setSelectedTarget(t.id)}>
              ◆
            </button>
          ))}
          {fighters.map(f => (
            <button key={f.id} className={`contact fighter ${selectedFighter===f.id?'selected':''}`}
              style={{left:`${f.x}%`, top:`${f.y}%`}} onClick={() => setSelectedFighter(f.id)}>
              ▲
            </button>
          ))}
          <div className="legend"><span>◆ UNKNOWN</span><span>▲ FRIENDLY</span></div>
        </div>

        <aside>
          <div className="panel">
            <h2>TRACK DATA</h2>
            <div className="big">{target.callsign}</div>
            <div className="grid">
              <label>BRG <strong>{bearing({x: fighter.x, y: fighter.y, heading:0, speed:0, altitude:0, fuel:0} as Aircraft, target).toString().padStart(3,'0')}°</strong></label>
              <label>RNG <strong>{range.toFixed(1)} NM</strong></label>
              <label>SPD <strong>{target.speed} KT</strong></label>
              <label>ALT <strong>FL{target.altitude}</strong></label>
              <label>HDG <strong>{target.heading.toString().padStart(3,'0')}°</strong></label>
              <label>STATUS <strong>UNKNOWN</strong></label>
            </div>
          </div>

          <div className="panel">
            <h2>QRA / FIGHTER</h2>
            <select value={selectedFighter} onChange={e=>setSelectedFighter(e.target.value)}>
              {fighters.map(f => <option key={f.id} value={f.id}>{f.callsign} — {Math.round(f.fuel)}% FUEL</option>)}
            </select>
            <div className="grid">
              <label>HDG <strong>{fighter.heading.toString().padStart(3,'0')}°</strong></label>
              <label>SPD <strong>{fighter.speed} KT</strong></label>
              <label>ALT <strong>FL{fighter.altitude}</strong></label>
              <label>FUEL <strong>{Math.round(fighter.fuel)}%</strong></label>
            </div>
          </div>

          <div className="panel command">
            <h2>VECTOR COMMAND</h2>
            <input type="range" min="0" max="359" value={vector} onChange={e=>setVector(Number(e.target.value))}/>
            <div className="vector"><span>VECTOR</span><strong>{vector.toString().padStart(3,'0')}°</strong></div>
            {assistance && <div className="hint">TRAINING HINT: Suggested vector {suggestedVector.toString().padStart(3,'0')}°</div>}
            <button className="primary" onClick={issueVector}>ISSUE VECTOR</button>
          </div>

          <div className="panel">
            <h2>CONTROLLER SCORE</h2>
            <div className="score">{score}</div>
            <p className="message">{message}</p>
            <label className="toggle"><input type="checkbox" checked={assistance} onChange={e=>setAssistance(e.target.checked)}/> Training assistance</label>
            <div className="actions">
              <button onClick={()=>setRunning(!running)}>{running?'PAUSE':'RESUME'}</button>
              <button onClick={reset}>RESET MISSION</button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
