import React, { useState } from 'react';
import { getMapsKey, setMapsKey } from '../maps.js';

export default function MapsKeyModal({ onClose, onSaved }) {
  const [key, setKey] = useState(getMapsKey());

  function save(e) {
    e.preventDefault();
    setMapsKey(key);
    if (window.google?.maps) {
      // El script de Google no se puede recargar con otra clave sin refrescar
      window.location.reload();
    } else {
      onSaved();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>🔑 Clave de Google Maps</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <p className="muted">
          Ohtli usa Google Maps para el mapa y la búsqueda de lugares.
          Crea una clave en la <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener">consola de Google Cloud</a> con
          las APIs <strong>Maps JavaScript API</strong> y <strong>Places API</strong> habilitadas.
          La clave se guarda solo en este navegador.
        </p>
        <form onSubmit={save}>
          <label>
            Clave de API
            <input
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIza…"
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
