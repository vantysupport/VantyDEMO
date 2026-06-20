# Crear la base de datos DEMO (clon del proyecto original + extras)

Objetivo: una base **nueva** e independiente para la demo, con las **mismas
tablas/funciones** que el proyecto original (`JugandoAprendoWeb / Vanty ABA`) y
además las columnas de **centros demo** que se agregaron.

---

## Paso 1 — Sacar el esquema del proyecto ORIGINAL (un solo archivo)

Necesitás la *connection string* del original:
**Dashboard del proyecto Vanty ABA → botón `Connect` (arriba) → "Connection string" → URI**.
Copiá la que dice *Direct connection* (puerto 5432) y reemplazá `[YOUR-PASSWORD]`
por la contraseña de la base (la definiste al crear el proyecto; si no la
recordás, se resetea en Settings → Database).

Luego, en una terminal dentro del proyecto:

```bash
# Vuelca SOLO la estructura (sin datos) del schema public a un archivo.
npx supabase db dump \
  --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[REF-ORIGINAL].supabase.co:5432/postgres" \
  -f esquema-original.sql
```

> `--db-url` evita tener que hacer `supabase link`. El `[REF-ORIGINAL]` es el id
> que aparece en la URL del dashboard del proyecto original.

Esto genera `esquema-original.sql` con TODO lo que ya construiste (incluye
`profiles`, `children`, panel de control, sesión única, límites de padres, etc.).

---

## Paso 2 — Crear el proyecto DEMO nuevo

En https://supabase.com/dashboard → **New project**. Anotá su `URL`, `anon key`
y `service_role key` (Project Settings → API). Esos van al `.env.local` del demo
(ver `.env.example`).

---

## Paso 3 — Cargar el esquema en el DEMO

```bash
npx supabase db push \
  --db-url "postgresql://postgres:[PASSWORD-DEMO]@db.[REF-DEMO].supabase.co:5432/postgres" \
  esquema-original.sql
```

> Alternativa sin CLI: abrí `esquema-original.sql`, copialo y pegalo en el
> **SQL Editor del proyecto demo** → Run. (Puede pedir correrlo en partes si es
> muy grande.)

---

## Paso 4 — Agregar las columnas de CENTROS DEMO

En el **SQL Editor del proyecto demo**, corré el archivo:

```
supabase/centros-demo.sql
```

(Agrega `is_demo`, `demo_active`, `demo_expires_at`, `center_name` a `profiles`.)

---

## Paso 5 — Crear TU cuenta de programador

1. Registrate/logueate una vez en la app del demo (crea tu fila en `profiles`).
2. En el SQL Editor del demo:

```sql
update public.profiles set role = 'programador' where email = 'TU_CORREO';
```

3. Entrá a `/control` → sección **Centros demo** → empezá a crear cuentas.

---

## Paso 6 — Variables de entorno

Copiá `.env.example` → `.env.local` y apuntá las 3 de Supabase al **proyecto
demo** (no al original). Completá las API keys que uses (IA, email, etc.).

---

### Notas
- El dump del Paso 1 **ya incluye** los parches que aplicaste al original
  (control, sesión única, límite de padres, fonemas…). No hace falta re-correrlos.
- Lo ÚNICO extra para el demo es `centros-demo.sql` (Paso 4).
- Los **Storage buckets** (`chat-files`, `patient-documents`, `store-images`,
  knowledge) NO viajan en el dump de schema: créalos a mano en el demo
  (Storage → New bucket) con los mismos nombres si vas a usar archivos.
