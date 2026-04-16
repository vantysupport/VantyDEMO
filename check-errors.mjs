// ============================================================================
// check-errors.mjs - Detector de errores para jugando-aprendo
// Uso: node check-errors.mjs
// ============================================================================

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname

let totalErrors = 0
let totalWarnings = 0

function error(file, msg) {
  console.log(`  ❌ ERROR   | ${file}\n             └─ ${msg}`)
  totalErrors++
}
function warn(file, msg) {
  console.log(`  ⚠️  WARNING | ${file}\n             └─ ${msg}`)
  totalWarnings++
}
function ok(msg) {
  console.log(`  ✅ OK      | ${msg}`)
}

function getAllFiles(dir, exts = ['.ts', '.tsx'], results = []) {
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'public'].includes(entry.name))
        getAllFiles(full, exts, results)
    } else if (exts.some(e => entry.name.endsWith(e))) {
      results.push(full)
    }
  }
  return results
}

function rel(p) { return p.replace(ROOT + path.sep, '').replace(/\\/g, '/') }
function readFile(p) { return fs.readFileSync(p, 'utf-8') }

function countBalanced(content) {
  let brace = 0, paren = 0
  let inString = null, inTemplate = 0, inRegex = false, inCharClass = false
  let i = 0
  while (i < content.length) {
    const c = content[i]
    if (inRegex) {
      if (c === '\\') { i += 2; continue }
      if (c === '[' && !inCharClass) { inCharClass = true; i++; continue }
      if (c === ']' && inCharClass) { inCharClass = false; i++; continue }
      if (c === '/' && !inCharClass) { inRegex = false; inCharClass = false }
      i++; continue
    }
    if (inString) {
      if (c === '\\') { i += 2; continue }
      if (c === inString) inString = null
      i++; continue
    }
    if (inTemplate > 0) {
      if (c === '\\') { i += 2; continue }
      if (c === '`') inTemplate--
      i++; continue
    }
    if (c === '/' && content[i+1] === '/') { while (i < content.length && content[i] !== '\n') i++; continue }
    if (c === '/' && content[i+1] === '*') { i+=2; while (i < content.length && !(content[i]==='*'&&content[i+1]==='/')) i++; i+=2; continue }
    if (c === '"' || c === "'") { inString = c; i++; continue }
    if (c === '`') { inTemplate++; i++; continue }
    if (c === '/') {
      // Skip JSX self-closing tags /> — not a regex literal
      if (content[i+1] === '>') { i++; continue }
      const before = content.slice(Math.max(0, i-15), i).trim()
      if (/[=(,\[{!&|?:;+\-*~^%]$/.test(before) || /\b(return|typeof|in|of|new|delete|void|throw|case|yield|await)$/.test(before)) {
        inRegex = true; i++; continue
      }
    }
    if (c === '{') brace++; else if (c === '}') brace--
    if (c === '(') paren++; else if (c === ')') paren--
    i++
  }
  return { brace, paren }
}

function checkBraceBalance(files) {
  console.log('\n📋 CHECK 1: Balance de llaves y paréntesis')
  let found = false
  for (const f of files) {
    const { brace, paren } = countBalanced(readFile(f))
    if (brace !== 0) { error(rel(f), `Llaves desbalanceadas: diferencia de ${brace>0?'+':''}${brace}`); found = true }
    if (paren !== 0) { error(rel(f), `Paréntesis desbalanceados: diferencia de ${paren>0?'+':''}${paren}`); found = true }
  }
  if (!found) ok('Todos los archivos tienen llaves/paréntesis balanceados')
}

function checkExportDefault(files) {
  console.log('\n📋 CHECK 2: export default en componentes/páginas')
  let found = false
  const namedOnlyFiles = ['Toast.tsx', 'UIComponents.tsx']
  const componentFiles = files.filter(f =>
    (f.includes('/app/') || f.includes('/components/')) && f.endsWith('.tsx') &&
    !f.includes('/api/') && !f.includes('shared/index') && !f.includes('/data/') &&
    !namedOnlyFiles.some(n => f.endsWith(n))
  )
  for (const f of componentFiles) {
    if (!/export\s+default\s+/.test(readFile(f))) {
      error(rel(f), 'Falta export default'); found = true
    }
  }
  if (!found) ok('Todos los componentes tienen export default')
}

function checkUseClient(files) {
  console.log("\n📋 CHECK 3: Directiva 'use client' en archivos con hooks/JSX")
  let found = false
  const clientPatterns = [/useState/, /useEffect/, /useRef/, /useCallback/, /useMemo/, /useRouter/, /useToast/]
  for (const f of files) {
    if (f.includes('/api/') || f.includes('actions.ts') || f.endsWith('.ts')) continue
    const content = readFile(f)
    const needsClient = clientPatterns.some(p => p.test(content))
    const hasUseClient = content.trimStart().startsWith("'use client'") || content.trimStart().startsWith('"use client"')
    if (needsClient && !hasUseClient) {
      error(rel(f), "Usa hooks React pero falta 'use client' al inicio"); found = true
    }
  }
  if (!found) ok("Todos los archivos con hooks tienen 'use client'")
}

function checkReactImports(files) {
  console.log('\n📋 CHECK 4: Imports de React hooks')
  let found = false
  const HOOKS = ['useState','useEffect','useRef','useCallback','useMemo','useContext','useReducer','useLayoutEffect']
  for (const f of files) {
    const content = readFile(f)
    const m = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/)
    const imported = new Set(m ? m[1].split(',').map(s => s.trim()) : [])
    const missing = HOOKS.filter(h =>
      (new RegExp(`\\b${h}\\s*[(<]`).test(content) || new RegExp(`\\b${h}\\s*=`).test(content)) && !imported.has(h)
    )
    if (missing.length > 0) { error(rel(f), `Hooks sin importar: ${missing.join(', ')}`); found = true }
  }
  if (!found) ok('Todos los hooks de React están correctamente importados')
}

const ALL_LUCIDE = new Set([
  'Activity','AlertCircle','AlertOctagon','AlertTriangle','Archive','ArrowLeft','ArrowRight',
  'Award','Baby','BarChart3','Bell','BellOff','Book','BookOpen','Brain','Camera','Calendar',
  'CheckCircle','CheckCircle2','ChevronDown','ChevronLeft','ChevronRight','ChevronUp',
  'Clock','ClipboardList','Code','Coffee','Compass','Cpu','Database','DollarSign',
  'Download','Edit','Eye','EyeOff','ExternalLink','File','FileCheck','FileDown',
  'FileSpreadsheet','FileText','FileWarning','Filter','Flag','Flame','FolderOpen',
  'Gift','Globe','Grid','HardDrive','Headphones','Heart','HelpCircle','Home',
  'Info','Key','Laptop','Layers','LayoutDashboard','List',
  'Lock','Loader2','LogOut','Mail','MapPin','Menu','MessageCircle','MessageSquareHeart',
  'Mic','Monitor','MoreHorizontal','Navigation','Package','PartyPopper','Phone',
  'PieChart','PlayCircle','Plus','Printer','QrCode','RefreshCw','Save','Search',
  'Send','Settings','Share2','ShieldAlert','ShieldCheck','Smile','Sparkles','Star',
  'Stethoscope','Table','Tag','Target','Terminal','Thermometer','Ticket','Trash2',
  'TrendingDown','TrendingUp','Upload','User','UserPlus','Users','Video','Volume2',
  'Watch','Wifi','Wrench','X','Zap','Instagram','Facebook','Twitter','Youtube',
  'Maximize','Minimize','Moon','Sun','Power','Repeat','Scissors','Shield','Sidebar',
  'Sliders','Smartphone','Tablet','Type','Unlock','Weight','AtSign','Hash','Frown',
])
const NOT_LUCIDE = new Set(['Image','Link','Script','Head','Router'])

function checkLucideImports(files) {
  console.log('\n📋 CHECK 5: Iconos de lucide-react faltantes')
  let found = false
  for (const f of files.filter(f => f.endsWith('.tsx'))) {
    const content = readFile(f)
    const lucideImports = new Set()
    for (const m of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g))
      for (const icon of m[1].split(','))
        lucideImports.add(icon.trim().split(' as ')[0].trim())
    const used = new Set([
      ...[...content.matchAll(/<([A-Z][a-zA-Z0-9]+)[\s/>]/g)].map(m => m[1]),
      ...[...content.matchAll(/[{(,\s=]<([A-Z][a-zA-Z0-9]+)[\s/>]/g)].map(m => m[1]),
    ])
    const missing = [...used].filter(n => ALL_LUCIDE.has(n) && !lucideImports.has(n) && !NOT_LUCIDE.has(n))
    if (missing.length > 0) { error(rel(f), `Iconos lucide no importados: ${missing.join(', ')}`); found = true }
  }
  if (!found) ok('Todos los iconos de lucide-react están importados')
}

function checkSupabaseInApiRoutes(files) {
  console.log('\n📋 CHECK 6: Cliente Supabase correcto en API routes')
  let found = false
  for (const f of files.filter(f => f.includes('/api/') && f.endsWith('route.ts'))) {
    if (/from\s+['"]@\/lib\/supabase['"]/.test(readFile(f))) {
      error(rel(f), "Usa cliente browser. Debe usar '@/lib/supabase-admin'"); found = true
    }
  }
  if (!found) ok('Todas las API routes usan supabaseAdmin correctamente')
}

function checkMissingApiRoutes(files) {
  console.log('\n📋 CHECK 7: Rutas API referenciadas por fetch() existen')
  let found = false
  const fetchCalls = new Set()
  for (const f of files)
    for (const m of readFile(f).matchAll(/fetch\(['"]([^'"]+)['"]/g))
      if (m[1].startsWith('/api/')) fetchCalls.add(m[1].split('?')[0])
  for (const route of fetchCalls) {
    const routePath = path.join(ROOT, 'app', ...route.slice(1).split('/'), 'route.ts')
    if (!fs.existsSync(routePath)) { error('fetch', `Ruta '${route}' no tiene route.ts`); found = true }
  }
  if (!found) ok('Todas las rutas API referenciadas existen')
}

function checkNextEnv() {
  console.log('\n📋 CHECK 8: next-env.d.ts')
  const p = path.join(ROOT, 'next-env.d.ts')
  if (!fs.existsSync(p)) { warn('next-env.d.ts', 'No encontrado'); return }
  if (/^import\s+/m.test(readFile(p)))
    error('next-env.d.ts', 'Contiene import inválido (solo se permiten /// <reference>)')
  else ok('next-env.d.ts está correcto')
}

function checkStrayTokens(files) {
  console.log('\n📋 CHECK 9: Tokens sueltos / sintaxis rota')
  let found = false
  for (const f of files) {
    const lines = readFile(f).split('\n')
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if ((trimmed === ')' || trimmed === ');') && i > 0) {
        const prev = lines[i-1]?.trim() || ''
        if (/(?<![=!<>])=\s*[a-zA-Z_$][a-zA-Z0-9_$.]*\s*$/.test(prev)) {
          error(rel(f), `Paréntesis suelto en línea ${i+1} tras: "${prev}"`); found = true
        }
      }
    }
  }
  if (!found) ok('No se detectaron tokens sueltos obvios')
}

function checkTsxExtension(files) {
  console.log('\n📋 CHECK 10: Archivos con JSX tienen extensión .tsx')
  let found = false
  for (const f of files.filter(f => f.endsWith('.ts') && !f.includes('/api/') && !f.includes('actions.ts'))) {
    const content = readFile(f)
    if (/<[A-Z][a-zA-Z]+[\s/>]/.test(content)) { warn(rel(f), 'JSX en archivo .ts (debería ser .tsx)'); found = true }
  }
  if (!found) ok('Todos los archivos con JSX tienen extensión .tsx')
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════')
console.log('  🔍 DETECTOR DE ERRORES - jugando-aprendo')
console.log('  Uso: node check-errors.mjs')
console.log('═══════════════════════════════════════════════════════════')

const allFiles = [
  ...getAllFiles(path.join(ROOT, 'app')),
  ...getAllFiles(path.join(ROOT, 'components')),
  ...getAllFiles(path.join(ROOT, 'lib')),
]

checkBraceBalance(allFiles)
checkExportDefault(allFiles)
checkUseClient(allFiles)
checkReactImports(allFiles)
checkLucideImports(allFiles)
checkSupabaseInApiRoutes(allFiles)
checkMissingApiRoutes(allFiles)
checkNextEnv()
checkStrayTokens(allFiles)
checkTsxExtension(allFiles)

console.log('\n═══════════════════════════════════════════════════════════')
if (totalErrors === 0 && totalWarnings === 0)
  console.log('  🎉 ¡PERFECTO! No se detectaron errores.')
else {
  if (totalErrors > 0) console.log(`  ❌ ${totalErrors} ERROR(ES) — corregir antes del build`)
  if (totalWarnings > 0) console.log(`  ⚠️  ${totalWarnings} ADVERTENCIA(S)`)
}
console.log('═══════════════════════════════════════════════════════════\n')
process.exit(totalErrors > 0 ? 1 : 0)
