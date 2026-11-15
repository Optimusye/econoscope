import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CONTINENT_POLYGONS, SEA_HOLES } from "../utils/worldGeo";
import { CHOKEPOINTS, HOTSPOTS, REGIONS, SHOCK_HOTSPOT_MAP, TRADE_ARCS } from "../data/econoscopeData";
import type {
  EconomicAlert,
  HeatmapMode,
  RegionKey,
  RiskHotspot,
  Severity,
  ThemeMode,
} from "../types/econoscope";
import { Compass, RotateCcw } from "lucide-react";

interface Globe3DHeatmapProps {
  theme: ThemeMode;
  region: RegionKey;
  heatmapMode: HeatmapMode;
  showRiskNodes: boolean;
  showChokepoints: boolean;
  showHeatmap: boolean;
  showTradeArcs: boolean;
  showPillars?: boolean;
  showNightLights?: boolean;
  autoRotate?: boolean;
  shockLevel: number;
  alerts: EconomicAlert[];
  extraHotspots?: RiskHotspot[];
  focusedHotspotId?: string | null;
  heightClass?: string;
  onSelectHotspot: (alertId: string, hotspotId?: string) => void;
}

const GLOBE_RADIUS = 1.0;

const SEVERITY_HEX: Record<Severity, number> = {
  CRITICAL: 0xef4444,
  ELEVATED: 0xf59e0b,
  WATCH: 0xe4e4e7,
};

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _targetDir = new THREE.Vector3();

function latLonToVec3(lat: number, lon: number, radius: number, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return out.set(x, y, z);
}

function computeHotspotIntensity(hspot: RiskHotspot, mode: HeatmapMode): number {
  if (mode === "geopolitical") return hspot.geopoliticalWeight;
  if (mode === "inflation") return hspot.economicWeight;
  if (mode === "food") return Math.min(1, hspot.foodInflationPct / 34);
  if (mode === "maritime") return Math.min(1, (hspot.portDelayDays / 7) * 0.75 + (hspot.category === "Chokepoint" ? 0.3 : 0));
  return hspot.geopoliticalWeight * 0.48 + hspot.economicWeight * 0.52;
}

