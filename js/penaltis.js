// =============================================================
//  DISPUTA DE PÊNALTIS — 5 cobranças para cada lado, depois alternadas
//  Batendo: mire com o joystick/setas, segure CHUTE para a força e solte.
//  No gol: escolha o canto (◀ ▲ ▶ ou setas) antes do batedor chutar.
// =============================================================
import * as THREE from 'three';
import { CAMPO, MEIO_X } from './estadio.js';
import { criarModeloJogador, animarJogador } from './jogador.js';
import { entrada } from './controles.js';
import { SELECAO, DIFICULDADES, elencoAdversario } from './dados.js';
import * as som from './audio.js';

const G = 9.8;
const RAIO_BOLA = 0.18;
const MARCA = MEIO_X - 11;   // marca do pênalti (x = 41.5)
const MEIA = CAMPO.golLarg / 2;
const sorte = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

export class Penaltis {
  constructor(op) {
    this.op = op;
    this.cena = op.cena;
    this.camera = op.camera;
    this.hud = op.hud;
    this.dif = DIFICULDADES[op.dificuldade] || DIFICULDADES.mirim;
    this.grupo = new THREE.Group();
    this.cena.add(this.grupo);
    this.placar = [[], []];   // true = gol, false = perdeu
    this.vez = 0;              // quem bate agora: 0 Brasil, 1 adversário
    this.rodada = 0;
    this.tempo = 0;
    this.terminou = false;
    this.pausado = false;

    const batedoresBR = [10, 9, 7, 8, 11, 5, 4, 3, 2, 6, 1].map(n => SELECAO.jogadores.find(j => j.num === n));
    // adversário: os mesmos jogadores da partida, os melhores chutadores primeiro
    const batedoresAdv = [...elencoAdversario(op.adversario)].sort((a, b) => (b.pos === 'GOL' ? -99 : b.chu) - (a.pos === 'GOL' ? -99 : a.chu));
    this.batedores = [batedoresBR, batedoresAdv];

    this.goleiros = [
      this.criarJogador(SELECAO.kitGoleiro, 1, SELECAO.jogadores[0].nome, 0, SELECAO.jogadores[0].visual, true),
      this.criarJogador({ camisa: 0xff4fa0, detalhe: 0x222222, calcao: 0x222222, meiao: 0xff4fa0 }, 1, 'Goleiro', 5, null, true),
    ];

    const bolaGeo = new THREE.SphereGeometry(RAIO_BOLA, 20, 14);
    this.bolaMalha = new THREE.Mesh(bolaGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    this.bolaMalha.castShadow = true;
    this.grupo.add(this.bolaMalha);

    // mira (círculo amarelo no gol)
    this.mira = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24), new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    this.mira.rotation.y = Math.PI / 2;
    this.mira.renderOrder = 10;
    this.grupo.add(this.mira);

    this.hud.placarPenaltis(this.placar);
    this.prepararCobranca();
  }

  criarJogador(kit, num, nome, indice, visual = null, goleiro = false) {
    const modelo = criarModeloJogador(kit, num, nome, indice, visual, goleiro);
    this.grupo.add(modelo.raiz);
    return { modelo, pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, ang: 0, fase: 0, mergulho: 0, ladoMergulho: 0, comemorando: 0, animChute: 0 };
  }

  destruir() {
    this.cena.remove(this.grupo);
    this.hud.botoesGoleiro(false);
    this.hud.placarPenaltis(null);
  }

  prepararCobranca() {
    const time = this.vez;
    const lista = this.batedores[time];
    const dados = lista[this.rodada % lista.length];
    const kit = time === 0 ? SELECAO.kit : this.op.adversario.kit;
    if (this.batedor) this.grupo.remove(this.batedor.modelo.raiz);
    this.batedor = this.criarJogador(kit, dados.num, dados.nome, this.rodada + time * 4, dados.visual);
    this.batedor.dados = dados;
    this.batedor.pos = { x: MARCA - 2.2, z: -0.8 };
    this.batedor.ang = Math.atan2(1, 0.35);
    this.goleiro = this.goleiros[1 - time];
    this.goleiros[time].modelo.raiz.visible = false;
    this.goleiro.modelo.raiz.visible = true;
    this.goleiro.pos = { x: MEIO_X - 0.3, z: 0 };
    this.goleiro.ang = -Math.PI / 2;
    this.goleiro.mergulho = 0;
    this.goleiro.vel = { x: 0, z: 0 };
    this.goleiro.modelo.corpo.rotation.z = 0;
    this.bola = new THREE.Vector3(MARCA, RAIO_BOLA, 0);
    this.velBola = new THREE.Vector3();
    this.miraPos = { z: 0, y: 1.0 };
    this.forca = 0;
    this.escolhaGoleiro = null;
    this.fase = 'mirando';
    this.timer = 0;
    this.decidiu = false;
    this.mira.visible = time === 0;
    this.hud.botoesGoleiro(time === 1);
    if (this.hud.dica) this.hud.dica(time === 0 ? 'Setas: mover a mira · K: segure e solte para chutar' : 'Setas ◀ ▲ ▶: escolha o canto para pular');
    this.hud.msg(time === 0 ? `${dados.nome} vai bater` : `Defenda! ${dados.nome} vai bater`, 1.8, false,
      time === 0 ? 'Mire e segure CHUTE' : 'Escolha o canto: ◀ ▲ ▶');
    // IA do batedor adversário escolhe o canto
    this.alvoIA = { z: (Math.random() < 0.5 ? -1 : 1) * sorte(1.2, 3.3), y: sorte(0.3, 2.0) };
    if (Math.random() < 0.15) this.alvoIA.z = sorte(-0.8, 0.8);
    this.tempoParaChuteIA = sorte(2.2, 3.2);
  }

