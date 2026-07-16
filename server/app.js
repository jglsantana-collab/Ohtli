import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql, ensureSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.JWT_SECRET) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(cors());
app.use(express.json());
app.use(async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (err) {
    console.error('Error inicializando el esquema:', err);
    res.status(500).json({ error: 'No se pudo conectar a la base de datos' });
  }
});

const CATEGORIES = ['restaurante', 'turistico', 'playa', 'cafe', 'bar', 'compras', 'hotel', 'naturaleza', 'otro'];

// ---------- Helpers ----------

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, is_admin: u.is_admin };
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [user] = await sql`SELECT * FROM users WHERE id = ${payload.sub}`;
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo un administrador puede hacer esto' });
  next();
}

async function getTripForMember(tripId, userId) {
  const [trip] = await sql`
    SELECT t.* FROM trips t
    JOIN trip_members m ON m.trip_id = t.id
    WHERE t.id = ${tripId} AND m.user_id = ${userId}
  `;
  return trip;
}

async function tripWithDetails(trip) {
  const members = (await sql`
    SELECT u.id, u.name, u.email, (u.id = ${trip.owner_id}) AS is_owner
    FROM trip_members m JOIN users u ON u.id = m.user_id
    WHERE m.trip_id = ${trip.id} ORDER BY is_owner DESC, u.name
  `).map(m => ({ ...m, is_owner: !!m.is_owner }));

  const places = await sql`
    SELECT p.*, u.name AS added_by_name
    FROM places p LEFT JOIN users u ON u.id = p.added_by
    WHERE p.trip_id = ${trip.id}
    ORDER BY p.planned_date IS NULL, p.planned_date, p.planned_time IS NULL, p.planned_time, p.sort_order, p.created_at
  `;

  const flights = await sql`
    SELECT * FROM flights WHERE trip_id = ${trip.id}
    ORDER BY departure_date IS NULL, departure_date, departure_time IS NULL, departure_time, created_at
  `;

  return { ...trip, members, places, flights };
}

function asyncRoute(handler) {
  return (req, res, next) => handler(req, res, next).catch(next);
}

// ---------- Auth ----------

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo electrónico inválido' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const [exists] = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

  const hash = bcrypt.hashSync(password, 10);
  const [user] = await sql`
    INSERT INTO users (name, email, password_hash) VALUES (${name.trim()}, ${normalizedEmail}, ${hash})
    RETURNING *
  `;
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  const [user] = await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------- Viajes ----------

app.get('/api/trips', auth, asyncRoute(async (req, res) => {
  const trips = await sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS place_count,
      (SELECT COUNT(*) FROM trip_members m2 WHERE m2.trip_id = t.id) AS member_count
    FROM trips t
    JOIN trip_members m ON m.trip_id = t.id
    WHERE m.user_id = ${req.user.id}
    ORDER BY t.created_at DESC
  `;
  res.json({ trips });
}));

app.post('/api/trips', auth, asyncRoute(async (req, res) => {
  const { name, city, lat, lng, start_date, end_date } = req.body || {};
  if (!name || !city || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Nombre, ciudad y coordenadas son obligatorios' });
  }
  const [trip] = await sql`
    WITH new_trip AS (
      INSERT INTO trips (name, city, lat, lng, start_date, end_date, owner_id)
      VALUES (${name.trim()}, ${city.trim()}, ${lat}, ${lng}, ${start_date || null}, ${end_date || null}, ${req.user.id})
      RETURNING *
    ), member AS (
      INSERT INTO trip_members (trip_id, user_id)
      SELECT id, owner_id FROM new_trip
    )
    SELECT * FROM new_trip
  `;
  res.status(201).json({ trip: await tripWithDetails(trip) });
}));

app.get('/api/trips/:id', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  res.json({ trip: await tripWithDetails(trip) });
}));

app.put('/api/trips/:id', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { name, city, lat, lng, start_date, end_date } = req.body || {};
  const [updated] = await sql`
    UPDATE trips SET
      name = COALESCE(${name ?? null}, name),
      city = COALESCE(${city ?? null}, city),
      lat = COALESCE(${lat ?? null}, lat),
      lng = COALESCE(${lng ?? null}, lng),
      start_date = ${start_date !== undefined ? start_date : trip.start_date},
      end_date = ${end_date !== undefined ? end_date : trip.end_date}
    WHERE id = ${trip.id}
    RETURNING *
  `;
  res.json({ trip: await tripWithDetails(updated) });
}));

app.delete('/api/trips/:id', auth, asyncRoute(async (req, res) => {
  const [trip] = await sql`SELECT * FROM trips WHERE id = ${req.params.id}`;
  if (!trip || !(await getTripForMember(trip.id, req.user.id))) {
    return res.status(404).json({ error: 'Viaje no encontrado' });
  }
  if (trip.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo el dueño del viaje puede eliminarlo' });
  }
  await sql`DELETE FROM trips WHERE id = ${trip.id}`;
  res.json({ ok: true });
}));

// ---------- Compartir (miembros) ----------

app.post('/api/trips/:id/members', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'El correo es obligatorio' });

  const [target] = await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`;
  if (!target) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese correo. Pídele que cree su cuenta primero.' });
  }
  const [already] = await sql`SELECT 1 FROM trip_members WHERE trip_id = ${trip.id} AND user_id = ${target.id}`;
  if (already) return res.status(409).json({ error: 'Esa persona ya es parte del viaje' });

  await sql`INSERT INTO trip_members (trip_id, user_id) VALUES (${trip.id}, ${target.id})`;
  res.status(201).json({ trip: await tripWithDetails(trip) });
}));

