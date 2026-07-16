import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { categoryById } from '../categories.js';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Calendario mensual: muestra los lugares en su fecha planeada y permite
// asignar fecha a los pendientes con arrastrar-o-clic.
export default function CalendarView({ trip, onChanged }) {
  const initial = trip.start_date ? new Date(trip.start_date + 'T12:00:00') : new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedPlace, setSelectedPlace] = useState(null);

  const byDate = useMemo(() => {
    const map = {};
    for (const p of trip.places) {
      if (!p.planned_date) continue;
      (map[p.planned_date] ||= []).push(p);
    }
    return map;
  }, [trip.places]);

  const unscheduled = trip.places.filter((p) => !p.planned_date);

  const weeks = useMemo(() => {
    const first = new Date(cursor);
    const startOffset = (first.getDay() + 6) % 7; // lunes = 0
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    const out = [];
    const d = new Date(gridStart);
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        row.push(new Date(d));
        d.setDate(d.getDate() + 1);
      }
      out.push(row);
      if (d.getMonth() !== cursor.getMonth() && d > new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)) break;
    }
    return out;
  }, [cursor]);

  const inTripRange = (iso) => {
    if (!trip.start_date && !trip.end_date) return false;
    return (!trip.start_date || iso >= trip.start_date) && (!trip.end_date || iso <= trip.end_date);
  };

  async function assignDate(place, iso) {
    try {
      await api.updatePlace(place.id, { planned_date: iso, notes: place.notes });
      setSelectedPlace(null);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  async function clearDate(place) {
    try {
      await api.updatePlace(place.id, { planned_date: null, notes: place.notes });
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  const todayISO = toISO(new Date());

  return (
    <div className="calendar-wrap">
      {unscheduled.length > 0 && (
        <div className="unscheduled glass">
          <p className="unscheduled-title">
            🕓 Sin fecha ({unscheduled.length}) — {selectedPlace
              ? <>ahora haz clic en un día para agendar <strong>{selectedPlace.name}</strong> <button className="link" onClick={() => setSelectedPlace(null)}>cancelar</button></>
              : 'elige uno y luego un día del calendario'}
          </p>
          <div className="chip-row">
            {unscheduled.map((p) => {
              const cat = categoryById(p.category);
              return (
                <button
                  key={p.id}
                  className={`chip ${selectedPlace?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlace(selectedPlace?.id === p.id ? null : p)}
                >
                  {cat.emoji} {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="calendar glass">
        <div className="cal-head">
          <button className="btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
          <h3>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h3>
          <button className="btn-icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="cal-grid cal-weekdays">
          {WEEKDAYS.map((d, i) => <div key={i} className="cal-weekday">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div className="cal-grid" key={wi}>
            {week.map((day) => {
              const iso = toISO(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const items = byDate[iso] || [];
              return (
                <div
                  key={iso}
                  className={[
                    'cal-cell',
                    inMonth ? '' : 'out',
                    inTripRange(iso) ? 'in-trip' : '',
                    iso === todayISO ? 'today' : '',
                    selectedPlace ? 'assignable' : ''
                  ].join(' ')}
                  onClick={() => selectedPlace && assignDate(selectedPlace, iso)}
                  title={selectedPlace ? `Agendar "${selectedPlace.name}" el ${iso}` : undefined}
                >
                  <span className="cal-daynum">{day.getDate()}</span>
                  <div className="cal-items">
                    {items.map((p) => {
                      const cat = categoryById(p.category);
                      return (
                        <div
                          key={p.id}
                          className="cal-item"
                          style={{ borderColor: cat.color }}
                          title={`${p.name} — clic para quitar fecha`}
                          onClick={(e) => { e.stopPropagation(); if (confirm(`¿Quitar la fecha de "${p.name}"?`)) clearDate(p); }}
                        >
                          <span>{cat.emoji}</span> <span className="cal-item-name">{p.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <p className="cal-legend muted">
          Las celdas resaltadas son los días de tu viaje. Haz clic en un lugar agendado para quitarle la fecha.
        </p>
      </div>
    </div>
  );
}
