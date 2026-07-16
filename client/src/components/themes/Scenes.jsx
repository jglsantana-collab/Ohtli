import React, { useEffect, useRef, useState } from 'react';
import './themes.css';

// ---------- Motor de eventos aleatorios ----------
// Cada cierto tiempo (aleatorio) elige un evento del spec según su peso,
// lo agrega a la escena y lo retira cuando termina su animación.
function useRandomEvents(spec, { min = 3500, max = 9000, firstDelay = 800 } = {}) {
  const [events, setEvents] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    let alive = true;
    let timer;

    function spawn() {
      if (!alive) return;
      const total = spec.reduce((s, e) => s + e.weight, 0);
      let r = Math.random() * total;
      const chosen = spec.find((e) => (r -= e.weight) <= 0) || spec[0];
      const ev = { id: ++idRef.current, type: chosen.type, ...chosen.make() };
      setEvents((list) => [...list, ev]);
      setTimeout(() => {
        if (alive) setEvents((list) => list.filter((x) => x.id !== ev.id));
      }, ev.duration + 600);
      timer = setTimeout(spawn, min + Math.random() * (max - min));
    }

    timer = setTimeout(spawn, firstDelay);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return events;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const flip = () => (Math.random() < 0.5 ? 'ltr' : 'rtl');

// Contenedor que cruza la pantalla de lado a lado.
function Crosser({ ev, children }) {
  return (
    <div
      className={`actor cross-${ev.dir}`}
      style={{ top: `${ev.top}%`, animationDuration: `${ev.duration}ms`, zIndex: ev.z || 1 }}
    >
      <div className={ev.dir === 'ltr' ? 'sprite-flip' : undefined}>{children}</div>
    </div>
  );
}

// ---------- Sprites (miran hacia la izquierda por defecto) ----------

function Gull({ size = 42 }) {
  return (
    <svg className="gull" viewBox="0 0 60 26" width={size} height={size * 0.45} aria-hidden="true">
      <g className="gull-wings">
        <path d="M30 18 Q18 2 4 11" fill="none" stroke="#f1f5f9" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M30 18 Q42 2 56 11" fill="none" stroke="#e2e8f0" strokeWidth="3.4" strokeLinecap="round" />
      </g>
      <ellipse cx="30" cy="18" rx="5" ry="2.6" fill="#f8fafc" />
      <path d="M24 17 L19 18.5 L24 19.6 Z" fill="#f59e0b" />
    </svg>
  );
}

function Sailboat() {
  return (
    <svg className="boat-bob" viewBox="0 0 120 92" width="86" height="66" aria-hidden="true">
      <path d="M14 68 H106 L92 84 H28 Z" fill="#7c2d12" />
      <rect x="57" y="8" width="3.4" height="60" fill="#57310f" />
      <path d="M55 14 L55 64 L20 64 Z" fill="#f8fafc" />
      <path d="M64 22 L64 64 L98 64 Z" fill="#dbe7f0" />
      <path d="M55 12 L48 8 L55 6 Z" fill="#ef4444" />
    </svg>
  );
}

function Jetski() {
  return (
    <div className="jetski-wrap">
      <span className="jetski-spray" />
      <span className="jetski-spray spray-2" />
      <svg className="jetski-bounce" viewBox="0 0 120 64" width="88" height="47" aria-hidden="true">
        {/* piloto */}
        <circle cx="52" cy="16" r="7" fill="#fbbf24" />
        <path d="M46 22 Q40 34 48 40 L62 40 Q60 28 56 22 Z" fill="#1e293b" />
        <path d="M50 26 L34 32 L36 36 L52 32 Z" fill="#1e293b" />
        {/* moto */}
        <path d="M10 44 Q28 32 66 36 L104 42 Q114 45 108 52 L20 56 Q6 53 10 44 Z" fill="#ef4444" />
        <path d="M28 38 L38 30 L42 33 L34 40 Z" fill="#b91c1c" />
        <path d="M14 50 L104 48 L102 52 L20 54 Z" fill="#fca5a5" opacity="0.7" />
      </svg>
    </div>
  );
}

function Dolphin({ delay = 0, size = 64 }) {
  return (
    <svg
      className="dolphin-jump"
      style={{ animationDelay: `${delay}ms` }}
      viewBox="0 0 84 46" width={size} height={size * 0.55} aria-hidden="true"
    >
      <path d="M6 38 Q42 -2 78 38 Q42 20 6 38 Z" fill="#41627e" />
      <path d="M38 13 L44 2 L48 14 Z" fill="#41627e" />
      <path d="M72 34 L83 26 L81 40 Z" fill="#41627e" />
      <path d="M10 36 L2 33 L9 40 Z" fill="#41627e" />
    </svg>
  );
}

function Whale({ ev }) {
  return (
    <div className="evt-whale" style={{ left: `${ev.left}%`, top: `${ev.top}%` }}>
      <div className="whale-rise">
        <div className="whale-spout">
          <span /><span /><span />
        </div>
        <svg viewBox="0 0 220 92" width="180" height="76" aria-hidden="true">
          <path
            d="M8 90 Q26 34 88 28 Q152 24 172 62 L182 48 Q192 40 198 50 Q202 62 190 68 L178 74 Q150 90 8 90 Z"
            fill="#22384c"
          />
          <path d="M30 78 Q80 70 150 74 L146 82 Q70 86 32 84 Z" fill="#31536e" opacity="0.7" />
          <circle cx="52" cy="52" r="3" fill="#0b1622" />
        </svg>
      </div>
    </div>
  );
}

// Parvada de aves lejanas (siluetas "V") para la montaña.
function BirdFlock({ count = 4 }) {
  return (
    <div className="bird-flock">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} viewBox="0 0 30 12" width="22" height="9" style={{ margin: `0 ${4 + (i % 2) * 8}px`, animationDelay: `${i * 120}ms` }} className="bird-v" aria-hidden="true">
          <path d="M2 9 Q8 2 15 8 Q22 2 28 9" fill="none" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

function Balloon() {
  return (
    <svg className="balloon-drift" viewBox="0 0 60 90" width="52" height="78" aria-hidden="true">
      <path d="M30 4 C10 4 4 22 8 38 C12 52 22 60 26 66 H34 C38 60 48 52 52 38 C56 22 50 4 30 4 Z" fill="#f97316" />
      <path d="M30 4 C24 4 20 22 22 40 C23 54 26 62 28 66 H32 C34 62 37 54 38 40 C40 22 36 4 30 4 Z" fill="#fbbf24" />
      <path d="M24 66 L26 74 H34 L36 66 Z" fill="none" stroke="#78350f" strokeWidth="1.6" />
      <rect x="24" y="74" width="12" height="10" rx="2" fill="#92400e" />
    </svg>
  );
}

function Plane() {
  return (
    <div className="plane-wrap">
      <svg viewBox="0 0 90 30" width="64" height="21" aria-hidden="true">
        <path d="M6 16 Q40 10 70 12 L84 15 Q86 17 82 19 L14 22 Q4 20 6 16 Z" fill="#cbd5e1" />
        <path d="M40 13 L30 2 L38 2 L50 12 Z" fill="#94a3b8" />
        <path d="M44 18 L38 27 L44 27 L52 18 Z" fill="#94a3b8" />
        <path d="M76 12 L72 4 L78 5 L82 13 Z" fill="#e2e8f0" />
      </svg>
      <span className="plane-light" />
    </div>
  );
}

// ---------- Escena: PLAYA ----------

const BEACH_EVENTS = [
  {
    type: 'gull', weight: 30,
    make: () => ({ dir: flip(), top: rnd(5, 26), duration: rnd(13000, 22000), z: 3, count: 1 + Math.floor(Math.random() * 3) })
  },
  { type: 'boat', weight: 10, make: () => ({ dir: flip(), top: rnd(41.5, 44), duration: rnd(48000, 75000), z: 1 }) },
  { type: 'jetski', weight: 15, make: () => ({ dir: flip(), top: rnd(58, 68), duration: rnd(6000, 9500), z: 4 }) },
  { type: 'dolphins', weight: 13, make: () => ({ dir: flip(), top: rnd(54, 63), duration: rnd(15000, 21000), z: 2 }) },
  { type: 'whale', weight: 8, make: () => ({ left: rnd(12, 66), top: rnd(50, 56), duration: 9000 }) }
];

export function BeachScene() {
  const events = useRandomEvents(BEACH_EVENTS, { min: 3000, max: 8000 });

  return (
    <div className="scene scene-beach" aria-hidden="true">
      {/* Cielo y sol */}
      <div className="beach-sun"><span className="sun-core" /></div>
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />

      {/* Mar */}
      <div className="sea">
        <div className="sea-shimmer" />
        <div className="wave-band wave-band-1" />
        <div className="wave-band wave-band-2" />
      </div>

      {/* Arrecife bajo el agua, cerca de la orilla */}
      <svg className="reef" viewBox="0 0 300 90" aria-hidden="true">
        <ellipse cx="150" cy="72" rx="140" ry="16" fill="#0b3a52" opacity="0.55" />
        <path d="M60 74 Q58 48 70 42 Q66 56 76 52 Q72 66 84 62 L88 74 Z" fill="#c2557f" opacity="0.75" />
        <path d="M120 76 Q116 44 130 36 Q126 52 138 46 Q134 62 148 56 L150 76 Z" fill="#e17a5f" opacity="0.75" />
        <path d="M196 74 Q194 52 206 46 Q202 60 214 54 Q212 66 222 64 L224 74 Z" fill="#8f5fb3" opacity="0.7" />
        <circle cx="100" cy="72" r="10" fill="#155e75" />
        <circle cx="172" cy="74" r="13" fill="#134e63" />
        <circle cx="242" cy="72" r="9" fill="#155e75" />
        <path d="M158 70 Q160 56 166 52 M166 70 Q166 60 172 56" stroke="#3fbf8f" strokeWidth="3" fill="none" strokeLinecap="round" className="reef-algae" />
      </svg>

      {/* Espuma de las olas rompiendo en la arena */}
      <div className="sand" />
      <div className="wet-sand" />
      <div className="foam foam-1" />
      <div className="foam foam-2" />

      {/* Bañistas: chica en bikini y hombre asoleándose */}
      <svg className="sunbathers" viewBox="0 0 300 150" aria-hidden="true">
        {/* sombrilla (vista superior) */}
        <g className="parasol">
          <circle cx="52" cy="58" r="42" fill="#fda4af" />
          <path d="M52 16 A42 42 0 0 1 94 58 L52 58 Z" fill="#e11d48" />
          <path d="M52 100 A42 42 0 0 1 10 58 L52 58 Z" fill="#e11d48" />
          <circle cx="52" cy="58" r="5" fill="#7f1d1d" />
        </g>

        {/* toalla y chica en bikini */}
        <g>
          <rect x="122" y="26" width="58" height="112" rx="9" fill="#fb7185" />
          <rect x="122" y="40" width="58" height="8" fill="#fecdd3" opacity="0.8" />
          <rect x="122" y="112" width="58" height="8" fill="#fecdd3" opacity="0.8" />
          <g className="breathe">
            {/* cabello y cabeza */}
            <ellipse cx="151" cy="42" rx="13" ry="11" fill="#6d3a1e" />
            <circle cx="151" cy="46" r="8.5" fill="#eab08a" />
            {/* torso + brazos */}
            <path d="M141 55 Q151 52 161 55 L159 86 Q151 89 143 86 Z" fill="#eab08a" />
            <path d="M141 57 L134 84 L138 86 L144 62 Z" fill="#eab08a" />
            <path d="M161 57 L168 84 L164 86 L158 62 Z" fill="#eab08a" />
            {/* bikini top */}
            <path d="M142 60 Q151 66 160 60 L160 67 Q151 72 142 67 Z" fill="#e11d48" />
            {/* cadera + bikini bottom */}
            <path d="M143 86 Q151 84 159 86 L158 96 Q151 100 144 96 Z" fill="#eab08a" />
            <path d="M143 88 Q151 94 159 88 L157 97 Q151 101 145 97 Z" fill="#e11d48" />
            {/* piernas */}
            <path d="M145 97 L143 132 L149 132 L150 98 Z" fill="#eab08a" />
            <path d="M157 97 L159 132 L153 132 L152 98 Z" fill="#eab08a" />
          </g>
        </g>

        {/* toalla y hombre */}
        <g>
          <rect x="200" y="24" width="62" height="114" rx="9" fill="#38bdf8" />
          <rect x="200" y="38" width="62" height="8" fill="#bae6fd" opacity="0.8" />
          <rect x="200" y="114" width="62" height="8" fill="#bae6fd" opacity="0.8" />
          <g className="breathe breathe-slow">
            <circle cx="231" cy="42" r="9" fill="#d99668" />
            <path d="M226 36 Q231 30 236 36 Q233 33 226 36 Z" fill="#3b2314" />
            {/* torso descubierto */}
            <path d="M219 52 Q231 48 243 52 L241 90 Q231 94 221 90 Z" fill="#d99668" />
            <path d="M219 54 L211 84 L216 86 L222 60 Z" fill="#d99668" />
            <path d="M243 54 L251 84 L246 86 L240 60 Z" fill="#d99668" />
            {/* traje de baño */}
            <path d="M221 90 Q231 87 241 90 L240 104 Q231 108 222 104 Z" fill="#1d4ed8" />
            {/* piernas */}
            <path d="M223 104 L221 134 L228 134 L229 105 Z" fill="#d99668" />
            <path d="M239 104 L241 134 L234 134 L233 105 Z" fill="#d99668" />
          </g>
        </g>
      </svg>

      {/* Eventos aleatorios */}
      {events.map((ev) => {
        if (ev.type === 'whale') return <Whale key={ev.id} ev={ev} />;
        if (ev.type === 'gull') {
          return (
            <Crosser key={ev.id} ev={ev}>
              <div className="gull-group">
                {Array.from({ length: ev.count }).map((_, i) => (
                  <div key={i} style={{ marginLeft: i * 34, marginTop: (i % 2) * 16, animationDelay: `${i * 180}ms` }} className="gull-hover">
                    <Gull size={40 - i * 6} />
                  </div>
                ))}
              </div>
            </Crosser>
          );
        }
        if (ev.type === 'boat') return <Crosser key={ev.id} ev={ev}><Sailboat /></Crosser>;
        if (ev.type === 'jetski') return <Crosser key={ev.id} ev={ev}><Jetski /></Crosser>;
        if (ev.type === 'dolphins') {
          return (
            <Crosser key={ev.id} ev={ev}>
              <div className="dolphin-pod">
                <Dolphin delay={0} size={62} />
                <Dolphin delay={450} size={52} />
                <Dolphin delay={900} size={44} />
              </div>
            </Crosser>
          );
        }
        return null;
      })}

      <div className="scene-dim" />
    </div>
  );
}

// ---------- Escena: CIUDAD ----------

const CITY_EVENTS = [
  { type: 'plane', weight: 18, make: () => ({ dir: flip(), top: rnd(6, 20), duration: rnd(16000, 26000), z: 2 }) },
  { type: 'star', weight: 8, make: () => ({ dir: 'rtl', top: rnd(4, 18), duration: 2400, z: 1 }) }
];

export function CityScene() {
  const events = useRandomEvents(CITY_EVENTS, { min: 6000, max: 14000 });

  return (
    <div className="scene scene-city" aria-hidden="true">
      <div className="city-stars" />
      <div className="city-moon" />
      <div className="skyline skyline-back" />
      <div className="skyline skyline-front" />
      <div className="city-glow" />
      <div className="road">
        <span className="car-lights lights-white" />
        <span className="car-lights lights-red" />
      </div>

      {events.map((ev) => {
        if (ev.type === 'plane') return <Crosser key={ev.id} ev={ev}><Plane /></Crosser>;
        if (ev.type === 'star') {
          return (
            <div key={ev.id} className="shooting-star" style={{ top: `${ev.top}%`, left: `${rnd(20, 80)}%` }} />
          );
        }
        return null;
      })}

      <div className="scene-dim scene-dim-soft" />
    </div>
  );
}

// ---------- Escena: MONTAÑA ----------

const MOUNTAIN_EVENTS = [
  { type: 'birds', weight: 24, make: () => ({ dir: flip(), top: rnd(8, 30), duration: rnd(16000, 26000), z: 3 }) },
  { type: 'eagle', weight: 12, make: () => ({ dir: flip(), top: rnd(14, 34), duration: rnd(14000, 20000), z: 3 }) },
  { type: 'balloon', weight: 10, make: () => ({ dir: flip(), top: rnd(16, 38), duration: rnd(40000, 60000), z: 2 }) }
];

export function MountainScene() {
  const events = useRandomEvents(MOUNTAIN_EVENTS, { min: 5000, max: 12000 });

  return (
    <div className="scene scene-mountain" aria-hidden="true">
      <div className="mountain-sun" />
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <svg className="peaks peaks-back" viewBox="0 0 1200 320" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 320 L140 130 L230 210 L360 60 L470 200 L600 90 L730 230 L860 100 L980 210 L1100 140 L1200 220 L1200 320 Z" fill="#31445e" />
        <path d="M360 60 L400 115 L385 108 L370 122 L345 100 Z" fill="#dbe7f4" />
        <path d="M600 90 L636 140 L620 132 L606 146 L580 122 Z" fill="#dbe7f4" />
        <path d="M860 100 L894 148 L880 140 L866 154 L842 130 Z" fill="#dbe7f4" />
      </svg>
      <svg className="peaks peaks-front" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 260 L180 60 L330 190 L520 40 L700 200 L880 70 L1050 190 L1200 110 L1200 260 Z" fill="#1d2d44" />
        <path d="M520 40 L560 100 L544 92 L528 108 L500 82 Z" fill="#eef4fb" />
        <path d="M880 70 L916 122 L902 114 L888 128 L862 104 Z" fill="#eef4fb" />
      </svg>
      <div className="fog fog-1" />
      <div className="fog fog-2" />
      <svg className="pines" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const x = i * 52 + (i % 3) * 10;
          const h = 54 + (i % 4) * 14;
          return <path key={i} d={`M${x} 120 L${x + 14} ${120 - h} L${x + 28} 120 Z`} fill="#0e1c2e" />;
        })}
      </svg>

      {events.map((ev) => {
        if (ev.type === 'birds') return <Crosser key={ev.id} ev={ev}><BirdFlock /></Crosser>;
        if (ev.type === 'eagle') return <Crosser key={ev.id} ev={ev}><div className="gull-hover"><Gull size={54} /></div></Crosser>;
        if (ev.type === 'balloon') return <Crosser key={ev.id} ev={ev}><Balloon /></Crosser>;
        return null;
      })}

      <div className="scene-dim scene-dim-soft" />
    </div>
  );
}
