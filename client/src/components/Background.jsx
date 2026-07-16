import React from 'react';

// Fondo dinámico: gradiente animado + "blobs" flotantes + estrellas sutiles.
// El tono cambia según la hora del día.
export default function Background() {
  const hour = new Date().getHours();
  const phase = hour >= 6 && hour < 12 ? 'morning' : hour >= 12 && hour < 19 ? 'day' : 'night';

  return (
    <div className={`bg-dynamic bg-${phase}`} aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="bg-grain" />
    </div>
  );
}