function buildEarthTexture(maxAnisotropy: number, theme: ThemeMode): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const isDark = theme === "dark";

  // Clean monochrome architectural Earth palette (Zero Blue)
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (isDark) {
    oceanGrad.addColorStop(0, "#0b0b0e");
    oceanGrad.addColorStop(0.5, "#151519");
    oceanGrad.addColorStop(1, "#09090b");
  } else {
    oceanGrad.addColorStop(0, "#d4d4d8");
    oceanGrad.addColorStop(0.5, "#e4e4e7");
    oceanGrad.addColorStop(1, "#d4d4d8");
  }
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle neutral radial depth sheen
  const centerGlow = ctx.createRadialGradient(w * 0.5, h * 0.48, 40, w * 0.5, h * 0.48, w * 0.55);
  centerGlow.addColorStop(0, isDark ? "rgba(255, 255, 255, 0.045)" : "rgba(255, 255, 255, 0.35)");
  centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, w, h);

  // Minimal clean graticule lines (every 30 deg)
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * w;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(24, 24, 27, 0.08)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * h;
    ctx.strokeStyle =
      lat === 0
        ? isDark
          ? "rgba(255, 255, 255, 0.14)"
          : "rgba(24, 24, 27, 0.18)"
        : isDark
          ? "rgba(255, 255, 255, 0.06)"
          : "rgba(24, 24, 27, 0.08)";
    ctx.lineWidth = lat === 0 ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const toXY = ([lon, lat]: [number, number]): [number, number] => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
  ];

  // Continents: crisp silhouette without clutter
  ctx.save();
  ctx.fillStyle = isDark ? "#323238" : "#52525b";
  ctx.strokeStyle = isDark ? "rgba(228, 228, 231, 0.55)" : "rgba(24, 24, 27, 0.68)";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";

  for (const poly of Object.values(CONTINENT_POLYGONS)) {
    ctx.beginPath();
    poly.forEach((pt, idx) => {
      const [x, y] = toXY(pt);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Carve inland seas cleanly
  ctx.fillStyle = isDark ? "#131317" : "#dcdce0";
  ctx.strokeStyle = isDark ? "rgba(212, 212, 216, 0.35)" : "rgba(24, 24, 27, 0.45)";
  ctx.lineWidth = 1.1;
  for (const hole of SEA_HOLES) {
    ctx.beginPath();
    hole.forEach((pt, idx) => {
      const [x, y] = toXY(pt);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function buildCityLightsTexture(hotspots: RiskHotspot[], maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  // Neutral silver-white & warm gold economic hub lights
  for (let i = 0; i < hotspots.length; i++) {
    const hs = hotspots[i];
    const cx = ((hs.lon + 180) / 360) * w;
    const cy = ((90 - hs.lat) / 180) * h;

    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 14);
    glow.addColorStop(0, "rgba(250, 250, 250, 0.92)");
    glow.addColorStop(0.45, "rgba(212, 212, 216, 0.3)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    for (let k = 0; k < 10; k++) {
      const ang = (i * 1.7 + k * 2.399) % (Math.PI * 2);
      const rad = 3 + ((k * 7 + i * 3) % 13);
      const sx = cx + Math.cos(ang) * rad;
      const sy = cy + Math.sin(ang) * rad * 0.7;
      ctx.fillStyle = k % 3 === 0 ? "rgba(253, 224, 71, 0.72)" : "rgba(244, 244, 245, 0.7)";
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function paintHeatmapCanvas(
  canvas: HTMLCanvasElement,
  hotspots: RiskHotspot[],
  mode: HeatmapMode,
  shockLevel: number,
  region: RegionKey
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const shockBoost = 1 + shockLevel * 0.13;
  for (const hspot of hotspots) {
    const x = ((hspot.lon + 180) / 360) * w;
    const y = ((90 - hspot.lat) / 180) * h;

    let intensity = computeHotspotIntensity(hspot, mode);
    const isShocked = Object.entries(SHOCK_HOTSPOT_MAP).some(
      ([sid, hid]) => hid === hspot.id && Number(sid.slice(1)) <= shockLevel
    );
    if (isShocked) intensity = Math.min(1, intensity * 1.3);
    else intensity = Math.min(1, intensity * shockBoost * 0.92);

    const inRegion = region === "global" || hspot.regions.includes(region);
    const alphaScale = inRegion ? 1 : 0.25;

    const radius = (34 + intensity * 44) * (isShocked ? 1.25 : 1);
    const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);

    if (intensity >= 0.8) {
      grad.addColorStop(0, `rgba(239, 68, 68, ${0.88 * alphaScale})`);
      grad.addColorStop(0.42, `rgba(245, 158, 11, ${0.48 * alphaScale})`);
      grad.addColorStop(1, "rgba(245, 158, 11, 0)");
    } else if (intensity >= 0.62) {
      grad.addColorStop(0, `rgba(245, 158, 11, ${0.75 * alphaScale})`);
      grad.addColorStop(0.5, `rgba(212, 212, 216, ${0.24 * alphaScale})`);
      grad.addColorStop(1, "rgba(212, 212, 216, 0)");
    } else {
      grad.addColorStop(0, `rgba(228, 228, 231, ${0.52 * alphaScale})`);
      grad.addColorStop(0.55, `rgba(161, 161, 170, ${0.16 * alphaScale})`);
      grad.addColorStop(1, "rgba(161, 161, 170, 0)");
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function Globe3DHeatmap({
  theme,
  region,
  heatmapMode,
  showRiskNodes,
  showChokepoints,
  showHeatmap,
  showTradeArcs,
  showPillars = true,
  showNightLights = true,
  autoRotate = true,
  shockLevel,
  alerts,
  extraHotspots = [],
  focusedHotspotId = null,
  heightClass = "h-[540px] lg:h-[620px]",
  onSelectHotspot,
}: Globe3DHeatmapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<{
    hotspot: RiskHotspot;
    severity: Severity;
    x: number;
    y: number;
  } | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const propsRef = useRef({
    theme,
    region,
    heatmapMode,
    showRiskNodes,
    showChokepoints,
    showHeatmap,
    showTradeArcs,
    showPillars,
    showNightLights,
    autoRotate,
    shockLevel,
    alerts,
    extraHotspots,
    focusedHotspotId,
    onSelectHotspot,
  });
  propsRef.current = {
    theme,
    region,
    heatmapMode,
    showRiskNodes,
    showChokepoints,
    showHeatmap,
    showTradeArcs,
    showPillars,
    showNightLights,
    autoRotate,
    shockLevel,
    alerts,
    extraHotspots,
    focusedHotspotId,
    onSelectHotspot,
  };

  const controlsApiRef = useRef<{
    focusRegion: (reg: RegionKey) => void;
    focusHotspot: (hotspotId: string) => void;
    updateLayers: () => void;
    syncExtraHotspots: () => void;
    setAutoRotate: (enabled: boolean) => void;
    updateTheme: (mode: ThemeMode) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe) return true;
      const ext = probe.getExtension("WEBGL_debug_renderer_info");
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension("WEBGL_lose_context")?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(300, container.clientHeight);
    const initialBg = propsRef.current.theme === "dark" ? 0x09090b : 0xe4e4e7;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.FogExp2(initialBg, 0.06);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 40);
    camera.position.set(0.3, 0.72, 2.68);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Neutral monochrome 3-point lighting rig (Zero Blue)
    const hemiLight = new THREE.HemisphereLight(0xfafafa, 0x18181b, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 3, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xd4d4d8, 1.15);
    rimLight.position.set(-4, -1.5, -3.5);
    scene.add(rimLight);

    // Subtle monochrome orbital dust
    const starCount = 280;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 6.8 + (i % 7) * 0.75;
      const theta = (i * 137.5 * Math.PI) / 180;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: propsRef.current.theme === "dark" ? 0xd4d4d8 : 0x52525b,
      size: 0.025,
      transparent: true,
      opacity: propsRef.current.theme === "dark" ? 0.35 : 0.25,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let earthTex = buildEarthTexture(maxAniso, propsRef.current.theme);
    const nightTex = buildCityLightsTexture(HOTSPOTS, maxAniso);
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
    const earthMat = new THREE.MeshPhysicalMaterial({
      map: earthTex,
      emissive: new THREE.Color(0xf4f4f5),
      emissiveMap: nightTex,
      emissiveIntensity:
        propsRef.current.showNightLights && propsRef.current.theme === "dark" ? 0.55 : 0.0,
      roughness: 0.62,
      metalness: 0.1,
      clearcoat: 0.28,
      clearcoatRoughness: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // Dynamic Heatmap Overlay
    const heatmapCanvas = document.createElement("canvas");
    heatmapCanvas.width = 1024;
    heatmapCanvas.height = 512;
    paintHeatmapCanvas(
      heatmapCanvas,
      [...propsRef.current.extraHotspots, ...HOTSPOTS],
      propsRef.current.heatmapMode,
      propsRef.current.shockLevel,
      propsRef.current.region
    );
    const heatmapTex = new THREE.CanvasTexture(heatmapCanvas);
    heatmapTex.colorSpace = THREE.SRGBColorSpace;
    heatmapTex.anisotropy = maxAniso;

    const heatGeo = new THREE.SphereGeometry(GLOBE_RADIUS + 0.008, 64, 48);
    const heatMat = new THREE.MeshBasicMaterial({
      map: heatmapTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const heatMesh = new THREE.Mesh(heatGeo, heatMat);
    globeGroup.add(heatMesh);

    // Subtle monochrome silver rim halo (uncluttered, zero blue)
    const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 48, 36);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: {
          value: new THREE.Color(propsRef.current.theme === "dark" ? 0xe4e4e7 : 0x52525b),
        },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        void main() {
          float fresnel = pow(0.66 - dot(vNormal, normalize(vViewPos)), 3.5);
          gl_FragColor = vec4(glowColor, clamp(fresnel * 0.55, 0.0, 0.6));
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // Single crisp orbital telemetry ring (clean, not over-cluttered)
    const orbitRingGeo = new THREE.TorusGeometry(GLOBE_RADIUS * 1.21, 0.0016, 8, 128);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: propsRef.current.theme === "dark" ? 0xa1a1aa : 0x52525b,
      transparent: true,
      opacity: 0.24,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2.25;
    orbitRing.rotation.y = 0.18;
    scene.add(orbitRing);

    // Target Focus Reticle Ring
    const reticleGeo = new THREE.RingGeometry(0.03, 0.039, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
    reticleMesh.visible = false;
    globeGroup.add(reticleMesh);

    // Risk Beacons & Volumetric Pillars
    const riskGroup = new THREE.Group();
    globeGroup.add(riskGroup);
    const hitProxies: THREE.Mesh[] = [];
    const beaconRefs: Array<{
      hotspot: RiskHotspot;
      group: THREE.Group;
      coreMat: THREE.MeshStandardMaterial;
      ringMat: THREE.MeshBasicMaterial;
      pillarMat: THREE.MeshStandardMaterial;
      pillarMesh: THREE.Mesh;
      orbMesh: THREE.Mesh;
      ringMesh: THREE.Mesh;
      hitProxy: THREE.Mesh;
    }> = [];

    const ringGeo = new THREE.RingGeometry(0.011, 0.017, 20);
    const pillarGeo = new THREE.CylinderGeometry(0.002, 0.0038, 1, 8);
    const orbGeo = new THREE.SphereGeometry(0.0095, 14, 14);
    const proxyGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

    const createBeaconForHotspot = (hspot: RiskHotspot) => {
      const pos = latLonToVec3(hspot.lat, hspot.lon, GLOBE_RADIUS + 0.003);
      const normal = pos.clone().normalize();
      const beacon = new THREE.Group();
      beacon.position.copy(pos);
      beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xe4e4e7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.003;
      beacon.add(ringMesh);

      const baseIntensity = computeHotspotIntensity(hspot, propsRef.current.heatmapMode);
      const pinH = 0.028 + baseIntensity * 0.095;
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0xe4e4e7,
        emissive: 0xe4e4e7,
        emissiveIntensity: 0.65,
        metalness: 0.35,
        roughness: 0.28,
        transparent: true,
        opacity: 0.85,
      });
      const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
      pillarMesh.scale.set(1, pinH, 1);
      pillarMesh.position.y = pinH * 0.5;
      beacon.add(pillarMesh);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xe4e4e7,
        emissive: 0xe4e4e7,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.25,
      });
      const orbMesh = new THREE.Mesh(orbGeo, coreMat);
      orbMesh.position.y = pinH + 0.007;
      beacon.add(orbMesh);

      const hitProxy = new THREE.Mesh(proxyGeo, proxyMat);
      hitProxy.position.y = pinH * 0.65;
      hitProxy.layers.set(1);
      hitProxy.userData.hotspot = hspot;
      beacon.add(hitProxy);
      hitProxies.push(hitProxy);

      riskGroup.add(beacon);
      beaconRefs.push({
        hotspot: hspot,
        group: beacon,
        coreMat,
        ringMat,
        pillarMat,
        pillarMesh,
        orbMesh,
        ringMesh,
        hitProxy,
      });
    };

    for (const hspot of HOTSPOTS) {
      createBeaconForHotspot(hspot);
    }

    const syncExtraHotspots = () => {
      const extras = propsRef.current.extraHotspots;
      const existingIds = new Set(beaconRefs.map((b) => b.hotspot.id));
      for (const hspot of extras) {
        if (!existingIds.has(hspot.id)) {
          createBeaconForHotspot(hspot);
        }
      }
    };
    syncExtraHotspots();

    // Chokepoint 3D Octahedron Markers
    const chokeGroup = new THREE.Group();
    globeGroup.add(chokeGroup);
    const chokeGeo = new THREE.OctahedronGeometry(0.015, 0);
    const chokeMarkers: Array<{
      regions: RegionKey[];
      name: string;
      baseStatus: string;
      mat: THREE.MeshStandardMaterial;
      mesh: THREE.Mesh;
    }> = [];
    for (const cp of CHOKEPOINTS) {
      const pos = latLonToVec3(cp.lat, cp.lon, GLOBE_RADIUS + 0.022);
      const col = cp.status === "DISRUPTED" ? 0xef4444 : cp.status === "CONGESTED" ? 0xf59e0b : 0x10b981;
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.6,
        metalness: 0.75,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(chokeGeo, mat);
      mesh.position.copy(pos);
      chokeGroup.add(mesh);
      chokeMarkers.push({ regions: cp.regions, name: cp.name, baseStatus: cp.status, mat, mesh });
    }

    // 18 Animated Trade Corridor Curves + Pulses (Neutral Silver / Amber / Red — Zero Blue)
    const arcGroup = new THREE.Group();
    globeGroup.add(arcGroup);
    const pulseGeo = new THREE.SphereGeometry(0.0075, 10, 10);
    const arcAnimators: Array<{
      curve: THREE.QuadraticBezierCurve3;
      pulse: THREE.Mesh;
      speed: number;
      offset: number;
      regions: RegionKey[];
      tubeGeo: THREE.TubeGeometry;
      tubeMat: THREE.MeshBasicMaterial;
      pulseMat: THREE.MeshBasicMaterial;
    }> = [];

    TRADE_ARCS.forEach((arc, idx) => {
      const pStart = latLonToVec3(arc.from[0], arc.from[1], GLOBE_RADIUS + 0.006);
      const pEnd = latLonToVec3(arc.to[0], arc.to[1], GLOBE_RADIUS + 0.006);
      const mid = pStart.clone().add(pEnd).multiplyScalar(0.5);
      const dist = pStart.distanceTo(pEnd);
      mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.085 + dist * 0.2);

      const curve = new THREE.QuadraticBezierCurve3(pStart, mid, pEnd);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.0022, 6, false);
      const arcCol = arc.status === "DISRUPTED" ? 0xef4444 : arc.status === "CONGESTED" ? 0xf59e0b : 0xd4d4d8;
      const tubeMat = new THREE.MeshBasicMaterial({
        color: arcCol,
        transparent: true,
        opacity: 0.44,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      arcGroup.add(tubeMesh);

      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      arcGroup.add(pulse);

      arcAnimators.push({
        curve,
        pulse,
        speed: 0.18 + (idx % 4) * 0.045,
        offset: idx * 0.14,
        regions: arc.regions,
        tubeGeo,
        tubeMat,
        pulseMat,
      });
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.55;
    controls.maxDistance = 4.2;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.75;
    controls.autoRotate = !isSoftwareGl && propsRef.current.autoRotate;
    controls.autoRotateSpeed = 0.32;

    let cameraFocusActive = false;
    const desiredCamPos = new THREE.Vector3();

    const cancelAutoFocus = () => {
      cameraFocusActive = false;
      controls.autoRotate = false;
    };
    controls.addEventListener("start", cancelAutoFocus);

    const resolveSeverity = (h: RiskHotspot): Severity => {
      const { shockLevel: sk, alerts: currentAlerts } = propsRef.current;
      const shocked = Object.entries(SHOCK_HOTSPOT_MAP).some(
        ([sid, hid]) => hid === h.id && Number(sid.slice(1)) <= sk
      );
      if (shocked) return "CRITICAL";
      const al = currentAlerts.find((a) => a.id === h.alertId);
      if (al) return al.severity;
      const avg = (h.geopoliticalWeight + h.economicWeight) / 2;
      if (avg >= 0.8) return "CRITICAL";
      if (avg >= 0.62) return "ELEVATED";
      return "WATCH";
    };

    const updateTheme = (mode: ThemeMode) => {
      const isDark = mode === "dark";
      const bg = isDark ? 0x09090b : 0xe4e4e7;
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.FogExp2(bg, 0.06);

      const nextTex = buildEarthTexture(maxAniso, mode);
      earthTex.dispose();
      earthTex = nextTex;
      earthMat.map = earthTex;
      earthMat.emissiveIntensity = propsRef.current.showNightLights && isDark ? 0.55 : 0.0;
      earthMat.needsUpdate = true;

      starMat.color.setHex(isDark ? 0xd4d4d8 : 0x52525b);
      starMat.opacity = isDark ? 0.35 : 0.22;
      orbitRingMat.color.setHex(isDark ? 0xa1a1aa : 0x52525b);
      atmoMat.uniforms.glowColor.value.setHex(isDark ? 0xe4e4e7 : 0x52525b);
      reticleMat.color.setHex(isDark ? 0xffffff : 0x18181b);
    };

    const updateLayers = () => {
      const {
        theme: thm,
        region: reg,
        heatmapMode: hmMode,
        showRiskNodes: showR,
        showChokepoints: showC,
        showHeatmap: showH,
        showTradeArcs: showA,
        showPillars: showP,
        showNightLights: showN,
        shockLevel: sk,
        extraHotspots: extras,
        focusedHotspotId: focusId,
      } = propsRef.current;

      const isDark = thm === "dark";
      riskGroup.visible = showR;
      chokeGroup.visible = showC;
      heatMesh.visible = showH;
      arcGroup.visible = showA;
      earthMat.emissiveIntensity = showN && isDark ? 0.55 : 0.0;

      const allHspots = [...extras, ...HOTSPOTS];
      paintHeatmapCanvas(heatmapCanvas, allHspots, hmMode, sk, reg);
      heatmapTex.needsUpdate = true;

      for (const b of beaconRefs) {
        const sev = resolveSeverity(b.hotspot);
        const watchHex = isDark ? 0xe4e4e7 : 0x27272a;
        const hex = sev === "WATCH" ? watchHex : SEVERITY_HEX[sev];
        const active = reg === "global" || b.hotspot.regions.includes(reg);
        const isFocused = b.hotspot.id === focusId;

        const intensity = computeHotspotIntensity(b.hotspot, hmMode);
        const pinH = showP ? 0.026 + intensity * (0.095 + sk * 0.012) : 0.022;
        b.pillarMesh.visible = showP;
        b.pillarMesh.scale.set(isFocused ? 1.5 : 1, pinH, isFocused ? 1.5 : 1);
        b.pillarMesh.position.y = pinH * 0.5;
        b.orbMesh.position.y = showP ? pinH + 0.007 : 0.016;
        b.hitProxy.position.y = pinH * 0.65;

        b.coreMat.color.setHex(isFocused ? (isDark ? 0xffffff : 0x09090b) : hex);
        b.coreMat.emissive.setHex(hex);
        b.coreMat.emissiveIntensity = isFocused ? 1.35 : 0.78;
        b.pillarMat.color.setHex(hex);
        b.pillarMat.emissive.setHex(hex);
        b.ringMat.color.setHex(isFocused ? (isDark ? 0xffffff : 0x18181b) : hex);
        b.ringMat.opacity = active || isFocused ? 0.85 : 0.2;
        b.group.scale.setScalar(isFocused ? 1.32 : active ? 1.0 : 0.72);
      }

      if (focusId) {
        const target = allHspots.find((h) => h.id === focusId);
        if (target) {
          const rPos = latLonToVec3(target.lat, target.lon, GLOBE_RADIUS + 0.014);
          reticleMesh.position.copy(rPos);
          reticleMesh.lookAt(rPos.clone().multiplyScalar(2));
          reticleMesh.visible = true;
        } else {
          reticleMesh.visible = false;
        }
      } else {
        reticleMesh.visible = false;
      }

      for (const cp of chokeMarkers) {
        const active = reg === "global" || cp.regions.includes(reg);
        const disrupted = sk >= 1 && (cp.name.includes("Suez") || cp.name.includes("Black"));
        const col = disrupted
          ? 0xef4444
          : cp.baseStatus === "DISRUPTED"
            ? 0xef4444
            : cp.baseStatus === "CONGESTED"
              ? 0xf59e0b
              : 0x10b981;
        cp.mat.color.setHex(col);
        cp.mat.emissive.setHex(col);
        cp.mesh.scale.setScalar(active ? 1.0 : 0.68);
      }

      for (const a of arcAnimators) {
        const active = reg === "global" || a.regions.some((r) => r === reg);
        a.tubeMat.opacity = active ? 0.5 : 0.12;
        a.pulse.visible = active;
      }
    };

    const focusRegion = (reg: RegionKey) => {
      const [lat, lon] = REGIONS[reg].focusLatLon;
      const dist = reg === "global" ? 2.68 : 2.08;
      latLonToVec3(lat, lon, dist, desiredCamPos);
      cameraFocusActive = true;
    };

    const focusHotspot = (hotspotId: string) => {
      const target = [...propsRef.current.extraHotspots, ...HOTSPOTS].find((h) => h.id === hotspotId);
      if (!target) return;
      latLonToVec3(target.lat, target.lon, 1.9, desiredCamPos);
      cameraFocusActive = true;
    };

    const setAutoRotate = (enabled: boolean) => {
      controls.autoRotate = !isSoftwareGl && enabled;
    };

    controlsApiRef.current = {
      focusRegion,
      focusHotspot,
      updateLayers,
      syncExtraHotspots,
      setAutoRotate,
      updateTheme,
    };
    updateLayers();
    if (propsRef.current.focusedHotspotId) {
      focusHotspot(propsRef.current.focusedHotspotId);
    } else {
      focusRegion(propsRef.current.region);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastMoveCheck = 0;

    const getCanvasPointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return rect;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 45) return;
      lastMoveCheck = now;
      const rect = getCanvasPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const hspot = hits[0].object.userData.hotspot as RiskHotspot;
        renderer.domElement.style.cursor = "pointer";
        setHovered({
          hotspot: hspot,
          severity: resolveSeverity(hspot),
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        renderer.domElement.style.cursor = "grab";
        setHovered(null);
      }
    };

    let downPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 6) return;
      getCanvasPointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const hspot = hits[0].object.userData.hotspot as RiskHotspot;
        const { shockLevel: sk, onSelectHotspot: cb } = propsRef.current;
        const shockMatch = Object.entries(SHOCK_HOTSPOT_MAP).find(
          ([sid, hid]) => hid === hspot.id && Number(sid.slice(1)) <= sk
        );
        cb(shockMatch ? shockMatch[0] : hspot.alertId, hspot.id);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(300, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (cameraFocusActive) {
        const curDist = camera.position.length();
        const targetDist = desiredCamPos.length();
        const nextDist = THREE.MathUtils.damp(curDist, targetDist, 4.5, delta);
        _vec3A.copy(camera.position).normalize();
        _targetDir.copy(desiredCamPos).normalize();
        _vec3B.copy(_vec3A).lerp(_targetDir, 1 - Math.exp(-4.5 * delta)).normalize().multiplyScalar(nextDist);
        camera.position.copy(_vec3B);
        if (camera.position.distanceTo(desiredCamPos) < 0.02) {
          cameraFocusActive = false;
        }
      }

      for (let i = 0; i < beaconRefs.length; i++) {
        const phase = 1 + 0.28 * Math.sin(elapsed * 2.4 + i * 0.45);
        beaconRefs[i].ringMesh.scale.set(phase, phase, 1);
      }

      if (reticleMesh.visible) {
        const pulse = 1 + 0.16 * Math.sin(elapsed * 4.0);
        reticleMesh.scale.set(pulse, pulse, 1);
      }

      for (const a of arcAnimators) {
        const t = (elapsed * a.speed + a.offset) % 1;
        a.curve.getPointAt(t, a.pulse.position);
      }

      for (const cp of chokeMarkers) {
        cp.mesh.rotation.y += delta * 0.85;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      controls.removeEventListener("start", cancelAutoFocus);
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);

      earthTex.dispose();
      nightTex.dispose();
      heatmapTex.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      heatGeo.dispose();
      heatMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      reticleGeo.dispose();
      reticleMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      ringGeo.dispose();
      pillarGeo.dispose();
      orbGeo.dispose();
      proxyGeo.dispose();
      proxyMat.dispose();
      chokeGeo.dispose();
      pulseGeo.dispose();
      beaconRefs.forEach((b) => {
        b.coreMat.dispose();
        b.ringMat.dispose();
        b.pillarMat.dispose();
      });
      chokeMarkers.forEach((c) => c.mat.dispose());
      arcAnimators.forEach((a) => {
        a.tubeGeo.dispose();
        a.tubeMat.dispose();
        a.pulseMat.dispose();
      });
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    controlsApiRef.current?.updateTheme(theme);
    controlsApiRef.current?.updateLayers();
  }, [theme]);

  useEffect(() => {
    controlsApiRef.current?.syncExtraHotspots();
    controlsApiRef.current?.updateLayers();
  }, [
    region,
    heatmapMode,
    showRiskNodes,
    showChokepoints,
    showHeatmap,
    showTradeArcs,
    showPillars,
    showNightLights,
    shockLevel,
    alerts,
    extraHotspots,
    focusedHotspotId,
  ]);

  useEffect(() => {
    controlsApiRef.current?.focusRegion(region);
  }, [region]);

  useEffect(() => {
    if (focusedHotspotId) {
      controlsApiRef.current?.focusHotspot(focusedHotspotId);
    }
  }, [focusedHotspotId]);

  useEffect(() => {
    controlsApiRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden rounded-b-xl bg-zinc-200 dark:bg-zinc-950`}>
      <div ref={mountRef} className="w-full h-full" aria-label="Interactive 3D world risk globe and heatmap" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-200/90 dark:bg-zinc-950/90 text-zinc-700 dark:text-zinc-300 text-sm">
          WebGL context suspended. Restoring 3D telemetry viewport...
        </div>
      )}

      {/* Opaque non-blurred HUD controls over WebGL canvas */}
      <div className="webgl-hud-surface absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 pointer-events-none">
        <Compass className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
        <span className="font-medium whitespace-nowrap">
          Drag to orbit · Scroll to zoom · Click any pillar for telemetry
        </span>
      </div>

      <button
        type="button"
        onClick={() => controlsApiRef.current?.focusRegion(region)}
        className="webgl-hud-surface absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
      >
        <RotateCcw className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
        <span>Recenter {REGIONS[region].name}</span>
      </button>

      {/* Hover Tooltip */}
      {hovered && (
        <div
          className="webgl-hud-surface absolute z-20 pointer-events-none rounded-lg px-3 py-2.5 max-w-[260px]"
          style={{
            left: Math.min(hovered.x + 14, 520),
            top: Math.max(12, hovered.y - 54),
          }}
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-zinc-950 dark:text-white">
            <span>
              {hovered.hotspot.name} · {hovered.hotspot.country}
            </span>
            <span
              className={`font-mono text-[10px] font-bold ${
                hovered.severity === "CRITICAL"
                  ? "text-red-500 dark:text-red-400"
                  : hovered.severity === "ELEVATED"
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {hovered.severity}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-zinc-700 dark:text-zinc-300 tabular-nums">
            <span>Food +{hovered.hotspot.foodInflationPct.toFixed(1)}%</span>
            <span>Delay {hovered.hotspot.portDelayDays.toFixed(1)}d</span>
            <span>Social {hovered.hotspot.socialSpike}</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">{hovered.hotspot.summary}</p>
        </div>
      )}
    </div>
  );
}
