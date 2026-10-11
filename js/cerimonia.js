// =============================================================
//  CERIMÔNIA DE PREMIAÇÃO — palco no meio do campo, o time campeão
//  em fila, o capitão levanta a taça, confete caindo e fogos no céu.
// =============================================================
import * as THREE from 'three';
import { criarModeloJogador, animarJogador } from './jogador.js';
import * as som from './audio.js';

const OURO = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.65, roughness: 0.28, emissive: 0x4a3200, emissiveIntensity: 0.6 });
const MALAQUITA = new THREE.MeshStandardMaterial({ color: 0x0f7a45, metalness: 0.3, roughness: 0.35 });

export function criarTaca(escala = 2) {
  const g = new THREE.Group();
  const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.14, 0.15, 0.05, 24), OURO, 0.025);
  add(new THREE.CylinderGeometry(0.137, 0.137, 0.035, 24), MALAQUITA, 0.07);
  add(new THREE.CylinderGeometry(0.13, 0.135, 0.03, 24), OURO, 0.1);
  add(new THREE.CylinderGeometry(0.128, 0.128, 0.03, 24), MALAQUITA, 0.13);
  const perfil = [[0.12, 0], [0.08, 0.05], [0.055, 0.12], [0.05, 0.2], [0.07, 0.28], [0.1, 0.34], [0.12, 0.38], [0.11, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
  add(new THREE.LatheGeometry(perfil, 28), OURO, 0.145);
  // as "figuras" em espiral segurando o mundo
  for (let i = 0; i < 3; i++) {
    const braco = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 20, Math.PI * 1.2), OURO);
    braco.position.y = 0.42;
    braco.rotation.set(Math.PI / 2.3, 0, (i / 3) * Math.PI * 2);
    g.add(braco);
  }
  add(new THREE.SphereGeometry(0.11, 24, 18), OURO, 0.63);
  g.scale.setScalar(escala);
  return g;
}

