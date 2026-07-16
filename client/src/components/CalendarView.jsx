import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { categoryById } from '../categories.js';

const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function buildDayRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  const d = parseISO(start);
  const last = parseISO(end);
  while (d <= last) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// Calendario por días del viaje: cada día es una columna grande donde los
// lugares se arrastran (drag & drop) y se ordenan por la hora que se les da.
export default function CalendarView({ trip, onChanged }) {
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [savingDates, setSavingDates] = useState(false);
  const [dateForm, setDateForm] = useState({ start_date: trip.start_date || '', end_date: trip.end_date || '' });

  const days = useMemo(() => buildDayRange(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);

  const byDate = useMemo(() => {
    const map = {};
    for (const p of trip.places) {
      if (!p.planned_date) continue;
      (map[p.planned_date] ||= []).push(p);
    }
    return map;
  }, [trip.places]);

  const unscheduled = trip.places.filter((p) => !p.planned_date);
  const todayISO = toISO(new Date());

  async function saveDates(e) {
    e.preventDefault();
    if (!dateForm.start_date || !dateForm.end_date) return;
    setSavingDates(true);
    try {
      await api.updateTrip(trip.id, dateForm);
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingDates(false);
    }
  }

  async function assignDate(placeId, iso, extra = {}) {
    try {
      await api.updatePlace(placeId, { planned_date: iso, ...extra });
      setSelectedPlace(null);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  async function clearDate(place) {
    try {
      await api.updatePlace(place.id, { planned_date: null, planned_time: null });
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateTime(place, value) {
    try {
      await api.updatePlace(place.id, { planned_time: value || null });
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  function appendToDay(placeId, iso) {
    const dayItems = byDate[iso] || [];
    const maxOrder = dayItems.reduce((m, p) => Math.max(m, p.sort_order || 0), 0);
    return assignDate(placeId, iso, { sort_order: maxOrder + 1 });
  }

  async function insertBefore(placeId, target) {
    if (placeId === target.id) return;
    const iso = target.planned_date;
    const moving = trip.places.find((p) => p.id === placeId);
    if (!moving) return;
    const rest = (byDate[iso] || []).filter((p) => p.id !== placeId);
    const idx = rest.findIndex((p) => p.id === target.id);
    rest.splice(idx, 0, moving);
    try {
      await Promise.all(rest.map((p, i) =>
        api.updatePlace(p.id, { planned_date: iso, sort_order: i, planned_time: p.id === placeId ? (moving.planned_time || null) : p.planned_time })
      ));
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleDragStart(e, place) {
    setDraggingId(place.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(place.id));
  }
  function handleDragEnd() {
    setDraggingId(null);
    setDragOverDay(null);
  }
  function handleDayDragOver(e, iso) {
    e.preventDefault();
    setDragOverDay(iso);
  }
  function handleDayDrop(e, iso) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain')) || draggingId;
    setDragOverDay(null);
    if (id) appendToDay(id, iso);
  }
  function handleItemDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleItemDrop(e, place) {
    e.preventDefault();
    e.stopPropagation();
    const id = Number(e.dataTransfer.getData('text/plain')) || draggingId;
    setDragOverDay(null);
    if (id) insertBefore(id, place);
  }

  if (!trip.start_date || !trip.end_date) {
    return (
      <div className="calendar-wrap">
        <div className="empty-state glass">
          <span className="empty-emoji">🗓️</span>
          <h3>Define las fechas de tu viaje</h3>
          <p>Para acomodar horarios día por día primero necesitas la fecha de inicio y fin.</p>
          <form className="trip-dates-form" onSubmit={saveDates}>
            <label>
              Inicio
              <input type="date" value={dateForm.start_date} onChange={(e) => setDateForm((f) => ({ ...f, start_date: e.target.value }))} required />
            </label>
            <label>
              Fin
              <input type="date" value={dateForm.end_date} min={dateForm.start_date || undefined} onChange={(e) => setDateForm((f) => ({ ...f, end_date: e.target.value }))} required />
            </label>
            <button className="btn btn-primary" disabled={savingDates}>{savingDates ? 'Guardando…' : 'Guardar fechas'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-wrap">
      {unscheduled.length > 0 && (
        <div className="unscheduled glass">
          <p className="unscheduled-title">
            🕓 Sin agendar ({unscheduled.length}) — arrastra un lugar a un día, o
            {selectedPlace
              ? <> haz clic en un día para agendar <strong>{selectedPlace.name}</strong> <button className="link" onClick={() => setSelectedPlace(null)}>cancelar</button></>
              : ' selecciona uno y luego haz clic en un día'}
          </p>
          <div className="chip-row">
            {unscheduled.map((p) => {
              const cat = categoryById(p.category);
              return (
                <button
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p)}
                  onDragEnd={handleDragEnd}
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

      <div className="day-columns">
        {days.map((day) => {
          const iso = toISO(day);
          const items = byDate[iso] || [];
          const dayIndex = days.findIndex((d) => toISO(d) === iso) + 1;
          return (
            <div
              key={iso}
              className={[
                'day-card glass',
                iso === todayISO ? 'today' : '',
                dragOverDay === iso ? 'drag-over' : '',
                selectedPlace ? 'assignable' : ''
              ].join(' ')}
              onDragOver={(e) => handleDayDragOver(e, iso)}
              onDragLeave={() => setDragOverDay((d) => (d === iso ? null : d))}
              onDrop={(e) => handleDayDrop(e, iso)}
              onClick={() => selectedPlace && appendToDay(selectedPlace.id, iso)}
            >
              <div className="day-card-head">
                <span className="day-card-badge">Día {dayIndex}</span>
                <div>
                  <h3>{WEEKDAYS_LONG[day.getDay()]}</h3>
                  <p className="muted">{day.getDate()} {MONTHS_SHORT[day.getMonth()]}</p>
                </div>
              </div>

              <div className="day-card-body">
                {items.length === 0 && (
                  <p className="day-empty muted">Arrastra lugares aquí</p>
                )}
                {items.map((p) => {
                  const cat = categoryById(p.category);
                  return (
                    <div
                      key={p.id}
                      className={`day-item ${draggingId === p.id ? 'dragging' : ''}`}
                      style={{ borderColor: cat.color }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, p)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleItemDragOver}
                      onDrop={(e) => handleItemDrop(e, p)}
                    >
                      <span className="day-item-handle">⋮⋮</span>
                      <input
                        type="time"
                        className="day-item-time"
                        value={p.planned_time || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTime(p, e.target.value)}
                      />
                      <span className="day-item-emoji">{cat.emoji}</span>
                      <span className="day-item-name">{p.name}</span>
                      <button
                        className="btn-icon day-item-remove"
                        title="Quitar del día"
                        onClick={(e) => { e.stopPropagation(); clearDate(p); }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="cal-legend muted">
        Arrastra un lugar entre días para moverlo, o suéltalo sobre otro lugar para reordenar. Ponle hora con el reloj de cada tarjeta.
      </p>
    </div>
  );
}
