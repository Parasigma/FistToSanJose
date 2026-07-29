import { Camera, Effect, Engine, PostProcess, Texture } from "@babylonjs/core";

/**
 * Look retro-noventero: resolución interna ~270p, dithering ordenado,
 * cuantización de color, grano animado, aberración cromática y viñeta.
 */
export function setupPSX(engine: Engine, camera: Camera): PostProcess {
  Effect.ShadersStore["psxFragmentShader"] = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform float time;

    float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main(void) {
      vec2 uv = vUV;
      vec3 col;
      float ca = 0.0016;
      col.r = texture2D(textureSampler, uv + vec2(ca, 0.0)).r;
      col.g = texture2D(textureSampler, uv).g;
      col.b = texture2D(textureSampler, uv - vec2(ca, 0.0)).b;

      float d = (bayer4(gl_FragCoord.xy) - 0.5) / 20.0;
      col = clamp(col + d, 0.0, 1.0);
      col = floor(col * 31.0 + 0.5) / 31.0;

      float g = hash(uv * 37.0 + fract(time * 13.71) * 91.0);
      col += (g - 0.5) * 0.06;

      float vd = distance(uv, vec2(0.5));
      col *= 1.0 - smoothstep(0.34, 0.88, vd) * 0.55;

      gl_FragColor = vec4(col, 1.0);
    }`;

  const pp = new PostProcess("psx", "psx", ["time"], null, 1.0, camera, Texture.NEAREST_SAMPLINGMODE);
  let t = 0;
  pp.onApply = (fx) => {
    t += engine.getDeltaTime() / 1000;
    fx.setFloat("time", t);
  };

  const applyRes = () => {
    const h = engine.getRenderingCanvas()?.clientHeight || window.innerHeight;
    engine.setHardwareScalingLevel(Math.max(1, h / 270));
  };
  applyRes();
  window.addEventListener("resize", applyRes);
  return pp;
}
