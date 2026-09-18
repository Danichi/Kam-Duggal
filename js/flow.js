/* Hero background: the current painting, slowly flowing like wet paint.
   A small WebGL shader warps the image through layered noise and crossfades
   between paintings. Falls back to a blurred still when WebGL is unavailable. */
(function () {
  const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D ta, tb;
uniform vec2 res, sa, sb, mouse;
uniform float t, mixv, amp;

vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1. + 2. * fract(sin(p) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.02; a *= .5; } return s; }

vec2 cover(vec2 uv, vec2 img){
  float r = res.x / res.y, ir = img.x / img.y;
  vec2 s = r > ir ? vec2(1., ir / r) : vec2(r / ir, 1.);
  return (uv - .5) * s + .5;
}

void main(){
  vec2 uv = v;
  uv.y = 1. - uv.y;
  vec2 q = uv * vec2(res.x / res.y, 1.) * 1.6;
  float tt = t * .045;
  vec2 w1 = vec2(fbm(q + vec2(0., tt)), fbm(q + vec2(5.2, 1.3) - tt));
  vec2 w2 = vec2(fbm(q + 3.5 * w1 + vec2(1.7, 9.2) + tt * .7), fbm(q + 3.5 * w1 + vec2(8.3, 2.8) - tt * .6));
  float d = distance(uv, mouse);
  vec2 warp = (w2 - .0) * amp + (uv - mouse) * .045 * smoothstep(.35, 0., d);
  vec2 ua = cover(uv, sa) * .86 + .07 + warp;
  vec2 ub = cover(uv, sb) * .86 + .07 + warp;
  vec3 ca = texture2D(ta, clamp(ua, .002, .998)).rgb;
  vec3 cb = texture2D(tb, clamp(ub, .002, .998)).rgb;
  vec3 c = mix(ca, cb, smoothstep(0., 1., mixv));
  c = mix(vec3(dot(c, vec3(.299, .587, .114))), c, 1.12);
  gl_FragColor = vec4(c * .92, 1.);
}`;

  window.KDFlow = function (host, slugs) {
    const imgs = slugs.map(s => `img/art/${s}.webp`);
    const fallback = document.createElement('img');
    fallback.className = 'fallback';
    fallback.alt = '';
    fallback.src = imgs[0];
    const api = { show: i => { fallback.src = imgs[i]; } };

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl || KD.reduced) { host.appendChild(fallback); return api; }

    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.appendChild(fallback); return api; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const u = { ta: U('ta'), tb: U('tb'), res: U('res'), sa: U('sa'), sb: U('sb'), t: U('t'), mixv: U('mixv'), amp: U('amp'), mouse: U('mouse') };
    gl.uniform1i(u.ta, 0);
    gl.uniform1i(u.tb, 1);

    const textures = [];
    function tex(i) {
      if (textures[i]) return Promise.resolve(textures[i]);
      return new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => {
          const t = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); }
          catch (e) { reject(e); return; } // file:// taints the image
          textures[i] = { t, w: im.naturalWidth, h: im.naturalHeight };
          resolve(textures[i]);
        };
        im.onerror = reject;
        im.src = imgs[i];
      });
    }

    let a = null, b = null, mixv = 0, target = 0, visible = true, raf = 0;
    const mouse = { x: .7, y: .5, tx: .7, ty: .5 };
    const start = performance.now();

    function resize() {
      const r = host.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio, 1) * .6; // it's a soft background; keep it cheap
      canvas.width = Math.max(2, Math.round(r.width * scale));
      canvas.height = Math.max(2, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function frame(now) {
      raf = 0;
      if (!visible || !a) return;
      mixv += (target - mixv) * .035;
      mouse.x += (mouse.tx - mouse.x) * .04;
      mouse.y += (mouse.ty - mouse.y) * .04;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (b || a).t);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform2f(u.sa, a.w, a.h);
      gl.uniform2f(u.sb, (b || a).w, (b || a).h);
      gl.uniform1f(u.t, (now - start) / 1000);
      gl.uniform1f(u.mixv, mixv);
      gl.uniform1f(u.amp, .085);
      gl.uniform2f(u.mouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (b && mixv > .995) { a = b; b = null; mixv = target = 0; }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

    tex(0).then(t0 => {
      a = t0;
      host.appendChild(canvas);
      resize();
      kick();
      imgs.forEach((_, i) => i && tex(i).catch(() => {}));
    }).catch(() => host.appendChild(fallback));

    addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(host);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; kick(); });
    host.parentElement.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = (e.clientY - r.top) / r.height;
    }, { passive: true });

    api.show = i => {
      fallback.src = imgs[i];
      tex(i).then(t => {
        if (!a) return;
        if (b) { a = b; mixv = 0; }
        b = t; target = 1;
        kick();
      }).catch(() => {});
    };
    return api;
  };
})();
