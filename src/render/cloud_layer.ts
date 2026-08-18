// The scrolling procedural cloud band (Aphasya W7): a flat disk of fbm value
// noise riding under the HDRI sky dome, so the baked sky gains a live,
// drifting cloud layer without any texture download. World-anchored UVs keep
// the clouds fixed over the world while the disk follows the camera with the
// dome; two scroll speeds give the field slow evolution instead of one
// sliding sheet. Colour and opacity come from cloud_layer_core.ts, fed by the
// same live grading the dome takes. `?clouds=off` is the dev A/B kill switch.
// Only the HDRI (non-low) sky builds one: the low-tier canvas dome keeps its
// baked gradient sky untouched.

import * as THREE from 'three';
import { cloudTint } from './cloud_layer_core';
import { renderLayerDisabled } from './render_dev_flags';

const CLOUD_HEIGHT = 168;
const CLOUD_RADIUS = 505;

const CLOUD_VERTEX = /* glsl */ `
  varying vec2 vLocal;
  varying float vRim;
  void main() {
    vLocal = position.xy;
    vRim = clamp(length(position.xy) / ${CLOUD_RADIUS.toFixed(1)}, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec2 uWorldOffset;
  varying vec2 vLocal;
  varying float vRim;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p = p * 2.13 + vec2(17.0, 9.2);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    // world-anchored, slow twin drift: the base field and a finer layer move
    // at different speeds so the shapes evolve instead of sliding as one
    vec2 wp = (vLocal + uWorldOffset) * 0.0018;
    float base = fbm(wp + vec2(uTime * 0.004, uTime * 0.0016));
    float detail = fbm(wp * 2.7 + vec2(-uTime * 0.007, uTime * 0.003));
    float n = base * 0.72 + detail * 0.28;
    // painterly cumuli: soft coverage threshold, flat bright bodies with a
    // slightly denser heart
    float cloud = smoothstep(0.52, 0.68, n);
    float heart = smoothstep(0.62, 0.82, n);
    // the rim fade keeps the dome's own horizon band the hero at distance
    float rim = 1.0 - smoothstep(0.62, 0.96, vRim);
    float alpha = cloud * (0.75 + 0.25 * heart) * rim * uOpacity;
    if (alpha < 0.004) discard;
    // hearts shade a touch deeper, undersides of the painted kind
    vec3 col = uTint * (1.0 - 0.16 * heart);
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface CloudLayer {
  mesh: THREE.Mesh;
  /** camera world position, so the world-anchored field stays put */
  setCamera(x: number, z: number): void;
  /** live sky grading: dome day multiplier, dusk warmth, star strength */
  setGrading(dayMul: readonly [number, number, number], duskWarm: number, starAmt: number): void;
  setTime(t: number): void;
  dispose(): void;
}

/** Build the cloud band, or null when the dev kill switch disables it. */
export function buildCloudLayer(): CloudLayer | null {
  if (renderLayerDisabled('clouds')) return null;
  const uniforms = {
    uTint: { value: new THREE.Vector3(0.94, 0.95, 0.97) },
    uOpacity: { value: 0.62 },
    uTime: { value: 0 },
    uWorldOffset: { value: new THREE.Vector2(0, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(CLOUD_RADIUS, 48), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = CLOUD_HEIGHT;
  // the integration site (sky.ts) sets renderOrder right after the dome's,
  // keeping the draw-order contract in one place
  mesh.frustumCulled = false;
  const tint = { r: 0.94, g: 0.95, b: 0.97, opacity: 0.62 };
  return {
    mesh,
    setCamera(x, z) {
      uniforms.uWorldOffset.value.set(x, z);
    },
    setGrading(dayMul, duskWarm, starAmt) {
      cloudTint(dayMul, duskWarm, starAmt, tint);
      uniforms.uTint.value.set(tint.r, tint.g, tint.b);
      uniforms.uOpacity.value = tint.opacity;
    },
    setTime(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}
