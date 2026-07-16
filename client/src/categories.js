export const CATEGORIES = [
  { id: 'restaurante', label: 'Restaurantes', emoji: '🍽️', color: '#f97316' },
  { id: 'turistico',   label: 'Lugares turísticos', emoji: '🏛️', color: '#8b5cf6' },
  { id: 'playa',       label: 'Playas', emoji: '🏖️', color: '#0ea5e9' },
  { id: 'cafe',        label: 'Cafés', emoji: '☕', color: '#a16207' },
  { id: 'bar',         label: 'Bares y vida nocturna', emoji: '🍹', color: '#ec4899' },
  { id: 'compras',     label: 'Compras', emoji: '🛍️', color: '#22c55e' },
  { id: 'hotel',       label: 'Hoteles', emoji: '🏨', color: '#6366f1' },
  { id: 'naturaleza',  label: 'Naturaleza', emoji: '🌿', color: '#16a34a' },
  { id: 'otro',        label: 'Otros', emoji: '📍', color: '#64748b' }
];

export const categoryById = (id) =>
  CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// Adivina la categoría a partir de los "types" que regresa Google Places
export function guessCategory(types = []) {
  const t = new Set(types);
  if (t.has('restaurant') || t.has('food') || t.has('meal_takeaway')) return 'restaurante';
  if (t.has('cafe') || t.has('bakery') || t.has('coffee_shop')) return 'cafe';
  if (t.has('bar') || t.has('night_club')) return 'bar';
  if (t.has('lodging') || t.has('hotel')) return 'hotel';
  if (t.has('shopping_mall') || t.has('store') || t.has('market')) return 'compras';
  if (t.has('beach')) return 'playa';
  if (t.has('park') || t.has('natural_feature') || t.has('zoo') || t.has('aquarium')) return 'naturaleza';
  if (t.has('tourist_attraction') || t.has('museum') || t.has('church') || t.has('point_of_interest')) return 'turistico';
  return 'otro';
}
