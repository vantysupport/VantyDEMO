'use client'
// app/padre/components/Tree3D.tsx
// Árboles 3D reales (three.js / react-three-fiber) para el "Modo Bosque".
//  • Procedural con primitivas low-poly + flat shading (estilo cozy farm),
//    sin archivos de modelo externos.
//  • Materiales DECLARATIVOS (sin hooks condicionales → seguro al cambiar de
//    especie) y auto-dispuestos por r3f al desmontar.
//  • SingleTree3D → un árbol (hero "Plantar" y miniaturas del selector).
//  • Forest3D → una sola escena tipo granjita con TODAS las plantas en el suelo.
//  • Se cargan con next/dynamic ssr:false desde ForestTimer (nunca en el server).

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

export type Species3D = 'pino' | 'manzano' | 'cerezo' | 'roble'

const FOLIAGE: Record<Species3D, { light: string; dark: string }> = {
  pino:    { light: '#4e9d52', dark: '#2f6b3a' },
  manzano: { light: '#6cc24a', dark: '#3f8f37' },
  cerezo:  { light: '#79c468', dark: '#4f9a45' },
  roble:   { light: '#7cab46', dark: '#4d7d33' },
}
const TRUNK: Record<Species3D, string> = {
  pino: '#6b4a2f', manzano: '#7a5230', cerezo: '#7a5230', roble: '#6b472c',
}

type Blob = [number, number, number, number] // x,y,z,r

// ── Tronco con base acampanada (root flare) que se clava en la tierra ────────
function Trunk({ color, h, r }: { color: string; h: number; r: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[r * 0.72, r * 1.15, h, 12]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <coneGeometry args={[r * 1.9, 0.28, 12]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  )
}

function Foliage({ blobs, light, dark }: { blobs: Blob[]; light: string; dark: string }) {
  return (
    <group>
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 3 === 2 ? dark : light} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Apple({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh castShadow>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#e0392f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.08, 5]} />
        <meshStandardMaterial color="#5a3b2c" roughness={1} />
      </mesh>
      <mesh position={[0.06, 0.16, 0]} rotation={[0, 0, -0.7]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#4f9a45" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Cherries({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[-0.08, -0.18, 0]} castShadow>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial color="#c41e3a" roughness={0.45} />
      </mesh>
      <mesh position={[0.08, -0.2, 0.02]} castShadow>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial color="#c41e3a" roughness={0.45} />
      </mesh>
      <mesh position={[-0.04, -0.05, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
        <meshStandardMaterial color="#4f7a35" roughness={1} />
      </mesh>
      <mesh position={[0.04, -0.06, 0.01]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
        <meshStandardMaterial color="#4f7a35" roughness={1} />
      </mesh>
    </group>
  )
}

function Acorn({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#caa15a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.075, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        <meshStandardMaterial color="#6b472c" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function PineTree() {
  const f = FOLIAGE.pino
  return (
    <group>
      <Trunk color={TRUNK.pino} h={0.75} r={0.16} />
      <mesh position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[1.0, 1.5, 12]} />
        <meshStandardMaterial color={f.dark} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <coneGeometry args={[0.78, 1.25, 12]} />
        <meshStandardMaterial color={f.light} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.75, 0]} castShadow>
        <coneGeometry args={[0.52, 1.05, 12]} />
        <meshStandardMaterial color={f.dark} roughness={1} flatShading />
      </mesh>
    </group>
  )
}

// ── El árbol según especie (base en y=0). Sin hooks → seguro al cambiar sp ───
function TreeBody({ species, fruit }: { species: Species3D; fruit: boolean }) {
  if (species === 'pino') return <PineTree />

  const f = FOLIAGE[species]
  const trunkColor = TRUNK[species]

  if (species === 'roble') {
    const blobs: Blob[] = [
      [0, 1.95, 0, 0.95],
      [-0.85, 1.7, 0.1, 0.72], [0.85, 1.7, -0.1, 0.72],
      [-0.45, 1.55, 0.75, 0.66], [0.45, 1.55, -0.75, 0.66],
      [0.55, 1.8, 0.55, 0.6], [-0.55, 1.8, -0.55, 0.6],
      [0, 1.55, 0.9, 0.58], [0, 1.6, -0.9, 0.58],
      [0, 2.45, 0, 0.6],
    ]
    return (
      <group>
        <Trunk color={trunkColor} h={1.15} r={0.27} />
        <Foliage blobs={blobs} light={f.light} dark={f.dark} />
        {fruit && (
          <>
            <Acorn p={[0.5, 1.35, 0.5]} />
            <Acorn p={[-0.55, 1.4, 0.2]} />
            <Acorn p={[0.2, 1.3, -0.6]} />
          </>
        )}
      </group>
    )
  }

  // manzano / cerezo — copa redonda compacta
  const small = species === 'cerezo'
  const blobs: Blob[] = small
    ? [
        [0, 1.7, 0, 0.66], [-0.5, 1.5, 0.05, 0.5], [0.5, 1.5, -0.05, 0.5],
        [0.05, 1.55, 0.5, 0.46], [-0.05, 1.55, -0.5, 0.46], [0, 2.05, 0, 0.46],
      ]
    : [
        [0, 1.8, 0, 0.72], [-0.55, 1.55, 0.08, 0.56], [0.55, 1.55, -0.08, 0.56],
        [0.08, 1.6, 0.55, 0.52], [-0.08, 1.6, -0.55, 0.52], [0, 2.2, 0, 0.5],
      ]
  return (
    <group>
      <Trunk color={trunkColor} h={small ? 1.0 : 1.05} r={small ? 0.15 : 0.17} />
      <Foliage blobs={blobs} light={f.light} dark={f.dark} />
      {species === 'manzano' && (
        <>
          <Apple p={[0.55, 1.45, 0.45]} />
          <Apple p={[-0.6, 1.5, 0.1]} />
          <Apple p={[0.2, 1.35, -0.6]} />
          {fruit && <Apple p={[-0.3, 1.7, 0.55]} />}
          {fruit && <Apple p={[0.45, 1.85, -0.25]} />}
        </>
      )}
      {species === 'cerezo' && (
        <>
          <Cherries p={[0.5, 1.45, 0.4]} />
          <Cherries p={[-0.5, 1.5, 0.15]} />
          <Cherries p={[0.15, 1.4, -0.5]} />
          {fruit && <Cherries p={[-0.2, 1.6, 0.5]} />}
        </>
      )}
    </group>
  )
}

function Withered() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.08, 0.16, 1.4, 8]} />
        <meshStandardMaterial color="#9b8a78" roughness={1} />
      </mesh>
      <mesh position={[0.25, 1.2, 0]} rotation={[0, 0, -0.8]}>
        <cylinderGeometry args={[0.04, 0.07, 0.6, 6]} />
        <meshStandardMaterial color="#9b8a78" roughness={1} />
      </mesh>
      <mesh position={[-0.22, 1.05, 0.1]} rotation={[0, 0, 0.9]}>
        <cylinderGeometry args={[0.04, 0.07, 0.5, 6]} />
        <meshStandardMaterial color="#9b8a78" roughness={1} />
      </mesh>
    </group>
  )
}