  atualizar(dt) {
    if (this.pausado || this.terminou) return;
    dt = Math.min(dt, 1 / 30);
    this.tempo += dt;
    this.timer += dt;
    const b = this.batedor, g = this.goleiro;

    if (this.fase === 'mirando') {
      if (this.vez === 0) {
        // jogador mira
        this.miraPos.z = limitar(this.miraPos.z + entrada.x * dt * 4, -MEIA - 0.6, MEIA + 0.6);
        this.miraPos.y = limitar(this.miraPos.y + entrada.y * dt * 3, 0.2, CAMPO.golAlt + 0.6);
        if (entrada.chute) {
          this.forca = Math.min(entrada.tempoChute / 1.0, 1);
          this.hud.forca(this.forca);
        }
        if (entrada.chuteSoltou) {
          this.hud.forca(null);
          this.forca = Math.max(0.2, Math.min(entrada.tempoChute / 1.0, 1));
          this.fase = 'corrida';
          this.timer = 0;
          // goleiro adversário decide o canto
          const acerta = Math.random() < this.dif.reacaoGoleiroAdv * 0.55;
          const ladoReal = Math.abs(this.miraPos.z) < 1 ? 0 : Math.sign(this.miraPos.z);
          this.escolhaGoleiro = acerta ? ladoReal : [-1, 0, 1].filter(l => l !== ladoReal)[Math.random() < 0.5 ? 0 : 1];
        }
      } else {
        // jogador escolhe o canto como goleiro (pode mudar até o chute)
        const esc = this.hud.escolhaGoleiro();
        if (esc !== null) this.escolhaGoleiro = esc;
        else if (Math.abs(entrada.x) > 0.5) this.escolhaGoleiro = Math.sign(entrada.x);
        else if (entrada.y > 0.5) this.escolhaGoleiro = 0;
        if (this.timer > this.tempoParaChuteIA) {
          this.fase = 'corrida';
          this.timer = 0;
          this.miraPos = { ...this.alvoIA };
          this.forca = sorte(0.55, 0.85);
        }
      }
      this.mira.position.set(MEIO_X, this.miraPos.y, this.miraPos.z);
    } else if (this.fase === 'corrida') {
      // corrida até a bola
      const alvo = { x: MARCA - 0.7, z: -0.25 };
      const dx = alvo.x - b.pos.x, dz = alvo.z - b.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        b.vel = { x: (dx / d) * 5, z: (dz / d) * 5 };
        b.pos.x += b.vel.x * dt; b.pos.z += b.vel.z * dt;
      } else {
        b.vel = { x: 0, z: 0 };
        this.chutar();
      }
    } else if (this.fase === 'voando') {
      this.velBola.y -= G * dt;
      this.bola.addScaledVector(this.velBola, dt);
      if (this.bola.y < RAIO_BOLA) { this.bola.y = RAIO_BOLA; this.velBola.y = Math.abs(this.velBola.y) * 0.4; this.velBola.multiplyScalar(0.8); }
      // goleiro mergulha no momento certo
      const tChegar = (MEIO_X - this.bola.x) / Math.max(this.velBola.x, 0.1);
      if (!g.mergulho && this.escolhaGoleiro !== null && tChegar < 0.45) {
        if (this.escolhaGoleiro !== 0) {
          g.mergulho = 1.2;
          g.vel = { x: 0, z: this.escolhaGoleiro * 7 };
          g.ladoMergulho = -this.escolhaGoleiro * Math.sin(g.ang);
        } else g.mergulho = 0.01;
      }
      if (g.mergulho > 0.01) {
        g.pos.z += g.vel.z * dt;
        g.vel.z *= 0.93;
      }
      if (!this.decidiu && this.bola.x >= MEIO_X - 0.6) this.decidir();
      if (this.timer > 2.2) this.proxima();
    } else if (this.fase === 'resultado') {
      this.velBola.y -= G * dt;
      this.bola.addScaledVector(this.velBola, dt);
      if (this.bola.y < RAIO_BOLA) { this.bola.y = RAIO_BOLA; this.velBola.y = Math.abs(this.velBola.y) * 0.3; this.velBola.multiplyScalar(0.7); }
      if (this.bola.x > MEIO_X + 2) { this.bola.x = MEIO_X + 2; this.velBola.x = 0; }
      if (g.mergulho > 0.01) g.pos.z += g.vel.z * dt * 0.3;
      if (this.timer > 2.4) this.proxima();
    }

