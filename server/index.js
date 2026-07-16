import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

// Secreto JWT persistente entre reinicios (generado la primera vez)
const secretFile = path.join(__dirname, 'data', '.jwt-secret');
if (!fs.existsSync(secretFile)) {
  fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
}
const JWT_SECRET = process.env.JWT_SECRET || fs.readFileSync(secretFile, 'utf8').trim();

const app = express();
app.use(cors());
app.use(express.json());

const CATEGORIES = ['restaurante', 'turistico', 'playa', 'cafe', 'bar', 'compras', 'hotel', 'naturaleza', 'otro'];

// ---------- Helpers ----------

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function getTripForMember(tripId, userId) {
  return db.prepare(`
    SELECT t.* FROM trips t
    JOIN trip_members m ON m.trip_id = t.id
    WHERE t.id = ? AND m.user_id = ?
  `).get(tripId, userId);
}

function tripWithDetails(trip) {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, (u.id = ?) AS is_owner
    FROM trip_members m JOIN users u ON u.id = m.user_id
    WHERE m.trip_id = ? ORDER BY is_owner DESC, u.name
  `).all(trip.owner_id, trip.id).map(m => ({ ...m, is_owner: !!m.is_owner }));

  const places = db.prepare(`
    SELECT p.*, u.name AS added_by_name
    FROM places p LEFT JOIN users u ON u.id = p.added_by
    WHERE p.trip_id = ?
    ORDER BY p.planned_date IS NULL, p.planned_date, p.created_at
  `).all(trip.id);

  return { ...trip, members, places };
}

// ---------- Auth ----------

app.post('/api/auth/register', (req, res) => {
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
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), email.trim().toLowerCase(), hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------- Viajes ----------

app.get('/api/trips', auth, (req, res) => {
  const trips = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM places p WHERE p.trip_id = t.id) AS place_count,
      (SELECT COUNT(*) FROM trip_members m2 WHERE m2.trip_id = t.id) AS member_count
    FROM trips t
    JOIN trip_members m ON m.trip_id = t.id
    WHERE m.user_id = ?
    ORDER BY t.created_at DESC
  `).all(req.user.id);
  res.json({ trips });
});

app.post('/api/trips', auth, (req, res) => {
  const { name, city, lat, lng, start_date, end_date } = req.body || {};
  if (!name || !city || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Nombre, ciudad y coordenadas son obligatorios' });
  }
  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO trips (name, city, lat, lng, start_date, end_date, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), city.trim(), lat, lng, start_date || null, end_date || null, req.user.id);
    db.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)')
      .run(info.lastInsertRowid, req.user.id);
    return info.lastInsertRowid;
  });
  const id = create();
  res.status(201).json({ trip: tripWithDetails(db.prepare('SELECT * FROM trips WHERE id = ?').get(id)) });
});

app.get('/api/trips/:id', auth, (req, res) => {
  const trip = getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  res.json({ trip: tripWithDetails(trip) });
});

app.put('/api/trips/:id', auth, (req, res) => {
  const trip = getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { name, city, lat, lng, start_date, end_date } = req.body || {};
  db.prepare(`
    UPDATE trips SET
      name = COALESCE(?, name),
      city = COALESCE(?, city),
      lat = COALESCE(?, lat),
      lng = COALESCE(?, lng),
      start_date = ?,
      end_date = ?
    WHERE id = ?
  `).run(
    name ?? null, city ?? null, lat ?? null, lng ?? null,
    start_date !== undefined ? start_date : trip.start_date,
    end_date !== undefined ? end_date : trip.end_date,
    trip.id
  );
  res.json({ trip: tripWithDetails(db.prepare('SELECT * FROM trips WHERE id = ?').get(trip.id)) });
});

app.delete('/api/trips/:id', auth, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  if (!trip || !getTripForMember(trip.id, req.user.id)) {
    return res.status(404).json({ error: 'Viaje no encontrado' });
  }
  if (trip.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo el dueño del viaje puede eliminarlo' });
  }
  db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id);
  res.json({ ok: true });
});

// ---------- Compartir (miembros) ----------

app.post('/api/trips/:id/members', auth, (req, res) => {
  const trip = getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'El correo es obligatorio' });

  const target = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!target) {
    return res.status(404).json({ error: 'No existe un usuario registrado con ese correo. Pídele que cree su cuenta primero.' });
  }
  const already = db.prepare('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .get(trip.id, target.id);
  if (already) return res.status(409).json({ error: 'Esa persona ya es parte del viaje' });

  db.prepare('INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)').run(trip.id, target.id);
  res.status(201).json({ trip: tripWithDetails(trip) });
});

app.delete('/api/trips/:id/members/:userId', auth, (req, res) => {
  const trip = getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const targetId = Number(req.params.userId);
  if (targetId === trip.owner_id) {
    return res.status(400).json({ error: 'El dueño del viaje no puede ser eliminado' });
  }
  // Solo el dueño quita a otros; cualquiera puede salirse a sí mismo
  if (targetId !== req.user.id && trip.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Solo el dueño puede quitar a otros miembros' });
  }
  db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?').run(trip.id, targetId);
  res.json({ ok: true });
});

// ---------- Lugares ----------

app.post('/api/trips/:id/places', auth, (req, res) => {
  const trip = getTripForMember(req.params.id, req.user.id);
  if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
  const { name, category, google_place_id, address, lat, lng, rating, planned_date, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'El nombre del lugar es obligatorio' });
  const cat = CATEGORIES.includes(category) ? category : 'otro';

  const info = db.prepare(`
    INSERT INTO places (trip_id, name, category, google_place_id, address, lat, lng, rating, planned_date, notes, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trip.id, name.trim(), cat, google_place_id || null, address || null,
    typeof lat === 'number' ? lat : null, typeof lng === 'number' ? lng : null,
    typeof rating === 'number' ? rating : null, planned_date || null, notes || null, req.user.id
  );
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ place });
});

app.put('/api/places/:id', auth, (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place || !getTripForMember(place.trip_id, req.user.id)) {
    return res.status(404).json({ error: 'Lugar no encontrado' });
  }
  const { name, category, planned_date, notes } = req.body || {};
  db.prepare(`
    UPDATE places SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      planned_date = ?,
      notes = ?
    WHERE id = ?
  `).run(
    name ?? null,
    category && CATEGORIES.includes(category) ? category : null,
    planned_date !== undefined ? planned_date : place.planned_date,
    notes !== undefined ? notes : place.notes,
    place.id
  );
  res.json({ place: db.prepare('SELECT * FROM places WHERE id = ?').get(place.id) });
});

app.delete('/api/places/:id', auth, (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place || !getTripForMember(place.trip_id, req.user.id)) {
    return res.status(404).json({ error: 'Lugar no encontrado' });
  }
  db.prepare('DELETE FROM places WHERE id = ?').run(place.id);
  res.json({ ok: true });
});

// ---------- Producción: servir el frontend compilado ----------

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🌎 Ohtli API escuchando en http://localhost:${PORT}`);
});
