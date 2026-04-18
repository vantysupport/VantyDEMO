export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: abril 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Información que recopilamos</h2>
        <p>Recopilamos información que usted nos proporciona directamente, como nombre, correo electrónico y datos de calendario, únicamente para brindar los servicios de gestión de citas terapéuticas del Centro SANTI.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. Uso de la información</h2>
        <p>La información recopilada se utiliza exclusivamente para:</p>
        <ul className="list-disc ml-6 mt-2 space-y-1">
          <li>Gestionar citas y sesiones terapéuticas</li>
          <li>Enviar notificaciones relacionadas con sus citas</li>
          <li>Mejorar nuestros servicios</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Google Calendar</h2>
        <p>Utilizamos la API de Google Calendar para crear y gestionar eventos de citas. El acceso se realiza únicamente con su autorización explícita y los datos no se comparten con terceros.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">4. Seguridad</h2>
        <p>Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal contra acceso no autorizado.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">5. Contacto</h2>
        <p>Para consultas sobre esta política escribinos a:{" "}
          <a href="mailto:aprendizaje.santi@gmail.com" className="text-blue-600 underline">
            aprendizaje.santi@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
