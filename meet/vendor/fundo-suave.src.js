/*
 * Fundo da câmera do Web Meeting (Endeavor): desfoque e fundo virtual com recorte suave.
 *
 * Processador de vídeo no formato do LiveKit (init / restart / destroy / processedTrack).
 * Melhorias sobre o @livekit/track-processors:
 *   - máscara de confiança (0 a 1) em vez de máscara binária: borda suave, sem serrilhado;
 *   - estabilidade no tempo: a máscara é misturada com a do quadro anterior, com mistura
 *     adaptativa (rápida onde houve movimento, lenta onde é só ruído): acaba o "pisca" na borda;
 *   - desfoque da máscara e transição gradual (feather) no contorno;
 *   - no desfoque, só o fundo entra na média: a pessoa não "vaza" como um halo em volta.
 * Tudo roda no navegador; nenhuma imagem sai do computador (a foto própria também não).
 *
 * window.EndeavorFundo = { criar({ modo: "desfoque" | "imagem", imagem, base }), suportado() }
 * MediaPipe Tasks Vision 0.10.14 (Apache 2.0, Google), empacotado com esbuild.
 */
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

const MW = 320; // largura da imagem enviada ao segmentador (a altura segue a proporção da câmera)
let segPromise = null, segBase = "", ultimoTs = 0;

function obterSegmentador(base) {
  if (segPromise && segBase === base) return segPromise;
  segBase = base;
  segPromise = (async () => {
    const files = await FilesetResolver.forVisionTasks(base);
    const criar = (delegate) => ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: base + "/selfie_segmenter.tflite", delegate },
      runningMode: "VIDEO", outputCategoryMask: false, outputConfidenceMasks: true,
    });
    try { return await criar("GPU"); } catch (e) { return await criar("CPU"); }
  })();
  segPromise.catch(() => { segPromise = null; });
  return segPromise;
}

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = (p + 1.0) * 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// 1) fundo pré-multiplicado: cor * (1 - pessoa), alfa = 1 - pessoa (para o desfoque não pegar a pessoa)
const FS_PREMUL = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D frame; uniform sampler2D mask;
void main(){ float bg = 1.0 - texture(mask, uv).r; o = vec4(texture(frame, uv).rgb * bg, bg); }`;

// 2) desfoque gaussiano separável (9 amostras com filtragem linear = 17 texels)
const FS_BLUR = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D tex; uniform vec2 dir;
void main(){
  vec4 s = texture(tex, uv) * 0.1964825501511404;
  s += (texture(tex, uv + dir * 1.411764705882353) + texture(tex, uv - dir * 1.411764705882353)) * 0.2969069646728344;
  s += (texture(tex, uv + dir * 3.2941176470588234) + texture(tex, uv - dir * 3.2941176470588234)) * 0.09447039785044732;
  s += (texture(tex, uv + dir * 5.176470588235294) + texture(tex, uv - dir * 5.176470588235294)) * 0.010381362401148057;
  o = s;
}`;

