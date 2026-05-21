// app/privacidad/page.tsx
// Política de Privacidad completa de la plataforma Vanty · Centro SANTI.
// Diseñada para verse profesional en modo claro y modo oscuro.

export const metadata = {
  title: 'Política de Privacidad · Vanty',
  description: 'Cómo Vanty protege los datos clínicos de las familias del Centro SANTI.',
}

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'identidad',
    title: '1. Quiénes somos',
    body: (
      <>
        <p>
          <strong>Neuropsicología y Terapias SANTI</strong> es un centro especializado en intervención
          infantil ABA, TEA y TDAH ubicado en Av. Brasil 2730, Pueblo Libre 15084, Lima — Perú.
        </p>
        <p>
          Operamos la plataforma digital <strong>Vanty</strong> para la gestión clínica y la comunicación
          con familias. Esta política describe cómo recopilamos, usamos y protegemos los datos personales
          y clínicos confiados a nuestro cargo.
        </p>
      </>
    ),
  },
  {
    id: 'datos',
    title: '2. Qué información recopilamos',
    body: (
      <>
        <p>Recopilamos únicamente la información necesaria para brindar nuestros servicios:</p>
        <ul>
          <li><strong>Datos de cuenta:</strong> nombre completo, correo electrónico, número de teléfono, foto de perfil opcional.</li>
          <li><strong>Datos del paciente:</strong> nombre, fecha de nacimiento, diagnóstico clínico, historial de sesiones, programas ABA y progreso terapéutico.</li>
          <li><strong>Datos de uso:</strong> registros de sesiones ABA, formularios clínicos, evaluaciones, reportes generados y respuestas al chequeo mensual de bienestar.</li>
          <li><strong>Datos de Google / Microsoft (opcionales):</strong> nombre, correo y foto de perfil si elegís iniciar sesión con esos proveedores. No accedemos a Gmail, Drive ni Outlook salvo Calendar — y solo con tu autorización explícita.</li>
          <li><strong>Datos técnicos:</strong> direcciones IP y registros de acceso, conservados de forma limitada por motivos de seguridad.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'uso',
    title: '3. Cómo usamos la información',
    body: (
      <>
        <ul>
          <li>Gestionar el historial clínico y el seguimiento terapéutico del paciente.</li>
          <li>Generar reportes de progreso para familias y profesionales.</li>
          <li>Enviar notificaciones de citas, recordatorios y comunicados del centro.</li>
          <li>Permitir la comunicación segura entre la familia y el equipo clínico.</li>
          <li>Mejorar la calidad de los servicios clínicos y de la plataforma Vanty.</li>
        </ul>
        <p><em>Nunca utilizamos los datos clínicos con fines publicitarios ni los vendemos a terceros.</em></p>
      </>
    ),
  },
  {
    id: 'compartir',
    title: '4. Con quién compartimos la información',
    body: (
      <>
        <p>La información puede ser compartida únicamente con:</p>
        <ul>
          <li>El equipo clínico de Neuropsicología y Terapias SANTI directamente involucrado en la atención del paciente.</li>
          <li>Proveedores de infraestructura tecnológica (Supabase para base de datos, Vercel para alojamiento) bajo estrictas políticas de confidencialidad.</li>
          <li>Proveedores de inteligencia artificial (Anthropic, Groq) procesando consultas puntuales del Asistente ARIA. Los datos enviados se descartan tras generar la respuesta y no se usan para entrenar modelos.</li>
          <li>Autoridades sanitarias o judiciales, exclusivamente cuando la ley lo exija expresamente.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seguridad',
    title: '5. Seguridad de los datos',
    body: (
      <>
        <p>Aplicamos múltiples capas de protección:</p>
        <ul>
          <li><strong>Cifrado AES-256</strong> de los datos en reposo (estándar bancario).</li>
          <li><strong>TLS 1.3</strong> en toda comunicación entre tu dispositivo y nuestros servidores.</li>
          <li><strong>Row Level Security (RLS)</strong> aplicada en cada tabla de la base de datos — cada cuenta solo puede acceder a los datos que le corresponden.</li>
          <li>Acceso del personal segmentado por <strong>roles</strong> (jefe, admin, especialista, terapeuta, secretaría, padre).</li>
          <li>Backups automáticos cifrados con redundancia geográfica.</li>
          <li>Auditoría de accesos a información sensible.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'ia',
    title: '6. Uso de Inteligencia Artificial (ARIA)',
    body: (
      <>
        <p>
          ARIA es nuestra asistente clínica basada en modelos de lenguaje. Su funcionamiento respeta los siguientes principios:
        </p>
        <ul>
          <li>Las consultas se procesan de forma contextual y se envía solo la información mínima necesaria.</li>
          <li>Los datos clínicos <strong>no se utilizan para entrenar modelos públicos</strong>.</li>
          <li>Cuando es técnicamente posible, los datos se anonimizan antes del procesamiento.</li>
          <li>Los reportes de análisis se generan a partir de tus datos pero los borradores temporales se descartan.</li>
          <li>El procesamiento por IA nunca reemplaza el criterio clínico del terapeuta.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'derechos',
    title: '7. Tus derechos (Ley 29733 · Perú)',
    body: (
      <>
        <p>Conforme a la Ley peruana de Protección de Datos Personales, tenés derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> solicitar una copia de los datos personales que conservamos.</li>
          <li><strong>Rectificación:</strong> corregir datos inexactos o desactualizados.</li>
          <li><strong>Eliminación:</strong> solicitar la baja de tu cuenta y de los datos asociados (sujeto a normativas de retención clínica).</li>
          <li><strong>Portabilidad:</strong> exportar tu información en un formato abierto y estructurado.</li>
          <li><strong>Oposición:</strong> limitar usos específicos de tus datos.</li>
          <li><strong>Información:</strong> conocer qué datos tenemos, con qué finalidad y por cuánto tiempo.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, escribinos a{' '}
          <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a>.
          Respondemos en un plazo máximo de 10 días hábiles.
        </p>
      </>
    ),
  },
  {
    id: 'google',
    title: '8. Inicio de sesión con Google / Microsoft',
    body: (
      <>
        <p>
          Si iniciás sesión con Google o Microsoft, utilizamos únicamente tu nombre, correo electrónico y foto de perfil
          para crear y gestionar tu cuenta. No accedemos a Gmail, Drive, OneDrive ni a ningún otro servicio sin tu
          consentimiento explícito.
        </p>
        <p>
          Si autorizás la sincronización con Google Calendar o Outlook Calendar, accedemos solo a la creación y
          actualización de eventos relacionados con tus citas en SANTI. Podés revocar este permiso en cualquier momento
          desde "Mi Perfil → Calendarios vinculados".
        </p>
      </>
    ),
  },
  {
    id: 'retencion',
    title: '9. Retención de datos',
    body: (
      <>
        <p>
          Los datos clínicos se conservan durante el período activo de atención y hasta <strong>5 años después</strong>{' '}
          del último servicio, conforme a las normativas peruanas de registros clínicos. Podés solicitar la eliminación
          anticipada en cualquier momento; en ese caso, conservaremos únicamente los registros mínimos requeridos
          por ley.
        </p>
      </>
    ),
  },
  {
    id: 'menores',
    title: '10. Protección especial de menores',
    body: (
      <>
        <p>
          Vanty está diseñada para gestionar datos de menores con el consentimiento expreso del padre, madre o tutor
          legal. Los datos del menor son tratados con el más alto nivel de confidencialidad:
        </p>
        <ul>
          <li>Solo el padre/tutor titular y los profesionales asignados al caso tienen acceso.</li>
          <li>No se utilizan los datos del menor para crear perfiles publicitarios ni de marketing.</li>
          <li>El padre/tutor puede revocar el acceso, descargar el expediente o solicitar la eliminación en cualquier momento.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'cambios',
    title: '11. Cambios en esta política',
    body: (
      <>
        <p>
          Podemos actualizar esta política para reflejar mejoras en nuestros servicios o cambios normativos.
          Notificaremos cualquier cambio relevante por correo electrónico y mediante un aviso destacado dentro de la
          plataforma. La fecha de última actualización siempre aparece al inicio de este documento.
        </p>
      </>
    ),
  },
  {
    id: 'contacto',
    title: '12. Contacto',
    body: (
      <>
        <p>Para cualquier consulta sobre esta política o sobre tus datos personales:</p>
        <p style={{ marginTop: 8 }}>
          <strong>Neuropsicología y Terapias SANTI</strong><br/>
          Av. Brasil 2730, Pueblo Libre 15084 — Lima, Perú<br/>
          📧 <a href="mailto:aprendizaje.santi@gmail.com" className="vanty-link">aprendizaje.santi@gmail.com</a><br/>
          📱 <a href="tel:+51991070734" className="vanty-link">+51 991 070 734</a>
        </p>
      </>
    ),
  },
]

export default function PrivacidadPage() {
  return (
    <div className="vanty-privacidad">
      {/* Estilos scoped — dark/light adaptativo + tipografía profesional */}
      <style>{`
        .vanty-privacidad {
          --vp-bg:        var(--background);
          --vp-card:      var(--card);
          --vp-surface:   var(--muted-bg);
          --vp-border:    var(--card-border);
          --vp-title:     var(--text-primary);
          --vp-body:      var(--text-secondary);
          --vp-muted:     var(--text-muted);
          --vp-accent:    #7c3aed;
          --vp-accent-2:  #db2777;

          min-height: 100vh;
          background: var(--vp-bg);
          color: var(--vp-body);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .vanty-privacidad .vp-container {
          max-width: 780px;
          margin: 0 auto;
          padding: 32px 20px 64px;
        }

        .vanty-privacidad .vp-hero {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #db2777 100%);
          border-radius: 24px;
          padding: 32px 28px;
          color: #fff;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(124,58,237,0.20);
          position: relative;
          overflow: hidden;
        }
        .vanty-privacidad .vp-hero::before {
          content: '';
          position: absolute;
          top: -50px; right: -50px;
          width: 200px; height: 200px;
          background: rgba(255,255,255,0.10);
          border-radius: 50%;
        }
        .vanty-privacidad .vp-hero::after {
          content: '';
          position: absolute;
          bottom: -40px; left: 40px;
          width: 130px; height: 130px;
          background: rgba(255,255,255,0.07);
          border-radius: 50%;
        }
        .vanty-privacidad .vp-brand {
          display: flex; align-items: center; gap: 10px;
          font-weight: 800; font-size: 14px;
          opacity: 0.95;
          margin-bottom: 14px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-brand-icon {
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.20);
          backdrop-filter: blur(6px);
          border-radius: 9px;
          display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 16px;
        }
        .vanty-privacidad .vp-title {
          font-size: 30px; font-weight: 900;
          line-height: 1.1; letter-spacing: -0.5px;
          margin: 0 0 6px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-subtitle {
          font-size: 13px;
          opacity: 0.85;
          margin: 0;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-badges {
          display: flex; flex-wrap: wrap; gap: 6px;
          margin-top: 16px;
          position: relative; z-index: 1;
        }
        .vanty-privacidad .vp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700;
          padding: 4px 10px;
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(4px);
          border-radius: 999px;
          letter-spacing: 0.3px;
        }

        .vanty-privacidad .vp-toc {
          background: var(--vp-card);
          border: 1px solid var(--vp-border);
          border-radius: 16px;
          padding: 18px 22px;
          margin-bottom: 28px;
        }
        .vanty-privacidad .vp-toc-title {
          font-size: 11px; font-weight: 800;
          color: var(--vp-muted);
          text-transform: uppercase; letter-spacing: 1px;
          margin: 0 0 10px;
        }
        .vanty-privacidad .vp-toc-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 4px 18px;
          list-style: none;
          padding: 0; margin: 0;
        }
        .vanty-privacidad .vp-toc-list a {
          display: block;
          color: var(--vp-body);
          text-decoration: none;
          font-size: 13px;
          padding: 6px 0;
          font-weight: 500;
          transition: color .15s;
        }
        .vanty-privacidad .vp-toc-list a:hover {
          color: var(--vp-accent);
        }

        .vanty-privacidad section.vp-section {
          background: var(--vp-card);
          border: 1px solid var(--vp-border);
          border-radius: 16px;
          padding: 22px 24px;
          margin-bottom: 14px;
        }
        .vanty-privacidad section.vp-section h2 {
          font-size: 17px; font-weight: 800;
          color: var(--vp-title);
          margin: 0 0 10px;
          letter-spacing: -0.2px;
        }
        .vanty-privacidad section.vp-section p {
          font-size: 14px; line-height: 1.65;
          color: var(--vp-body);
          margin: 0 0 10px;
        }
        .vanty-privacidad section.vp-section p:last-child { margin-bottom: 0; }
        .vanty-privacidad section.vp-section ul {
          padding-left: 18px;
          margin: 6px 0 10px;
          color: var(--vp-body);
        }
        .vanty-privacidad section.vp-section li {
          font-size: 14px; line-height: 1.6;
          padding: 3px 0;
        }
        .vanty-privacidad section.vp-section strong {
          color: var(--vp-title);
        }
        .vanty-privacidad section.vp-section em {
          color: var(--vp-muted);
          font-style: italic;
        }
        .vanty-privacidad .vanty-link {
          color: var(--vp-accent);
          text-decoration: none;
          font-weight: 600;
          border-bottom: 1px dashed var(--vp-accent);
        }
        .vanty-privacidad .vanty-link:hover {
          border-bottom-style: solid;
        }

        .vanty-privacidad .vp-footer {
          margin-top: 32px;
          padding-top: 22px;
          border-top: 1px solid var(--vp-border);
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 12px;
        }
        .vanty-privacidad .vp-footer p {
          font-size: 12px; color: var(--vp-muted);
          margin: 0;
        }
        .vanty-privacidad .vp-footer a {
          font-size: 12px;
          color: var(--vp-accent);
          font-weight: 700;
          text-decoration: none;
        }
        .vanty-privacidad .vp-footer a:hover { text-decoration: underline; }

        @media (max-width: 600px) {
          .vanty-privacidad .vp-title { font-size: 24px; }
          .vanty-privacidad .vp-hero { padding: 26px 22px; border-radius: 20px; }
          .vanty-privacidad section.vp-section { padding: 18px 20px; }
        }
      `}</style>

      <div className="vp-container">
        {/* Hero */}
        <div className="vp-hero">
          <div className="vp-brand">
            <span className="vp-brand-icon">🧩</span>
            <span>Vanty · Neuropsicología y Terapias SANTI</span>
          </div>
          <h1 className="vp-title">Política de Privacidad</h1>
          <p className="vp-subtitle">Última actualización: abril 2025 · Pueblo Libre, Lima — Perú</p>
          <div className="vp-badges">
            <span className="vp-badge">🔑 AES-256</span>
            <span className="vp-badge">⚙️ TLS 1.3</span>
            <span className="vp-badge">🗄️ Row Level Security</span>
            <span className="vp-badge">✓ Ley 29733 (PE)</span>
          </div>
        </div>

        {/* Tabla de contenidos */}
        <nav className="vp-toc" aria-label="Índice de contenidos">
          <p className="vp-toc-title">Índice</p>
          <ul className="vp-toc-list">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Secciones */}
        {SECTIONS.map(s => (
          <section key={s.id} id={s.id} className="vp-section">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}

        {/* Footer */}
        <div className="vp-footer">
          <p>© {new Date().getFullYear()} Neuropsicología y Terapias SANTI · Todos los derechos reservados</p>
          <a href="/terminos">Ver Términos de Servicio →</a>
        </div>
      </div>
    </div>
  )
}
