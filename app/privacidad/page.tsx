export default function PrivacidadPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1f2937', lineHeight: 1.7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <div style={{ width: 36, height: 36, background: '#4f46e5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 18 }}>🧩</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>Jugando Aprendo</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b', marginBottom: 8 }}>Política de Privacidad</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>Última actualización: marzo 2025 · Pisco, Ica, Perú</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>1. Quiénes somos</h2>
        <p>Jugando Aprendo es un centro de terapia especializada en intervención infantil ABA, TEA y TDAH ubicado en Pisco, Ica, Perú. Operamos la plataforma digital Vanty para la gestión clínica y comunicación con familias.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>2. Qué información recopilamos</h2>
        <p>Recopilamos únicamente la información necesaria para brindar nuestros servicios:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Datos de cuenta:</strong> nombre completo, correo electrónico, número de teléfono.</li>
          <li><strong>Datos del paciente:</strong> nombre, fecha de nacimiento, diagnóstico clínico, historial de sesiones y progreso terapéutico.</li>
          <li><strong>Datos de uso:</strong> registros de sesiones ABA, formularios clínicos, evaluaciones y reportes generados.</li>
          <li><strong>Datos de Google (si usás inicio de sesión con Google):</strong> nombre, correo electrónico y foto de perfil proporcionados por Google.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>3. Cómo usamos la información</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>Gestionar el historial clínico y seguimiento terapéutico del paciente.</li>
          <li>Generar reportes de progreso para familias y profesionales.</li>
          <li>Enviar notificaciones de citas y recordatorios.</li>
          <li>Mejorar nuestros servicios clínicos y la plataforma Vanty.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>4. Con quién compartimos la información</h2>
        <p>No vendemos ni compartimos datos personales con terceros con fines comerciales. La información puede ser compartida únicamente con:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>El equipo clínico de Jugando Aprendo directamente involucrado en la atención del paciente.</li>
          <li>Proveedores de infraestructura tecnológica (Supabase para base de datos, Vercel para alojamiento) bajo estrictas políticas de confidencialidad.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>5. Seguridad de los datos</h2>
        <p>Todos los datos se transmiten mediante cifrado SSL/TLS. La base de datos está protegida con autenticación de dos factores y políticas de acceso por roles. Los datos clínicos son accesibles únicamente al personal autorizado.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>6. Derechos del usuario</h2>
        <p>Tenés derecho a solicitar en cualquier momento:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Acceso a los datos personales que tenemos sobre vos.</li>
          <li>Corrección de datos incorrectos o desactualizados.</li>
          <li>Eliminación de tu cuenta y datos asociados.</li>
        </ul>
        <p style={{ marginTop: 8 }}>Para ejercer estos derechos, escribinos a: <strong>tallerjugandoaprendoind@gmail.com</strong></p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>7. Uso de Google OAuth</h2>
        <p>Si iniciás sesión con Google, utilizamos únicamente tu nombre, correo electrónico y foto de perfil para crear y gestionar tu cuenta. No accedemos a tu Gmail, Drive, Calendar ni ningún otro servicio de Google sin tu consentimiento explícito.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>8. Retención de datos</h2>
        <p>Los datos clínicos se conservan durante el período activo de atención y hasta 5 años después del último servicio, conforme a las normativas de registros clínicos en Perú. Podés solicitar la eliminación anticipada contactándonos.</p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>9. Contacto</h2>
        <p>Para cualquier consulta sobre esta política:</p>
        <p style={{ marginTop: 8 }}><strong>Jugando Aprendo</strong><br/>Pisco, Ica, Perú<br/>📧 tallerjugandoaprendoind@gmail.com<br/>📱 +51 924 807 183</p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>© 2025 Jugando Aprendo · Todos los derechos reservados</p>
        <a href="/terminos" style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>Ver Términos de Servicio →</a>
      </div>
    </div>
  )
}
