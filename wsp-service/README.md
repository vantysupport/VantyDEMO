# wsp-service — WhatsApp Baileys para Jugando Aprendo

Microservicio que mantiene una sesión de WhatsApp Web activa y permite enviar mensajes a los padres directamente.

## Deploy en Railway (recomendado — gratis)

1. Crear cuenta en [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub** (subir esta carpeta a un repo)
   - O usar Railway CLI: `railway init` → `railway up`
3. En Railway → Variables de entorno:
   ```
   SERVICE_SECRET=una_clave_segura_larga
   ```
4. Railway te dará una URL pública, ej: `https://wsp-service-production.up.railway.app`

5. Agregar en **Vercel** (el proyecto Next.js):
   ```
   WSP_SERVICE_URL=https://wsp-service-production.up.railway.app
   WSP_SERVICE_SECRET=una_clave_segura_larga   ← la misma que en Railway
   CENTRO_NOMBRE=Jugando Aprendo
   ```

6. En el panel admin → Configuración → WhatsApp: **escanear el QR** con tu celular

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/status` | Estado de la conexión |
| GET | `/qr` | QR para escanear (base64) |
| POST | `/send` | Enviar mensaje a un número |
| POST | `/broadcast` | Enviar a múltiples números |

Todos los endpoints (excepto `/health`) requieren el header:
```
x-service-secret: tu_clave_secreta
```

## Formato de número

Acepta cualquiera de estos formatos:
- `+51924807183`
- `51924807183`  
- `924807183` (agrega +51 automáticamente)
