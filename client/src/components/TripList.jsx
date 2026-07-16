import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { geocodeCity, getMapsKey } from '../maps.js';
import { TRIP_THEMES, themeById } from '../themes.js';

// Ciudades sugeridas con coordenadas (funcionan sin clave de Google)
const CITY_PRESETS = [
  { name: 'Mazatlán, Sinaloa, México', lat: 23.2494, lng: -106.4111 },
  { name: 'Ciudad de México, México', lat: 19.4326, lng: -99.1332 },
  { name: 'Guadalajara, Jalisco, México', lat: 20.6597, lng: -103.3496 },
  { name: 'Cancún, Quintana Roo, México', lat: 21.1619, lng: -86.8515 },
  { name: 'Oaxaca de Juárez, México', lat: 17.0732, lng: -96.7266 }
];

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TripList({ user, onOpenTrip }) {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: 'Viaje a Mazatlán',
    city: CITY_PRESETS[0].name,
    start_date: '',
    end_date: '',
    theme: 'playa'
  });
  const [customCity, setCustomCity] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.trips().then((d) => setTrips(d.trips)).catch((e) => setError(e.message));
  }, []);

  async function createTrip(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let coords = CITY_PRESETS.find((c) => c.name === form.city);
      if (!coords) {
        if (!getMapsKey()) {
          throw new Error('Para una ciudad personalizada necesitas configurar la clave de Google Maps (⚙️), o elige una ciudad de la lista.');
        }
        const g = await geocodeCity(form.city);
        coords = { lat: g.lat, lng: g.lng };
      }
      const { trip } = await api.createTrip({
        name: form.name,
        city: form.city,
        lat: coords.lat,
        lng: coords.lng,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        theme: form.theme
      });
      setTrips((t) => [trip, ...(t || [])]);
      setShowForm(false);
      onOpenTrip(trip.id, trip.theme);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTrip(trip) {
    if (!confirm(`¿Eliminar el viaje "${trip.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteTrip(trip.id);
      setTrips((t) => t.filter((x) => x.id !== trip.id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Mis viajes</h2>
          <p className="muted">Hola {user.name} 👋 · Planifica, guarda lugares y comparte con tu gente.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '✈️ Nuevo viaje'}
        </button>
      </div>

      {error && <div className="form-error">⚠️ {error}</div>}

      {showForm && (
        <form className="card glass trip-form" onSubmit={createTrip}>
          <h3>Nuevo viaje</h3>
          <label>
            Nombre del viaje
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Vacaciones familiares"
              required
            />
          </label>
          <label>
            Ciudad destino
            {customCity ? (
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Escribe la ciudad (requiere clave de Google)"
                required
              />
            ) : (
              <select
                value={form.city}
                onChange={(e) => {
                  if (e.target.value === '__custom__') { setCustomCity(true); setForm((f) => ({ ...f, city: '' })); }
                  else setForm((f) => ({ ...f, city: e.target.value }));
                }}
              >
                {CITY_PRESETS.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                <option value="__custom__">Otra ciudad…</option>
              </select>
            )}
          </label>
          <label>
            Temática del viaje
            <div className="theme-picker">
              {TRIP_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-chip${form.theme === t.id ? ' active' : ''}`}
                  title={t.desc}
                  onClick={() => setForm((f) => ({ ...f, theme: t.id }))}
                >
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </label>
          <div className="form-row">
            <label>
              Fecha de inicio
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </label>
            <label>
              Fecha de fin
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Creando…' : 'Crear viaje'}
          </button>
        </form>
      )}

      {trips === null ? (
        <div className="center-block"><div className="spinner" /></div>
      ) : trips.length === 0 && !showForm ? (
        <div className="empty-state glass">
          <span className="empty-emoji">🏖️</span>
          <h3>Aún no tienes viajes</h3>
          <p>Crea tu primer viaje — te sugerimos empezar con Mazatlán.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>✈️ Crear mi primer viaje</button>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => (
            <div key={trip.id} className="trip-card glass" onClick={() => onOpenTrip(trip.id, trip.theme)}>
              <div className="trip-card-head">
                <h3>
                  {trip.name}
                  {trip.theme && trip.theme !== 'default' && (
                    <span className="trip-theme-chip" title={`Temática: ${themeById(trip.theme).name}`}>
                      {themeById(trip.theme).emoji}
                    </span>
                  )}
                </h3>
                {trip.owner_id === user.id && (
                  <button
                    className="btn-icon"
                    title="Eliminar viaje"
                    onClick={(e) => { e.stopPropagation(); removeTrip(trip); }}
                  >🗑️</button>
                )}
              </div>
              <p className="trip-city">📍 {trip.city}</p>
              {(trip.start_date || trip.end_date) && (
                <p className="trip-dates">📅 {fmtDate(trip.start_date) || '¿?'} — {fmtDate(trip.end_date) || '¿?'}</p>
              )}
              <div className="trip-meta">
                <span>🗺️ {trip.place_count ?? 0} lugares</span>
                <span>👥 {trip.member_count ?? 1}</span>
                {trip.owner_id !== user.id && <span className="badge">Compartido contigo</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