app.delete('/api/trips/:id/members/:userId', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const targetId = Number(req.params.userId);
  if (targetId === trip.owner_id) {
    return res.status(400).json({ error: 'El dueño del viaje no puede ser eliminado' });
  }
  // Solo el dueño quita a otros; cualquiera puede salirse a sí mismo
  if (targetId !== req.user.id && trip.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo el dueño puede quitar a otros miembros' });
  }
  await sql`DELETE FROM trip_members WHERE trip_id = ${trip.id} AND user_id = ${targetId}`;
  res.json({ ok: true });
}));

// ---------- Lugares ----------

app.post('/api/trips/:id/places', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { name, category, google_place_id, address, lat, lng, rating, planned_date, planned_time, checkin_date, checkout_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'El nombre del lugar es obligatorio' });
  const cat = CATEGORIES.includes(category) ? category : 'otro';

  const [place] = await sql`
    INSERT INTO places (trip_id, name, category, google_place_id, address, lat, lng, rating, planned_date, planned_time, checkin_date, checkout_date, notes, added_by)
    VALUES (
      ${trip.id}, ${name.trim()}, ${cat}, ${google_place_id || null}, ${address || null},
      ${typeof lat === 'number' ? lat : null}, ${typeof lng === 'number' ? lng : null},
      ${typeof rating === 'number' ? rating : null}, ${planned_date || null}, ${planned_time || null},
      ${checkin_date || null}, ${checkout_date || null}, ${notes || null}, ${req.user.id}
    )
    RETURNING *
  `;
  res.status(201).json({ place });
}));

app.put('/api/places/:id', auth, asyncRoute(async (req, res) => {
  const [place] = await sql`SELECT * FROM places WHERE id = ${req.params.id}`;
  if (!place || !(await getTripForMember(place.trip_id, req.user.id))) {
    return res.status(404).json({ error: 'Lugar no encontrado' });
  }
  const { name, category, planned_date, planned_time, sort_order, checkin_date, checkout_date, notes } = req.body || {};
  const [updated] = await sql`
    UPDATE places SET
      name = COALESCE(${name ?? null}, name),
      category = COALESCE(${category && CATEGORIES.includes(category) ? category : null}, category),
      planned_date = ${planned_date !== undefined ? planned_date : place.planned_date},
      planned_time = ${planned_time !== undefined ? planned_time : place.planned_time},
      sort_order = ${sort_order !== undefined ? sort_order : place.sort_order},
      checkin_date = ${checkin_date !== undefined ? checkin_date : place.checkin_date},
      checkout_date = ${checkout_date !== undefined ? checkout_date : place.checkout_date},
      notes = ${notes !== undefined ? notes : place.notes}
    WHERE id = ${place.id}
    RETURNING *
  `;
  res.json({ place: updated });
}));

app.delete('/api/places/:id', auth, asyncRoute(async (req, res) => {
  const [place] = await sql`SELECT * FROM places WHERE id = ${req.params.id}`;
  if (!place || !(await getTripForMember(place.trip_id, req.user.id))) {
    return res.status(404).json({ error: 'Lugar no encontrado' });
  }
  await sql`DELETE FROM places WHERE id = ${place.id}`;
  res.json({ ok: true });
}));

// ---------- Vuelos ----------

app.get('/api/flights/lookup', auth, asyncRoute(async (req, res) => {
  const { flight_number } = req.query;
  if (!flight_number) return res.status(400).json({ error: 'Falta el número de vuelo' });
  if (!process.env.FLIGHT_API_KEY) {
    return res.status(501).json({ error: 'El autocompletado de vuelos no está configurado (falta FLIGHT_API_KEY)' });
  }
  const clean = String(flight_number).replace(/\s+/g, '').toUpperCase();
  const url = `https://api.aviationstack.com/v1/flights?access_key=${process.env.FLIGHT_API_KEY}&flight_iata=${encodeURIComponent(clean)}`;
  const apiRes = await fetch(url);
  if (!apiRes.ok) return res.status(502).json({ error: 'No se pudo consultar el vuelo' });
  const data = await apiRes.json();
  if (data?.error) return res.status(502).json({ error: data.error.message || 'No se pudo consultar el vuelo' });
  const match = data?.data?.[0];
  if (!match) return res.status(404).json({ error: `No se encontró información para el vuelo ${clean}` });

  function splitDateTime(iso) {
    if (!iso) return { date: null, time: null };
    const [date, rest] = iso.split('T');
    return { date, time: rest ? rest.slice(0, 5) : null };
  }
  const dep = splitDateTime(match.departure?.scheduled);
  const arr = splitDateTime(match.arrival?.scheduled);

  res.json({
    flight: {
      airline: match.airline?.name || null,
      flight_number: match.flight?.iata || clean,
      origin: match.departure?.airport || match.departure?.iata || null,
      destination: match.arrival?.airport || match.arrival?.iata || null,
      departure_date: dep.date,
      departure_time: dep.time,
      arrival_date: arr.date,
      arrival_time: arr.time
    }
  });
}));

