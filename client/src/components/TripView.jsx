import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import PlacesList from './PlacesList.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import CalendarView from './CalendarView.jsx';
import MapView from './MapView.jsx';
import ShareView from './ShareView.jsx';

const TABS = [
  { id: 'lugares', label: '📋 Lugares' },
  { id: 'calendario', label: '📅 Calendario' },
  { id: 'mapa', label: '🗺️ Mapa' },
  { id: 'compartir', label: '👥 Compartir' }
];

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TripView({ tripId, user, mapsReady, onBack, onNeedKey }) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('lugares');
  const [showSearch, setShowSearch] = useState(false);

  const reload = useCallback(() => {
    api.trip(tripId)
      .then((d) => setTrip(d.trip))
      .catch((e) => setError(e.message));
  }, [tripId]);

  useEffect(() => { reload(); }, [reload]);

  // Refresca cada 20 s para ver lo que agregan otros miembros
  useEffect(() => {
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) {
    return (
      <div className="page">
        <button className="btn btn-ghost" onClick={onBack}>← Volver</button>
        <div className="form-error">⚠️ {error}</div>
      </div>
    );
  }

  if (!trip) return <div className="center-block"><div className="spinner" /></div>;

  return (
    <div className="page page-trip">
      <div className="trip-head">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Mis viajes</button>
        <div className="trip-head-info">
          <h2>{trip.name}</h2>
          <p className="muted">
            📍 {trip.city}
            {(trip.start_date || trip.end_date) && (
              <> · 📅 {fmtDate(trip.start_date) || '¿?'} — {fmtDate(trip.end_date) || '¿?'}</>
            )}
            {' '}· 👥 {trip.members.length} {trip.members.length === 1 ? 'persona' : 'personas'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSearch(true)}>＋ Agregar lugar</button>
      </div>

      <nav className="tabs glass">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'lugares' && (
        <PlacesList trip={trip} onChanged={reload} onAdd={() => setShowSearch(true)} />
      )}
      {tab === 'calendario' && (
        <CalendarView trip={trip} onChanged={reload} />
      )}
      {tab === 'mapa' && (
        <MapView trip={trip} mapsReady={mapsReady} onNeedKey={onNeedKey} />
      )}
      {tab === 'compartir' && (
        <ShareView trip={trip} user={user} onChanged={reload} />
      )}

      {showSearch && (
        <PlaceSearch
          trip={trip}
          mapsReady={mapsReady}
          onNeedKey={onNeedKey}
          onClose={() => setShowSearch(false)}
          onAdded={() => { reload(); }}
        />
      )}
    </div>
  );
}
