// =============================================================
//  PARTIDA 11 x 11 — bola, regras, inteligência dos jogadores e câmera
//  O Brasil (time 0) ataca para a direita (+x). O adversário (time 1) ataca para a esquerda.
// =============================================================
import * as THREE from 'three';
import { CAMPO, MEIO_X, MEIO_Z } from './estadio.js';
import { criarModeloJogador, criarMarcadorControle, animarJogador } from './jogador.js';
import { entrada } from './controles.js';
import { FORMACAO, SELECAO, DIFICULDADES, elencoAdversario } from './dados.js';
import * as som from './audio.js';

const G = 9.8;
const RAIO_BOLA = 0.18;          // bola um pouco maior que a real para enxergar no celular
const ATRITO = 3.4;              // freio da bola rolando na grama (m/s²)
const MEIA_TRAVE = CAMPO.golLarg / 2;
const KIT_GOLEIRO_ADV = { camisa: 0xff4fa0, detalhe: 0x222222, calcao: 0x222222, meiao: 0xff4fa0 };

const v2 = (x = 0, z = 0) => ({ x, z });
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const sorte = (a, b) => a + Math.random() * (b - a);

const temBolaAgora = (p, j) => p.bola.dono === j;

export class Partida {
  constructor(op) {
    this.op = op;
    this.cena = op.cena;
    this.camera = op.camera;
    this.hud = op.hud;
    this.dif = DIFICULDADES[op.dificuldade] || DIFICULDADES.mirim;
    this.regrasCompletas = this.dif.regrasCompletas;
    this.treino = !!op.treino;
    this.duracao = op.duracaoTempo || 180;   // segundos de cada tempo
    this.grupo = new THREE.Group();
    this.cena.add(this.grupo);
    this.gols = [0, 0];
    this.periodo = 1;
    this.relogio = 0;
    this.estado = 'parada';
    this.timerEstado = 0;
    this.tempoTotal = 0;
    this.pausado = false;
    this.terminou = false;
    this.estatisticas = { chutes: [0, 0] };
    this.torcida = op.torcida || null;
    this.fracaoBR = op.fracaoBR ?? 0.5;   // quanto da torcida é do Brasil (mando de campo)
    this.gravacao = [];                   // últimos segundos, para o replay
    this.ultimoReplay = null;
    this.replay = null;
    this.capturarReplayEm = null;
    this.timerOla = 15;
    this.marcadores = [];          // quem fez cada gol: { nome, time, contra }
    this.substituicoes = 0;
    this.maxSubstituicoes = 5;
    this.sairam = new Set();       // números de quem já saiu (não pode voltar)
    this.expulsosNums = new Set();

    this.criarTimes();
    this.criarBola();
    this.marcador = criarMarcadorControle();
    this.grupo.add(this.marcador);
    this.controlado = null;
    this.timerTroca = 0;
    this.camAlvo = new THREE.Vector3();
    this.camPos = new THREE.Vector3(0, 22, 50);

    this.hud.placar(this.gols[0], this.gols[1]);
    this.iniciarSaida(0, true);
  }

