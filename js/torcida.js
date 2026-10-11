// =============================================================
//  TORCIDA 3D — milhares de torcedores sentados na arquibancada.
//  Quem tem o mando de campo tem mais torcedores, e a torcida organizada
//  fica atrás do gol. Cada torcida pula no gol do seu time e fica
//  quieta quando sofre gol.
// =============================================================
import * as THREE from 'three';

const PELES = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0x6b3e1f, 0xffdbac];
const CORES_BR = [0xffd400, 0xffd400, 0xffd400, 0xffd400, 0x0a9b3c, 0x0a9b3c, 0x1646b8, 0xffffff];
const geoCorpo = new THREE.BoxGeometry(0.5, 0.75, 0.35);
const geoCabeca = new THREE.SphereGeometry(0.17, 8, 6);
const geoBraco = new THREE.BoxGeometry(0.12, 0.5, 0.12);

export class Torcida {
  // fracaoBR: 0 a 1 (quanto da torcida é do Brasil). kitAdv: cores do adversário
  constructor(arquibancadas, { fracaoBR = 0.5, kitAdv = null } = {}) {
    this.fracaoBR = fracaoBR;
    this.grupos = [];
    this.festa = null;
    this.tristeza = null;
    this.uhhAte = 0;
    this.olaInicio = -100;
    this.tempo = 0;
    const coresAdv = kitAdv ? [kitAdv.camisa, kitAdv.camisa, kitAdv.camisa, kitAdv.detalhe] : [0xdddddd];
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    arquibancadas.forEach((g, indice) => {
      const L = g.userData.largura;
      // chance de cada lugar ser de torcedor brasileiro
      let chanceBR = fracaoBR;
      if (indice === 2) chanceBR = fracaoBR >= 0.5 ? 0.95 : fracaoBR;          // atrás do gol esquerdo
      if (indice === 1) chanceBR = fracaoBR <= 0.5 ? 0.12 : Math.max(0.3, fracaoBR - 0.2); // atrás do gol direito
      const lugares = [];
      for (let degrau = 0; degrau < 4; degrau++) {
        const topo = 3 + degrau * 3;
        for (const fila of [1.2, -1.1]) {
          for (let x = -L / 2 + 1; x < L / 2 - 1; x += 0.85) {
            if (Math.random() < 0.07) continue; // lugar vazio
            const time = Math.random() < chanceBR ? 0 : 1;
            lugares.push({
              x: x + (Math.random() - 0.5) * 0.2, y: topo + 0.38, z: -degrau * 5 + fila + (Math.random() - 0.5) * 0.2,
              time, fase: Math.random() * Math.PI * 2, forca: 0.6 + Math.random() * 0.5,
            });
          }
        }
      }
      const n = lugares.length;
      const corpo = new THREE.InstancedMesh(geoCorpo, mat, n);
      const cabeca = new THREE.InstancedMesh(geoCabeca, mat, n);
      const bracos = new THREE.InstancedMesh(geoBraco, mat, n * 2);
      const m = new THREE.Matrix4();
      const cor = new THREE.Color();
      lugares.forEach((l, i) => {
        m.makeTranslation(l.x, l.y, l.z);
        corpo.setMatrixAt(i, m);
        m.makeTranslation(l.x, l.y + 0.55, l.z);
        cabeca.setMatrixAt(i, m);
        const lista = l.time === 0 ? CORES_BR : coresAdv;
        cor.setHex(lista[(Math.random() * lista.length) | 0]);
        corpo.setColorAt(i, cor);
        cor.setHex(PELES[(Math.random() * PELES.length) | 0]);
        cabeca.setColorAt(i, cor);
        bracos.setColorAt(i * 2, cor);
        bracos.setColorAt(i * 2 + 1, cor);
      });
      for (const im of [corpo, cabeca, bracos]) {
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.frustumCulled = false;
        g.add(im);
      }
      this.grupos.push({ g, corpo, cabeca, bracos, lugares, longa: indice === 0 });
    });
    this.atualizar(0);
  }

  // Gol! A torcida do time que fez pula; a outra fica triste
  gol(timeQueFez, segundos = 7) {
    this.festa = { time: timeQueFez, ate: this.tempo + segundos };
    this.tristeza = { time: 1 - timeQueFez, ate: this.tempo + segundos };
  }

  // Chance perigosa: todo mundo levanta
  uhh() { this.uhhAte = this.tempo + 1.6; }

  // Ola na arquibancada principal
  ola() { if (this.tempo - this.olaInicio > 12) this.olaInicio = this.tempo; }

  atualizar(dt) {
    this.tempo += dt;
    const t = this.tempo;
    const festa = this.festa && t < this.festa.ate ? this.festa.time : -1;
    const triste = this.tristeza && t < this.tristeza.ate ? this.tristeza.time : -1;
    const uhh = t < this.uhhAte ? Math.sin(((this.uhhAte - t) / 1.6) * Math.PI) : 0;
    const olaPos = -70 + (t - this.olaInicio) * 22;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eixoZ = new THREE.Vector3(0, 0, 1);
    const esc = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();

    for (const gr of this.grupos) {
      const corpoArr = gr.corpo.instanceMatrix.array;
      const cabecaArr = gr.cabeca.instanceMatrix.array;
      const lugares = gr.lugares;
      for (let i = 0; i < lugares.length; i++) {
        const l = lugares[i];
        let y = l.y;
        let bracosParaCima = 0;
        if (l.time === festa) {
          y += Math.abs(Math.sin(t * 8.5 * l.forca + l.fase)) * 0.75;
          bracosParaCima = 1;
        } else if (l.time === triste) {
          y -= 0.22;
        } else {
          // batucada: os brasileiros balançam no ritmo
          if (l.time === 0) y += Math.max(0, Math.sin(t * 5.2 + l.fase * 0.25)) * 0.07;
          y += uhh * 0.35 * l.forca;
          if (uhh > 0.5) bracosParaCima = 0.6;
          if (gr.longa) {
            const d = l.x - olaPos;
            const onda = Math.exp(-(d * d) / 18);
            if (onda > 0.05) { y += onda * 0.8; bracosParaCima = Math.max(bracosParaCima, onda); }
          }
        }
        corpoArr[i * 16 + 13] = y;
        cabecaArr[i * 16 + 13] = y + 0.55;
        // braços: para baixo ao lado do corpo, ou levantados
        for (let lado = 0; lado < 2; lado++) {
          const s = lado ? 1 : -1;
          const ang = s * (0.15 + bracosParaCima * (2.6 + Math.sin(t * 10 + l.fase) * 0.3));
          q.setFromAxisAngle(eixoZ, ang);
          const ombroY = y + 0.3;
          p.set(l.x + s * 0.31 + Math.sin(ang) * 0.25, ombroY - Math.cos(ang) * 0.25, l.z);
          m.compose(p, q, esc);
          gr.bracos.setMatrixAt(i * 2 + lado, m);
        }
      }
      gr.corpo.instanceMatrix.needsUpdate = true;
      gr.cabeca.instanceMatrix.needsUpdate = true;
      gr.bracos.instanceMatrix.needsUpdate = true;
    }
  }

  destruir() {
    for (const gr of this.grupos) {
      for (const im of [gr.corpo, gr.cabeca, gr.bracos]) { gr.g.remove(im); im.dispose(); }
    }
    this.grupos = [];
  }
}
