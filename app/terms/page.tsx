export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Términos de Servicio</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: abril 2026</p>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">1. Aceptación de los términos</h2>
        <p>Al usar la plataforma del Centro SANTI, usted acepta estos términos de servicio en su totalidad.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">2. Uso del servicio</h2>
        <p>Esta plataforma está destinada exclusivamente a la gestión de citas y comunicación entre familias y especialistas del Centro Neuropsicología y Terapias SANTI.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">3. Responsabilidades del usuario</h2>
        <ul className="list-disc ml-6 mt-2 space-y-1">
          <li>Mantener la confidencialidad de sus credenciales de acceso</li>
          <li>No compartir información de otros usuarios sin autorización</li>
          <li>Usar la plataforma de manera respetuosa y apropiada</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">4. Contacto</h2>
        <p>Para consultas escribinos a:{" "}
          <a href="mailto:aprendizaje.santi@gmail.com" className="text-blue-600 underline">
            aprendizaje.santi@gmail.com
          </a>
        </p>
      </section>
    </main>
  );
}
