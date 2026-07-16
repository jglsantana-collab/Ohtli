import React, { useState } from 'react';
import { api } from '../api.js';
import { searchPlaces, getMapsKey, staticMapUrl } from '../maps.js';
import { CATEGORIES, categoryById, guessCategory } from '../categories.js';

// Modal para buscar lugares en Google y ligarlos al viaje,
// o agregar un lugar manualmente si no hay clave configurada.
export default function PlaceSearch({ trip, mapsReady, onNeedKey, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());
  const [manual, setManual] = useState(!getMapsKey());
  const [manualForm, setManualForm] = useState({ name: '', category: 'restaurante', planned_date: '', checkin_date: '', checkout_date: '', notes: '' });

  async function doSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    if (!getMapsKey()) { onNeedKey(); return; }
    setSearching(true);
    setError('');
    try {
      const res = await searchPlaces(query, { lat: trip.lat, lng: trip.lng });
      setResults(res);
    } catch (err) {
      setError(err.message === 'NO_KEY' ? 'Configura tu clave de Google Maps primero.' : err.message);
    } finally {
      setSearching(false);
    }
  }

  async function addResult(r, category) {
    setAddingId(r.place_id);
    setError('');
    try {
      await api.addPlace(trip.id, {
        name: r.name,
        category,
        google_place_id: r.place_id,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        rating: r.rating ?? undefined,
        photo_url: r.photo_url ?? undefined
      });
      setAddedIds((s) => new Set([...s, r.place_id]));
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingId(null);
    }
  }

  async function addManual(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addPlace(trip.id, {
        name: manualForm.name,
        category: manualForm.category,
        planned_date: manualForm.category === 'hotel' ? null : (manualForm.planned_date || null),
        checkin_date: manualForm.category === 'hotel' ? (manualForm.checkin_date || null) : null,
        checkout_date: manualForm.category === 'hotel' ? (manualForm.checkout_date || null) : null,
        notes: manualForm.notes || null
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Agregar lugar a “{trip.name}”</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="search-mode-tabs">
          <button className={!manual ? 'active' : ''} onClick={() => setManual(false)}>🔎 Buscar en Google</button>
          <button className={manual ? 'active' : ''} onClick={() => setManual(true)}>✏️ Agregar manualmente</button>
        </div>

        {!manual ? (
          <>
            <form className="search-bar" onSubmit={doSearch}>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ej. mariscos, malecón, museo… en ${trip.city.split(',')[0]}`}
              />
              <button className="btn btn-primary" disabled={searching}>
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </form>

            {!mapsReady && !getMapsKey() && (
              <div className="hint">
                🔑 Para buscar lugares de Google necesitas configurar tu clave de Google Maps.{' '}
                <button className="link" onClick={onNeedKey}>Configurar ahora</button>
              </div>
            )}

            {error && <div className="form-error">⚠️ {error}</div>}

            {results && results.length === 0 && (
              <p className="muted">Sin resultados para “{query}”. Prueba con otras palabras.</p>
            )}

            {results && results.length > 0 && (
              <ul className="search-results">
                {results.map((r) => {
                  const suggested = guessCategory(r.types);
                  const added = addedIds.has(r.place_id);
                  return (
                    <SearchResult
                      key={r.place_id}
                      result={r}
                      suggested={suggested}
                      added={added}
                      busy={addingId === r.place_id}
                      onAdd={(cat) => addResult(r, cat)}
                    />
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <form className="manual-form" onSubmit={addManual}>
            <label>
              Nombre del lugar
              <input
                autoFocus
                value={manualForm.name}
                onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Restaurante La Puntilla"
                required
              />
            </label>
            <label>
              Categoría
              <select
                value={manualForm.category}
                onChange={(e) => setManualForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </label>
            {manualForm.category === 'hotel' ? (
              <div className="form-row">
                <label>
                  Check-in
                  <input
                    type="date"
                    value={manualForm.checkin_date}
                    min={trip.start_date || undefined}
                    max={trip.end_date || undefined}
                    onChange={(e) => setManualForm((f) => ({ ...f, checkin_date: e.target.value }))}
                  />
                </label>
                <label>
                  Check-out
                  <input
                    type="date"
                    value={manualForm.checkout_date}
                    min={manualForm.checkin_date || trip.start_date || undefined}
                    max={trip.end_date || undefined}
                    onChange={(e) => setManualForm((f) => ({ ...f, checkout_date: e.target.value }))}
                  />
                </label>
              </div>
            ) : (
              <label>
                Fecha planeada (opcional)
                <input
                  type="date"
                  value={manualForm.planned_date}
                  min={trip.start_date || undefined}
                  max={trip.end_date || undefined}
                  onChange={(e) => setManualForm((f) => ({ ...f, planned_date: e.target.value }))}
                />
              </label>
            )}
            <label>
              Notas (opcional)
              <textarea
                value={manualForm.notes}
                onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Reservación, horarios, qué pedir…"
                rows={2}
              />
            </label>
            {error && <div className="form-error">⚠️ {error}</div>}
            <button className="btn btn-primary btn-block">Agregar lugar</button>
          </form>
        )}
      </div>
    </div>
  );
}

function SearchResult({ result, suggested, added, busy, onAdd }) {
  const [category, setCategory] = useState(suggested);
  const cat = categoryById(category);
  const mapThumb = staticMapUrl(result.lat, result.lng, { width: 100, height: 100, zoom: 15 });

  return (
    <li className={`search-result ${added ? 'added' : ''}`}>
      {result.photo_url && <img className="sr-photo" src={result.photo_url} alt="" loading="lazy" />}
      {mapThumb && <img className="sr-mapthumb" src={mapThumb} alt="Mapa" loading="lazy" />}
      <div className="sr-info">
        <div className="sr-name">
          <span className="sr-emoji">{cat.emoji}</span> {result.name}
          {result.rating != null && <span className="sr-rating">⭐ {result.rating}</span>}
        </div>
        {result.address && <div className="sr-address">{result.address}</div>}
      </div>
      <div className="sr-actions">
        <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={added}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
          ))}
        </select>
        <button
          className={`btn btn-sm ${added ? 'btn-ghost' : 'btn-primary'}`}
          disabled={busy || added}
          onClick={() => onAdd(category)}
        >
          {added ? '✓ Agregado' : busy ? '…' : '＋ Agregar'}
        </button>
      </div>
    </li>
  );
}
