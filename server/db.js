import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Postgres)');
}

export const sql = neon(process.env.DATABASE_URL);

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      start_date TEXT,
      end_date TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (trip_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS places (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'otro',
      google_place_id TEXT,
      address TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      rating DOUBLE PRECISION,
      planned_date TEXT,
      notes TEXT,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

let schemaReady = null;

export function ensureSchema() {
  if (!schemaReady) schemaReady = initSchema();
  return schemaReady;
}
