import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

// Coordinates scaled to sphere surface (radius = 2.2)
const DESTINATIONS = [
  { name: 'Birgunj (Home)', lat: 27.01, lng: 84.88, isHome: true, color: '#d9232d' },
  { name: 'Canada', lat: 56.13, lng: -106.34, isHome: false, color: '#0c3b5e' },
  { name: 'Australia', lat: -25.27, lng: 133.77, isHome: false, color: '#0c3b5e' },
  { name: 'United Kingdom', lat: 55.37, lng: -3.43, isHome: false, color: '#0c3b5e' },
  { name: 'USA', lat: 37.09, lng: -95.71, isHome: false, color: '#0c3b5e' },
  { name: 'Germany', lat: 51.16, lng: 10.45, isHome: false, color: '#0c3b5e' },
  { name: 'Ireland', lat: 53.14, lng: -7.69, isHome: false, color: '#0c3b5e' },
];

function latLngToVector3(lat, lng, radius = 2.2) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function GlobeInner() {
  const globeGroupRef = useRef();

  // Auto-rotate globe smoothly
  useFrame((_, delta) => {
    if (globeGroupRef.current) {
      globeGroupRef.current.rotation.y += delta * 0.15;
    }
  });

  const points = useMemo(() => {
    return DESTINATIONS.map(d => ({
      ...d,
      pos: latLngToVector3(d.lat, d.lng, 2.22)
    }));
  }, []);

  const homePos = points.find(p => p.isHome)?.pos || new THREE.Vector3(0, 0, 2.22);

  // Quadratic Bezier Arcs connecting Birgunj to destinations
  const arcs = useMemo(() => {
    return points
      .filter(p => !p.isHome)
      .map(dest => {
        const mid = new THREE.Vector3().addVectors(homePos, dest.pos).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(3.1); // curve outwards
        const curve = new THREE.QuadraticBezierCurve3(homePos, mid, dest.pos);
        return curve.getPoints(32);
      });
  }, [points, homePos]);

  return (
    <group ref={globeGroupRef}>
      {/* Central Solid Globe */}
      <Sphere args={[2.2, 64, 64]}>
        <meshPhysicalMaterial
          color="#f0f4f8"
          roughness={0.6}
          metalness={0.1}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
          reflectivity={0.5}
        />
      </Sphere>

      {/* Lat/Long Grid Wireframe */}
      <Sphere args={[2.21, 24, 24]}>
        <meshBasicMaterial
          color="#0c3b5e"
          wireframe
          transparent
          opacity={0.12}
        />
      </Sphere>

      {/* Outer Atmosphere Glow Ring */}
      <Sphere args={[2.35, 32, 32]}>
        <meshBasicMaterial
          color="#0c3b5e"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Destination Markers */}
      {points.map((pt, i) => (
        <group key={i} position={pt.pos}>
          <mesh>
            <sphereGeometry args={[pt.isHome ? 0.09 : 0.06, 16, 16]} />
            <meshStandardMaterial
              color={pt.color}
              emissive={pt.color}
              emissiveIntensity={0.8}
            />
          </mesh>
          {/* Subtle Outer Halo */}
          <mesh scale={1.8}>
            <sphereGeometry args={[pt.isHome ? 0.09 : 0.06, 16, 16]} />
            <meshBasicMaterial
              color={pt.color}
              transparent
              opacity={0.25}
            />
          </mesh>
        </group>
      ))}

      {/* Flight Path Arcs */}
      {arcs.map((arcPoints, idx) => (
        <Line
          key={idx}
          points={arcPoints}
          color={idx % 2 === 0 ? '#d9232d' : '#0c3b5e'}
          lineWidth={2.2}
          transparent
          opacity={0.65}
        />
      ))}
    </group>
  );
}

function FallbackLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50/50 rounded-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-navy-600 border-t-crimson-600 rounded-full animate-spin" />
        <span className="text-xs font-semibold text-navy-600">Loading 3D Globe...</span>
      </div>
    </div>
  );
}

export default function HeroGlobe3D() {
  return (
    <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[520px] flex items-center justify-center">
      {/* Soft Background Radial Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-navy-100/40 via-crimson-50/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

      <Suspense fallback={<FallbackLoader />}>
        <Canvas
          camera={{ position: [0, 0, 5.8], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#d9232d" />
          <pointLight position={[0, 5, 0]} intensity={0.8} color="#0c3b5e" />

          <Float speed={1.8} rotationIntensity={0.3} floatIntensity={0.4}>
            <GlobeInner />
          </Float>

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={false}
            rotateSpeed={0.5}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
      </Suspense>

      {/* Floating Badges on Globe Perimeter */}
      <div className="absolute top-4 left-2 sm:left-6 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg px-3.5 py-2 rounded-xl text-xs font-bold text-navy-800 flex items-center gap-2 animate-float-slow pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-crimson-600 animate-ping" />
        15+ Study Countries
      </div>

      <div className="absolute bottom-6 right-2 sm:right-6 bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-lg px-3.5 py-2 rounded-xl text-xs font-bold text-navy-800 flex items-center gap-2 animate-float-slow style={{ animationDelay: '3s' }} pointer-events-none">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        500+ Students Placed
      </div>
    </div>
  );
}