  // ---------------------------------------------------------- criação
  criarTimes() {
    this.jogadores = [];
    this.times = [[], []];
    const brasil = SELECAO.titulares.map(n => SELECAO.jogadores.find(j => j.num === n));
    const adv = this.treino ? null : this.op.adversario;
    const elencoAdv = adv ? elencoAdversario(adv) : null;
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < 11; i++) {
        if (t === 1 && this.treino && i !== 0) continue; // no treino só tem o goleiro adversário
        const dados = t === 0 ? brasil[i] : (elencoAdv ? elencoAdv[i] : { num: 1, nome: 'Goleiro', pos: 'GOL', vel: 60, chu: 40, pas: 50, dri: 40, def: 70, fis: 70 });
        const kit = i === 0 ? (t === 0 ? SELECAO.kitGoleiro : KIT_GOLEIRO_ADV) : (t === 0 ? SELECAO.kit : adv.kit);
        const modelo = criarModeloJogador(kit, dados.num, dados.nome, t * 11 + i + (t === 0 ? 0 : 3), dados.visual, i === 0);
        this.grupo.add(modelo.raiz);
        const dir = t === 0 ? 1 : -1;
        const veloc = 6.2 + (dados.vel / 99) * 2.4;
        const j = {
          time: t, idx: i, dir, papel: FORMACAO[i].papel, dados, modelo,
          pos: v2(FORMACAO[i].x * dir, FORMACAO[i].z), vel: v2(), desejo: v2(),
          ang: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
          velMax: veloc * (t === 1 ? this.dif.velAdv : 1),
          fase: Math.random() * 6, mergulho: 0, ladoMergulho: 0, comemorando: 0, animChute: 0,
          atordoado: 0, recargaRoubo: 0, travado: false, controlado: false, reacao: 0, decisao: sorte(0, 0.4), tempoComBola: 0,
          carrinho: 0, carrinhoDir: v2(), carrinhoResolvido: true, amarelos: 0,
        };
        this.jogadores.push(j);
        this.times[t].push(j);
      }
    }
    this.goleiros = [this.times[0][0], this.times[1][0]];
    this.criarJuiz();
  }

  // ---------------------------------------------------------- juiz
  criarJuiz() {
    const kit = { camisa: 0x161616, detalhe: 0xd8d8d8, calcao: 0x161616, meiao: 0x161616 };
    const modelo = criarModeloJogador(kit, '', 'Árbitro', 4, { pele: 1, cabelo: 'raspado', corCabelo: 0x2b1a0f, barba: false });
    this.grupo.add(modelo.raiz);
    // cartão na mão direita (aparece quando o juiz mostra amarelo ou vermelho)
    const cartao = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
    cartao.position.set(0, -0.36, 0.02);
    cartao.visible = false;
    modelo.cotovelos[1].add(cartao);
    this.juiz = {
      modelo, cartao, pos: v2(-4, -9), vel: v2(), ang: 0, fase: 0, velMax: 7.2,
      mergulho: 0, ladoMergulho: 0, comemorando: 0, animChute: 0, carrinho: 0, apontando: 0, tempoCartao: 0,
    };
  }

  // O juiz acompanha o lance na diagonal, sem atrapalhar a jogada
  atualizarJuiz(dt) {
    const jz = this.juiz;
    const b = this.bola;
    jz.apontando = Math.max(0, jz.apontando - dt);
    jz.tempoCartao = Math.max(0, jz.tempoCartao - dt);
    jz.cartao.visible = jz.tempoCartao > 0;
    let alvo;
    if (this.estado === 'parada' && this.reinicio && this.reinicio.tipo === 'saida') alvo = v2(-3, -11);
    else alvo = v2(limitar(b.pos.x - 7, -MEIO_X + 4, MEIO_X - 4), limitar(b.pos.z * 0.5 - 10, -MEIO_Z + 2, MEIO_Z - 4));
    const dx = alvo.x - jz.pos.x, dz = alvo.z - jz.pos.z;
    const d = Math.hypot(dx, dz);
    let v = d < 0.8 ? 0 : jz.velMax * Math.min(1, d / 6);
    if (jz.tempoCartao > 0) v = 0;
    const desejo = d > 0 ? v2((dx / d) * v, (dz / d) * v) : v2();
    const k = Math.min(1, dt * 4);
    jz.vel.x += (desejo.x - jz.vel.x) * k;
    jz.vel.z += (desejo.z - jz.vel.z) * k;
    jz.pos.x += jz.vel.x * dt;
    jz.pos.z += jz.vel.z * dt;
    // olha para a bola
    let da = Math.atan2(b.pos.x - jz.pos.x, b.pos.z - jz.pos.z) - jz.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    jz.ang += da * Math.min(1, dt * 6);
    jz.modelo.raiz.position.set(jz.pos.x, 0, jz.pos.z);
    jz.modelo.raiz.rotation.y = jz.ang;
    animarJogador(jz, dt, this.tempoTotal);
  }

  juizApita(cartao = null) {
    if (!this.juiz) return;
    this.juiz.apontando = 1.8;
    if (cartao) {
      this.juiz.cartao.material.color.setHex(cartao === 'vermelho' ? 0xe02020 : 0xffd400);
      this.juiz.tempoCartao = 2.2;
    }
  }

  criarBola() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#1b1b1b';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.arc((i * 29) % 128 + 6, (i * 17) % 64 + 4, 7, 0, Math.PI * 2);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const malha = new THREE.Mesh(new THREE.SphereGeometry(RAIO_BOLA, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    malha.castShadow = true;
    this.grupo.add(malha);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(RAIO_BOLA * 1.1, 14), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2;
    this.grupo.add(sombra);
    this.bola = {
      malha, sombra, pos: new THREE.Vector3(0, RAIO_BOLA, 0), vel: new THREE.Vector3(),
      dono: null, ultimoToque: null, alvoPasse: null, ignorar: null, ignorarAte: 0,
      chuteDe: null, goleiroTestado: [false, false],
    };
  }

  destruir() {
    this.cena.remove(this.grupo);
    this.grupo.traverse(o => {
      if (o.isMesh) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }

  // ---------------------------------------------------------- reinícios
  posicaoBase(j) {
    const f = FORMACAO[j.idx];
    return v2(f.x * j.dir, f.z);
  }

  iniciarSaida(time, primeira = false) {
    const b = this.bola;
    for (const j of this.jogadores) {
      const f = FORMACAO[j.idx];
      let x = Math.min(f.x * 0.9, -1.5);
      if (j.time !== time && j.idx >= 6) x = Math.min(x, -10);
      j.pos = v2(x * j.dir, f.z * (j.idx >= 8 ? 0.8 : 1));
      j.vel = v2(); j.desejo = v2();
      j.ang = j.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      j.travado = false; j.comemorando = 0; j.mergulho = 0;
    }
    const time_ = this.times[time];
    const batedor = time_.length > 9 ? time_[9] : time_[0];
    const companheiro = time_.length > 7 ? time_[7] : null;
    if (companheiro) companheiro.pos = v2(-6 * batedor.dir, -4);
    batedor.pos = v2(-0.6 * batedor.dir, 0);
    b.pos.set(0, RAIO_BOLA, 0);
    b.vel.set(0, 0, 0);
    this.prepararReinicio('saida', batedor, primeira ? 2.2 : 1.4);
  }

  prepararReinicio(tipo, batedor, espera = 1.2, ang = null) {
    const b = this.bola;
    b.dono = null;
    b.alvoPasse = null;
    b.chuteDe = null;
    for (const j of this.jogadores) j.travado = false;
    batedor.travado = true;
    batedor.tempoComBola = 0;
    batedor.ang = ang !== null ? ang : (batedor.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.estado = 'parada';
    this.timerEstado = espera;
    this.reinicio = { tipo, batedor };
    batedor.vel = v2();
    if (batedor.time === 0) this.trocarControle(batedor);
    else this.trocarControle(this.maisPerto(0, b.pos, true));
  }

  reinicioPorSaida(lado, tipo) {
    // lado: 'lateral' com posição | 'fundo'
    const b = this.bola;
    const ultimo = b.ultimoToque ? b.ultimoToque.time : 0;
    const time = 1 - ultimo;
    let x = limitar(b.pos.x, -MEIO_X + 1, MEIO_X - 1);
    let z = b.pos.z;
    let nome = '';
    if (tipo === 'lateral') {
      z = Math.sign(z) * (MEIO_Z + 0.3);
      nome = 'Lateral';
    } else {
      const ladoX = Math.sign(b.pos.x);
      const defensor = ladoX > 0 ? 1 : 0; // quem defende aquele gol
      if (ultimo === defensor) {
        const atacante = 1 - defensor;
        x = ladoX * (MEIO_X - 0.4);
        z = Math.sign(b.pos.z || 1) * (MEIO_Z - 0.4);
        nome = 'Escanteio';
        this.colocarBolaReinicio(x, z, atacante, 'escanteio');
        this.hud.msg(nome, 1.2);
        return;
      }
      x = ladoX * (MEIO_X - 5.5);
      z = 0;
      nome = 'Tiro de meta';
      this.colocarBolaReinicio(x, z, defensor, 'tiroDeMeta');
      this.hud.msg(nome, 1.2);
      return;
    }
    this.colocarBolaReinicio(x, z, time, 'lateral');
    this.hud.msg(nome, 1.0);
  }

  colocarBolaReinicio(x, z, time, tipo) {
    const b = this.bola;
    b.pos.set(x, RAIO_BOLA, z);
    b.vel.set(0, 0, 0);
    let batedor;
    if (tipo === 'tiroDeMeta') batedor = this.times[time][0];
    else batedor = this.maisPerto(time, b.pos, true);
    let ang;
    if (tipo === 'lateral') { batedor.pos = v2(x, z + Math.sign(z) * 0.4); ang = Math.atan2(0, -Math.sign(z)); }
    else if (tipo === 'escanteio') { batedor.pos = v2(x + Math.sign(x) * 0.5, z + Math.sign(z) * 0.5); ang = Math.atan2(-Math.sign(x), -Math.sign(z) * 0.8); }
    else if (tipo === 'tiroLivre') {
      const gx = batedor.dir * MEIO_X - x, gz = -z;
      const gd = Math.hypot(gx, gz) || 1;
      batedor.pos = v2(x - (gx / gd) * 0.75, z - (gz / gd) * 0.75);
      ang = Math.atan2(gx, gz);
    }
    else { batedor.pos = v2(x + Math.sign(x) * 0.75, z); ang = Math.atan2(-Math.sign(x), 0); }
    this.prepararReinicio(tipo, batedor, tipo === 'tiroLivre' ? 1.6 : 1.1, ang);
  }

  marcarFalta(faltoso, vitima, porTras) {
    som.apito();
    const b = this.bola;
    b.dono = null;
    b.vel.set(0, 0, 0);
    vitima.atordoado = 1.0;
    const x = limitar(vitima.pos.x, -MEIO_X + 1, MEIO_X - 1);
    const z = limitar(vitima.pos.z, -MEIO_Z + 1, MEIO_Z - 1);
    const time = vitima.time;
    let textoCartao = '';
    let expulso = false;
    if (this.regrasCompletas && porTras) {
      faltoso.amarelos++;
      if (faltoso.amarelos >= 2) { textoCartao = `Cartão vermelho! ${faltoso.dados.nome} está expulso`; expulso = true; }
      else textoCartao = `Cartão amarelo para ${faltoso.dados.nome}`;
    }
    const golX = vitima.dir * MEIO_X;
    const naArea = Math.abs(x - golX) < 16.5 && Math.abs(z) < 20.16;
    if (naArea) {
      this.marcarPenalti(time);
      this.hud.msg('PÊNALTI!', 2.4, true, textoCartao);
      som.narrar('Pênalti!');
    } else {
      this.colocarBolaReinicio(x, z, time, 'tiroLivre');
      this.hud.msg('Falta!', 2.2, false, textoCartao || (porTras ? 'Carrinho por trás' : 'Pegou o jogador, não a bola'));
    }
    this.juizApita(textoCartao ? (expulso ? 'vermelho' : 'amarelo') : null);
    if (expulso) this.expulsar(faltoso);
    if (this.torcida) this.torcida.uhh();
  }

  marcarPenalti(time) {
    const b = this.bola;
    const dir = time === 0 ? 1 : -1;
    const x = dir * (MEIO_X - 11);
    b.pos.set(x, RAIO_BOLA, 0);
    b.vel.set(0, 0, 0);
    let batedor = null;
    for (const j of this.times[time]) if (j.idx !== 0 && (!batedor || j.dados.chu > batedor.dados.chu)) batedor = j;
    batedor.pos = v2(x - dir * 1.0, 0);
    for (const j of this.jogadores) {
      if (j === batedor || j.idx === 0) continue;
      if (Math.abs(j.pos.x - dir * MEIO_X) < 21) j.pos.x = dir * (MEIO_X - 21 - Math.random() * 3);
      j.vel = v2();
    }
    const gol = this.goleiros[1 - time];
    gol.pos = v2(dir * (MEIO_X - 0.4), 0);
    gol.vel = v2();
    this.prepararReinicio('penalti', batedor, 2.0, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  // ---------------------------------------------------------- substituições
  elencoParaSubstituir() {
    const emCampo = this.times[0].map(j => ({ num: j.dados.num, nome: j.dados.nome, pos: j.dados.pos, energia: j.energia ?? 1, papel: j.papel, amarelos: j.amarelos }));
    const nums = new Set(this.times[0].map(j => j.dados.num));
    const reservas = SELECAO.jogadores.filter(d => !nums.has(d.num) && !this.sairam.has(d.num) && !this.expulsosNums.has(d.num));
    return { emCampo, reservas, feitas: this.substituicoes, max: this.maxSubstituicoes };
  }

  substituir(numSai, numEntra) {
    if (this.substituicoes >= this.maxSubstituicoes) return 'Já foram feitas as 5 substituições.';
    const j = this.times[0].find(x => x.dados.num === numSai);
    const novo = SELECAO.jogadores.find(d => d.num === numEntra);
    if (!j || !novo) return 'Jogador não encontrado.';
    if ((j.idx === 0) !== (novo.pos === 'GOL')) return j.idx === 0 ? 'Goleiro só pode ser trocado por outro goleiro.' : 'Goleiro reserva só entra no lugar do goleiro.';
    const kit = j.idx === 0 ? SELECAO.kitGoleiro : SELECAO.kit;
    const modelo = criarModeloJogador(kit, novo.num, novo.nome, j.idx + 30, novo.visual, j.idx === 0);
    this.grupo.remove(j.modelo.raiz);
    this.grupo.add(modelo.raiz);
    this.sairam.add(j.dados.num);
    j.dados = novo;
    j.modelo = modelo;
    j.velMaxBase = 6.2 + (novo.vel / 99) * 2.4;
    j.velMax = j.velMaxBase;
    j.energia = 1;
    j.amarelos = 0;
    this.substituicoes++;
    this.hud.msg('Substituição', 2.4, false, `Sai ${this.ultimoNomeSaiu = SELECAO.jogadores.find(d => d.num === numSai).nome} · Entra ${novo.nome}`);
    this.juizApita();
    som.apito();
    return null;
  }

  expulsar(j) {
    this.expulsosNums.add(j.dados.num);
    for (const lista of [this.jogadores, this.times[j.time]]) {
      const i = lista.indexOf(j);
      if (i >= 0) lista.splice(i, 1);
    }
    this.grupo.remove(j.modelo.raiz);
    if (this.bola.dono === j) this.bola.dono = null;
    if (this.controlado === j) {
      this.controlado = null;
      this.trocarControle(this.maisPerto(0, this.bola.pos, true));
    }
  }

  iniciarCarrinho(j, mx, mz, forcaMov) {
    if (j.carrinho > 0 || j.atordoado > 0) return;
    const dir = forcaMov > 0.2 ? v2(mx / forcaMov, mz / forcaMov) : v2(Math.sin(j.ang), Math.cos(j.ang));
    j.carrinho = 0.6;
    j.carrinhoDir = dir;
    j.carrinhoResolvido = false;
    j.vel = v2(dir.x * 10.5, dir.z * 10.5);
    j.ang = Math.atan2(dir.x, dir.z);
  }

  atualizarCarrinho(j, dt) {
    j.carrinho -= dt;
    j.desejo = v2();
    const b = this.bola;
    if (!j.carrinhoResolvido) {
      const dono = b.dono;
      if (!dono && b.pos.y < 0.7 && dist2(j.pos, b.pos) < 1.5) {
        // bola solta: o carrinho isola a bola para frente
        j.carrinhoResolvido = true;
        const s = sorte(7, 10);
        b.vel.set(j.carrinhoDir.x * s, 0.5, j.carrinhoDir.z * s);
        b.ultimoToque = j; b.ignorar = j; b.ignorarAte = this.tempoTotal + 0.4;
        b.alvoPasse = null; b.chuteDe = null; b.goleiroTestado = [false, false];
        som.chute(0.4);
      } else if (dono && dono.time !== j.time && !dono.travado) {
        const dBola = dist2(j.pos, b.pos), dJog = dist2(j.pos, dono.pos);
        if (dBola < 1.5 || dJog < 1.3) {
          j.carrinhoResolvido = true;
          if (dono.idx === 0) return; // goleiro com a bola na mão: nada acontece
          const porTras = (j.carrinhoDir.x * Math.sin(dono.ang) + j.carrinhoDir.z * Math.cos(dono.ang)) > 0.55;
          let chance = (dBola <= dJog ? 0.78 : 0.35) * (j.dados.def / 85) * (this.dif.miraAuto ? 1.25 : 1);
          if (porTras) chance *= 0.3;
          if (Math.random() < chance) {
            b.dono = null;
            dono.atordoado = 0.9;
            dono.tempoComBola = 0;
            const s = sorte(6, 9);
            b.vel.set(j.carrinhoDir.x * s, 0.4, j.carrinhoDir.z * s);
            b.ultimoToque = j; b.ignorar = j; b.ignorarAte = this.tempoTotal + 0.4; b.alvoPasse = null;
            this.hud.msg('Desarmou!', 1);
            som.chute(0.5);
          } else {
            this.marcarFalta(j, dono, porTras);
          }
        }
      }
    }
    if (j.carrinho <= 0) { j.carrinho = 0; j.atordoado = 0.45; }
  }

  maisPerto(time, ponto, semGoleiro = false, exceto = null) {
    let melhor = null, md = Infinity;
    for (const j of this.times[time]) {
      if ((semGoleiro && j.idx === 0) || j === exceto) continue;
      const d = dist2(j.pos, ponto);
      if (d < md) { md = d; melhor = j; }
    }
    return melhor || this.times[time][0];
  }

  trocarControle(j) {
    if (!j || j.time !== 0 || j.idx === 0) return;
    if (this.controlado) this.controlado.controlado = false;
    j.controlado = true;
    this.controlado = j;
  }

  // ---------------------------------------------------------- ações com a bola
  soltarBola(j) {
    const b = this.bola;
    b.dono = null;
    b.ultimoToque = j;
    b.ignorar = j;
    b.ignorarAte = this.tempoTotal + 0.3;
    b.goleiroTestado = [false, false];
    b.chuteDe = null;
    j.travado = false;
    j.tempoComBola = 0;
    j.animChute = 0.3;
    if (this.estado === 'parada') this.estado = 'jogando';
  }

  chutarPara(j, alvo, velH) {
    const b = this.bola;
    this.soltarBola(j);
    const dx = alvo.x - b.pos.x, dz = alvo.z - b.pos.z;
    const d = Math.max(Math.hypot(dx, dz), 0.1);
    const t = d / velH;
    const vy = (alvo.y - b.pos.y + 0.5 * G * t * t) / t;
    b.vel.set((dx / d) * velH, vy, (dz / d) * velH);
  }

  passeRasteiro(j, alvo, receptor) {
    const b = this.bola;
    this.soltarBola(j);
    const dx = alvo.x - b.pos.x, dz = alvo.z - b.pos.z;
    const d = Math.max(Math.hypot(dx, dz), 0.1);
    const qualidade = j.dados.pas / 99;
    const v0 = limitar(Math.sqrt(16 + 2 * ATRITO * d), 7, 28);
    const erro = (1 - qualidade) * 0.12 * (Math.random() - 0.5);
    const ang = Math.atan2(dz, dx) + erro;
    b.vel.set(Math.cos(ang) * v0, 0, Math.sin(ang) * v0);
    b.alvoPasse = receptor || null;
    som.chute(0.3);
  }

  passeAlto(j, alvo, receptor) {
    const d = dist2(j.pos, alvo);
    const velH = limitar(8 + d * 0.4, 12, 24);
    this.chutarPara(j, { x: alvo.x, y: 0.6, z: alvo.z }, velH);
    this.bola.alvoPasse = receptor || null;
    som.chute(0.5);
  }

  chutarAoGol(j, forca, mira) {
    // mira: -1 (canto de cima da tela) .. 1 (canto de baixo); null = automático
    const gx = j.dir * (MEIO_X + 0.5);
    const gol = this.goleiros[1 - j.time];
    let z;
    if (mira === null || mira === undefined) {
      // canto contrário ao goleiro
      const lado = gol.pos.z > 0 ? -1 : 1;
      z = lado * sorte(2.0, 3.1);
    } else {
      z = limitar(mira, -1, 1) * 3.0;
    }
    const qualidade = j.dados.chu / 99;
    const distGol = Math.hypot(gx - j.pos.x, j.pos.z);
    let erro = (1 - qualidade) * 2.6 + distGol * 0.03;
    if (j.time === 0 && this.dif.miraAuto) erro *= 0.35;
    z += (Math.random() - 0.5) * erro;
    let y = 0.35 + forca * 1.3 + (Math.random() - 0.5) * erro * 0.4;
    if (forca > 0.88) y += (forca - 0.88) * 14; // forte demais: a bola sobe!
    y = Math.max(0.2, y);
    const velH = 15 + forca * 15 + qualidade * 3;
    this.chutarPara(j, { x: gx, y, z }, velH);
    this.bola.chuteDe = j;
    this.estatisticas.chutes[j.time]++;
    som.chute(forca);
    som.vibrarTorcida(0.5, 2);
  }

  escolherReceptor(j, direcao, longo = false) {
    // direcao: vetor (x, z) normalizado ou null
    let melhor = null, ms = -Infinity;
    for (const c of this.times[j.time]) {
      if (c === j) continue;
      const dx = c.pos.x - j.pos.x, dz = c.pos.z - j.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3 || d > (longo ? 60 : 38)) continue;
      let s = 0;
      if (direcao) {
        const cos = (dx * direcao.x + dz * direcao.z) / d;
        if (cos < 0.45) continue;
        s += cos * 30;
      } else {
        s += (dx * j.dir) * 0.6; // prefere passes para frente
      }
      s -= Math.abs(d - (longo ? 28 : 14)) * 0.5;
      // espaço livre ao redor do companheiro
      let livre = 10;
      for (const a of this.times[1 - j.time]) livre = Math.min(livre, dist2(a.pos, c.pos));
      s += livre * 1.5;
      if (c.idx === 0) s -= 25;
      if (!this.linhaLivre(j, c)) s -= 18;
      if (s > ms) { ms = s; melhor = c; }
    }
    return melhor;
  }

  linhaLivre(de, para) {
    const ax = de.pos.x, az = de.pos.z, bx = para.pos.x, bz = para.pos.z;
    const L2 = (bx - ax) ** 2 + (bz - az) ** 2;
    for (const o of this.times[1 - de.time]) {
      let t = ((o.pos.x - ax) * (bx - ax) + (o.pos.z - az) * (bz - az)) / L2;
      t = limitar(t, 0, 1);
      const px = ax + t * (bx - ax), pz = az + t * (bz - az);
      if (Math.hypot(o.pos.x - px, o.pos.z - pz) < 1.8) return false;
    }
    return true;
  }

  pontoDePasse(j, r) {
    const d = dist2(j.pos, r.pos);
    const t = d / 16;
    return v2(
      limitar(r.pos.x + r.vel.x * t * 0.7, -MEIO_X + 1, MEIO_X - 1),
      limitar(r.pos.z + r.vel.z * t * 0.7, -MEIO_Z + 1, MEIO_Z - 1)
    );
  }

  tocarPara(j, r, longo) {
    const alvo = this.pontoDePasse(j, r);
    if (longo || dist2(j.pos, alvo) > 30 || !this.linhaLivre(j, r)) this.passeAlto(j, alvo, r);
    else this.passeRasteiro(j, alvo, r);
    if (j.time === 0) this.trocarControle(r);
  }

  tentarRoubar(ladrao, chance) {
    const b = this.bola;
    const dono = b.dono;
    if (!dono || dono.travado || dono.time === ladrao.time || ladrao.recargaRoubo > 0 || ladrao.atordoado > 0) return false;
    if (dono.idx === 0 && Math.abs(dono.pos.x) > MEIO_X - 16.5) return false; // ninguém rouba do goleiro na área
    ladrao.recargaRoubo = 0.7;
    const protecao = 1 - (dono.dados.dri / 99) * 0.45;
    if (Math.random() < chance * (ladrao.dados.def / 85) * protecao) {
      b.dono = ladrao;
      b.ultimoToque = ladrao;
      b.alvoPasse = null;
      dono.atordoado = 0.6;
      dono.tempoComBola = 0;
      ladrao.tempoComBola = 0;
      if (ladrao.time === 0) this.trocarControle(ladrao);
      else this.trocarControle(this.maisPerto(0, b.pos, true));
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------- loop
  atualizar(dt) {
    if (this.pausado) return;
    dt = Math.min(dt, 1 / 30);
    if (this.replay) { this.tocarReplay(dt); return; }
    if (this.terminou) return;
    this.tempoTotal += dt;

    if (this.estado === 'jogando' && !this.treino) {
      this.relogio += dt;
      const dur = this.periodo <= 2 ? this.duracao : this.duracao / 3;
      if (this.relogio >= dur && !this.bola.chuteDe) this.fimDoPeriodo();
    }
    this.atualizarRelogioHud();

    if (this.estado === 'parada') {
      this.timerEstado -= dt;
      const r = this.reinicio;
      const b = this.bola;
      if (this.timerEstado <= 0 && !b.dono) {
        b.dono = r.batedor;
        r.batedor.travado = true;
        r.batedor.tempoComBola = 0;
        b.ultimoToque = r.batedor;
        som.apito();
      }
    } else if (this.estado === 'gol' || this.estado === 'intervalo') {
      this.timerEstado -= dt;
      if (this.timerEstado <= 0) {
        if (this.estado === 'gol') this.iniciarSaida(this.timeQueSofreu);
        else {
          this.periodo++; this.relogio = 0;
          for (const j of this.jogadores) j.energia = Math.min(1, (j.energia ?? 1) + 0.5);
          this.iniciarSaida(this.periodo % 2 === 0 ? 1 : 0);
        }
      }
    }

    this.atualizarTroca(dt);
    for (const j of this.jogadores) this.pensar(j, dt);
    this.mover(dt);
    this.atualizarBola(dt);
    this.atualizarVisual(dt);
    this.atualizarJuiz(dt);
    this.atualizarCamera(dt);
    this.atualizarNome();
    this.desenharRadar();
    this.gravar(dt);
    if (this.torcida && this.fracaoBR >= 0.5 && this.gols[0] > this.gols[1]) {
      this.timerOla -= dt;
      if (this.timerOla <= 0) { this.torcida.ola(); this.timerOla = sorte(25, 40); }
    }
  }

  // ---------------------------------------------------------- nome de quem está com a bola
  atualizarNome() {
    if (this.hud.energia) {
      const c = this.controlado;
      if (!c || this.estado === 'gol' || this.replay || this.treino) this.hud.energia(null);
      else {
        this.camera.updateMatrixWorld();
        const v = new THREE.Vector3(c.pos.x, 0, c.pos.z).project(this.camera);
        this.hud.energia(c.energia ?? 1, (v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, c.dados.nome);
      }
    }
    if (!this.hud.nomeDono) return;
    const d = this.bola.dono;
    if (!d || this.estado === 'gol' || this.replay) { this.hud.nomeDono(null); return; }
    this.camera.updateMatrixWorld();
    const v = new THREE.Vector3(d.pos.x, 4.1, d.pos.z).project(this.camera);
    this.hud.nomeDono(`${d.dados.num} · ${d.dados.nome}`, (v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, d.time);
  }

  // ---------------------------------------------------------- replay do gol
  gravar(dt) {
    const b = this.bola;
    this.gravacao.push({
      dt,
      b: [b.pos.x, b.pos.y, b.pos.z],
      js: [...this.jogadores, this.juiz].map(j => [j, j.pos.x, j.pos.z, j.ang, j.vel.x, j.vel.z, j.mergulho, j.ladoMergulho, j.comemorando, j.animChute, j.carrinho]),
    });
    if (this.gravacao.length > 60 * 9) this.gravacao.shift();
    if (this.capturarReplayEm !== null && this.tempoTotal >= this.capturarReplayEm) {
      // guarda os últimos 6,5 segundos (até um pouco depois do gol)
      let soma = 0, ini = this.gravacao.length;
      while (ini > 0 && soma < 6.5) { ini--; soma += this.gravacao[ini].dt; }
      this.ultimoReplay = { quadros: this.gravacao.slice(ini), lado: this.ladoReplay, autor: this.autorReplay };
      this.capturarReplayEm = null;
      if (this.hud.replayDisponivel) this.hud.replayDisponivel(true);
    }
  }

  iniciarReplay() {
    if (!this.ultimoReplay || this.replay) return false;
    this.replay = { i: 0, acc: 0, fantasmas: new Map(), tempo: 0 };
    const q0 = this.ultimoReplay.quadros[0];
    this.camReplay = new THREE.Vector3(q0.b[0] - this.ultimoReplay.lado * 10, 5, q0.b[2] + 10);
    if (this.hud.modoReplay) this.hud.modoReplay(true, this.ultimoReplay.autor);
    this.hud.nomeDono && this.hud.nomeDono(null);
    return true;
  }

  pararReplay() {
    this.replay = null;
    if (this.hud.modoReplay) this.hud.modoReplay(false);
  }

  tocarReplay(dt) {
    const r = this.replay;
    const quadros = this.ultimoReplay.quadros;
    if (entrada.passeApertou || entrada.chuteApertou) { this.pararReplay(); return; }
    const lento = 0.5; // câmera lenta
    r.acc += dt * lento;
    r.tempo += dt * lento;
    while (r.i < quadros.length - 1 && r.acc >= quadros[r.i].dt) { r.acc -= quadros[r.i].dt; r.i++; }
    if (r.i >= quadros.length - 1) { this.pararReplay(); return; }
    const q = quadros[r.i];
    for (const [j, x, z, ang, vx, vz, merg, lado, com, anim, carr] of q.js) {
      if (!j.modelo.raiz.parent) continue;
      let f = r.fantasmas.get(j);
      if (!f) { f = { modelo: j.modelo, vel: v2(), fase: j.fase }; r.fantasmas.set(j, f); }
      f.vel.x = vx; f.vel.z = vz; f.mergulho = merg; f.ladoMergulho = lado; f.comemorando = com; f.animChute = anim; f.carrinho = carr;
      j.modelo.raiz.position.set(x, 0, z);
      j.modelo.raiz.rotation.y = ang;
      animarJogador(f, dt * lento, r.tempo);
    }
    const b = this.bola;
    b.malha.position.set(q.b[0], q.b[1], q.b[2]);
    b.sombra.position.set(q.b[0], 0.03, q.b[2]);
    this.marcador.visible = false;
    // câmera de TV baixinha, do lado do gol
    const alvo = new THREE.Vector3(q.b[0], 1, q.b[2]);
    const pos = new THREE.Vector3(q.b[0] - this.ultimoReplay.lado * 11, 7.5, q.b[2] + 13);
    this.camReplay.lerp(pos, Math.min(1, dt * 2.5));
    this.camera.position.copy(this.camReplay);
    this.camera.lookAt(alvo);
  }

  minutoAtual() {
    if (this.periodo <= 2) return Math.min((this.periodo - 1) * 45 + Math.floor((this.relogio / this.duracao) * 45) + 1, this.periodo * 45);
    return Math.min(90 + (this.periodo - 3) * 15 + Math.floor((this.relogio / (this.duracao / 3)) * 15) + 1, 120);
  }

  atualizarRelogioHud() {
    if (this.treino) { this.hud.relogio('TREINO'); return; }
    let min;
    if (this.periodo <= 2) min = (this.periodo - 1) * 45 + Math.floor((this.relogio / this.duracao) * 45);
    else min = 90 + (this.periodo - 3) * 15 + Math.floor((this.relogio / (this.duracao / 3)) * 15);
    const limite = this.periodo <= 2 ? this.periodo * 45 : 90 + (this.periodo - 2) * 15;
    this.hud.relogio(`${Math.min(min, limite)}'`);
  }

  fimDoPeriodo() {
    som.apito(true);
    const b = this.bola;
    b.dono = null;
    b.vel.set(0, 0, 0);
    if (this.periodo === 1 || this.periodo === 3) {
      this.estado = 'intervalo';
      this.timerEstado = 3;
      this.hud.msg(this.periodo === 1 ? 'Intervalo' : 'Fim do 1º tempo da prorrogação', 2.6, true);
      return;
    }
    const empate = this.gols[0] === this.gols[1];
    if (this.periodo === 2 && empate && this.op.mataMata && this.regrasCompletas) {
      this.estado = 'intervalo';
      this.timerEstado = 3;
      this.hud.msg('Prorrogação!', 2.6, true);
      return;
    }
    this.terminou = true;
    this.estado = 'fim';
    this.hud.msg('Fim de jogo!', 2.5, true);
    som.vibrarTorcida(0.8, 3);
    const precisaPenaltis = empate && this.op.mataMata;
    setTimeout(() => this.op.aoTerminar({ gols: [...this.gols], precisaPenaltis, chutes: this.estatisticas.chutes, marcadores: this.marcadores }), 2600);
  }

  marcarGol(time) {
    this.gols[time]++;
    this.hud.placar(this.gols[0], this.gols[1]);
    this.estado = 'gol';
    this.timerEstado = 3.6;
    this.timeQueSofreu = 1 - time;
    const autor = this.bola.ultimoToque;
    const b = this.bola;
    b.dono = null;
    b.chuteDe = null;
    som.rede();
    som.golTorcida(time === 0 ? this.fracaoBR : 1 - this.fracaoBR);
    if (time === 0) som.animarBatucada();
    if (this.torcida) this.torcida.gol(time);
    this.capturarReplayEm = this.tempoTotal + 1.6;
    this.juizApita();
    this.ladoReplay = time === 0 ? 1 : -1;
    this.autorReplay = autor ? autor.dados.nome : '';
    const contra = autor && autor.time !== time;
    if (!this.treino) {
      this.marcadores.push({
        nome: autor ? autor.dados.nome : '?',
        time,
        contra: !!contra,
        minuto: this.hud && this.minutoAtual ? this.minutoAtual() : 0,
      });
    }
    if (contra) {
      this.hud.msg('GOL CONTRA!', 3, true, `${autor.dados.nome} marcou contra`);
      som.narrar(time === 0 ? `Gol contra! ${autor.dados.nome} marca contra o próprio gol! Gol do Brasil!` : `Ih, gol contra de ${autor.dados.nome}!`);
      this.autorReplay = autor.dados.nome + ' (contra)';
    } else if (time === 0) {
      const nome = autor && autor.time === 0 ? autor.dados.nome : 'Brasil';
      this.hud.msg('GOOOOL!', 3, true, nome);
      som.narrar(`Goooool do Brasil! ${autor && autor.time === 0 ? autor.dados.nome : ''}!`);
    } else {
      this.hud.msg(`Gol ${this.op.adversario ? 'da seleção ' + this.op.adversario.nome : ''}`, 3, true);
      som.narrar(`Gol ${this.op.adversario ? 'de ' + this.op.adversario.nome : ''}.`);
    }
    for (const j of this.times[time]) if (autor && j.idx !== 0 && dist2(j.pos, b.pos) < 30) j.comemorando = 3.2;
    if (this.treino) { this.timeQueSofreu = 0; }
  }

  // ---------------------------------------------------------- controle automático do jogador
  atualizarTroca(dt) {
    const b = this.bola;
    this.timerTroca -= dt;
    if (this.timerTroca > 0) return;
    this.timerTroca = 0.35;
    const c = this.controlado;
    if (b.dono && b.dono.time === 0) return;
    if (b.alvoPasse && b.alvoPasse.time === 0) return;
    const perto = this.maisPerto(0, this.previsaoBola(0.4), true);
    if (!c) { this.trocarControle(perto); return; }
    const semComando = Math.hypot(entrada.x, entrada.y) < 0.2;
    const folga = semComando ? 2 : 7;
    if (perto !== c && dist2(perto.pos, b.pos) + folga < dist2(c.pos, b.pos)) this.trocarControle(perto);
  }

  previsaoBola(t) {
    const b = this.bola;
    if (b.dono) return v2(b.pos.x, b.pos.z);
    const s = Math.hypot(b.vel.x, b.vel.z);
    if (s < 0.1) return v2(b.pos.x, b.pos.z);
    const dist = Math.min(s * t - 0.5 * ATRITO * t * t, (s * s) / (2 * ATRITO));
    return v2(b.pos.x + (b.vel.x / s) * dist, b.pos.z + (b.vel.z / s) * dist);
  }

  // ---------------------------------------------------------- cérebro de cada jogador
  pensar(j, dt) {
    j.recargaRoubo = Math.max(0, j.recargaRoubo - dt);
    j.atordoado = Math.max(0, j.atordoado - dt);
    j.animChute = Math.max(0, j.animChute - dt);
    j.comemorando = Math.max(0, j.comemorando - dt);
    if (j.mergulho > 0) {
      j.mergulho -= dt;
      j.desejo = v2(j.vel.x * 0.9, j.vel.z * 0.9);
      return;
    }
    if (j.carrinho > 0) { this.atualizarCarrinho(j, dt); return; }
    if (this.estado === 'parada' && this.reinicio && this.reinicio.tipo === 'penalti' && !j.travado) { j.desejo = v2(); return; }
    if (this.estado === 'gol' || this.estado === 'intervalo' || this.estado === 'fim') {
      const base = this.posicaoBase(j);
      if (j.comemorando > 0) { j.desejo = v2(); return; }
      this.irPara(j, v2(base.x * 0.7, base.z * 0.8), 0.6);
      return;
    }
    if (j.travado) {
      j.desejo = v2();
      if (this.bola.dono === j) this.cobrarReinicio(j, dt);
      return;
    }
    if (j.controlado) { this.pensarHumano(j, dt); return; }
    if (j.idx === 0) { this.pensarGoleiro(j, dt); return; }
    this.pensarIA(j, dt);
  }

  irPara(j, alvo, ritmo = 1) {
    const dx = alvo.x - j.pos.x, dz = alvo.z - j.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) { j.desejo = v2(); return; }
    let v = j.velMax * ritmo;
    if (d < 4) v *= d / 4;
    j.desejo = v2((dx / d) * v, (dz / d) * v);
  }

  pensarHumano(j, dt) {
    const b = this.bola;
    const temBola = b.dono === j;
    const mx = entrada.x, mz = -entrada.y; // para cima na tela = -z no campo
    const forcaMov = Math.hypot(mx, mz);
    const corrida = entrada.corrida && j.energia > 0.08 ? (temBolaAgora(this, j) ? 1.12 : 1.25) : 1;
    const lento = j.atordoado > 0 ? 0.5 : 1;

    if (temBola) {
      j.tempoComBola += dt;
      j.desejo = v2(mx * j.velMax * 0.92 * corrida * lento, mz * j.velMax * 0.92 * corrida * lento);
      // força do chute
      if (entrada.chute) this.hud.forca(Math.min(entrada.tempoChute / 0.9, 1));
      if (entrada.chuteSoltou) {
        this.hud.forca(null);
        const forca = Math.min(entrada.tempoChute / 0.9, 1);
        const atacando = j.pos.x * j.dir > 10;
        const praTras = forcaMov > 0.2 && mx * j.dir < -0.5;
        if (praTras) {
          // chute forte para onde o joystick aponta, mesmo que seja para o próprio gol
          const d = 30;
          this.chutarPara(j, { x: j.pos.x + (mx / forcaMov) * d, y: 0.4 + forca * 1.2, z: j.pos.z + (mz / forcaMov) * d }, 16 + forca * 14);
          this.bola.chuteDe = j;
          som.chute(forca);
        } else if (atacando) {
          const mira = this.dif.miraAuto && Math.abs(entrada.y) < 0.3 ? null : -entrada.y;
          this.chutarAoGol(j, Math.max(forca, 0.25), mira);
        } else {
          // longe do gol: chutão para frente
          const dir = forcaMov > 0.2 ? v2(mx / forcaMov, mz / forcaMov) : v2(j.dir, 0);
          const d = 20 + forca * 25;
          this.passeAlto(j, v2(j.pos.x + dir.x * d, j.pos.z + dir.z * d), null);
        }
        return;
      }
      if (entrada.passeSoltou) {
        const longo = entrada.tempoPasse > 0.35;
        const dir = forcaMov > 0.2 ? v2(mx / forcaMov, mz / forcaMov) : v2(Math.sin(j.ang), Math.cos(j.ang));
        const r = this.escolherReceptor(j, dir, longo);
        if (r) this.tocarPara(j, r, longo);
        else {
          const d = longo ? 30 : 14;
          const alvo = v2(limitar(j.pos.x + dir.x * d, -MEIO_X, MEIO_X), limitar(j.pos.z + dir.z * d, -MEIO_Z, MEIO_Z));
          if (longo) this.passeAlto(j, alvo, null); else this.passeRasteiro(j, alvo, null);
        }
      }
      return;
    }

    this.hud.forca(null);
    // sem a bola
    if (entrada.carrinhoApertou) { this.iniciarCarrinho(j, mx, mz, forcaMov); return; }
    if (entrada.passeApertou || entrada.trocaApertou) {
      const outro = this.maisPerto(0, this.previsaoBola(0.3), true, j);
      this.trocarControle(outro);
      this.timerTroca = 0.8;
      return;
    }
    if (entrada.chuteApertou && b.dono && b.dono.time === 1 && dist2(j.pos, b.dono.pos) < 2.4) {
      // dar o bote
      const chance = this.dif.miraAuto ? 0.85 : 0.6;
      const dx = b.dono.pos.x - j.pos.x, dz = b.dono.pos.z - j.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      j.vel = v2((dx / d) * 9, (dz / d) * 9);
      j.recargaRoubo = 0;
      if (!this.tentarRoubar(j, chance)) j.atordoado = 0.35;
      return;
    }
    if (forcaMov < 0.15) {
      // sem comando: o jogador se ajuda sozinho
      if (b.alvoPasse === j) { this.irPara(j, this.previsaoBola(0.5)); return; }
      this.pensarIA(j, dt, true);
      return;
    }
    j.desejo = v2(mx * j.velMax * corrida * lento, mz * j.velMax * corrida * lento);
    if (b.dono && b.dono.time === 1 && dist2(j.pos, b.dono.pos) < 1.3) this.tentarRoubar(j, 0.25 * (this.dif.miraAuto ? 1.6 : 1));
  }

  cobrarReinicio(j, dt) {
    const r = this.reinicio;
    j.tempoComBola += dt;
    if (j.time === 0 && j.controlado && j.tempoComBola < 6) {
      // o jogador escolhe a direção com o joystick e aperta PASSE ou CHUTE
      const mx = entrada.x, mz = -entrada.y;
      const f = Math.hypot(mx, mz);
      if (f > 0.2) j.ang = Math.atan2(mx, mz);
      if (entrada.chute) this.hud.forca(Math.min(entrada.tempoChute / 0.9, 1));
      const distGol = Math.hypot(j.dir * MEIO_X - j.pos.x, j.pos.z);
      if (entrada.chuteSoltou && (r.tipo === 'penalti' || (r.tipo === 'tiroLivre' && distGol < 35))) {
        this.hud.forca(null);
        const forca = Math.min(entrada.tempoChute / 0.9, 1);
        this.chutarAoGol(j, Math.max(forca, 0.3), Math.abs(entrada.y) < 0.3 && this.dif.miraAuto ? null : -entrada.y);
        return;
      }
      if (entrada.passeSoltou || entrada.chuteSoltou) {
        this.hud.forca(null);
        const longo = entrada.chuteSoltou || entrada.tempoPasse > 0.35 || r.tipo === 'escanteio';
        const dir = f > 0.2 ? v2(mx / f, mz / f) : null;
        let rec = this.escolherReceptor(j, dir, longo) || this.escolherReceptor(j, null, longo);
        if (r.tipo === 'escanteio' && !dir) rec = this.melhorNaArea(j) || rec;
        if (rec) this.tocarPara(j, rec, longo && r.tipo !== 'lateral');
        else this.passeRasteiro(j, v2(j.pos.x + j.dir * 10, j.pos.z * 0.6), null);
      }
      return;
    }
    if (j.tempoComBola < (r.tipo === 'saida' ? 0.5 : r.tipo === 'penalti' ? 1.4 : 0.9)) return;
    let rec;
    if (r.tipo === 'penalti') { this.chutarAoGol(j, sorte(0.55, 0.85), sorte(-1, 1)); return; }
    if (r.tipo === 'tiroLivre' && Math.hypot(j.dir * MEIO_X - j.pos.x, j.pos.z) < 30) { this.chutarAoGol(j, sorte(0.6, 0.85), sorte(-1, 1)); return; }
    if (r.tipo === 'escanteio') {
      rec = this.melhorNaArea(j);
      if (rec) { this.passeAlto(j, v2(j.dir * (MEIO_X - sorte(6, 11)), sorte(-6, 6)), rec); return; }
    }
    if (r.tipo === 'tiroDeMeta') {
      rec = this.escolherReceptor(j, null, Math.random() < 0.5);
    } else if (r.tipo === 'saida') {
      rec = this.times[j.time][7] || this.escolherReceptor(j, null);
    } else {
      rec = this.escolherReceptor(j, null) || this.maisPerto(j.time, j.pos, true, j);
    }
    if (rec) this.tocarPara(j, rec, r.tipo === 'tiroDeMeta' && dist2(j.pos, rec.pos) > 25);
    else this.passeAlto(j, v2(0, 0), null);
  }

  melhorNaArea(j) {
    let melhor = null, md = Infinity;
    for (const c of this.times[j.time]) {
      if (c === j || c.idx === 0) continue;
      const d = Math.abs(c.pos.x - j.dir * (MEIO_X - 9)) + Math.abs(c.pos.z) * 0.5;
      if (d < md) { md = d; melhor = c; }
    }
    return melhor;
  }

  pensarGoleiro(j, dt) {
    const b = this.bola;
    const golX = -j.dir * MEIO_X;
    if (b.dono === j) {
      j.tempoComBola += dt;
      this.irPara(j, v2(golX + j.dir * 6, 0), 0.3);
      if (j.tempoComBola > 1.2) {
        const r = this.escolherReceptor(j, null, Math.random() < 0.4);
        if (r) this.tocarPara(j, r, dist2(j.pos, r.pos) > 25);
        else this.passeAlto(j, v2(0, sorte(-15, 15)), null);
      }
      return;
    }
    // chute vindo em direção ao gol?
    const indoProGol = !b.dono && Math.sign(b.vel.x) === Math.sign(golX) && Math.abs(b.vel.x) > 8;
    if (indoProGol) {
      const t = (golX - b.pos.x) / b.vel.x;
      if (t > 0 && t < 1.4) {
        const zPrev = b.pos.z + b.vel.z * t;
        if (Math.abs(zPrev) < MEIA_TRAVE + 1.2) {
          j.reacao += dt;
          const tempoReacao = j.time === 1 ? 0.35 - this.dif.reacaoGoleiroAdv * 0.25 : 0.15;
          const alvoZ = limitar(zPrev, -MEIA_TRAVE, MEIA_TRAVE);
          if (j.reacao > tempoReacao) {
            const dz = alvoZ - j.pos.z;
            if (Math.abs(dz) > 1.1 && t < 0.6) {
              const s = Math.sign(dz);
              j.mergulho = 0.75;
              j.vel = v2(0, s * 7.5);
              j.ladoMergulho = -s * Math.sin(j.ang);
              return;
            }
            this.irPara(j, v2(golX + j.dir * 0.8, alvoZ), 1.2);
            return;
          }
        }
      }
    } else j.reacao = 0;

    // bola solta perto: sai para pegar
    const naArea = Math.abs(b.pos.x - golX) < 16 && Math.abs(b.pos.z) < 20;
    if (!b.dono && naArea && Math.hypot(b.vel.x, b.vel.z) < 10) {
      const meu = this.maisPerto(j.time, b.pos, false);
      if (meu === j || dist2(j.pos, b.pos) < 7) { this.irPara(j, this.previsaoBola(0.3), 1.1); return; }
    }
    // posição: entre a bola e o centro do gol
    const dx = b.pos.x - golX;
    const dBola = Math.hypot(dx, b.pos.z);
    const sair = limitar(dBola * 0.09, 0.6, 5);
    const k = sair / Math.max(dBola, 1);
    const alvo = v2(golX + dx * k, limitar(b.pos.z * k + b.pos.z * 0.04, -MEIA_TRAVE + 0.4, MEIA_TRAVE - 0.4));
    this.irPara(j, alvo, 0.9);
  }

  pensarIA(j, dt, ajudaHumano = false) {
    const b = this.bola;
    const meuTime = j.time;
    const dono = b.dono;
    const comBola = dono === j;
    if (comBola) { this.conduzirIA(j, dt); return; }

    if (this.estado === 'parada') { this.posicionar(j); return; }
    const nossaPosse = dono ? dono.time === meuTime : (b.ultimoToque && b.ultimoToque.time === meuTime && b.alvoPasse);
    // quem vai na bola?
    if (b.alvoPasse === j) { this.irPara(j, this.previsaoBola(0.5)); return; }
    const alvoBola = this.previsaoBola(0.35);
    const perseguidor = this.perseguidorDoTime(meuTime);
    if (!nossaPosse && (perseguidor === j || ajudaHumano && dist2(j.pos, alvoBola) < 10)) {
      this.irPara(j, alvoBola, 1.0);
      if (dono && dono.time !== meuTime && dist2(j.pos, dono.pos) < 1.5) {
        this.tentarRoubar(j, 0.32 * (meuTime === 1 ? this.dif.roubada : 1));
      }
      return;
    }
    if (dono && dono.time !== meuTime) {
      const dDono = dist2(j.pos, dono.pos);
      // quem encosta no adversário tenta desarmar
      if (dDono < 1.5) this.tentarRoubar(j, 0.25 * (meuTime === 1 ? this.dif.roubada : 1));
      // zagueiros e volante fecham o caminho para o gol
      if ((j.papel === 'ZAG' || j.papel === 'VOL') && dDono < 13 && !ajudaHumano) {
        const golX = -j.dir * MEIO_X;
        const gx = golX - dono.pos.x, gz = -dono.pos.z;
        const gd = Math.hypot(gx, gz) || 1;
        const fecha = Math.min(2.6, gd - 1);
        this.irPara(j, v2(dono.pos.x + (gx / gd) * fecha, dono.pos.z + (gz / gd) * fecha), 1.0);
        return;
      }
    }
    // segundo homem pressiona quando o adversário está com a bola perto
    if (dono && dono.time !== meuTime && j.idx >= 5) {
      const seg = this.segundoPerseguidor(meuTime);
      if (seg === j && dist2(j.pos, dono.pos) < 14) {
        this.irPara(j, v2(dono.pos.x - dono.dir * 3, dono.pos.z), 0.75);
        return;
      }
    }
    this.posicionar(j);
  }

  posicionar(j) {
    const b = this.bola;
    const dono = b.dono;
    const meuTime = j.time;
    // posicionamento tático
    const base = this.posicaoBase(j);
    let ataque = 0;
    if (dono) ataque = dono.time === meuTime ? 1 : -1;
    const bx = b.pos.x, bz = b.pos.z;
    let tx = base.x * 0.55 + bx * 0.45 + j.dir * ataque * (j.idx >= 8 ? 10 : 6);
    let tz = base.z * 0.85 + bz * 0.3;
    if (j.papel === 'ZAG' || j.papel === 'LAT') {
      // defensores não passam muito da bola
      const linha = bx - j.dir * 4;
      if (ataque <= 0) tx = j.dir > 0 ? Math.min(tx, linha) : Math.max(tx, linha);
    }
    if (ataque > 0 && (j.idx >= 8)) tz += Math.sin(this.tempoTotal * 0.7 + j.idx) * 4; // movimentação dos atacantes
    tx = limitar(tx, -MEIO_X + 3, MEIO_X - 3);
    tz = limitar(tz, -MEIO_Z + 2, MEIO_Z - 2);
    // na cobrança de falta e escanteio, quem defende fica a 9,15 m da bola
    const r = this.reinicio;
    if (this.estado === 'parada' && r && (r.tipo === 'tiroLivre' || r.tipo === 'escanteio') && j.time !== r.batedor.time) {
      const dx = tx - bx, dz = tz - bz;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 9.5) { tx = bx + (dx / d) * 9.5; tz = bz + (dz / d) * 9.5; }
    }
    this.irPara(j, v2(tx, tz), dist2(j.pos, v2(tx, tz)) > 10 ? 0.95 : 0.7);
  }

  perseguidorDoTime(t) {
    const cache = this._cachePerseguidor || (this._cachePerseguidor = {});
    if (cache.tempo === this.tempoTotal && cache[t]) return cache[t];
    if (cache.tempo !== this.tempoTotal) { cache.tempo = this.tempoTotal; cache[0] = cache[1] = cache.s0 = cache.s1 = null; }
    const alvo = this.previsaoBola(0.35);
    let melhor = null, seg = null, md = Infinity, md2 = Infinity;
    for (const j of this.times[t]) {
      if (j.idx === 0) continue;
      if (t === 0 && j.controlado && Math.hypot(entrada.x, entrada.y) > 0.15) continue;
      const d = dist2(j.pos, alvo);
      if (d < md) { md2 = md; seg = melhor; md = d; melhor = j; }
      else if (d < md2) { md2 = d; seg = j; }
    }
    // o time do Brasil não manda outro jogador se o controlado já está perto
    if (t === 0 && this.controlado && Math.hypot(entrada.x, entrada.y) > 0.15 && dist2(this.controlado.pos, alvo) < 9) melhor = null;
    cache[t] = melhor;
    cache['s' + t] = seg;
    return melhor;
  }

  segundoPerseguidor(t) {
    this.perseguidorDoTime(t);
    return this._cachePerseguidor['s' + t];
  }

  conduzirIA(j, dt) {
    j.tempoComBola += dt;
    j.decisao -= dt;
    const golX = j.dir * MEIO_X;
    const distGol = Math.hypot(golX - j.pos.x, j.pos.z);
    // adversário mais perto
    let perigo = null, dp = Infinity;
    for (const o of this.times[1 - j.time]) {
      const d = dist2(o.pos, j.pos);
      if (d < dp) { dp = d; perigo = o; }
    }
    if (j.decisao <= 0) {
      j.decisao = sorte(0.25, 0.5);
      const angBom = Math.abs(j.pos.z) < 18;
      if (distGol < 28 && angBom && Math.random() < (distGol < 17 ? 0.85 : 0.3 + this.dif.velAdv * 0.15)) {
        this.chutarAoGol(j, sorte(0.45, 0.85), sorte(-1, 1));
        return;
      }
      const pressionado = dp < 4.5 && (perigo.pos.x - j.pos.x) * j.dir > -1;
      if (pressionado || j.tempoComBola > sorte(2.5, 5)) {
        const r = this.escolherReceptor(j, null, Math.random() < 0.2);
        if (r && (pressionado || (r.pos.x - j.pos.x) * j.dir > -5)) { this.tocarPara(j, r, false); return; }
      }
    }
    // driblar em direção ao gol, desviando de quem marca
    let dx = golX - j.pos.x, dz = (0 - j.pos.z) * 0.5;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    if (perigo && dp < 6) {
      const ox = j.pos.x - perigo.pos.x, oz = j.pos.z - perigo.pos.z;
      const od = Math.hypot(ox, oz) || 1;
      const peso = (6 - dp) / 6 * 1.2;
      dx += (ox / od) * peso * 0.4;
      dz += (oz / od) * peso;
    }
    const n = Math.hypot(dx, dz) || 1;
    const v = j.velMax * 0.88 * (j.atordoado > 0 ? 0.5 : 1);
    j.desejo = v2((dx / n) * v, (dz / n) * v);
  }

  // ---------------------------------------------------------- física
  // Cansaço: correr gasta energia, andar e ficar parado recupera.
  // Com pouca energia o jogador fica mais lento e não consegue dar arrancada.
  atualizarEnergia(j, dt) {
    if (j.velMaxBase === undefined) { j.velMaxBase = j.velMax; j.energia = 1; }
    const s = Math.hypot(j.vel.x, j.vel.z);
    const fator = ({ mirim: 0.5, titular: 1, penta: 1.15 })[this.op.dificuldade] || 1;
    const resistencia = 1.3 - (j.dados.fis / 99) * 0.6;
    if (j.idx === 0) j.energia = Math.min(1, j.energia + dt * 0.02);
    else if (s > j.velMaxBase * 1.03) j.energia -= dt * 0.035 * fator * resistencia;
    else if (s > 3.5) j.energia -= dt * 0.004 * fator * resistencia;
    else j.energia += dt * 0.035;
    j.energia = limitar(j.energia, 0, 1);
    const pena = j.energia > 0.6 ? 1 : 0.72 + 0.28 * (j.energia / 0.6);
    j.velMax = j.velMaxBase * pena;
  }

  mover(dt) {
    const b = this.bola;
    for (const j of this.jogadores) {
      this.atualizarEnergia(j, dt);
      if (j.mergulho > 0) {
        j.pos.x += j.vel.x * dt;
        j.pos.z += j.vel.z * dt;
        j.vel.z *= 0.96;
        continue;
      }
      if (j.carrinho > 0) {
        j.pos.x += j.vel.x * dt;
        j.pos.z += j.vel.z * dt;
        const fr = Math.max(0, 1 - dt * 2.2);
        j.vel.x *= fr; j.vel.z *= fr;
        continue;
      }
      const k = Math.min(1, dt * (j.atordoado > 0 ? 2.5 : 7));
      j.vel.x += (j.desejo.x - j.vel.x) * k;
      j.vel.z += (j.desejo.z - j.vel.z) * k;
      j.pos.x += j.vel.x * dt;
      j.pos.z += j.vel.z * dt;
      const m = b.dono === j ? -0.6 : 3;
      j.pos.x = limitar(j.pos.x, -MEIO_X - m, MEIO_X + m);
      j.pos.z = limitar(j.pos.z, -MEIO_Z - m, MEIO_Z + m);
      const s = Math.hypot(j.vel.x, j.vel.z);
      let alvoAng = j.ang;
      if (s > 0.6) alvoAng = Math.atan2(j.vel.x, j.vel.z);
      else if (b.dono !== j && !j.travado) alvoAng = Math.atan2(b.pos.x - j.pos.x, b.pos.z - j.pos.z);
      let da = alvoAng - j.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      j.ang += da * Math.min(1, dt * 10);
    }
    // jogadores não ficam um dentro do outro
    const js = this.jogadores;
    for (let i = 0; i < js.length; i++) {
      for (let k = i + 1; k < js.length; k++) {
        const a = js[i], c = js[k];
        const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0 && d < 0.95) {
          const emp = (0.95 - d) / 2;
          a.pos.x -= (dx / d) * emp; a.pos.z -= (dz / d) * emp;
          c.pos.x += (dx / d) * emp; c.pos.z += (dz / d) * emp;
        }
      }
    }
  }

  atualizarBola(dt) {
    const b = this.bola;
    if (b.dono) {
      const j = b.dono;
      const fx = Math.sin(j.ang), fz = Math.cos(j.ang);
      const s = Math.hypot(j.vel.x, j.vel.z);
      const frente = 0.75 + Math.min(s, 8) * 0.04 + Math.sin(j.fase * 0.5) * 0.08 * Math.min(s / 6, 1);
      b.pos.set(j.pos.x + fx * frente, RAIO_BOLA, j.pos.z + fz * frente);
      b.vel.set(j.vel.x, 0, j.vel.z);
      return;
    }
    if (this.estado === 'gol' || this.estado === 'parada' || this.estado === 'intervalo' || this.estado === 'fim') {
      // a bola só desliza até parar
      b.vel.multiplyScalar(Math.max(0, 1 - dt * 2));
      b.vel.y = Math.min(b.vel.y, 0);
      b.pos.addScaledVector(b.vel, dt);
      b.pos.y = Math.max(RAIO_BOLA, b.pos.y);
      if (this.estado === 'gol') {
        // segura a bola dentro da rede
        const lado = Math.sign(b.pos.x);
        if (Math.abs(b.pos.x) > MEIO_X + 2) { b.pos.x = lado * (MEIO_X + 2); b.vel.x = 0; }
      }
      return;
    }

    const antesX = b.pos.x;
    b.vel.y -= G * dt;
    b.pos.addScaledVector(b.vel, dt);
    if (b.pos.y <= RAIO_BOLA) {
      b.pos.y = RAIO_BOLA;
      if (b.vel.y < -1.5) { b.vel.y = -b.vel.y * 0.5; b.vel.x *= 0.88; b.vel.z *= 0.88; }
      else b.vel.y = 0;
    }
    if (b.pos.y <= RAIO_BOLA + 0.01 && b.vel.y === 0) {
      const s = Math.hypot(b.vel.x, b.vel.z);
      if (s > 0) {
        const ns = Math.max(0, s - ATRITO * dt);
        b.vel.x *= ns / s; b.vel.z *= ns / s;
      }
    }

    // traves e travessão
    for (const lado of [-1, 1]) {
      const linha = lado * MEIO_X;
      const cruzou = (antesX - linha) * (b.pos.x - linha) <= 0 && antesX !== b.pos.x;
      if (!cruzou) continue;
      const az = Math.abs(b.pos.z);
      if (Math.abs(az - MEIA_TRAVE) < 0.22 && b.pos.y < CAMPO.golAlt + 0.1) {
        b.pos.x = linha - lado * 0.25;
        b.vel.x *= -0.55; b.vel.z += (Math.random() - 0.5) * 4;
        som.chute(0.8);
        this.hud.msg('Na trave!', 1.2);
        som.uhhTorcida(); if (this.torcida) this.torcida.uhh();
        b.goleiroTestado = [true, true];
        return;
      }
      if (az < MEIA_TRAVE && Math.abs(b.pos.y - CAMPO.golAlt) < 0.22) {
        b.pos.x = linha - lado * 0.25;
        b.vel.x *= -0.5; b.vel.y = -Math.abs(b.vel.y) * 0.5;
        som.chute(0.8);
        this.hud.msg('No travessão!', 1.2);
        som.uhhTorcida(); if (this.torcida) this.torcida.uhh();
        b.goleiroTestado = [true, true];
        return;
      }
    }

    // gol?
    if (Math.abs(b.pos.x) > MEIO_X + RAIO_BOLA) {
      if (Math.abs(b.pos.z) < MEIA_TRAVE && b.pos.y < CAMPO.golAlt) {
        this.marcarGol(b.pos.x > 0 ? 0 : 1);
        b.vel.multiplyScalar(0.35);
        return;
      }
      if (this.treino) { this.resetTreino(); return; }
      this.reinicioPorSaida('fundo', 'fundo');
      return;
    }
    if (Math.abs(b.pos.z) > MEIO_Z + RAIO_BOLA) {
      if (this.treino) { this.resetTreino(); return; }
      this.reinicioPorSaida('lateral', 'lateral');
      return;
    }

    // goleiros
    for (const g of this.goleiros) {
      if (b.goleiroTestado[g.time]) continue;
      if (b.ultimoToque === g) continue;
      // bola de companheiro só conta se estiver indo em direção ao gol (recuo ou gol contra)
      if (b.ultimoToque && b.ultimoToque.time === g.time && Math.sign(b.vel.x) !== -g.dir) continue;
      const alcance = g.mergulho > 0 ? 2.3 : 1.35;
      const d = dist2(g.pos, b.pos);
      if (d < alcance && b.pos.y < 2.7) {
        b.goleiroTestado[g.time] = true;
        const vel = b.vel.length();
        let chance = g.time === 1 ? this.dif.reacaoGoleiroAdv : ({ mirim: 0.85, titular: 0.72, penta: 0.62 })[this.op.dificuldade] || 0.75;
        chance *= 1 - limitar((vel - 18) / 25, 0, 0.45);
        if (Math.abs(b.pos.z) > MEIA_TRAVE - 0.9) chance *= 0.75;
        if (vel < 12) chance = 0.97;
        if (Math.random() < chance) {
          if (vel < 21 && b.pos.y < 2.2) {
            b.dono = g; b.ultimoToque = g; b.alvoPasse = null; g.tempoComBola = 0;
            b.vel.set(0, 0, 0);
            if (vel > 14) { this.hud.msg('Que defesa!', 1.2); som.uhhTorcida(); if (this.torcida) this.torcida.uhh(); }
          } else {
            // espalma
            b.vel.x = -b.vel.x * 0.3 + g.dir * 3;
            b.vel.z = (Math.random() < 0.5 ? -1 : 1) * sorte(5, 9);
            b.vel.y = sorte(2, 5);
            b.ultimoToque = g;
            b.chuteDe = null;
            this.hud.msg('Espalmou!', 1.2);
            som.uhhTorcida(); if (this.torcida) this.torcida.uhh();
          }
          som.vibrarTorcida(0.6, 2);
          return;
        }
      }
    }

    // alguém domina a bola?
    if (b.pos.y < 1.3) {
      let melhor = null, md = Infinity;
      for (const j of this.jogadores) {
        if (j.mergulho > 0 || j.atordoado > 0) continue;
        if (j === b.ignorar && this.tempoTotal < b.ignorarAte) continue;
        if (j.idx === 0 && b.goleiroTestado[j.time] && b.vel.length() > 12) continue;
        const d = dist2(j.pos, b.pos);
        const raio = j.idx === 0 ? 1.2 : 0.95;
        if (d < raio && d < md) { md = d; melhor = j; }
      }
      if (melhor) {
        b.dono = melhor;
        b.ultimoToque = melhor;
        b.alvoPasse = null;
        b.chuteDe = null;
        melhor.tempoComBola = 0;
        melhor.decisao = sorte(0.1, 0.35);
        if (melhor.time === 0) this.trocarControle(melhor);
        else if (this.controlado && b.alvoPasse === null) this.timerTroca = 0;
      }
    }
  }

  resetTreino() {
    const b = this.bola;
    b.pos.set(this.controlado ? this.controlado.pos.x : 0, RAIO_BOLA, 0);
    b.vel.set(0, 0, 0);
    if (this.controlado) b.pos.set(this.controlado.pos.x + 1, RAIO_BOLA, this.controlado.pos.z);
  }

  // ---------------------------------------------------------- visual e câmera
  atualizarVisual(dt) {
    for (const j of this.jogadores) {
      j.modelo.raiz.position.set(j.pos.x, 0, j.pos.z);
      j.modelo.raiz.rotation.y = j.ang;
      animarJogador(j, dt, this.tempoTotal);
    }
    const b = this.bola;
    b.malha.position.copy(b.pos);
    const s = Math.hypot(b.vel.x, b.vel.z);
    if (s > 0.05) {
      const eixo = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
      b.malha.rotateOnWorldAxis(eixo, (s * dt) / RAIO_BOLA);
    }
    b.sombra.position.set(b.pos.x, 0.03, b.pos.z);
    const c = this.controlado;
    this.marcador.visible = !!c && this.estado !== 'gol';
    if (c) {
      this.marcador.position.set(c.pos.x, 0, c.pos.z);
      this.marcador.userData.seta.position.y = 3.4 + Math.sin(this.tempoTotal * 6) * 0.15;
    }
  }

  atualizarCamera(dt) {
    const b = this.bola;
    const cx = limitar(b.pos.x, -38, 38);
    const cz = limitar(b.pos.z, -MEIO_Z, MEIO_Z);
    const alvoPos = new THREE.Vector3(cx, 21, cz * 0.45 + 33);
    const alvoOlhar = new THREE.Vector3(cx, 0, cz * 0.75 - 1);
    const k = Math.min(1, dt * 3);
    this.camPos.lerp(alvoPos, k);
    this.camAlvo.lerp(alvoOlhar, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camAlvo);
  }

  desenharRadar() {
    const cv = this.hud.radar;
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,90,40,0.75)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    const X = x => (x + MEIO_X) / CAMPO.comp * W;
    const Z = z => (z + MEIO_Z) / CAMPO.larg * H;
    for (const j of this.jogadores) {
      g.fillStyle = j.time === 0 ? (j.controlado ? '#ffffff' : '#ffd400') : '#ff4d4d';
      g.beginPath(); g.arc(X(j.pos.x), Z(j.pos.z), j.controlado ? 3.5 : 2.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(X(this.bola.pos.x) - 1.5, Z(this.bola.pos.z) - 1.5, 3, 3);
  }
}
