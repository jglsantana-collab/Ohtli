# 🧭 Ohtli — Planificador de viajes

*Ohtli* significa "camino" en náhuatl. Es una app interactiva y colaborativa para planificar viajes: guarda lugares por categoría, agéndalos en un calendario, míralos en un mapa de Google con pines de emoji y comparte el plan con tus acompañantes.

## ✨ Funcionalidades

- 🔐 **Cuentas con correo y contraseña** (registro e inicio de sesión, JWT + bcrypt)
- ✈️ **Viajes por ciudad y fechas** — el ejemplo inicial es **Mazatlán**
- 📋 **Lista de lugares por categoría**: restaurantes 🍽️, lugares turísticos 🏛️, playas 🏖️, cafés ☕, bares 🍹, compras 🛍️, hoteles 🏨, naturaleza 🌿 y otros 📍
- 🔎 **Búsqueda de lugares de Google** (Places API) ligada a cada lugar guardado
- 📅 **Calendario** para agendar cada lugar en un día del viaje
- 🗺️ **Mapa grande de Google** con un pin de emoji por categoría y filtros
- 👥 **Compartir el viaje** con otras personas registradas (por correo); todos pueden agregar y editar
- 🌅 **Fondo dinámico** animado que cambia según la hora del día

## 🚀 Cómo correrla en local

Requisitos: Node.js 18+ y un proyecto de Postgres en [Supabase](https://supabase.com) (tiene capa gratuita).

```bash
cd ohtli
npm install          # instala "concurrently" (raíz)
npm run setup        # instala dependencias de server/ y client/
```

Crea `server/.env` a partir de `server/.env.example` con tu `DATABASE_URL` de Postgres y un `JWT_SECRET` propio.

```bash
npm run dev          # levanta API (http://localhost:4000) y web (http://localhost:5173)
```

Abre **http://localhost:5173**, crea tu cuenta y tu primer viaje (Mazatlán viene sugerido). Las tablas se crean solas la primera vez que la API recibe una petición.

### Modo producción (un solo servidor)

```bash
npm run start        # compila el frontend y lo sirve desde la API en http://localhost:4000
```

## ☁️ Despliegue en Vercel

El proyecto ya está configurado para desplegarse completo (frontend + API) en un solo proyecto de Vercel, usando Postgres de Supabase:

1. En tu proyecto de Supabase: **Project Settings → Database → Connection string**, pestaña **Transaction pooler** (puerto `6543`, recomendado para funciones serverless). Copia la cadena y sustituye `[YOUR-PASSWORD]` por la contraseña real de la base de datos.
2. En Vercel: **Project Settings → Environment Variables**, agrega:
   - `DATABASE_URL` = la cadena que copiaste de Supabase.
   - `JWT_SECRET` = un valor aleatorio propio (ej. generado con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
3. Vuelve a desplegar (Deployments → ⋯ → Redeploy). `vercel.json` en la raíz ya define el build del frontend (`client/`) y enruta `/api/*` hacia la función serverless en `api/index.js`, que reutiliza el mismo Express de `server/app.js`.

## 🔑 Clave de Google Maps

Para el mapa y la búsqueda de lugares necesitas una clave de la API de Google:

1. Entra a la [consola de Google Cloud](https://console.cloud.google.com/google/maps-apis).
2. Crea (o usa) un proyecto y habilita **Maps JavaScript API** y **Places API** (la app soporta tanto la Places API nueva como la clásica).
3. Crea una clave de API.
4. Pégala en la app: botón **⚙️ / 🔑 Configurar Google Maps** en la barra superior (se guarda solo en tu navegador), o bien crea `client/.env` a partir de `client/.env.example` con `VITE_GOOGLE_MAPS_API_KEY=tu_clave`.

Sin clave, la app sigue funcionando: puedes agregar lugares manualmente, usar el calendario y compartir; solo el mapa y la búsqueda de Google quedan deshabilitados.

## 🧱 Arquitectura

```
ohtli/
├── api/
│   └── index.js     # entrypoint de la función serverless de Vercel (reexporta server/app.js)
├── server/          # API Express + Postgres (Supabase, driver "postgres")
│   ├── app.js        # la app de Express: rutas de auth, viajes, lugares, miembros
│   ├── index.js       # entrypoint solo para desarrollo local (app.listen)
│   └── db.js          # conexión y esquema de la base de datos
├── vercel.json      # build del frontend + rewrite de /api/* hacia api/index.js
└── client/          # React + Vite
    └── src/
        ├── components/   # pantallas y vistas (lista, calendario, mapa…)
        ├── maps.js       # carga de Google Maps + búsqueda de lugares
        └── categories.js # categorías con emoji y colores
```

- La sesión se guarda como JWT en `localStorage` (30 días).
- Los viajes se comparten agregando miembros por correo; cada miembro ve el viaje en su lista y la vista se refresca sola cada 20 segundos.
- La base de datos es Postgres; la conexión se toma de `DATABASE_URL` y las tablas se crean solas en el primer request.
