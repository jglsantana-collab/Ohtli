import React from 'react';
import { BeachScene, CityScene, MountainScene } from './themes/Scenes.jsx';

// Fondo dinámico. Con theme='default' muestra el gradiente animado de siempre
// (el tono cambia según la hora del día); las demás temáticas muestran
// escenas animadas con eventos aleatorios.
export default function Background({ theme = 'default' }) {
  if (theme === 'playa') return <BeachScene />;
  if (theme === 'ciudad') return <CityScene />;
  if (theme === 'montana') return <MountainScene />;

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
