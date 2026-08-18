import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  ColorManagement,
  GLSL3,
  LinearToneMapping,
  NeutralToneMapping,
  RawShaderMaterial,
  ReinhardToneMapping,
  SRGBTransfer,
  type Texture,
  type ToneMapping,
  Vector3,
  Vector4,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { NEUTRAL_GRADE } from './aphasya_grade_core';

interface TimeUniform {
  value: number;
}

export const OUTPUT_GRADE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D tBloom;
  uniform float uTime;
  uniform vec4 uInputUvRect;

  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>

  in vec2 vUv;
  out vec4 pc_fragColor;

  // Aphasya per-biome grade (aphasya_grade_core.ts): the renderer eases these
  // toward the camera biome's authored target; the defaults reproduce the
  // legacy hardcoded grade exactly.
  uniform vec3 uLift;
  uniform vec3 uGain;
  uniform float uGamma;
  uniform float uSat;

  // Keep the exact RGBA16F boundaries removed by the bloom-add fusion and by
  // the earlier OutputPass plus GradePass fusion.
  vec3 quantizeHalf(vec3 value) {
    vec2 rg = unpackHalf2x16(packHalf2x16(value.rg));
    float b = unpackHalf2x16(packHalf2x16(vec2(value.b, 0.0))).x;
    return vec3(rg, b);
  }

  // A stray NaN fragment in the HalfFloat beauty target poisons the whole frame:
  // the bloom high-pass reads the beauty and its Gaussian blur smears the NaN
  // across every mip, so OutputGradePass adds a frame-wide NaN and the tonemap
  // maps it to black. NaN survives only in the float composer targets (the
  // direct-to-canvas UNSIGNED_BYTE tiers clamp it away), which is why low/medium
  // are fine while the composer tiers go black. The IBL / PBR shader path emits
  // those NaNs on some drivers (observed on ANGLE's OpenGL backend with NVIDIA on
  // Linux). Every NaN comparison is false, so the (x < 0.0 || x >= 0.0) test
  // keeps finite and infinite values and rewrites only NaN to zero. This must
  // stay on the beauty AND the bloom read, since the blur already spread the NaN.
  vec3 sanitizeFinite(vec3 v) {
    return vec3(
      (v.x < 0.0 || v.x >= 0.0) ? v.x : 0.0,
      (v.y < 0.0 || v.y >= 0.0) ? v.y : 0.0,
      (v.z < 0.0 || v.z >= 0.0) ? v.z : 0.0
    );
  }

  void main() {
    vec2 inputUv = min(vUv * uInputUvRect.xy, uInputUvRect.zw);
    vec4 outputColor = texture(tDiffuse, inputUv);
    outputColor.rgb = sanitizeFinite(outputColor.rgb);

    #ifdef BLOOM_PREPARED
      vec4 bloom = texture(tBloom, inputUv);
      outputColor.rgb = quantizeHalf(outputColor.rgb + sanitizeFinite(bloom.rgb * bloom.a));
    #endif

    #ifdef LINEAR_TONE_MAPPING
      outputColor.rgb = LinearToneMapping(outputColor.rgb);
    #elif defined(REINHARD_TONE_MAPPING)
      outputColor.rgb = ReinhardToneMapping(outputColor.rgb);
    #elif defined(CINEON_TONE_MAPPING)
      outputColor.rgb = CineonToneMapping(outputColor.rgb);
    #elif defined(ACES_FILMIC_TONE_MAPPING)
      outputColor.rgb = ACESFilmicToneMapping(outputColor.rgb);
    #elif defined(AGX_TONE_MAPPING)
      outputColor.rgb = AgXToneMapping(outputColor.rgb);
    #elif defined(NEUTRAL_TONE_MAPPING)
      outputColor.rgb = NeutralToneMapping(outputColor.rgb);
    #endif

    #ifdef SRGB_TRANSFER
      outputColor = sRGBTransferOETF(outputColor);
    #endif

    vec3 c = quantizeHalf(outputColor.rgb);
    c = pow(max(vec3(0.0), c * uGain + uLift), vec3(uGamma));
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.23);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    vec2 d = vUv - 0.5;
    c *= 1.0 - 0.20 * smoothstep(0.60, 0.95, dot(d, d) * 2.2);
    c += (fract(sin(dot(vUv * 731.7 + uTime, vec2(12.9898, 78.233))) * 43758.5) - 0.5) * 0.012;
    pc_fragColor = vec4(c, 1.0);
  }