// 3) composição final
const FS_COMP = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D frame; uniform sampler2D mask; uniform sampler2D bg;
uniform vec2 mtex;        // tamanho do texel da máscara
uniform int modo;         // 0 = desfoque, 1 = imagem
uniform vec4 cover;       // escala e deslocamento da imagem de fundo (preencher sem distorcer)
uniform float lo; uniform float hi;
float m(vec2 d){ return texture(mask, uv + d * mtex).r; }
void main(){
  // máscara suavizada (3x3 ponderado, com a filtragem linear vira ~5x5)
  float a = m(vec2(0.0)) * 0.25
    + (m(vec2(1.0, 0.0)) + m(vec2(-1.0, 0.0)) + m(vec2(0.0, 1.0)) + m(vec2(0.0, -1.0))) * 0.125
    + (m(vec2(1.0, 1.0)) + m(vec2(-1.0, 1.0)) + m(vec2(1.0, -1.0)) + m(vec2(-1.0, -1.0))) * 0.0625;
  a = smoothstep(lo, hi, a);
  vec3 f = texture(frame, uv).rgb;
  vec3 b;
  if (modo == 0) {
    vec4 s = texture(bg, uv);
    b = s.a > 0.02 ? s.rgb / s.a : f;
  } else {
    b = texture(bg, uv * cover.xy + cover.zw).rgb;
    // "light wrap" leve: a borda da pessoa pega um pouco da cor do fundo, parece mais natural
    float borda = a * (1.0 - a) * 4.0;
    f = mix(f, b, borda * 0.18);
  }
  o = vec4(mix(b, f, a), 1.0);
}`;

function compilar(gl, fs) {
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function textura(gl) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function alvo(gl, w, h) {
  const t = textura(gl); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { t, fb, w, h };
}
async function carregarImagem(src) {
  if (!src) return null;
  if (typeof Blob !== "undefined" && src instanceof Blob) src = URL.createObjectURL(src);
  const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"; img.src = src;
  await img.decode();
  return img;
}

class FundoSuave {
  constructor(op) {
    this.name = "endeavor-fundo";
    this.op = Object.assign({ modo: "desfoque", base: "", imagem: null, forca: 1 }, op || {});
    this.processedTrack = undefined;
  }

  async init(opts) {
    this.vivo = true;
    this.fonte = opts.track;
    const st = this.fonte.getSettings ? this.fonte.getSettings() : {};
    this.seg = await obterSegmentador(this.op.base);
    this.imgFundo = this.op.modo === "imagem" ? await carregarImagem(this.op.imagem) : null;
    this.prepararCanvas(st.width || 1280, st.height || 720);

    const temInsertable = typeof MediaStreamTrackProcessor !== "undefined" && typeof MediaStreamTrackGenerator !== "undefined" && typeof VideoFrame !== "undefined";
    if (temInsertable) {
      // Chrome/Edge: lê quadro a quadro (não para quando a aba fica em segundo plano)
      // maxBufferSize 1: se um quadro atrasar, o antigo é descartado (não acumula atraso)
      this.leitor = new MediaStreamTrackProcessor({ track: this.fonte, maxBufferSize: 1 }).readable.getReader();
      this.gerador = new MediaStreamTrackGenerator({ kind: "video" });
      this.escritor = this.gerador.writable.getWriter();
      this.processedTrack = this.gerador;
      this.loopInsertable();
    } else {
      // Safari/Firefox: vídeo escondido + canvas.captureStream
      this.video = document.createElement("video");
      this.video.muted = true; this.video.playsInline = true; this.video.autoplay = true;
      this.video.srcObject = new MediaStream([this.fonte]);
      await this.video.play().catch(() => { });
      this.processedTrack = this.canvas.captureStream(30).getVideoTracks()[0];
      this.loopVideo();
    }
  }

  /** Cria o canvas e o WebGL uma vez; numa troca de resolução, só redimensiona (a trilha de saída continua a mesma). */
  prepararCanvas(w, h) {
    const esc = Math.min(1, 1280 / w); w = Math.round(w * esc); h = Math.round(h * esc);
    if (!this.gl) {
      this.canvas = document.createElement("canvas"); this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl = this.canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
      if (!gl) throw new Error("Este navegador não suporta fundo virtual.");
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.pPremul = compilar(gl, FS_PREMUL); this.pBlur = compilar(gl, FS_BLUR); this.pComp = compilar(gl, FS_COMP);
      this.tFrame = textura(gl); this.tMask = textura(gl); this.tImg = textura(gl);
      this.small = document.createElement("canvas");
      this.sctx = this.small.getContext("2d");
    } else if (this.canvas.width === w && this.canvas.height === h && this.fa) return;
    const gl = this.gl;
    this.canvas.width = w; this.canvas.height = h;
    if (this.fa) { [this.fa, this.fb].forEach(x => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); }); }
    // desfoque em 1/4 da resolução: mais forte e mais leve
    const bw = Math.max(64, Math.round(w / 4)), bh = Math.max(36, Math.round(h / 4));
    this.fa = alvo(gl, bw, bh); this.fb = alvo(gl, bw, bh);
    // imagem do segmentador
    this.mh = Math.max(90, Math.round(MW * h / w));
    this.small.width = MW; this.small.height = this.mh;
    this.mAnt = null; this.m8 = new Uint8Array(MW * this.mh);
    if (this.imgFundo) this.enviarImagem();
  }

  enviarImagem() {
    const gl = this.gl, img = this.imgFundo;
    gl.bindTexture(gl.TEXTURE_2D, this.tImg);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    // mipmaps: a imagem em alta definição fica nítida e sem serrilhado quando reduzida
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    // "cover": preenche o quadro sem distorcer, cortando o excesso no centro
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const ri = iw / ih, rc = this.canvas.width / this.canvas.height;
    let sx = 1, sy = 1; if (ri > rc) sx = rc / ri; else sy = ri / rc;
    this.cover = [sx, sy, (1 - sx) / 2, (1 - sy) / 2];
  }

  async loopInsertable() {
    while (this.vivo) {
      let r; try { r = await this.leitor.read(); } catch (e) { break; }
      if (r.done) break;
      const frame = r.value;
      try {
        if (frame.displayWidth !== this.lw || frame.displayHeight !== this.lh) { this.lw = frame.displayWidth; this.lh = frame.displayHeight; this.prepararCanvas(this.lw, this.lh); }
        this.processar(frame);
        const saida = new VideoFrame(this.canvas, { timestamp: frame.timestamp });
        frame.close();
        if (this.vivo) this.escritor.write(saida).catch(() => { }); else saida.close();
      } catch (e) { try { frame.close(); } catch (_) { } if (this.vivo) console.error(e); }
    }
  }

  loopVideo() {
    const passo = () => {
      if (!this.vivo) return;
      const v = this.video;
      if (v.readyState >= 2 && v.videoWidth) {
        if (v.videoWidth !== this.lw || v.videoHeight !== this.lh) { this.lw = v.videoWidth; this.lh = v.videoHeight; this.prepararCanvas(this.lw, this.lh); }
        try { this.processar(v); } catch (e) { console.error(e); }
      }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(passo); else this.timer = setTimeout(passo, 33);
    };
    passo();
  }

  /** Atualiza a máscara (segmentação + estabilização no tempo) e desenha o quadro final. */
  processar(fonte) {
    const gl = this.gl, W = this.canvas.width, H = this.canvas.height, n = MW * this.mh;
    this.sctx.drawImage(fonte, 0, 0, MW, this.mh);
    let ts = performance.now(); if (ts <= ultimoTs) ts = ultimoTs + 0.01; ultimoTs = ts;
    this.seg.segmentForVideo(this.small, ts, (res) => {
      const ms = res.confidenceMasks; if (!ms || !ms.length) return;
      const nova = ms[ms.length - 1].getAsFloat32Array(); // última máscara = pessoa
      let ant = this.mAnt;
      if (!ant || ant.length !== n) { ant = this.mAnt = new Float32Array(nova); }
      const m8 = this.m8, mh = this.mh;
      for (let y = 0; y < mh; y++) {
        const o = y * MW; // FLIP_Y também vale para dados brutos: a máscara fica alinhada com o vídeo
        for (let x = 0, i = y * MW; x < MW; x++, i++) {
          const v = nova[i], d = Math.abs(v - ant[i]);
          // mistura adaptativa: diferença grande = movimento (segue rápido); pequena = ruído (segura)
          const k = d > 0.3 ? 1 : d < 0.08 ? 0.5 : 0.5 + (d - 0.08) * 2.27;
          const m = ant[i] + (v - ant[i]) * k;
          ant[i] = m; m8[o + x] = m * 255;
        }
      }
    });
    // máscara (a textura usa FLIP_Y como o vídeo, então as coordenadas batem)
    gl.bindTexture(gl.TEXTURE_2D, this.tMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, MW, this.mh, 0, gl.RED, gl.UNSIGNED_BYTE, this.m8);
    gl.bindTexture(gl.TEXTURE_2D, this.tFrame);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte);

    const desenhar = (prog, fb, w, h) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h); gl.useProgram(prog.p); };
    const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
    const desfoque = this.op.modo !== "imagem";
    if (desfoque) {
      const { fa, fb } = this;
      desenhar(this.pPremul, fa.fb, fa.w, fa.h);
      tex(0, this.tFrame, this.pPremul.u.frame); tex(1, this.tMask, this.pPremul.u.mask);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const passes = Math.max(1, Math.round(2 * this.op.forca));
      for (let i = 0; i < passes; i++) {
        desenhar(this.pBlur, fb.fb, fb.w, fb.h); tex(0, fa.t, this.pBlur.u.tex); gl.uniform2f(this.pBlur.u.dir, 1 / fa.w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        desenhar(this.pBlur, fa.fb, fa.w, fa.h); tex(0, fb.t, this.pBlur.u.tex); gl.uniform2f(this.pBlur.u.dir, 0, 1 / fb.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    const c = this.pComp;
    desenhar(c, null, W, H);
    tex(0, this.tFrame, c.u.frame); tex(1, this.tMask, c.u.mask); tex(2, desfoque ? this.fa.t : this.tImg, c.u.bg);
    gl.uniform2f(c.u.mtex, 1 / MW, 1 / this.mh);
    gl.uniform1i(c.u.modo, desfoque ? 0 : 1);
    const cv = this.cover || [1, 1, 0, 0]; gl.uniform4f(c.u.cover, cv[0], cv[1], cv[2], cv[3]);
    // no desfoque a borda pode ser mais generosa; no fundo virtual, um pouco mais justa (menos fundo real aparecendo)
    if (desfoque) { gl.uniform1f(c.u.lo, 0.3); gl.uniform1f(c.u.hi, 0.7); } else { gl.uniform1f(c.u.lo, 0.42); gl.uniform1f(c.u.hi, 0.78); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Troca o fundo sem reiniciar (instantâneo): { modo, imagem }. */
  async trocar(op) {
    const novo = Object.assign({}, this.op, op);
    const img = novo.modo === "imagem" ? await carregarImagem(novo.imagem) : null;
    this.op = novo; this.imgFundo = img; this.cover = null;
    if (img && this.gl) this.enviarImagem();
  }

  async restart(opts) { await this.destroy(); await this.init(opts); }

  liberarGL() {
    const gl = this.gl; if (!gl) return;
    try { const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); } catch (e) { }
    this.gl = null;
  }

  async destroy() {
    this.vivo = false;
    clearTimeout(this.timer);
    try { this.leitor && await this.leitor.cancel(); } catch (e) { }
    try { this.escritor && await this.escritor.close(); } catch (e) { }
    try { this.processedTrack && this.processedTrack.stop(); } catch (e) { }
    if (this.video) { this.video.srcObject = null; this.video = null; }
    this.leitor = this.escritor = this.gerador = null;
    this.liberarGL();
    this.fa = this.fb = null; this.mAnt = null;
  }
}

window.EndeavorFundo = {
  criar: (op) => new FundoSuave(op),
  suportado: () => {
    try { return !!document.createElement("canvas").getContext("webgl2") && typeof WebAssembly !== "undefined"; } catch (e) { return false; }
  },
  /** Carrega o modelo antes (opcional), para o primeiro clique ser rápido. */
  preparar: (base) => obterSegmentador(base).then(() => true, () => false),
};
