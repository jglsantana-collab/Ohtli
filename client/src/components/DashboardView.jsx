import React, { useEffect, useState } from 'react';
import { CATEGORIES } from '../categories.js';
import FlightsPanel from './FlightsPanel.jsx';

function parseISO(iso, endOfDay = false) {
  const [y, m, d] = iso.split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
}

function diffParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Countdown({ trip, onGoCalendar }) {
  const now = useNow();

  if (!trip.start_date || !trip.end_date) {
    return (
      <div className="countdown-card glass">
        <p className="countdown-label">🗓️ Todavía no tienes fechas para este viaje</p>
        <button className="btn btn-primary" onClick={onGoCalendar}>Definir fechas en el Calendario</button>
      </div>
    );
  }

  const start = parseISO(trip.start_date);
  const end = parseISO(trip.end_date, true);

  let phase, target, label;
  if (now < start) { phase = 'before'; target = start; label = `Faltan para tu viaje a ${trip.city.split(',')[0]}`; }
  else if (now <= end) { phase = 'during'; target = end; label = '¡Ya estás de viaje! Tiempo restante'; }
  else { phase = 'after'; }

  if (phase === 'after') {
    const endedDays = Math.floor((now - end) / 86400000);
    return (
      <div className="countdown-card glass countdown-ended">
        <p className="countdown-label">🏁 Viaje finalizado</p>
        <p className="countdown-sub">Terminó hace {endedDays === 0 ? 'hoy' : `${endedDays} día${endedDays === 1 ? '' : 's'}`}</p>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = diffParts(target - now);

  return (
    <div className={`countdown-card glass countdown-${phase}`}>
      <p className="countdown-label">{phase === 'before' ? '🧳' : '🌴'} {label}</p>
      <div className="countdown-digits">
        <div className="countdown-unit"><span>{days}</span><small>días</small></div>
        <div className="countdown-unit"><span>{String(hours).padStart(2, '0')}</span><small>hrs</small></div>
        <div className="countdown-unit"><span>{String(minutes).padStart(2, '0')}</span><small>min</small></div>
        <div className="countdown-unit"><span>{String(seconds).padStart(2, '0')}</span><small>seg</small></div>
      </div>
    </div>
  );
}

export default function DashboardView({ trip, onChanged, onGoCalendar }) {
  const tripDays = trip.start_date && trip.end_date
    ? Math.round((parseISO(trip.end_date) - parseISO(trip.start_date)) / 86400000) + 1
    : null;

  const byCategory = CATEGORIES
    .map((c) => ({ ...c, count: trip.places.filter((p) => p.category === c.id).length }))
    .filter((c) => c.count > 0);

  return (
    <div className="dashboard-wrap">
      <Countdown trip={trip} onGoCalendar={onGoCalendar} />

      <div className="stat-row">
        <div className="stat-card glass">
          <span className="stat-value">{trip.places.length}</span>
          <span className="stat-label">📍 Lugares</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-value">{tripDays ?? '—'}</span>
          <span className="stat-label">📅 Días</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-value">{trip.members.length}</span>
          <span className="stat-label">👥 Personas</span>
        </div>
        <div className="stat-card glass">
          <span className="stat-value">{trip.flights?.length || 0}</span>
          <span className="stat-label">✈️ Vuelos</span>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="chip-row">
          {byCategory.map((c) => (
            <span key={c.id} className="chip" style={{ borderColor: c.color }}>
              {c.emoji} {c.label} ({c.count})
            </span>
          ))}
        </div>
      )}

      <FlightsPanel trip={trip} onChanged={onChanged} />
    </div>
  );
}
