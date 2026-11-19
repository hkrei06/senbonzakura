// The city from above (the interlude; docs/TREATMENT.md, Direction v3): a Taisho city at night in 3D, seen from a slow
// glide past the twelve-storey tower. Thousands of buildings whose facades carry their own window grids (the shader:
// storeys and bays from world position, each window lit or dark by a hash, fading to its average where the cells get
// smaller than a few pixels), lamp-lit streets, sakura avenues glowing pink, a river with the lights in it, the loop line
// on its viaduct with a tram running, a domed station, the palace moat, the moon and the hills beyond, the haze between.
// (The board's first city was a flat skewed map: the reference MV's aerial city showed what it lacked.)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H } from '../engine/gl';
import { setupRenderer, handheld } from '../engine/world';
import { clamp, ease, lerp, mulberry32 } from '../engine/util';
import { layer, moonDisc } from './taisho';

const MOON = new THREE.Vector3(0.16, 0.105, -1).normalize(); // where the moon hangs: low, just over the hills the glide looks toward
const LIT = new THREE.Vector3(-0.35, 0.8, 0.45).normalize(); // the moonlight on roofs and walls
const FOG = new THREE.Color('#2e1832');
const TOWER = new THREE.Vector3(150, 0, -640);
const riverZ = (x: number) => -470 + 110 * Math.sin(x / 260) + 35 * Math.sin(x / 85 + 1);