`;

const OUTPUT_GRADE_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  in vec3 position;
  in vec2 uv;
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class OutputGradePass extends Pass {
  readonly uniforms: {
    tDiffuse: { value: Texture | null };
    tBloom: { value: Texture | null };
    toneMappingExposure: { value: number };
    uTime: TimeUniform;
    uInputUvRect: { value: Vector4 };
    uLift: { value: Vector3 };
    uGain: { value: Vector3 };
    uGamma: { value: number };
    uSat: { value: number };
  };
  readonly material: RawShaderMaterial;
  readonly fsQuad: FullScreenQuad;
  private outputColorSpace: string | null = null;
  private toneMapping: ToneMapping | null = null;
  private readonly hasPreparedBloom: boolean;

  constructor(timeUniform: TimeUniform, bloomTexture: Texture | null = null) {
    super();
    this.hasPreparedBloom = bloomTexture !== null;
    this.uniforms = {
      tDiffuse: { value: null },
      tBloom: { value: bloomTexture },
      toneMappingExposure: { value: 1 },
      uTime: timeUniform,
      uInputUvRect: { value: new Vector4(1, 1, 1, 1) },
      uLift: { value: new Vector3(...NEUTRAL_GRADE.lift) },
      uGain: { value: new Vector3(...NEUTRAL_GRADE.gain) },
      uGamma: { value: NEUTRAL_GRADE.gamma },
      uSat: { value: NEUTRAL_GRADE.sat },
    };
    this.material = new RawShaderMaterial({
      name: 'OutputGradeShader',
      glslVersion: GLSL3,
      uniforms: this.uniforms,
      vertexShader: OUTPUT_GRADE_VERTEX_SHADER,
      fragmentShader: OUTPUT_GRADE_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  setInputUvRect(scaleX: number, scaleY: number, maxX: number, maxY: number): void {
    this.uniforms.uInputUvRect.value.set(scaleX, scaleY, maxX, maxY);
  }

  /** Push the eased Aphasya biome grade (see aphasya_grade_core.ts); alloc-free. */
  setGrade(
    lift: readonly [number, number, number],
    gain: readonly [number, number, number],
    gamma: number,
    sat: number,
  ): void {
    this.uniforms.uLift.value.set(lift[0], lift[1], lift[2]);
    this.uniforms.uGain.value.set(gain[0], gain[1], gain[2]);
    this.uniforms.uGamma.value = gamma;
    this.uniforms.uSat.value = sat;
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget,
  ): void {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;

    if (
      this.outputColorSpace !== renderer.outputColorSpace ||
      this.toneMapping !== renderer.toneMapping
    ) {
      this.outputColorSpace = renderer.outputColorSpace;
      this.toneMapping = renderer.toneMapping;
      this.material.defines = this.hasPreparedBloom ? { BLOOM_PREPARED: '' } : {};

      if (ColorManagement.getTransfer(renderer.outputColorSpace) === SRGBTransfer) {
        this.material.defines.SRGB_TRANSFER = '';
      }
      if (renderer.toneMapping === LinearToneMapping) {
        this.material.defines.LINEAR_TONE_MAPPING = '';
      } else if (renderer.toneMapping === ReinhardToneMapping) {
        this.material.defines.REINHARD_TONE_MAPPING = '';
      } else if (renderer.toneMapping === CineonToneMapping) {
        this.material.defines.CINEON_TONE_MAPPING = '';
      } else if (renderer.toneMapping === ACESFilmicToneMapping) {
        this.material.defines.ACES_FILMIC_TONE_MAPPING = '';
      } else if (renderer.toneMapping === AgXToneMapping) {
        this.material.defines.AGX_TONE_MAPPING = '';
      } else if (renderer.toneMapping === NeutralToneMapping) {
        this.material.defines.NEUTRAL_TONE_MAPPING = '';
      }
      this.material.needsUpdate = true;
    }

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) {
        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      }
    }
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      this.fsQuad.render(renderer);
    } finally {
      renderer.autoClear = oldAutoClear;
    }
  }

  override dispose(): void {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