app.post('/api/trips/:id/flights', auth, asyncRoute(async (req, res) => {
  const trip = await getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { airline, flight_number, reservation_code, origin, destination, departure_date, departure_time, arrival_date, arrival_time, notes } = req.body || {};
  if (!flight_number) return res.status(400).json({ error: 'El número de vuelo es obligatorio' });

  const [flight] = await sql`
    INSERT INTO flights (
      trip_id, airline, flight_number, reservation_code, origin, destination,
      departure_date, departure_time, arrival_date, arrival_time, notes, added_by
    )
    VALUES (
      ${trip.id}, ${airline || null}, ${flight_number.trim().toUpperCase()}, ${reservation_code || null},
      ${origin || null}, ${destination || null}, ${departure_date || null}, ${departure_time || null},
      ${arrival_date || null}, ${arrival_time || null}, ${notes || null}, ${req.user.id}
    )
    RETURNING *
  `;
  res.status(201).json({ flight });
}));

app.put('/api/flights/:id', auth, asyncRoute(async (req, res) => {
  const [flight] = await sql`SELECT * FROM flights WHERE id = ${req.params.id}`;
  if (!flight || !(await getTripForMember(flight.trip_id, req.user.id))) {
    return res.status(404).json({ error: 'Vuelo no encontrado' });
  }
  const { airline, flight_number, reservation_code, origin, destination, departure_date, departure_time, arrival_date, arrival_time, notes } = req.body || {};
  const [updated] = await sql`
    UPDATE flights SET
      airline = ${airline !== undefined ? airline : flight.airline},
      flight_number = ${flight_number ? flight_number.trim().toUpperCase() : flight.flight_number},
      reservation_code = ${reservation_code !== undefined ? reservation_code : flight.reservation_code},
      origin = ${origin !== undefined ? origin : flight.origin},
      destination = ${destination !== undefined ? destination : flight.destination},
      departure_date = ${departure_date !== undefined ? departure_date : flight.departure_date},
      departure_time = ${departure_time !== undefined ? departure_time : flight.departure_time},
      arrival_date = ${arrival_date !== undefined ? arrival_date : flight.arrival_date},
      arrival_time = ${arrival_time !== undefined ? arrival_time : flight.arrival_time},
      notes = ${notes !== undefined ? notes : flight.notes}
    WHERE id = ${flight.id}
    RETURNING *
  `;
  res.json({ flight: updated });
}));

app.delete('/api/flights/:id', auth, asyncRoute(async (req, res) => {
  const [flight] = await sql`SELECT * FROM flights WHERE id = ${req.params.id}`;
  if (!flight || !(await getTripForMember(flight.trip_id, req.user.id))) {
    return res.status(404).json({ error: 'Vuelo no encontrado' });
  }
  await sql`DELETE FROM flights WHERE id = ${flight.id}`;
  res.json({ ok: true });
}));

// ---------- Administración ----------

app.get('/api/admin/users', auth, adminOnly, asyncRoute(async (req, res) => {
  const users = await sql`
    SELECT u.id, u.name, u.email, u.is_admin, u.created_at,
      (SELECT COUNT(*) FROM trips t WHERE t.owner_id = u.id) AS trips_owned
    FROM users u
    ORDER BY u.created_at
  `;
  res.json({ users });
}));

app.put('/api/admin/users/:id/password', auth, adminOnly, asyncRoute(async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const [updated] = await sql`
    UPDATE users SET password_hash = ${hash} WHERE id = ${req.params.id} RETURNING id
  `;
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
}));

app.put('/api/admin/users/:id/role', auth, adminOnly, asyncRoute(async (req, res) => {
  const targetId = Number(req.params.id);
  const { is_admin } = req.body || {};
  if (targetId === req.user.id && !is_admin) {
    return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administrador' });
  }
  const [updated] = await sql`
    UPDATE users SET is_admin = ${!!is_admin} WHERE id = ${targetId} RETURNING id, name, email, is_admin, created_at
  `;
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: updated });
}));

app.delete('/api/admin/users/:id', auth, adminOnly, asyncRoute(async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí' });
  }
  const [deleted] = await sql`DELETE FROM users WHERE id = ${targetId} RETURNING id`;
  if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
}));

// ---------- Producción: servir el frontend compilado (solo para `npm start` local) ----------

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

export default app;
