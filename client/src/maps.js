// Utilidades para cargar Google Maps JS API y buscar lugares.
// La clave se toma de localStorage (configurable desde la app) o de VITE_GOOGLE_MAPS_API_KEY.

const KEY_STORAGE = 'ohtli_gmaps_key';

export function getMapsKey() {
  return localStorage.getItem(KEY_STORAGE) || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

export function setMapsKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

let loaderPromise = null;
let loadedWithKey = null;

export function loadGoogleMaps() {
  const key = getMapsKey();
  if (!key) return Promise.reject(new Error('NO_KEY'));
  if (window.google?.maps && loadedWithKey === key) return Promise.resolve(window.google.maps);
  if (loaderPromise && loadedWithKey === key) return loaderPromise;

  loadedWithKey = key;
  loaderPromise = new Promise((resolve, reject) => {
    const cbName = '__ohtliMapsReady';
    window[cbName] = () => resolve(window.google.maps);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&language=es&region=MX&loading=async&callback=${cbName}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('No se pudo cargar Google Maps. Revisa tu conexión y tu clave.'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

// Foto pequeña de un lugar (de la API nueva o la clásica) — ambas exponen
// un método sync/async que regresa una URL ya lista para usar en <img>.
async function firstPhotoUrl(photos, { maxWidth = 320, maxHeight = 240 } = {}) {
  const photo = photos?.[0];
  if (!photo) return null;
  try {
    if (typeof photo.getURI === 'function') return await photo.getURI({ maxWidth, maxHeight });
    if (typeof photo.getUrl === 'function') return photo.getUrl({ maxWidth, maxHeight });
  } catch {
    return null;
  }
  return null;
}

// Miniatura de mapa estática (Maps Static API) centrada en un punto.
export function staticMapUrl(lat, lng, { width = 160, height = 120, zoom = 15 } = {}) {
  const key = getMapsKey();
  if (!key || lat == null || lng == null) return null;
  const size = `${width}x${height}`;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&markers=color:0x38bdf8%7C${lat},${lng}&key=${encodeURIComponent(key)}`;
}

// Busca lugares con la Places API nueva y, si no está habilitada, con la clásica.
export async function searchPlaces(query, center, radiusMeters = 20000) {
  const maps = await loadGoogleMaps();

  // Intento 1: Places API (New)
  try {
    const { Place } = await maps.importLibrary('places');
    if (Place?.searchByText) {
      const { places } = await Place.searchByText({
        textQuery: query,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'types', 'photos'],
        locationBias: { center, radius: radiusMeters },
        language: 'es',
        maxResultCount: 12
      });
      return Promise.all((places || []).map(async (p) => ({
        place_id: p.id,
        name: p.displayName,
        address: p.formattedAddress || '',
        lat: p.location?.lat(),
        lng: p.location?.lng(),
        rating: p.rating ?? null,
        types: p.types || [],
        photo_url: await firstPhotoUrl(p.photos)
      })));
    }
  } catch (err) {
    console.warn('Places API (nueva) no disponible, probando la clásica…', err);
  }

  // Intento 2: Places API clásica (PlacesService)
  return new Promise((resolve, reject) => {
    const service = new maps.places.PlacesService(document.createElement('div'));
    service.textSearch(
      { query, location: new maps.LatLng(center.lat, center.lng), radius: radiusMeters },
      async (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && results) {
          resolve(await Promise.all(results.slice(0, 12).map(async (r) => ({
            place_id: r.place_id,
            name: r.name,
            address: r.formatted_address || '',
            lat: r.geometry?.location?.lat(),
            lng: r.geometry?.location?.lng(),
            rating: r.rating ?? null,
            types: r.types || [],
            photo_url: await firstPhotoUrl(r.photos)
          }))));
        } else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          reject(new Error(`La búsqueda de Google falló (${status}). Verifica que la Places API esté habilitada para tu clave.`));
        }
      }
    );
  });
}

// Geocodifica una ciudad para obtener sus coordenadas
export async function geocodeCity(city) {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();
  const { results } = await geocoder.geocode({ address: city, language: 'es' });
  if (!results?.length) throw new Error('Ciudad no encontrada');
  const loc = results[0].geometry.location;
  return { lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address };
}
