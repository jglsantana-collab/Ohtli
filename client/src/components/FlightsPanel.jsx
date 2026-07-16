import React, { useState } from 'react';
import { api } from '../api.js';

function fmtDateTime(date, time) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return time ? `${label} · ${time}` : label;
}

const emptyForm = {
  flight_number: '', airline: '', reservation_code: '',
  origin: '', destination: '',
  departure_date: '', departure_time: '', arrival_date: '', arrival_time: '',
  notes: ''
};

function FlightForm({ trip, flight, onDone, onCancel }) {
  const [form, setForm] = useState(flight ? {
    flight_number: flight.flight_number || '',
    airline: flight.airline || '',
    reservation_code: flight.reservation_code || '',
    origin: flight.origin || '',
    destination: flight.destination || '',
    departure_date: flight.departure_date || '',
    departure_time: flight.departure_time || '',
    arrival_date: flight.arrival_date || '',
    arrival_time: flight.arrival_time || '',
    notes: flight.notes || ''
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function lookup() {
    const num = form.flight_number.trim();
    if (!num) return;
    setLooking(true);
    setLookupMsg('');
    try {
      const { flight: found } = await api.lookupFlight(num);
      setForm((f) => ({
        ...f,
        airline: found.airline || f.airline,
        origin: found.origin || f.origin,
        destination: found.destination || f.destination,
        departure_date: found.departure_date || f.departure_date,
        departure_time: found.departure_time || f.departure_time,
        arrival_date: found.arrival_date || f.arrival_date,
        arrival_time: found.arrival_time || f.arrival_time
      }));
      setLookupMsg('✓ Datos completados automáticamente');
    } catch (err) {
      setLookupMsg(err.status === 501 ? 'Autocompletado no configurado — captura los datos a mano' : err.message);
    } finally {
      setLooking(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, flight_number: form.flight_number.trim() };
      if (flight) await api.updateFlight(flight.id, body);
      else await api.addFlight(trip.id, body);
      onDone();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card glass flight-form" onSubmit={submit}>
      <label>
        Número de vuelo
        <input
          value={form.flight_number}
          onChange={set('flight_number')}
          onBlur={lookup}
          placeholder="Ej. AM123"
          required
          autoFocus
        />
      </label>
      <div className="flight-lookup-row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={lookup} disabled={looking || !form.flight_number.trim()}>
          {looking ? 'Buscando…' : '🔎 Buscar vuelo'}
        </button>
        {lookupMsg && <span className="muted">{lookupMsg}</span>}
      </div>

      <div className="form-row">
        <label>
          Aerolínea
          <input value={form.airline} onChange={set('airline')} placeholder="Ej. Aeroméxico" />
        </label>
        <label>
          Código de reservación
          <input value={form.reservation_code} onChange={set('reservation_code')} placeholder="Ej. ABC123" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Origen
          <input value={form.origin} onChange={set('origin')} placeholder="Aeropuerto de salida" />
        </label>
        <label>
          Destino
          <input value={form.destination} onChange={set('destination')} placeholder="Aeropuerto de llegada" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Salida — fecha
          <input type="date" value={form.departure_date} onChange={set('departure_date')} />
        </label>
        <label>
          Salida — hora
          <input type="time" value={form.departure_time} onChange={set('departure_time')} />
        </label>
      </div>

      <div className="form-row">
        <label>
          Llegada — fecha
          <input type="date" value={form.arrival_date} onChange={set('arrival_date')} />
        </label>
        <label>
          Llegada — hora
          <input type="time" value={form.arrival_time} onChange={set('arrival_time')} />
        </label>
      </div>

      <label>
        Notas
        <input value={form.notes} onChange={set('notes')} placeholder="Asientos, equipaje, etc." />
      </label>

      <div className="place-edit-actions">
        <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Guardando…' : 'Guardar vuelo'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function FlightsPanel({ trip, onChanged }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const flights = trip.flights || [];

  function done() {
    setShowForm(false);
    setEditing(null);
    onChanged();
  }

  async function remove(flight) {
    if (!confirm(`¿Quitar el vuelo ${flight.flight_number}?`)) return;
    try {
      await api.deleteFlight(flight.id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="flights-section">
      <div className="section-head">
        <h3>✈️ Vuelos</h3>
        {!showForm && !editing && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(true)}>＋ Agregar vuelo</button>
        )}
      </div>

      {showForm && <FlightForm trip={trip} onDone={done} onCancel={() => setShowForm(false)} />}
      {editing && <FlightForm trip={trip} flight={editing} onDone={done} onCancel={() => setEditing(null)} />}

      {flights.length === 0 && !showForm ? (
        <p className="muted">Aún no has agregado vuelos.</p>
      ) : (
        <div className="flight-list">
          {flights.map((f) => (
            <div key={f.id} className="flight-card glass">
              <div className="flight-card-main" onClick={() => setEditing(editing?.id === f.id ? null : f)}>
                <div className="flight-code">
                  <span className="flight-number">✈️ {f.flight_number}</span>
                  {f.airline && <span className="muted">{f.airline}</span>}
                </div>
                <div className="flight-route">
                  <span>{f.origin || '¿?'}</span>
                  <span className="flight-arrow">→</span>
                  <span>{f.destination || '¿?'}</span>
                </div>
                <div className="flight-times">
                  {f.departure_date && <span className="tag tag-date">🛫 {fmtDateTime(f.departure_date, f.departure_time)}</span>}
                  {f.arrival_date && <span className="tag tag-date">🛬 {fmtDateTime(f.arrival_date, f.arrival_time)}</span>}
                  {f.reservation_code && <span className="tag">🎫 {f.reservation_code}</span>}
                </div>
              </div>
              <button className="btn-icon" title="Quitar vuelo" onClick={() => remove(f)}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