    // visual
    for (const p of [b, g]) {
      p.modelo.raiz.position.set(p.pos.x, 0, p.pos.z);
      p.modelo.raiz.rotation.y = p.ang;
      p.animChute = Math.max(0, p.animChute - dt);
      p.comemorando = Math.max(0, p.comemorando - dt);
      animarJogador(p, dt, this.tempo);
    }
    this.bolaMalha.position.copy(this.bola);
    this.bolaMalha.rotation.z -= this.velBola.x * dt;

    this.camera.position.set(MARCA - 10.5, 3.6, 1.4);
    this.camera.lookAt(MEIO_X, 1.2, 0);
  }

  chutar() {
    const b = this.batedor;
    b.animChute = 0.3;
    const qualidade = (b.dados.chu || 80) / 99;
    let erro = this.vez === 0 ? (this.dif.miraAuto ? 0.15 : 0.4) : (1 - qualidade) * 1.6 + 0.2;
    let { z, y } = this.miraPos;
    z += (Math.random() - 0.5) * erro;
    y += (Math.random() - 0.5) * erro * 0.6;
    if (this.forca > 0.9) y += (this.forca - 0.9) * 10;   // força demais: isola!
    y = Math.max(0.15, y);
    const velH = 13 + this.forca * 17;
    const dx = MEIO_X + 0.6 - this.bola.x, dz = z - this.bola.z;
    const d = Math.hypot(dx, dz);
    const t = d / velH;
    const vy = (y - this.bola.y + 0.5 * G * t * t) / t;
    this.velBola.set((dx / d) * velH, vy, (dz / d) * velH);
    this.alvoFinal = { z, y };
    this.fase = 'voando';
    this.timer = 0;
    this.mira.visible = false;
    this.hud.botoesGoleiro(false);
    som.chute(this.forca);
  }

  decidir() {
    this.decidiu = true;
    const { z, y } = { z: this.bola.z, y: this.bola.y };
    const g = this.goleiro;
    let gol = Math.abs(z) < MEIA && y < CAMPO.golAlt;
    let texto;
    if (!gol) {
      texto = Math.abs(Math.abs(z) - MEIA) < 0.25 || Math.abs(y - CAMPO.golAlt) < 0.25 ? 'Na trave!' : 'Pra fora!';
    } else {
      // o goleiro alcança?
      const lado = this.escolhaGoleiro;
      const pontoZ = lado === 0 || lado === null ? 0 : g.pos.z;
      const alcanceZ = lado === 0 || lado === null ? 0.9 : 1.7;
      const alcanceY = lado === 0 || lado === null ? 2.3 : 1.9;
      const pegou = lado !== null && Math.abs(z - pontoZ) < alcanceZ && y < alcanceY + (lado === 0 ? 0 : 0.2);
      const rapido = this.velBola.length() > 26;
      if (pegou && !(rapido && Math.random() < 0.35)) { gol = false; texto = 'Defendeu!'; }
    }
    this.placar[this.vez].push(gol);
    this.hud.placarPenaltis(this.placar);
    this.fase = 'resultado';
    this.timer = 0;
    const fr = this.op.fracaoBR ?? 0.5;
    if (gol) {
      som.rede();
      som.golTorcida(this.vez === 0 ? fr : 1 - fr);
      if (this.vez === 0) som.animarBatucada();
      if (this.op.torcida) this.op.torcida.gol(this.vez, 3);
      texto = 'GOOOL!';
      if (this.vez === 0) { this.batedor.comemorando = 2.2; som.narrar('Goool!'); }
    } else {
      this.velBola.x = -Math.abs(this.velBola.x) * 0.3;
      this.velBola.z = (Math.random() - 0.5) * 6;
      som.uhhTorcida();
      if (this.op.torcida) this.op.torcida.uhh();
      if (texto === 'Defendeu!') { this.velBola.y = 3; som.narrar(this.vez === 1 ? 'Defendeu!' : 'Que pena!'); }
    }
    this.hud.msg(texto, 1.8, true);
  }

  proxima() {
    if (!this.decidiu) this.decidir();
    const fim = this.verificarFim();
    if (fim !== null) {
      this.terminou = true;
      this.hud.botoesGoleiro(false);
      setTimeout(() => this.op.aoTerminar({ vencedor: fim, placar: this.placar.map(l => l.filter(Boolean).length) }), 1200);
      return;
    }
    if (this.vez === 1) this.rodada++;
    this.vez = 1 - this.vez;
    this.prepararCobranca();
  }

  verificarFim() {
    const [a, b] = this.placar;
    const ga = a.filter(Boolean).length, gb = b.filter(Boolean).length;
    if (a.length <= 5 && b.length <= 5) {
      const restA = 5 - a.length, restB = 5 - b.length;
      if (ga + restA < gb) return 1;
      if (gb + restB < ga) return 0;
      if (a.length === 5 && b.length === 5 && ga !== gb) return ga > gb ? 0 : 1;
      return null;
    }
    // morte súbita: decide quando os dois bateram o mesmo número
    if (a.length === b.length && ga !== gb) return ga > gb ? 0 : 1;
    return null;
  }
}