// Árbol con balanceo + escala de crecimiento (anclada a la base y=0)
function Tree({
  species, grow = 1, fruit = false, withered = false, swayPhase = 0, animate = true,
}: {
  species: Species3D; grow?: number; fruit?: boolean; withered?: boolean
  swayPhase?: number; animate?: boolean
}) {
  const g = useRef<THREE.Group>(null)
  const scaleRef = useRef(grow)
  useFrame((state, dt) => {
    if (!g.current) return
    scaleRef.current += (grow - scaleRef.current) * Math.min(1, dt * 3)
    const s = Math.max(0.12, scaleRef.current)
    g.current.scale.set(s, s, s)
    if (animate && !withered) {
      g.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1 + swayPhase) * 0.025
    }
  })
  return (
    <group ref={g}>
      {withered ? <Withered /> : <TreeBody species={species} fruit={fruit} />}
    </group>
  )
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#6f8f6a', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 7, 4]} intensity={1.15} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      />
    </>
  )
}

// ── Plato de tierra (vista "Plantar") ───────────────────────────────────────
function SoilPot() {
  return (
    <group position={[0, -0.18, 0]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[1.85, 1.95, 0.36, 40]} />
        <meshStandardMaterial color="#f3e6bf" roughness={1} />
      </mesh>
      <mesh position={[0, 0.19, 0]} receiveShadow>
        <cylinderGeometry args={[1.7, 1.7, 0.06, 40]} />
        <meshStandardMaterial color="#8a5a3b" roughness={1} />
      </mesh>
    </group>
  )
}

export function SingleTree3D({
  species, grow = 1, done = false, withered = false, animate = true,
}: {
  species: Species3D; grow?: number; done?: boolean; withered?: boolean; animate?: boolean
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      frameloop={animate ? 'always' : 'demand'}
      camera={{ position: [2.4, 2.4, 4.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera }) => camera.lookAt(0, 1.25, 0)}
    >
      <Lights />
      <SoilPot />
      <Tree species={species} grow={grow} fruit={done} withered={withered} animate={animate} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.32} scale={6} blur={2.4} far={4} />
    </Canvas>
  )
}

// ── Granjita 3D (vista "Mi bosque") ─────────────────────────────────────────
export type ForestItem = { species: Species3D; ok: boolean }

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#7bbf6a" roughness={1} />
      </mesh>
      {[-3, -1, 1, 3].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[40, 0.5]} />
          <meshStandardMaterial color="#69ad59" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function FieldTrees({ items }: { items: ForestItem[] }) {
  const list = items.slice(0, 40)
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)))
  const rowCount = Math.ceil(list.length / cols)
  const gap = 2.2
  return (
    <group>
      {list.map((it, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        const x = (c - (cols - 1) / 2) * gap
        const z = (r - (rowCount - 1) / 2) * gap
        return (
          <group key={i} position={[x, 0, z]} scale={0.62}>
            <Tree species={it.species} grow={1} fruit withered={!it.ok} swayPhase={i * 1.3} />
          </group>
        )
      })}
    </group>
  )
}

export function Forest3D({ items }: { items: ForestItem[] }) {
  const n = Math.min(40, items.length)
  const dist = 7 + Math.sqrt(Math.max(1, n)) * 2.0
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ position: [dist * 0.55, dist * 0.7, dist], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
    >
      <Lights />
      <Ground />
      <FieldTrees items={items} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.28} scale={40} blur={2.6} far={8} />
    </Canvas>
  )
}
