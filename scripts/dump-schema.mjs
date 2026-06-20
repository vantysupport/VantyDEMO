// Genera un esquema SQL completo del proyecto original conectándose directo a
// Postgres (sin Docker ni pg_dump). Reconstruye: extensiones, secuencias,
// tablas (con tipos exactos: vector(N), varchar(N)…), funciones, constraints,
// índices, RLS + políticas y triggers. Salida: esquema-original.sql
import pg from 'pg'
import { writeFileSync } from 'node:fs'

const URL = process.env.PGURL
const client = new pg.Client({ connectionString: URL, ssl: { rejectUnauthorized: false } })

const q = async (sql, params = []) => (await client.query(sql, params)).rows
const out = []
const w = (s = '') => out.push(s)

await client.connect()

w('-- ════════════════════════════════════════════════════════════════════')
w('-- ESQUEMA RECONSTRUIDO del proyecto original (Santi) — schema public')
w('-- Generado automáticamente. Correr en el SQL Editor del proyecto DEMO.')
w('-- ════════════════════════════════════════════════════════════════════')
w()
w('-- Resuelve el tipo "vector" y demás esté donde esté instalado pgvector.')
w('set search_path = public, extensions;')
w()

// ── 1) EXTENSIONES ──────────────────────────────────────────────────────────
const exts = await q(`
  select extname from pg_extension
  where extname not in ('plpgsql')
  order by extname`)
w('-- ── Extensiones ──')
for (const e of exts) {
  w(`create extension if not exists "${e.extname}" with schema extensions;`)
}
w()

// ── 2) SECUENCIAS ───────────────────────────────────────────────────────────
const seqs = await q(`select sequencename from pg_sequences where schemaname='public' order by sequencename`)
if (seqs.length) {
  w('-- ── Secuencias ──')
  for (const s of seqs) w(`create sequence if not exists public."${s.sequencename}";`)
  w()
}

// ── 3) TABLAS (columnas + default + not null) ───────────────────────────────
const cols = await q(`
  select c.relname as tbl, a.attnum, a.attname,
         format_type(a.atttypid, a.atttypmod) as type,
         a.attnotnull as notnull,
         pg_get_expr(ad.adbin, ad.adrelid) as def
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname, a.attnum`)

const byTable = new Map()
for (const r of cols) {
  if (!byTable.has(r.tbl)) byTable.set(r.tbl, [])
  byTable.get(r.tbl).push(r)
}
w('-- ── Tablas ──')
for (const [tbl, list] of byTable) {
  w(`create table if not exists public."${tbl}" (`)
  const lines = list.map(c => {
    let line = `  "${c.attname}" ${c.type}`
    if (c.def) line += ` default ${c.def}`
    if (c.notnull) line += ' not null'
    return line
  })
  w(lines.join(',\n'))
  w(');')
  w()
}

// ── 4) FUNCIONES (solo propias: sin agregadas ni de extensiones) ────────────
const fns = await q(`
  select pg_get_functiondef(p.oid) as ddl, p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and p.prokind = 'f' and d.objid is null
  order by p.proname`)
w('-- ── Funciones ──')
for (const f of fns) { w(f.ddl + ';'); w() }

// ── 5) CONSTRAINTS (PK/UNIQUE/CHECK primero, FK después) ────────────────────
const cons = await q(`
  select c.relname as tbl, con.conname, con.contype,
         pg_get_constraintdef(con.oid) as def
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  order by case con.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end`)
w('-- ── Llaves y constraints ──')
for (const c of cons) {
  w(`alter table public."${c.tbl}" add constraint "${c.conname}" ${c.def};`)
}
w()

// ── 6) ÍNDICES (no los de PK/UNIQUE, que ya van por constraint) ─────────────
const idx = await q(`
  select pg_get_indexdef(ix.indexrelid) as def
  from pg_index ix
  join pg_class c on c.oid = ix.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not ix.indisprimary and not ix.indisunique
  order by c.relname`)
if (idx.length) {
  w('-- ── Índices ──')
  for (const i of idx) w(i.def.replace(/^CREATE INDEX/i, 'create index if not exists').replace(/^CREATE UNIQUE INDEX/i, 'create unique index if not exists') + ';')
  w()
}

// ── 7) RLS: habilitar + políticas ───────────────────────────────────────────
const rlsTables = await q(`
  select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity order by c.relname`)
w('-- ── RLS (Row Level Security) ──')
for (const t of rlsTables) w(`alter table public."${t.relname}" enable row level security;`)
w()

const pols = await q(`
  select tablename, policyname, permissive, cmd, roles, qual, with_check
  from pg_policies where schemaname='public'
  order by tablename, policyname`)
w('-- ── Políticas ──')
for (const p of pols) {
  const rolesArr = Array.isArray(p.roles)
    ? p.roles
    : String(p.roles || '').replace(/^\{|\}$/g, '').split(',').filter(Boolean)
  const roles = (rolesArr.length ? rolesArr : ['public'])
    .map(r => r === 'public' ? 'public' : `"${r}"`).join(', ')
  let s = `create policy "${p.policyname}" on public."${p.tablename}" as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${roles}`
  if (p.qual) s += ` using (${p.qual})`
  if (p.with_check) s += ` with check (${p.with_check})`
  w(s + ';')
}
w()

// ── 8) TRIGGERS (public + los de auth.users que usan funciones propias) ─────
const trgs = await q(`
  select pg_get_triggerdef(t.oid) as def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','auth') and not t.tgisinternal
  order by c.relname`)
if (trgs.length) {
  w('-- ── Triggers ──')
  for (const t of trgs) w(t.def + ';')
  w()
}

await client.end()
writeFileSync('esquema-original.sql', out.join('\n'), 'utf8')
console.log(`OK — ${byTable.size} tablas, ${fns.length} funciones, ${cons.length} constraints, ${idx.length} índices, ${pols.length} políticas, ${trgs.length} triggers`)
console.log('Archivo: esquema-original.sql')
