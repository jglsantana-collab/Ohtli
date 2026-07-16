// Temáticas visuales disponibles para los viajes.
// Cada una tiene su propia escena animada de fondo (ver components/themes/Scenes.jsx).
export const TRIP_THEMES = [
  { id: 'default', name: 'Clásico', emoji: '🎨', desc: 'Fondo dinámico según la hora del día' },
  { id: 'playa', name: 'Playa', emoji: '🏖️', desc: 'Mar, arena, gaviotas, delfines y más' },
  { id: 'ciudad', name: 'Ciudad', emoji: '🌆', desc: 'Skyline nocturno con luces en movimiento' },
  { id: 'montana', name: 'Montaña', emoji: '⛰️', desc: 'Picos nevados, nubes y aves' }
];

export const themeById = (id) => TRIP_THEMES.find((t) => t.id === id) || TRIP_THEMES[0];
