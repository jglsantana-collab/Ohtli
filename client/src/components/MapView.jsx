import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, getMapsKey } from '../maps.js';
import { CATEGORIES, categoryById } from '../categories.js';

// Mapa grande de Google con un pin de emoji por cada lugar guardado.
export default function MapView({ trip, mapsReady, onNeedKey }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(null); // null = todas las categorías
  const placesWithCoords = trip.places.filter((p) => p.lat != null && p.lng != null);

  useEffect(() => {
    if (!getMapsKey()) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !mapRef.current) return;
        const { Map: GMap } = await maps.importLibrary('maps');
        const { AdvancedMarkerElement } = await maps.importLibrary('marker');
        if (cancelled || !mapRef.current) return;

        if (!mapObj.current) {
          mapObj.current = new GMap(mapRef.current, {
            center: { lat: trip.lat, lng: trip.lng },
            zoom: 13,
            mapId: 'OHTLI_MAP',
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
          });
          infoRef.current = new maps.InfoWindow();
        }

        // Limpia pines anteriores y dibuja los actuales
        markersRef.current.forEach((m) => (m.map = null));
        markersRef.current = [];

        const visible = filter
          ? placesWithCoords.filter((p) => p.category === filter)
          : placesWithCoords;

        const bounds = new maps.LatLngBounds();
        bounds.extend({ lat: trip.lat, lng: trip.lng });

        for (const p of visible) {
          const cat = categoryById(p.category);
          const pin = document.createElement('div');
          pin.className = 'map-pin';
          pin.style.setProperty('--pin-color', cat.color);
          pin.innerHTML = `<span class="map-pin-emoji">${cat.emoji}</span>`;

          const marker = new AdvancedMarkerElement({
            map: mapObj.current,
            position: { lat: p.lat, lng: p.lng },
            content: pin,
            title: p.name
          });

          marker.addListener('click', () => {
            infoRef.current.setContent(`
              <div class="map-info">
                <strong>${cat.emoji} ${escapeHtml(p.name)}</strong><br/>
                ${p.address ? `<small>${escapeHtml(p.address)}</small><br/>` : ''}
                ${p.planned_date ? `📅 ${p.planned_date}<br/>` : ''}
                ${p.rating != null ? `⭐ ${p.rating}<br/>` : ''}
                ${p.notes ? `📝 ${escapeHtml(p.notes)}<br/>` : ''}
                ${p.google_place_id ? `<a href="https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.google_place_id)}" target="_blank" rel="noopener">Ver en Google Maps ↗</a>` : ''}
              </div>
            `);
            infoRef.current.open({ map: mapObj.current, anchor: marker });
          });

          bounds.extend({ lat: p.lat, lng: p.lng });
          markersRef.current.push(marker);
        }

        if (visible.length > 0) {
          mapObj.current.fitBounds(bounds, 60);
        } else {
          mapObj.current.setCenter({ lat: trip.lat, lng: trip.lng });
          mapObj.current.setZoom(13);
        }
      })
      .catch((err) => {
        if (err.message !== 'NO_KEY') setError(err.message);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, trip.places, filter, mapsReady]);

  if (!getMapsKey()) {
    return (
      <div className="empty-state glass">
        <span className="empty-emoji">🗺️</span>
        <h3>Configura Google Maps</h3>
        <p>Para ver el mapa de {trip.city.split(',')[0]} con tus lugares, agrega tu clave de la API de Google Maps.</p>
        <button className="btn btn-primary" onClick={onNeedKey}>🔑 Configurar clave</button>
      </div>
    );
  }

  const usedCategories = CATEGORIES.filter((c) => placesWithCoords.some((p) => p.category === c.id));

  return (
    <div className="map-wrap">
      {usedCategories.length > 0 && (
        <div className="chip-row map-filter">
          <button className={`chip ${filter === null ? 'active' : ''}`} onClick={() => setFilter(null)}>
            Todas ({placesWithCoords.length})
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              className={`chip ${filter === c.id ? 'active' : ''}`}
              onClick={() => setFilter(filter === c.id ? null : c.id)}
            >
              {c.emoji} {c.label} ({placesWithCoords.filter((p) => p.category === c.id).length})
            </button>
          ))}
        </div>
      )}

      {error && <div className="form-error">⚠️ {error}</div>}

      <div ref={mapRef} className="map-canvas glass" />

      {placesWithCoords.length === 0 && (
        <p className="hint">
          Los lugares que agregues desde la búsqueda de Google aparecerán aquí con su pin de emoji.
          (Los lugares agregados manualmente no tienen coordenadas.)
        </p>
      )}
    </div>
  );
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
