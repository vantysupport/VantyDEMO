# Neuropsicología y Terapias SANTI

Plataforma de gestión terapéutica conductual (ABA) para el centro Neuropsicología y Terapias SANTI. Construida sobre Next.js 16, Supabase y múltiples APIs de IA.

## Primeros pasos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo de plantilla y completa los valores:

```bash
cp .env.example .env.local
```

Luego abre `.env.local` y rellena:
- **NEXT_PUBLIC_SUPABASE_URL** y keys → desde Supabase → Settings → API
- **GROQ_API_KEY** → desde https://console.groq.com
- **GEMINI_API_KEY** → desde https://aistudio.google.com/apikey
- (Opcionales: ElevenLabs, Gmail SMTP, Railway para WhatsApp, etc.)

### 3. Configurar la base de datos

Ejecuta los SQLs de la carpeta raíz en Supabase → SQL Editor:

1. `chat_avatars_reactions_migration.sql`
2. `chat_especialista_admin_migration.sql`
3. `supabase_hub_ia_migration.sql`

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — serás redirigido directamente al login.

### 5. Desplegar en Vercel

```bash
git push origin main
```

Vercel lo detecta automáticamente. Recuerda agregar todas las variables de entorno en **Vercel → Settings → Environment Variables**.

## Estructura principal

```
app/
├── login/            # Pantalla de login (página de entrada)
├── admin/            # Panel jefe/admin
├── especialista/     # Panel de terapeutas
├── padre/            # Portal de padres
├── secretaria/       # Panel de recepción
├── api/              # APIs del backend (agentes IA, CRUD, etc.)
├── privacidad/       # Política de privacidad
├── terminos/         # Términos de servicio
└── page.tsx          # Redirige a /login

lib/                  # Clientes (Supabase, Groq, email, WhatsApp)
components/           # Componentes React reutilizables
messages/             # Traducciones i18n
public/               # Logos, íconos, manifest
wsp-service/          # Microservicio WhatsApp (para Railway)
```

## Roles del sistema

- **jefe** — acceso total al panel admin
- **especialista** — terapeutas, acceso a pacientes y evaluaciones
- **padre** — portal para familias
- **secretaria** — panel de agenda y recepción

## Agentes de IA incluidos

- ARIA (chat asistente para padres)
- Agente de predicción (progreso 30/90 días)
- Agente de patrones ABA
- Agente de objetivos adaptativos
- Agente de conocimiento clínico
- Agente guardián (seguridad y auditoría)
- Agente de sugerencias para terapeutas

Todos corren sobre Groq con fallback automático entre modelos (Llama 3.3 70B → Llama 3.1 8B → GPT-OSS 20B → GPT-OSS 120B).
