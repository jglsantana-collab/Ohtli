import React, { useState } from 'react';
import { api } from '../api.js';
import { CATEGORIES, categoryById } from '../categories.js';

function fmtDate(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Lista de lugares agrupados por categoría, con edición rápida de fecha/notas.
export default function PlacesList({ trip, onChanged, onAdd }) {
  const [filter, setFilter] = useState('todas');
  const [editingId, setEditingId] = useState(null);

  const places = filter === 'todas' ? trip.places : trip.places.filter((p) => p.category === filter);

  const grouped = CATEGORIES
    .map((cat) => ({ cat, items: places.filter((p) => p.category === cat.id) }))
    .filter((g) => g.items.length > 0);

  const usedCategories = new Set(trip.places.map((p) => p.category));

  if (trip.places.length === 0) {
    return (
      <div className="empty-state glass">
        <span className="empty-emoji">🗺️</span>
        <h3>Todavía no hay lugares</h3>
        <p>Busca restaurantes, playas y lugares turísticos de {trip.city.split(',')[0]} y agrégalos a tu plan.</p>
        <button className="btn btn-primary" onClick={onAdd}>＋ Agregar el primero</button>
      </div>
    );
  }

  return (
    <div className="places-wrap">
      <div className="chip-row">
        <button className={`chip ${filter === 'todas' ? 'active' : ''}`} onClick={() => setFilter('todas')}>
          Todas ({trip.places.length})
        </button>
        {CATEGORIES.filter((c) => usedCategories.has(c.id)).map((c) => (
          <button
            key={c.id}
            className={`chip ${filter === c.id ? 'active' : ''}`}
            onClick={() => setFilter(filter === c.id ? 'todas' : c.id)}
          >
            {c.emoji} {c.label} ({trip.places.filter((p) => p.category === c.id).length})
          </button>
        ))}
      </div>

      {grouped.map(({ cat, items }) => (
        <section key={cat.id} className="cat-section">
          <h3 className="cat-title">
            <span className="cat-emoji" style={{ background: cat.color + '33' }}>{cat.emoji}</span>
            {cat.label} <span className="muted">({items.length})</span>
          </h3>
          <ul className="place-list">
            {items.map((p) => (
              <PlaceRow
                key={p.id}
                place={p}
                trip={trip}
                editing={editingId === p.id}
                onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                onChanged={() => { setEditingId(null); onChanged(); }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PlaceRow({ place, trip, editing, onEdit, onChanged }) {
  const cat = categoryById(place.category);
  const [form, setForm] = useState({
    category: place.category,
    planned_date: place.planned_date || '',
    checkin_date: place.checkin_date || '',
    checkout_date: place.checkout_date || '',
    notes: place.notes || ''
  });
  const [busy, setBusy] = useState(false);
  const isHotel = form.category === 'hotel';

  async function save() {
    setBusy(true);
    try {
      await api.updatePlace(place.id, {
        category: form.category,
        planned_date: isHotel ? null : (form.planned_date || null),
        checkin_date: isHotel ? (form.checkin_date || null) : null,
        checkout_date: isHotel ? (form.checkout_date || null) : null,
        notes: form.notes || null
      });
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Quitar "${place.name}" del viaje?`)) return;
    try {
      await api.deletePlace(place.id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <li className="place-row glass">
      <div className="place-main" onClick={onEdit}>
        <span className="place-emoji" style={{ background: cat.color + '33' }}>{cat.emoji}</span>
        <div className="place-info">
          <div className="place-name">
            {place.name}
            {place.rating != null && <span className="sr-rating">⭐ {place.rating}</span>}
            {place.google_place_id && <span className="badge badge-g" title="Ligado a Google Maps">G</span>}
          </div>
          {place.address && <div className="place-address">{place.address}</div>}
          <div className="place-tags">
            {place.category === 'hotel'
              ? (place.checkin_date
                  ? <span className="tag tag-date">🏨 {fmtDate(place.checkin_date)} → {place.checkout_date ? fmtDate(place.checkout_date) : '¿?'}</span>
                  : <span className="tag tag-nodate">Sin fechas de estancia</span>)
              : (place.planned_date
                  ? <span className="tag tag-date">📅 {fmtDate(place.planned_date)}</span>
                  : <span className="tag tag-nodate">Sin fecha</span>)}
            {place.notes && <span className="tag">📝 {place.notes}</span>}
            {place.added_by_name && <span className="tag tag-by">Agregó: {place.added_by_name}</span>}
          </div>
        </div>
        <span className="place-caret">{editing ? '▴' : '▾'}</span>
      </div>

      {editing && (
        <div className="place-edit">
          <label>
            Categoría
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </label>
          {isHotel ? (
            <>
              <label>
                Check-in
                <input
                  type="date"
                  value={form.checkin_date}
                  min={trip.start_date || undefined}
                  max={trip.end_date || undefined}
                  onChange={(e) => setForm((f) => ({ ...f, checkin_date: e.target.value }))}
                />
              </label>
              <label>
                Check-out
                <input
                  type="date"
                  value={form.checkout_date}
                  min={form.checkin_date || trip.start_date || undefined}
                  max={trip.end_date || undefined}
                  onChange={(e) => setForm((f) => ({ ...f, checkout_date: e.target.value }))}
                />
              </label>
            </>
          ) : (
            <label>
              Fecha planeada
              <input
                type="date"
                value={form.planned_date}
                min={trip.start_date || undefined}
                max={trip.end_date || undefined}
                onChange={(e) => setForm((f) => ({ ...f, planned_date: e.target.value }))}
              />
            </label>
          )}
          <label className="grow">
            Notas
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Reservación, horarios…"
            />
          </label>
          <div className="place-edit-actions">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>Guardar</button>
            <button className="btn btn-danger btn-sm" onClick={remove}>Quitar</button>
          </div>
        </div>
      )}
    </li>
  );
}
