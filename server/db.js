import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('Falta la variable de entorno DATABASE_URL (cadena de conexión de Postgres)');
}

// prepare: false es obligatorio con el "Transaction pooler" de Supabase (pgbouncer),
// que no soporta prepared statements entre invocaciones.
export const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  prepare: false
});

export async function initSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`;

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
      planned_time TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      checkin_date TEXT,
      checkout_date TEXT,
      notes TEXT,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS planned_time TEXT`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS checkin_date TEXT`;
  await sql`ALTER TABLE places ADD COLUMN IF NOT EXISTS checkout_date TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS flights (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      airline TEXT,
      flight_number TEXT NOT NULL,
      reservation_code TEXT,
      origin TEXT,
      destination TEXT,
      departure_date TEXT,
      departure_time TEXT,
      arrival_date TEXT,
      arrival_time TEXT,
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
