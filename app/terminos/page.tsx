export default function TerminosPage() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '48px 24px', color: '#1f2937', lineHeight: 1.7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <div style={{ width: 36, height: 36, background: '#4f46e5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 18 }}>🧩</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, color: '#1e1b4b' }}>Jugando Aprendo</span>
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b', marginBottom: 8 }}>Términos de Servicio</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 40 }}>Última actualización: marzo 2025 · Pisco, Ica, Perú</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>1. Aceptación de los términos</h2>
        <p>Al crear una cuenta y usar la plataforma Vanty de Jugando Aprendo, aceptás estos Términos de Servicio. Si no estás de acuerdo, por favor no uses la plataforma.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>2. Descripción del servicio</h2>
        <p>Vanty es una plataforma digital de gestión clínica para el centro Jugando Aprendo. Permite a los profesionales registrar y hacer seguimiento de programas ABA, y a las familias consultar el progreso de sus hijos, coordinar citas y comunicarse con el equipo terapéutico.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>3. Uso permitido</h2>
        <p>La plataforma es de uso exclusivo para:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Familias y pacientes activos del centro Jugando Aprendo.</li>
          <li>Profesionales y terapeutas del equipo clínico.</li>
          <li>Personal administrativo autorizado.</li>
        </ul>
        <p style={{ marginTop: 8 }}>Queda prohibido compartir credenciales de acceso, usar la plataforma para fines distintos a la gestión clínica, o intentar acceder a información de otros usuarios.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>4. Naturaleza clínica del servicio</h2>
        <p>La inteligencia artificial integrada en Vanty (ARIA) es una herramienta de apoyo clínico. Sus análisis y sugerencias son de carácter orientativo y <strong>no reemplazan el criterio del terapeuta certificado</strong>. Todas las decisiones clínicas son responsabilidad exclusiva del profesional a cargo.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>5. Confidencialidad</h2>
        <p>Toda la información clínica es estrictamente confidencial. Los usuarios se comprometen a no divulgar datos de otros pacientes ni del equipo clínico obtenidos a través de la plataforma.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>6. Cuentas de usuario</h2>
        <p>Sos responsable de mantener la seguridad de tu contraseña y de todas las actividades realizadas desde tu cuenta. Si detectás acceso no autorizado, notificanos de inmediato a tallerjugandoaprendoind@gmail.com.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>7. Disponibilidad del servicio</h2>
        <p>Nos esforzamos por mantener la plataforma disponible las 24 horas. Sin embargo, pueden ocurrir interrupciones por mantenimiento o causas técnicas. No nos hacemos responsables por pérdidas derivadas de la inactividad del servicio.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>8. Modificaciones</h2>
        <p>Nos reservamos el derecho de modificar estos términos. Los cambios significativos serán notificados por correo electrónico con al menos 15 días de anticipación.</p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>9. Contacto</h2>
        <p><strong>Jugando Aprendo</strong><br/>Pisco, Ica, Perú<br/>📧 tallerjugandoaprendoind@gmail.com<br/>📱 +51 924 807 183</p>
      </section>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>© 2025 Jugando Aprendo · Todos los derechos reservados</p>
        <a href="/privacidad" style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>Ver Política de Privacidad →</a>
      </div>
    </div>
  )
}
