import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import PlacesList from './PlacesList.jsx';
import PlaceSearch from './PlaceSearch.jsx';
import CalendarView from './CalendarView.jsx';
import MapView from './MapView.jsx';
import ShareView from './ShareView.jsx';
import DashboardView from './DashboardView.jsx';
import DocumentsPanel from './DocumentsPanel.jsx';
import { TRIP_THEMES, themeById } from '../themes.js';

const TABS = [
  { id: 'resumen', label: '🧭 Resumen' },
  { id: 'lugares', label: '📋 Lugares' },
  { id: 'calendario', label: '📅 Calendario' },
  { id: 'mapa', label: '🗺️ Mapa' },
  { id: 'documentos', label: '📁 Documentos' },
  { id: 'compartir', label: '👥 Compartir' }
];

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TripView({ tripId, user, mapsReady, onBack, onNeedKey, onThemeChange }) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('resumen');
  const [showSearch, setShowSearch] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  const reload = useCallback(() => {
    api.trip(tripId)
      .then((d) => {
        setTrip(d.trip);
        onThemeChange?.(d.trip.theme || 'default');
      })
      .catch((e) => setError(e.message));
  }, [tripId, onThemeChange]);

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

  async function changeTheme(themeId) {
    if (themeId === trip.theme) { setShowThemePicker(false); return; }
    setSavingTheme(true);
    try {
      const { trip: updated } = await api.updateTrip(trip.id, { theme: themeId });
      setTrip(updated);
      onThemeChange?.(updated.theme || 'default');
      setShowThemePicker(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingTheme(false);
    }
  }

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
        <div className="trip-theme-control">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowThemePicker((v) => !v)}
            title="Cambiar temática del viaje"
          >
            {themeById(trip.theme).emoji} Temática
          </button>
          {showThemePicker && (
            <div className="theme-picker-popover glass">
              <div className="theme-picker">
                {TRIP_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={savingTheme}
                    className={`theme-chip${(trip.theme || 'default') === t.id ? ' active' : ''}`}
                    title={t.desc}
                    onClick={() => changeTheme(t.id)}
                  >
                    {t.emoji} {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
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

      {tab === 'resumen' && (
        <DashboardView trip={trip} onChanged={reload} onGoCalendar={() => setTab('calendario')} />
      )}
      {tab === 'lugares' && (
        <PlacesList trip={trip} onChanged={reload} onAdd={() => setShowSearch(true)} />
      )}
      {tab === 'calendario' && (
        <CalendarView trip={trip} onChanged={reload} />
      )}
      {tab === 'mapa' && (
        <MapView trip={trip} mapsReady={mapsReady} onNeedKey={onNeedKey} />
      )}
      {tab === 'documentos' && (
        <DocumentsPanel trip={trip} onChanged={reload} />
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