const BUILD_VS = /* glsl */ `
  in vec3 aWall; in vec3 aRoof; in vec2 aMisc;
  out vec3 vWP; out vec3 vN; out vec3 vWall; out vec3 vRoof; out vec2 vMisc;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 wp = m * vec4(position, 1.0);
    vWP = wp.xyz; vWall = aWall; vRoof = aRoof; vMisc = aMisc;
    vN = normalize(transpose(inverse(mat3(m))) * normal); // the inverse transpose: the roofs are scaled unevenly
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BUILD_FS = /* glsl */ `
  layout(location = 0) out highp vec4 outColor;
  in vec3 vWP; in vec3 vN; in vec3 vWall; in vec3 vRoof; in vec2 vMisc;
  uniform vec3 uFog, uLit, uFlood; uniform float uFogD, uGlow;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vN), col;
    float sun = max(dot(n, uLit), 0.0);
    if (n.y > 0.5) col = vRoof * (0.14 + 0.26 * sun) + vec3(0.007, 0.008, 0.015) * sun; // moonlit tiles
    else {
      // the facade: storeys of 3.4 m, bays of 3 m along the face; a window per cell, lit or dark
      float along = abs(n.x) > 0.5 ? vWP.z : vWP.x;
      vec2 cell = vec2(along / 3.0, vWP.y / 3.4), f = fract(cell), id = floor(cell);
      float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.82) * step(0.9, vWP.y);
      float lit = step(1.0 - vMisc.y, h21(id + vMisc.x * 17.0));
      vec3 litC = mix(vec3(2.8, 1.6, 0.7), vec3(2.4, 1.25, 0.9), h21(id + 3.1)) * (0.5 + 0.7 * h21(id + 7.7)) * uGlow;
      vec3 wall = vWall * (0.1 + 0.22 * sun), glass = vec3(0.008, 0.005, 0.012);
      vec3 winC = mix(glass, litC, lit);
      float px = max(fwidth(cell.x), fwidth(cell.y));
      vec3 avg = wall + 0.34 * vMisc.y * litC * 0.38; // far off: the windows' average, fainter (the city glows, it does not blaze)
      col = mix(mix(wall, winC, win), avg, smoothstep(0.22, 0.55, px));
      col += vMisc.y * vec3(0.3, 0.13, 0.04) * (1.0 - smoothstep(0.0, 3.4, vWP.y)) * uGlow; // the shops at street level
    }
    float fd = length(vWP.xz - uFlood.xz); // the floodlights at the tower's foot
    col += vec3(0.32, 0.17, 0.07) * (1.0 - smoothstep(0.0, uFlood.y, fd)) * (1.0 - smoothstep(0.0, 90.0, vWP.y)) * (n.y > 0.5 ? 0.25 : 0.4 + 0.6 * max(dot(n, normalize(vec3(uFlood.x, 0.0, uFlood.z) - vWP + vec3(0.0, 0.0, 60.0))), 0.0)); // lit from the square: the faces toward it brighter
    float d = length(vWP - cameraPosition);
    outColor = vec4(mix(col, uFog, 1.0 - exp(-pow(uFogD * d, 2.0))), 1.0);
  }`;
// camera-facing sprites: a soft glow (additive lights) or a soft-edged disc (blossom, trees)
const SPRITE_VS = /* glsl */ `
  in vec4 aP; in vec3 aC; uniform float uT; out vec2 vUv; out vec3 vC; out float vD;
  void main() {
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 w = aP.xyz + (right * position.x + up * position.y) * aP.w;
    vec4 mv = viewMatrix * vec4(w, 1.0); vD = -mv.z; vUv = uv; vC = aC;
    gl_Position = projectionMatrix * mv;
  }`;
const GLOW_FS = /* glsl */ `
  layout(location = 0) out highp vec4 outColor;
  in vec2 vUv; in vec3 vC; in float vD; uniform vec3 uFog; uniform float uFogD;
  void main() {
    vec2 q = vUv * 2.0 - 1.0; float r2 = dot(q, q);
    if (r2 > 1.0) discard;
    float k = exp(-r2 * 5.0) + 0.6 * exp(-r2 * 40.0);
    outColor = vec4(vC * k * exp(-pow(uFogD * vD, 2.0)), 1.0);
  }`;
const PUFF_FS = /* glsl */ `
  layout(location = 0) out highp vec4 outColor;
  in vec2 vUv; in vec3 vC; in float vD; uniform vec3 uFog; uniform float uFogD;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float n = 0.12 * h21(floor(vUv * 9.0));
    if (dot(q, q) > 0.85 - n) discard;
    vec3 c = vC * (0.75 + 0.35 * (1.0 - vUv.y));
    outColor = vec4(mix(c, uFog, 1.0 - exp(-pow(uFogD * vD, 2.0))), 1.0);
  }`;

export default class City extends Scene {
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(42, W / H, 1, 7000);
  loop!: THREE.CatmullRomCurve3;
  tram!: THREE.Mesh;
  tramGlow!: THREE.InstancedMesh;
  moon!: THREE.Mesh;
  fogU = { uFog: { value: FOG }, uFogD: { value: 0.00062 } };
  buildU = { ...this.fogU, uLit: { value: LIT }, uGlow: { value: 1 }, uFlood: { value: new THREE.Vector3(TOWER.x, 70, TOWER.z) } }; // (x, radius, z)

  private buildingMesh(geo: THREE.BufferGeometry, rows: { m: THREE.Matrix4; wall: THREE.Color; roof: THREE.Color; seed: number; lit: number }[]) {
    const n = rows.length, wall = new Float32Array(n * 3), roof = new Float32Array(n * 3), misc = new Float32Array(n * 2);
    rows.forEach((b, i) => { wall.set([b.wall.r, b.wall.g, b.wall.b], i * 3); roof.set([b.roof.r, b.roof.g, b.roof.b], i * 3); misc.set([b.seed, b.lit], i * 2); });
    const g = geo.clone();
    g.setAttribute('aWall', new THREE.InstancedBufferAttribute(wall, 3));
    g.setAttribute('aRoof', new THREE.InstancedBufferAttribute(roof, 3));
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 2));
    const mesh = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.buildU, vertexShader: BUILD_VS, fragmentShader: BUILD_FS }), n);
    rows.forEach((b, i) => mesh.setMatrixAt(i, b.m));
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }
  private sprites(pts: [number, number, number, number, THREE.Color][], fs: string, additive: boolean) {
    const n = pts.length, p = new Float32Array(n * 4), c = new Float32Array(n * 3);
    pts.forEach(([x, y, z, s, col], i) => { p.set([x, y, z, s], i * 4); c.set([col.r, col.g, col.b], i * 3); });
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(p, 4));
    g.setAttribute('aC', new THREE.InstancedBufferAttribute(c, 3));
    const mesh = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: { ...this.fogU, uT: { value: 0 } }, vertexShader: SPRITE_VS, fragmentShader: fs,
      transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive,
    }), n);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return mesh;
  }

  override init() {
    setupRenderer(this.ctx.renderer);
    const sc = this.scene, r = mulberry32(7), C = (h: string) => new THREE.Color(h);
    sc.fog = new THREE.FogExp2(FOG, this.fogU.uFogD.value);
    // ---- the sky: the night gradient, stars, three ranges of hills; the moon (a card)
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, side: THREE.BackSide, depthWrite: false,
      uniforms: { uTop: { value: C('#120a16') }, uLow: { value: C('#3a1d3c') }, uFog: { value: FOG } },
      vertexShader: `out vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor; in vec3 vDir; uniform vec3 uTop, uLow, uFog;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h21(vec2(i, 1.7)), h21(vec2(i + 1.0, 1.7)), f); }
        void main() {
          vec3 d = normalize(vDir); float h = d.y, a = atan(d.x, d.z);
          vec3 c = mix(uLow, uTop, smoothstep(0.0, 0.45, h));
          vec2 sp = vec2(a, asin(clamp(h, -1.0, 1.0))) * 200.0; float r = h21(floor(sp));
          if (r > 0.986 && h > 0.06) c += vec3(1.0, 0.92, 0.85) * 0.6 * smoothstep(0.25, 0.0, length(fract(sp) - 0.5)) * (r - 0.986) / 0.014;
          for (int i = 0; i < 3; i++) { float fi = float(i), ridge = 0.01 + 0.012 * fi + (0.02 + 0.012 * fi) * (0.6 * n1(a * (4.0 + 3.0 * fi) + fi * 5.0) + 0.4 * n1(a * 17.0 + fi));
            c = mix(c, mix(uFog * 0.7, vec3(0.03, 0.015, 0.04), 0.4 + 0.25 * fi), smoothstep(ridge + 0.002, ridge - 0.002, h)); }
          outColor = vec4(c, 1.0);
        }`,
    })));
    const mt = new THREE.CanvasTexture(layer(800, 800, (c, rr) => moonDisc(c, 400, 400, 120, rr), 21));
    mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(1200); sc.add(this.moon);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: C('#0e0810') }));
    ground.rotation.x = -Math.PI / 2; sc.add(ground);

    // ---- the street grid (irregular), the avenues every sixth line, the blocks and their buildings
    const xs: number[] = [], zs: number[] = [];
    for (let x = -2300; x < 2300; x += 36 + r() * 42) xs.push(x);
    for (let z = 600; z > -3600; z -= 36 + r() * 42) zs.push(z);
    const avX = (i: number) => i % 6 === 3, avZ = (j: number) => j % 7 === 4;
    const walls = [C('#5a2a22'), C('#4a221d'), C('#2c1812'), C('#8b7f6b'), C('#6e6658'), C('#b3a385'), C('#3a2a2a')];
    const roofs = [C('#26242e'), C('#2e2a34'), C('#3a3440'), C('#1e1c24'), C('#3e5a50')];
    const flat: { m: THREE.Matrix4; wall: THREE.Color; roof: THREE.Color; seed: number; lit: number }[] = [];
    const gabled: typeof flat = [], gRoofs: typeof flat = [];
    const trees: [number, number, number, number, THREE.Color][] = [];
    const q = new THREE.Quaternion(), yA = new THREE.Vector3(0, 1, 0);
    const box = (x: number, z: number, w: number, h: number, d: number, rot = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q.clone().setFromAxisAngle(yA, rot), new THREE.Vector3(w, h, d));
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const hw0 = avX(i) ? 13 : 4.5, hw1 = avX(i + 1) ? 13 : 4.5, hd0 = avZ(j) ? 13 : 4.5, hd1 = avZ(j + 1) ? 13 : 4.5;
      const x0 = xs[i]! + hw0, x1 = xs[i + 1]! - hw1, z0 = zs[j]! - hd0, z1 = zs[j + 1]! + hd1;
      const xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
      if (x1 - x0 < 10 || z0 - z1 < 10) continue;
      if (Math.abs(zc - riverZ(xc)) < 52) continue; // the river
      if (Math.hypot(xc - TOWER.x, zc - TOWER.z) < 60) continue; // the tower's square
      const inPalace = Math.abs(xc + 520) < 170 && Math.abs(zc + 1050) < 170;
      if (inPalace || r() < 0.035) { // a park (the palace grounds): dark trees, a few in blossom
        for (let k = 0; k < (x1 - x0) * (z0 - z1) / 30; k++) trees.push([x0 + r() * (x1 - x0), 3 + r() * 3, z1 + r() * (z0 - z1), 4.5 + r() * 3.5, r() < 0.3 ? C('#b86a88') : r() < 0.5 ? C('#14201a') : C('#1d2c22')]);
        continue;
      }
      const centre = Math.exp(-Math.hypot(xc - 60, zc + 520) / 600); // taller and more western toward the middle
      const nx = Math.max(1, Math.round((x1 - x0) / (9 + r() * 8))), nz = (z0 - z1) > 34 ? 2 : 1;
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        const lw = (x1 - x0) / nx, ld = (z0 - z1) / nz, x = x0 + lw * (a + 0.5), z = z1 + ld * (b + 0.5);
        const tall = r() < 0.12 + 0.35 * centre, west = tall || r() < 0.2 + 0.3 * centre;
        const h = tall ? 14 + r() * (10 + 18 * centre) : 5 + r() * 6;
        const wall = (west ? walls[[0, 1, 5, 4][Math.floor(r() * 4)]!] : walls[[2, 3, 6][Math.floor(r() * 3)]!])!.clone().multiplyScalar(0.8 + 0.4 * r());
        const roof = roofs[r() < 0.05 ? 4 : Math.floor(r() * 4)]!.clone().multiplyScalar(0.8 + 0.4 * r());
        const blaze = tall && r() < 0.18; // a department store or a theatre, every window lit
        const row = { m: box(x, z, lw - 1.6, h, ld - 1.6), wall, roof, seed: r(), lit: blaze ? 0.9 : 0.22 + 0.36 * r() };
        if (!west && r() < 0.75) { // a gabled roof (a machiya) on a low building
          gabled.push(row);
          gRoofs.push({ ...row, m: new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromAxisAngle(yA, r() < 0.5 ? 0 : Math.PI / 2), new THREE.Vector3(lw - 0.6, Math.min(lw, ld) * 0.38, ld - 0.6)) });
        } else flat.push(row);
      }
    }
    const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const prism = new THREE.BufferGeometry(); // a gabled roof: a triangular prism, its ridge along x at y = 1
    {
      const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5];
      const idx = [0, 3, 2, 0, 2, 1, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5];
      const pos: number[] = []; for (const k of idx) pos.push(v[k * 3]!, v[k * 3 + 1]!, v[k * 3 + 2]!);
      prism.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); prism.computeVertexNormals();
    }
    this.buildingMesh(unitBox, [...flat, ...gabled]);
    this.buildingMesh(prism, gRoofs);

    // ---- the twelve-storey tower: an octagonal brick shaft, a gallery, a spire with a beacon, a pavilion at its foot
    const tw = { wall: C('#7a3428'), roof: C('#2a1416'), seed: 0.37, lit: 0.85 };
    this.buildingMesh(new THREE.CylinderGeometry(7, 7.8, 54, 8).translate(0, 27, 0), [{ ...tw, m: box(TOWER.x, TOWER.z, 1, 1, 1) }]);
    this.buildingMesh(new THREE.CylinderGeometry(9, 9, 1.4, 8).translate(0, 54.7, 0), [{ ...tw, wall: C('#c9a24a'), m: box(TOWER.x, TOWER.z, 1, 1, 1) }]);
    this.buildingMesh(new THREE.ConeGeometry(8.2, 17, 8).translate(0, 63.9, 0), [{ ...tw, m: box(TOWER.x, TOWER.z, 1, 1, 1) }]);
    this.buildingMesh(unitBox, [{ ...tw, wall: C('#5a2a22'), lit: 0.7, m: box(TOWER.x, TOWER.z, 46, 8, 46) }]);
    // ---- the station: a long brick front, a dome at its middle and at each end (copper roofs)
    const stn = new THREE.Vector3(-380, 0, -260), sw = { wall: C('#6a3026'), roof: C('#3e5a50'), seed: 0.71, lit: 0.8 };
    this.buildingMesh(unitBox, [{ ...sw, m: box(stn.x, stn.z, 200, 18, 26) }]);
    for (const [dx, rr] of [[0, 15], [-92, 10], [92, 10]] as const) this.buildingMesh(new THREE.SphereGeometry(rr, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 18, 0), [{ ...sw, m: box(stn.x + dx, stn.z, 1, 1, 1) }]);

    // ---- lamps along every street (both sides on the avenues), lanterns at the crossings; sakura along the avenues
    const lamps: [number, number, number, number, THREE.Color][] = [], puffs: [number, number, number, number, THREE.Color][] = [];
    const warm = (k: number) => new THREE.Color(1.6 * k, 0.95 * k, 0.42 * k), pinkC = [C('#f2b8c6'), C('#f7d6de'), C('#d98aa3')];
    const street = (ax: 'x' | 'z', at: number, av: boolean) => {
      const span = ax === 'x' ? [600, -3600] : [-2300, 2300], step = av ? 14 : 24;
      for (let s = Math.min(span[0]!, span[1]!); s < Math.max(span[0]!, span[1]!); s += step) {
        for (const side of av ? [-1, 1] : [r() < 0.5 ? -1 : 1]) {
          const off = side * (av ? 11 : 3.6), px = ax === 'x' ? at + off : s, pz = ax === 'x' ? s : at + off;
          if (Math.abs(pz - riverZ(px)) < 46) continue;
          lamps.push([px, 4.2, pz, av ? 3.4 : 2.6, warm(0.8 + 0.5 * r())]);
          if (av) for (let k = 0; k < 3; k++) puffs.push([px + (ax === 'x' ? side * (2 + r() * 3) : (r() - 0.5) * 12), 5 + r() * 3, pz + (ax === 'z' ? side * (2 + r() * 3) : (r() - 0.5) * 12), 9 + r() * 6, pinkC[Math.floor(r() * 3)]!.clone().multiplyScalar(0.55 + 0.3 * r())]);
        }
      }
    };
    xs.forEach((x, i) => street('x', x, avX(i)));
    zs.forEach((z, j) => street('z', z, avZ(j)));
    const bandM = (col: THREE.Color) => new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { ...this.fogU, uC: { value: col } },
      vertexShader: `out vec2 vUv; out float vD; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `layout(location = 0) out highp vec4 outColor; in vec2 vUv; in float vD; uniform vec3 uC; uniform float uFogD;
        float h11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
        float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
        void main() { float k = exp(-pow((vUv.x - 0.5) * 4.4, 2.0)) * (0.25 + 0.75 * n1(vUv.y * 70.0 + uC.r * 31.0)) * (0.6 + 0.4 * n1(vUv.y * 260.0));
          outColor = vec4(uC * k * exp(-pow(uFogD * vD, 2.0)), 1.0); }`,
    });
    const streetBand = bandM(new THREE.Color(0.42, 0.23, 0.085)), avBand = bandM(new THREE.Color(0.62, 0.28, 0.32));
    xs.forEach((x, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(avX(i) ? 34 : 11, 4200), avX(i) ? avBand : streetBand); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, -1500); sc.add(m); });
    zs.forEach((z, j) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(avZ(j) ? 34 : 11, 4600), avZ(j) ? avBand : streetBand); m.rotation.set(-Math.PI / 2, 0, Math.PI / 2); m.position.set(0, 0.15, z); sc.add(m); });
    this.sprites(lamps, GLOW_FS, true);
    this.sprites(puffs, GLOW_FS, true);
    this.sprites(trees, PUFF_FS, false);

    // ---- the river: dark water, the lights of both banks in it as long streaks, lamp-lit bridges at the avenues
    const rv: number[] = [], rIdx: number[] = [];
    for (let k = 0, x = -2400; x <= 2400; x += 20, k++) {
      const z = riverZ(x); rv.push(x, 0.3, z - 46, x, 0.3, z + 46);
      if (k > 0) rIdx.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, k * 2, k * 2 + 1, (k - 1) * 2 + 1);
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3)); rg.setIndex(rIdx);
    sc.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: C('#0b0a1a') })));
    const refl: [number, number, number, number, THREE.Color][] = [];
    for (let x = -2300; x < 2300; x += 9) for (const s of [-1, 1]) if (r() < 0.6) refl.push([x + r() * 6, 0.5, riverZ(x) + s * (24 + r() * 16), 2.2 + r() * 2, warm(0.45 + 0.4 * r())]);
    this.sprites(refl, GLOW_FS, true);
    xs.forEach((x, i) => {
      if (!avX(i)) return;
      const z = riverZ(x);
      this.buildingMesh(unitBox, [{ wall: C('#2a2430'), roof: C('#2a2430'), seed: 0.5, lit: 0, m: box(x, z, 20, 2.2, 110) }]);
      const bl: [number, number, number, number, THREE.Color][] = [];
      for (let k = -50; k <= 50; k += 10) for (const s of [-1, 1]) bl.push([x + s * 9, 4, z + k, 3, warm(1.1)]);
      this.sprites(bl, GLOW_FS, true);
    });

    // ---- the loop line on its viaduct (a gold rail), its piers, the tram running round it
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; pts.push(new THREE.Vector3(-40 + Math.cos(a) * 760, 10, -560 + Math.sin(a) * 440)); }
    this.loop = new THREE.CatmullRomCurve3(pts, true);
    sc.add(new THREE.Mesh(new THREE.TubeGeometry(this.loop, 400, 1.3, 6, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.4) })));
    const piers: { m: THREE.Matrix4; wall: THREE.Color; roof: THREE.Color; seed: number; lit: number }[] = [];
    for (let k = 0; k < 160; k++) { const p = this.loop.getPointAt(k / 160); piers.push({ wall: C('#3a2a2a'), roof: C('#3a2a2a'), seed: 0.2, lit: 0, m: box(p.x, p.z, 2, 9.4, 2) }); }
    this.buildingMesh(unitBox, piers);
    this.tram = new THREE.Mesh(new THREE.BoxGeometry(16, 3.6, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.2) }));
    sc.add(this.tram);
    this.tramGlow = this.sprites([[0, 0, 0, 26, warm(1.4)]], GLOW_FS, true);
    // the tower's floodlight and its beacon
    this.sprites([[TOWER.x, 14, TOWER.z, 90, warm(0.9)], [TOWER.x, 73, TOWER.z, 9, new THREE.Color(2.4, 0.4, 0.2)]], GLOW_FS, true);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx, t = f.t, cam = this.cam;
    // ---- the glide: from high over the near edge of the city down past the tower, turning a little toward it
    const u = clamp((t - this.ctx.start) / Math.max(1, this.ctx.end - this.ctx.start)), e = ease.inOutQuad(u);
    cam.position.set(lerp(-260, -20, e), lerp(260, 135, e), lerp(420, -470, e));
    const look = new THREE.Vector3(lerp(60, 330, e), lerp(0, 18, e), lerp(-640, -1180, e));
    cam.up.set(0, 1, 0); cam.lookAt(look);
    const hh = handheld(t, 0.0012, 0.25, 9); cam.rotateZ(0.04 * Math.sin(u * Math.PI) + hh[2]); cam.rotateY(hh[0]); cam.rotateX(hh[1]);
    cam.updateMatrixWorld(true);
    this.moon.position.copy(cam.position).addScaledVector(MOON, 5200); this.moon.quaternion.copy(cam.quaternion);
    // ---- the tram round the loop line
    const k = ((t * 0.018) % 1 + 1) % 1, p = this.loop.getPointAt(k), d = this.loop.getTangentAt(k);
    this.tram.position.set(p.x, p.y + 2.6, p.z); this.tram.rotation.y = Math.atan2(-d.z, d.x);
    const ga = this.tramGlow.geometry.getAttribute('aP') as THREE.InstancedBufferAttribute;
    ga.setXYZW(0, p.x, p.y + 3, p.z, 26); ga.needsUpdate = true;
    this.buildU.uGlow.value = 1 + 0.25 * f.a.kick;
    renderer.setRenderTarget(out); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    renderer.render(this.scene, cam);
    return { exposure: 1.0, bloom: 0.36, halation: 0.14, ca: 0.3, grain: 0.04, vignette: 0.42, shoulder: 1, grade: 0.3 };
  }
}