function texturaFaixa(texto, sub, corFundo) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, corFundo);
  grad.addColorStop(1, '#06281a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#ffd400';
  g.lineWidth = 10;
  g.strokeRect(8, 8, 1008, 240);
  g.fillStyle = '#ffd400';
  g.textAlign = 'center';
  g.font = 'bold 110px Arial';
  g.fillText(texto, 512, 140);
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px Arial';
  g.fillText(sub, 512, 210);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Cerimonia {
  // vencedor: { nome, kit, kitGoleiro, jogadores: [dados...] }  coresConfete: [hex...]
  constructor({ cena, camera, vencedor, torcida, timeTorcida = 0, titulo = 'CAMPEÃO!', subtitulo = '' }) {
    this.cena = cena;
    this.camera = camera;
    this.torcida = torcida;
    this.timeTorcida = timeTorcida;
    this.grupo = new THREE.Group();
    cena.add(this.grupo);
    this.tempo = 0;
    this.pausado = false;
    this.terminou = true; // não pausa sozinho quando a aba some
    this.fogos = [];
    this.proximoFogo = 0.5;

    // palco
    const branco = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 });
    const palco = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 4.2), branco);
    palco.position.set(0, 0.25, -2);
    palco.receiveShadow = true; palco.castShadow = true;
    this.grupo.add(palco);
    const borda = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.08, 4.4), OURO);
    borda.position.set(0, 0.52, -2);
    this.grupo.add(borda);
    const degrau = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 1), branco);
    degrau.position.set(0, 0.125, 0.55);
    this.grupo.add(degrau);
    // faixa no fundo
    const faixa = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: texturaFaixa(titulo, subtitulo || vencedor.nome.toUpperCase(), '#0a7a34') }));
    faixa.position.set(0, 4.2, -4.6);
    this.grupo.add(faixa);
    for (const x of [-8, 8]) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.4, 8), OURO);
      poste.position.set(x, 3.2, -4.62);
      this.grupo.add(poste);
    }

    // jogadores em fila; o capitão no meio, na frente, com a taça
    this.jogadores = [];
    const lista = vencedor.jogadores.slice(0, 11);
    const ordem = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0, 10];
    lista.forEach((d, i) => {
      const goleiro = d.pos === 'GOL';
      const modelo = criarModeloJogador(goleiro ? vencedor.kitGoleiro : vencedor.kit, d.num, d.nome, i + 7, d.visual, goleiro);
      this.grupo.add(modelo.raiz);
      const k = ordem.indexOf(i);
      const capitao = i === 7 || (lista.length < 8 && i === 0);
      const x = capitao ? 0 : (k - 5) * 1.45;
      const z = capitao ? -0.6 : -2.2 - (Math.abs(k - 5) % 2) * 0.6;
      modelo.raiz.position.set(x, 0.5, z);
      const j = { modelo, vel: { x: 0, z: 0 }, fase: Math.random() * 6, mergulho: 0, ladoMergulho: 0, comemorando: 0, animChute: 0, carrinho: 0, capitao, atraso: Math.random() * 0.6 };
      this.jogadores.push(j);
      if (capitao) {
        this.capitao = j;
        this.taca = criarTaca(2.1);
        this.grupo.add(this.taca);
      }
    });

    // confete
    const n = 900;
    this.confete = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
    this.confete.frustumCulled = false;
    const cores = vencedor.coresConfete || [0xffd400, 0x0a9b3c, 0x1646b8, 0xffffff];
    const cor = new THREE.Color();
    this.pedacos = [];
    for (let i = 0; i < n; i++) {
      this.pedacos.push({ x: (Math.random() - 0.5) * 40, y: Math.random() * 18, z: (Math.random() - 0.5) * 24 - 2, vy: 1.2 + Math.random() * 1.6, giro: Math.random() * 6, vg: 2 + Math.random() * 6, bal: Math.random() * 6 });
      cor.setHex(cores[i % cores.length]);
      this.confete.setColorAt(i, cor);
    }
    this.grupo.add(this.confete);
    this.mat4 = new THREE.Matrix4();
    this.quat = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.vetor = new THREE.Vector3();
    this.um = new THREE.Vector3(1, 1, 1);

    this.camPos = new THREE.Vector3(0, 6, 22);
    if (torcida) torcida.gol(timeTorcida, 9999);
  }

  soltarFogo() {
    const n = 140;
    const pos = new Float32Array(n * 3);
    const vel = [];
    const cx = (Math.random() - 0.5) * 70, cy = 26 + Math.random() * 14, cz = -25 - Math.random() * 20;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(9 + Math.random() * 5);
      vel.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const cores = [0xffd400, 0x3ddc6b, 0x4f8bff, 0xff5a5a, 0xffffff, 0xff9de2];
    const mat = new THREE.PointsMaterial({ color: cores[(Math.random() * cores.length) | 0], size: 0.9, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const pontos = new THREE.Points(geo, mat);
    this.grupo.add(pontos);
    this.fogos.push({ pontos, vel, vida: 0 });
    som.fogo();
  }

  atualizar(dt) {
    if (this.pausado) return;
    dt = Math.min(dt, 1 / 30);
    this.tempo += dt;
    const t = this.tempo;

    // capitão levanta a taça depois de 2 segundos
    const levantar = Math.min(1, Math.max(0, (t - 2) / 0.8));
    for (const j of this.jogadores) {
      if (j.capitao) {
        j.comemorando = 0;
        animarJogador(j, dt, t);
        const m = j.modelo;
        const [oE, oD] = m.bracos, [cE, cD] = m.cotovelos;
        oE.rotation.x = oD.rotation.x = 1.0 + levantar * 2.05;
        oE.rotation.z = -0.25; oD.rotation.z = 0.25;
        cE.rotation.x = cD.rotation.x = -0.9 * (1 - levantar);
        const pulo = levantar >= 1 ? Math.abs(Math.sin(t * 5)) * 0.15 : 0;
        m.corpo.position.y = pulo;
        const p = m.raiz.position;
        this.taca.position.set(p.x, p.y + 1.45 + levantar * 0.85 + pulo, p.z + 0.35 * (1 - levantar) + 0.12);
        this.taca.rotation.y = Math.sin(t * 1.5) * 0.3;
      } else {
        j.comemorando = t > 2 + j.atraso ? 5 : 0;
        animarJogador(j, dt, t + j.atraso);
      }
    }
    if (t > 2 && !this.gritou) { this.gritou = true; som.golTorcida(1); }

    // confete caindo e girando
    for (let i = 0; i < this.pedacos.length; i++) {
      const c = this.pedacos[i];
      c.y -= c.vy * dt;
      c.giro += c.vg * dt;
      if (c.y < 0.05) { c.y = 16 + Math.random() * 4; }
      this.vetor.set(c.x + Math.sin(t + c.bal) * 0.6, c.y, c.z + Math.cos(t * 0.8 + c.bal) * 0.4);
      this.euler.set(c.giro, c.giro * 0.7, c.bal);
      this.quat.setFromEuler(this.euler);
      this.mat4.compose(this.vetor, this.quat, this.um);
      this.confete.setMatrixAt(i, this.mat4);
    }
    this.confete.instanceMatrix.needsUpdate = true;

    // fogos de artifício
    this.proximoFogo -= dt;
    if (this.proximoFogo <= 0) { this.soltarFogo(); this.proximoFogo = 0.5 + Math.random() * 0.9; }
    for (let i = this.fogos.length - 1; i >= 0; i--) {
      const f = this.fogos[i];
      f.vida += dt;
      const arr = f.pontos.geometry.attributes.position.array;
      for (let k = 0; k < f.vel.length; k++) {
        const v = f.vel[k];
        v.y -= 4 * dt;
        v.multiplyScalar(1 - dt * 1.2);
        arr[k * 3] += v.x * dt; arr[k * 3 + 1] += v.y * dt; arr[k * 3 + 2] += v.z * dt;
      }
      f.pontos.geometry.attributes.position.needsUpdate = true;
      f.pontos.material.opacity = Math.max(0, 1 - f.vida / 2);
      if (f.vida > 2) {
        this.grupo.remove(f.pontos);
        f.pontos.geometry.dispose(); f.pontos.material.dispose();
        this.fogos.splice(i, 1);
      }
    }

    // câmera: aproxima e passeia em volta do palco
    const ang = Math.sin(t * 0.18) * 0.55;
    const raio = Math.max(10, 22 - t * 2.2);
    const alvo = new THREE.Vector3(Math.sin(ang) * raio, 3.2 + Math.max(0, 6 - t) * 0.4, -2 + Math.cos(ang) * raio);
    this.camPos.lerp(alvo, Math.min(1, dt * 1.5));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(0, 2.2, -2);
  }

  destruir() {
    this.cena.remove(this.grupo);
    if (this.torcida) this.torcida.festa = null;
  }
}
