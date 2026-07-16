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
  return { id: u.id, name: u.name, email: u.email };
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
    ORDER BY p.planned_date IS NULL, p.planned_date, p.created_at
  `;

  return { ...trip, members, places };
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
  const { name, category, google_place_id, address, lat, lng, rating, planned_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'El nombre del lugar es obligatorio' });
  const cat = CATEGORIES.includes(category) ? category : 'otro';

  const [place] = await sql`
    INSERT INTO places (trip_id, name, category, google_place_id, address, lat, lng, rating, planned_date, notes, added_by)
    VALUES (
      ${trip.id}, ${name.trim()}, ${cat}, ${google_place_id || null}, ${address || null},
      ${typeof lat === 'number' ? lat : null}, ${typeof lng === 'number' ? lng : null},
      ${typeof rating === 'number' ? rating : null}, ${planned_date || null}, ${notes || null}, ${req.user.id}
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
  const { name, category, planned_date, notes } = req.body || {};
  const [updated] = await sql`
    UPDATE places SET
      name = COALESCE(${name ?? null}, name),
      category = COALESCE(${category && CATEGORIES.includes(category) ? category : null}, category),
      planned_date = ${planned_date !== undefined ? planned_date : place.planned_date},
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

// ---------- Producción: servir el frontend compilado (solo para `npm start` local) ----------

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

export default app;
