// app/verificar/[codigo]/page.tsx
//
// Página pública de verificación de documentos emitidos por el sistema SANTI.
// Al escanear el QR de un documento clínico, esta página confirma su autenticidad
// mostrando metadata básica (sin información sensible del paciente).

import { obtenerDocumentoEmitido } from '@/lib/registrar-documento'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Next.js 16: params es un Promise — hay que awaitearlo
export default async function VerificarDocumento({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: codigoRaw } = await params
  const codigo = codigoRaw ? decodeURIComponent(codigoRaw) : ''
  const doc = codigo ? await obtenerDocumentoEmitido(codigo) : null

  const esValido = !!doc && doc.valido

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/40 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo institucional */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 mb-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Vanty ABA</h1>
          <p className="text-xs text-slate-500 mt-1">Sistema de verificación de documentos</p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-white rounded-3xl shadow-xl ring-1 ring-slate-200 overflow-hidden">

          {/* Banner de estado */}
          {!doc ? (
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold opacity-80">Documento no encontrado</p>
                  <h2 className="text-2xl font-bold">Código no válido</h2>
                </div>
              </div>
            </div>
          ) : !doc.valido ? (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold opacity-80">Documento invalidado</p>
                  <h2 className="text-2xl font-bold">Versión obsoleta</h2>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold opacity-80">Documento verificado</p>
                  <h2 className="text-2xl font-bold">Auténtico y vigente</h2>
                </div>
              </div>
            </div>
          )}

          {/* Cuerpo */}
          <div className="px-8 py-7">
            {!doc ? (
              <div className="text-center py-6">
                <p className="text-slate-700 text-base mb-2">
                  El código <span className="font-mono font-bold text-slate-900">{codigo}</span> no corresponde a ningún documento emitido por nuestro sistema.
                </p>
                <p className="text-sm text-slate-500 mt-4">
                  Si recibió este código de una fuente legítima, le recomendamos contactar al centro:
                </p>
                <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition">
                  💬 Contactar al centro
                </a>
              </div>
            ) : (
              <>
                {!doc.valido && doc.notas && (
                  <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                    <p className="font-bold mb-1">⚠️ Este documento ya no es válido</p>
                    <p className="text-amber-800">{doc.notas}</p>
                    <p className="text-xs text-amber-700 mt-2">Solicite al centro la versión actualizada.</p>
                  </div>
                )}

                <dl className="space-y-4">
                  <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                    <dt className="text-xs font-bold text-slate-500 w-32 shrink-0 pt-1">Tipo</dt>
                    <dd className="text-base font-bold text-slate-900">{doc.tipo_label}</dd>
                  </div>

                  <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                    <dt className="text-xs font-bold text-slate-500 w-32 shrink-0 pt-1">Código</dt>
                    <dd className="font-mono text-sm font-bold text-sky-700">{doc.codigo_doc}</dd>
                  </div>

                  {doc.paciente_iniciales && (
                    <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                      <dt className="text-xs font-bold text-slate-500 w-32 shrink-0 pt-1">Paciente</dt>
                      <dd className="text-base text-slate-700">
                        <span className="font-bold text-slate-900">{doc.paciente_iniciales}</span>
                        <span className="text-xs ml-2 text-slate-400 italic">(iniciales por privacidad)</span>
                      </dd>
                    </div>
                  )}

                  <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
                    <dt className="text-xs font-bold text-slate-500 w-32 shrink-0 pt-1">Emitido</dt>
                    <dd className="text-base text-slate-700">
                      {new Date(doc.fecha_emision).toLocaleDateString('es-PE', {
                        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                      })}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(doc.fecha_emision).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} hrs
                      </p>
                    </dd>
                  </div>

                  {doc.especialista && (
                    <div className="flex items-start gap-4">
                      <dt className="text-xs font-bold text-slate-500 w-32 shrink-0 pt-1">Responsable</dt>
                      <dd className="text-base text-slate-700">
                        <span className="font-bold text-slate-900">{doc.especialista}</span>
                        <p className="text-xs text-slate-500 italic mt-0.5">Centro de Vanty ABA</p>
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
                  <p>
                    ✅ Este código corresponde a un documento real emitido digitalmente por el sistema SANTI.
                    Este documento clínico <strong>no reemplaza un certificado médico-legal</strong>.
                    Su validez legal queda condicionada a la firma manuscrita o digital del profesional responsable.
                    Para consultar el contenido completo del informe, contacte al centro indicando el código.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-500 space-y-1">
          <p className="font-bold">Vanty ABA · Centro Especializado en Neurodesarrollo</p>
          <p>
            <a href="https://wa.me/51991070734" className="hover:text-sky-700">📞 +51 991 070 734</a>
            <span className="mx-2">·</span>
            <Link href="/" className="hover:text-sky-700">santiterapias.com</Link>
          </p>
          <p className="text-slate-400 italic mt-3">
            Sistema de verificación oficial · Consultado el {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}
