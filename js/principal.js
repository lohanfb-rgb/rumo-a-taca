// =============================================================
//  RUMO À TAÇA — arquivo principal: telas, fluxo do jogo e desenho 3D
// =============================================================
import * as THREE from 'three';
import { criarEstadio } from './estadio.js';
import { Partida } from './partida.js';
import { Penaltis } from './penaltis.js';
import { Torcida } from './torcida.js';
import { Cerimonia } from './cerimonia.js';
import { iniciarControles, atualizarControles, entrada } from './controles.js';
import { ADVERSARIOS, DIFICULDADES, SELECAO, elencoAdversario } from './dados.js';
import * as som from './audio.js';
import * as camp from './campanha.js';
import * as jog from './jogadores.js';

// ------------------------------------------------------------ 3D
const canvas = document.getElementById('tela3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 600);
let cena = null;
let noiteAtual = null;
let estadioInfo = null;
let torcida = null;

// Monta o estádio (dia ou noite) e coloca a torcida conforme o mando de campo
function montarCena(noite = false, fracaoBR = 0.5, kitAdv = null) {
  if (!cena || noiteAtual !== noite) {
    cena = new THREE.Scene();
    estadioInfo = criarEstadio(cena, noite);
    noiteAtual = noite;
    torcida = null;
  }
  if (torcida) torcida.destruir();
  torcida = new Torcida(estadioInfo.arquibancadas, { fracaoBR, kitAdv });
  return cena;
}

// Mando de campo: quanto da torcida é brasileira
const FRACAO_MANDO = { casa: 0.8, neutro: 0.5, fora: 0.25 };
const NOME_MANDO = { casa: 'Brasil em casa', neutro: 'Campo neutro', fora: 'Brasil fora de casa' };
function mandoDaCampanha(fase) {
  if (fase === 0 || fase === 2) return 'casa';
  if (fase === 1) return 'fora';
  return 'neutro';
}

function redimensionar() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // em telas estreitas, abre um pouco mais a câmera
  camera.fov = w / h < 1.5 ? 48 : 40;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', redimensionar);
redimensionar();

// ------------------------------------------------------------ preferências
const PREF = 'rumoATaca.preferencias';
let pref = { dificuldade: 'mirim', duracao: 180, mando: 'casa' };
try { pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch (e) { /* ok */ }
const salvarPref = () => { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) { /* ok */ } };

// ------------------------------------------------------------ telas
const $ = id => document.getElementById(id);
let telaAtual = 'menu';
let voltarPara = 'menu';
function mostrar(id) {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  $(id).classList.add('ativa');
  telaAtual = id;
}
function sobrepor(id, ligado) { $(id).classList.toggle('ativa', ligado); }

const ehToque = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ehToque) document.body.classList.add('toque');

function bandeira(adv, mini = false) {
  const el = document.createElement('div');
  el.className = 'bandeira';
  if (!adv || adv.sigla === 'BRA') { el.classList.add('br'); }
  else {
    const [a, b, c] = adv.bandeira;
    el.style.background = adv.vertical
      ? `linear-gradient(90deg, ${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6%)`
      : `linear-gradient(180deg, ${a} 0 33.3%, ${b} 33.3% 66.6%, ${c} 66.6%)`;
    if (adv.bola) { const bo = document.createElement('div'); bo.className = 'bola'; bo.style.background = adv.bola; el.appendChild(bo); }
  }
  if (mini) { const w = document.createElement('span'); w.className = 'bandeira-mini'; w.appendChild(el); return w; }
  return el;
}
const BRASIL = { sigla: 'BRA', nome: 'Brasil' };

// ------------------------------------------------------------ chips de opção
function prepararChips(id, chave) {
  const cont = $(id);
  const marcar = () => cont.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', String(pref[chave]) === b.dataset.valor));
  cont.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    pref[chave] = chave === 'duracao' ? Number(b.dataset.valor) : b.dataset.valor;
    salvarPref();
    marcar();
  });
  marcar();
}
prepararChips('chips-dificuldade', 'dificuldade');
prepararChips('chips-duracao', 'duracao');
prepararChips('chips-mando', 'mando');

function atualizarContadorEstrelas() {
  $('contador-estrelas').textContent = '★ ' + camp.carregarPerfil().estrelas;
}
atualizarContadorEstrelas();

function atualizarBotoesSom() {
  const t = som.estaMudo() ? 'Som: desligado' : 'Som: ligado';
  $('bt-som').textContent = t;
  $('bt-som-pausa').textContent = t;
}

// ------------------------------------------------------------ HUD
let timerMsg = null;
const hud = {
  radar: $('radar'),
  _placar: '', _relogio: '', _forca: undefined,
  placar(a, b) {
    const t = `${a} - ${b}`;
    if (t !== this._placar) { $('hud-gols').textContent = t; this._placar = t; }
  },
  relogio(t) { if (t !== this._relogio) { $('hud-relogio').textContent = t; this._relogio = t; } },
  msg(texto, seg = 1.5, grande = false, sub = '') {
    const el = $('hud-msg');
    el.querySelector('.msg-texto').textContent = texto;
    el.querySelector('.msg-sub').textContent = sub || '';
    el.classList.toggle('grande', grande);
    el.classList.remove('visivel');
    void el.offsetWidth;
    el.classList.add('visivel');
    clearTimeout(timerMsg);
    timerMsg = setTimeout(() => el.classList.remove('visivel'), seg * 1000);
  },
  forca(v) {
    if (v === this._forca) return;
    this._forca = v;
    const el = $('hud-forca');
    el.classList.toggle('ativa', v !== null);
    if (v !== null) el.firstElementChild.style.width = Math.round(v * 100) + '%';
  },
  placarPenaltis(p) {
    const el = $('hud-penaltis');
    if (!p) { el.classList.remove('ativo'); el.innerHTML = ''; return; }
    el.classList.add('ativo');
    const siglas = ['BRA', jogoAtual && jogoAtual.adv ? jogoAtual.adv.sigla : 'ADV'];
    el.innerHTML = p.map((linha, i) => {
      const n = Math.max(5, p[0].length, p[1].length);
      let bolas = '';
      for (let k = 0; k < n; k++) bolas += `<i class="${linha[k] === undefined ? '' : linha[k] ? 'g' : 'p'}"></i>`;
      return `<div class="linha"><span class="s">${siglas[i]}</span>${bolas}<span>${linha.filter(Boolean).length}</span></div>`;
    }).join('');
    $('hud-gols').textContent = `${p[0].filter(Boolean).length} - ${p[1].filter(Boolean).length}`;
    this._placar = '';
  },
  _escolha: null,
  botoesGoleiro(ligado) {
    $('botoes-goleiro').classList.toggle('ativo', ligado);
    $('botoes-goleiro').querySelectorAll('button').forEach(b => b.classList.remove('escolhido'));
    this._escolha = null;
  },
  escolhaGoleiro() { return this._escolha; },
  dica(texto) { $('dica-teclado').textContent = texto; },
  _nome: null,
  nomeDono(texto, x, y, time) {
    const el = $('nome-dono');
    if (!texto) { if (this._nome !== null) { el.classList.remove('ativo'); this._nome = null; } return; }
    if (texto !== this._nome) {
      el.textContent = texto;
      el.classList.add('ativo');
      el.classList.toggle('adversario', time === 1);
      this._nome = texto;
    }
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  },
  _energia: -1,
  energia(valor, x, y, nome) {
    const el = $('energia');
    const painel = $('energia-painel');
    if (valor === null) { el.classList.remove('ativo'); painel.classList.remove('ativo'); this._energia = -1; return; }
    el.classList.add('ativo');
    painel.classList.add('ativo');
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, 10px)`;
    const pct = Math.round(valor * 100);
    if (pct !== this._energia) {
      this._energia = pct;
      const cor = pct > 60 ? '#3ddc6b' : pct > 30 ? '#ffd400' : '#ff4d4d';
      for (const barra of [el.firstElementChild, $('energia-painel-barra')]) {
        barra.style.width = pct + '%';
        barra.style.background = cor;
      }
    }
    if (nome !== this._nomeEnergia) { $('energia-painel-nome').textContent = nome; this._nomeEnergia = nome; }
  },
  replayDisponivel(v) {
    $('bt-replay').classList.toggle('ativo', v);
    $('bt-replay-pausa').disabled = !v;
  },
  modoReplay(ligado, autor = '') {
    const el = $('selo-replay');
    el.classList.toggle('ativo', ligado);
    el.querySelector('small').textContent = autor ? `Gol de ${autor}` : '';
    $('hud').classList.toggle('em-replay', ligado);
  },
};
const DICA_PARTIDA = 'Setas: correr · J: passe · K: chute · L: corrida · I: troca · U: carrinho · R: replay · P: pausa';
$('botoes-goleiro').addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (!b) return;
  hud._escolha = Number(b.dataset.lado);
  $('botoes-goleiro').querySelectorAll('button').forEach(x => x.classList.toggle('escolhido', x === b));
});

// ------------------------------------------------------------ fluxo das partidas
let jogo = null;          // Partida ou Penaltis em andamento
let jogoAtual = null;     // { modo, adv, ... }

function prepararHud(adv) {
  $('hud-band-a').replaceChildren(bandeira(BRASIL));
  $('hud-band-b').replaceChildren(adv ? bandeira(adv) : document.createTextNode(''));
  $('hud-sigla-b').textContent = adv ? adv.sigla : '';
  hud._placar = ''; hud._relogio = ''; hud._forca = undefined;
  hud.placar(0, 0);
  hud.forca(null);
  hud.placarPenaltis(null);
  hud.botoesGoleiro(false);
  $('hud-msg').classList.remove('visivel');
  hud.dica(DICA_PARTIDA);
  $('radar').style.display = '';
  hud.nomeDono(null);
  hud.energia(null);
  hud.replayDisponivel(false);
  hud.modoReplay(false);
}

function encerrarJogo() {
  if (jogo) { jogo.destruir(); jogo = null; }
  som.pararTorcida();
  hud.forca(null);
}

function iniciarPartida({ adv, mataMata = false, treino = false, noite = false, mando = 'casa', aoTerminar }) {
  encerrarJogo();
  const fracaoBR = treino ? 0.9 : FRACAO_MANDO[mando];
  montarCena(noite, fracaoBR, adv ? adv.kit : null);
  prepararHud(adv);
  mostrar('hud');
  som.iniciarTorcida(fracaoBR);
  jogo = new Partida({
    cena, camera, hud, torcida, fracaoBR,
    adversario: adv, dificuldade: pref.dificuldade, duracaoTempo: pref.duracao,
    mataMata, treino,
    aoTerminar: res => { if (jogo && jogo.terminou) aoTerminar(res); },
  });
  if (!treino) {
    hud.msg(`Brasil x ${adv.nome}`, 2.2, false, NOME_MANDO[mando]);
    const fala = mando === 'casa' ? 'A torcida brasileira lota o estádio!' : mando === 'fora' ? `A torcida ${adv.nome === 'Estados Unidos' ? 'americana' : 'adversária'} é maioria hoje!` : '';
    setTimeout(() => som.narrar(`Começa o jogo! Brasil contra ${adv.nome}! ${fala}`), 300);
  }
  else hud.msg('Treino livre', 2, false, 'Faça gols à vontade!');
}

function iniciarPenaltis({ adv, noite = false, mando = 'casa', aoTerminar }) {
  encerrarJogo();
  const fracaoBR = FRACAO_MANDO[mando];
  montarCena(noite, fracaoBR, adv.kit);
  prepararHud(adv);
  mostrar('hud');
  som.iniciarTorcida(fracaoBR);
  $('radar').style.display = 'none';
  $('hud-relogio').textContent = 'PÊN';
  hud._relogio = 'PÊN';
  jogo = new Penaltis({ cena, camera, hud, torcida, fracaoBR, adversario: adv, dificuldade: pref.dificuldade, aoTerminar });
}

// ------------------------------------------------------------ resultado
function estrelasHTML(n) {
  return [0, 1, 2].map(i => `<span class="${i < n ? '' : 'apagada'}">★</span>`).join('');
}

function figurinhaHTML(f, animar = false, selo = '') {
  const s = selo ? `<div class="selo ${selo === 'NOVA!' ? 'novo' : ''}">${selo}</div>` : '';
  return `<div class="figurinha ${animar ? 'nova' : ''}">${s}<div class="geral">${f.geral}</div><div class="camisa">${f.num || ''}</div><div><div class="nome">${f.nome}</div><div class="pos">${f.pos}</div></div></div>`;
}
let ultimasNovas = new Set();   // figurinhas que acabaram de entrar no álbum

function golsHTML(marcadores, adv) {
  if (!marcadores || !marcadores.length) return '';
  const linha = (time) => marcadores.filter(m => m.time === time)
    .map(m => `${m.nome}${m.contra ? ' (contra)' : ''} ${m.minuto ? m.minuto + "'" : ''}`).join(' · ');
  const br = linha(0), ad = linha(1);
  return `${br ? `<div><b>Brasil:</b> ⚽ ${br}</div>` : ''}${ad ? `<div><b>${adv ? adv.nome : 'Adversário'}:</b> ⚽ ${ad}</div>` : ''}`;
}

let ultimosPontos = null; // pontos de ranking do último jogo (mostrados no resultado)
function mostrarResultado({ titulo, golsBR, golsAdv, adv, estrelas = null, texto = '', botoes, penaltis = null, marcadores = null }) {
  $('res-gols').innerHTML = golsHTML(marcadores, adv);
  const atual = jog.jogadorAtual();
  $('res-pontos').textContent = atual && ultimosPontos !== null ? `+${ultimosPontos} pontos no ranking para ${atual.apelido}` : '';
  ultimosPontos = null;
  $('res-titulo').textContent = titulo;
  const pl = $('res-placar');
  pl.innerHTML = '';
  pl.append(bandeira(BRASIL), document.createTextNode(` ${golsBR} - ${golsAdv} `), bandeira(adv));
  $('res-estrelas').innerHTML = estrelas === null ? '' : estrelasHTML(estrelas);
  $('res-texto').textContent = texto + (penaltis ? ` (pênaltis: ${penaltis[0]} x ${penaltis[1]})` : '');
  const pac = $('res-pacotes');
  const figTexto = $('res-fig-texto');
  pac.innerHTML = '';
  figTexto.textContent = '';
  botoes = [...botoes];
  if (estrelas !== null) {
    const perfil = camp.carregarPerfil();
    const pacotes = estrelas ? camp.adicionarEstrelas(perfil, estrelas) : [];
    atualizarContadorEstrelas();
    if (pacotes.length) {
      const figs = pacotes.flat();
      const novas = figs.filter(f => f.nova);
      ultimasNovas = new Set(novas.map(f => f.id));
      const nomes = figs.map(f => f.nome + (f.nova ? '' : ' (repetida)')).join(', ');
      figTexto.innerHTML = `<b>Você ganhou ${figs.length} figurinhas${novas.length ? `, ${novas.length === 1 ? '1 nova' : novas.length + ' novas'}` : ''}!</b><br>${nomes}`;
      pac.innerHTML = figs.map(f => figurinhaHTML(f, true, f.nova ? 'NOVA!' : 'Repetida')).join('');
      const depois = botoes[botoes.length - 1].acao;
      botoes.splice(1, 0, { texto: 'Ver álbum', classe: 'azul', acao: () => abrirAlbum(depois) });
    } else {
      const faltam = 5 - (perfil.estrelas - perfil.estrelasGastas);
      figTexto.textContent = `Faltam ${faltam} ${faltam === 1 ? 'estrela' : 'estrelas'} para o próximo pacote de figurinhas.`;
    }
  }
  const bt = $('res-botoes');
  bt.innerHTML = '';
  for (const b of botoes) {
    const el = document.createElement('button');
    el.className = 'bt ' + (b.classe || 'verde');
    el.textContent = b.texto;
    el.onclick = () => { sobrepor('resultado', false); b.acao(); };
    bt.appendChild(el);
  }
  sobrepor('resultado', true);
}

function voltarAoMenu() {
  encerrarJogo();
  sobrepor('resultado', false);
  sobrepor('pausa', false);
  sobrepor('campeao', false);
  montarCena(false);
  mostrar('menu');
  atualizarContadorEstrelas();
}

// ------------------------------------------------------------ amistoso / pênaltis / treino
function abrirEscolha(modo) {
  $('titulo-escolha').textContent = modo === 'penaltis' ? 'Pênaltis: escolha o adversário' : 'Amistoso: escolha o adversário';
  const grade = $('grade-adversarios');
  grade.innerHTML = '';
  for (const adv of [...ADVERSARIOS].sort((a, b) => b.forca - a.forca)) {
    const c = document.createElement('button');
    c.className = 'carta-adv';
    c.append(bandeira(adv));
    const t = document.createElement('div');
    t.innerHTML = `<b>${adv.nome}</b><small>Força ${adv.forca}</small>`;
    c.append(t);
    c.onclick = () => (modo === 'penaltis' ? jogarPenaltis(adv) : jogarAmistoso(adv));
    grade.appendChild(c);
  }
  voltarPara = 'menu';
  mostrar('escolha');
}

function jogarAmistoso(adv) {
  jogoAtual = { modo: 'amistoso', adv };
  iniciarPartida({
    adv, noite: Math.random() < 0.4, mando: pref.mando,
    aoTerminar: res => {
      const [a, b] = res.gols;
      const venceu = a > b;
      camp.registrarArtilheirosPerfil(res.marcadores);
      ultimosPontos = jog.registrarResultado({ modo: 'amistoso', golsPro: a, golsContra: b, venceu, empate: a === b, estrelas: camp.calcularEstrelas(a, b, venceu), dificuldade: pref.dificuldade });
      mostrarResultado({
        marcadores: res.marcadores,
        titulo: venceu ? 'Vitória!' : a === b ? 'Empate' : 'Derrota',
        golsBR: a, golsAdv: b, adv,
        estrelas: camp.calcularEstrelas(a, b, venceu),
        texto: venceu ? 'Que jogão do Brasil!' : a === b ? 'Foi equilibrado!' : 'Na próxima a gente vira!',
        botoes: [
          { texto: 'Jogar de novo', classe: 'amarelo', acao: () => jogarAmistoso(adv) },
          { texto: 'Menu', acao: voltarAoMenu },
        ],
      });
    },
  });
}

function jogarPenaltis(adv) {
  jogoAtual = { modo: 'penaltis', adv };
  iniciarPenaltis({
    adv, mando: pref.mando,
    aoTerminar: res => {
      const venceu = res.vencedor === 0;
      if (venceu) som.narrar('O Brasil venceu nos pênaltis!');
      ultimosPontos = jog.registrarResultado({ modo: 'penaltis', venceu, estrelas: venceu ? 1 : 0, dificuldade: pref.dificuldade });
      mostrarResultado({
        titulo: venceu ? 'Vitória nos pênaltis!' : 'Perdemos nos pênaltis',
        golsBR: res.placar[0], golsAdv: res.placar[1], adv,
        estrelas: venceu ? 1 : 0,
        texto: venceu ? 'Que categoria na marca da cal!' : 'Treine mais um pouco e tente de novo!',
        botoes: [
          { texto: 'Jogar de novo', classe: 'amarelo', acao: () => jogarPenaltis(adv) },
          { texto: 'Menu', acao: voltarAoMenu },
        ],
      });
    },
  });
}

function jogarTreino() {
  jogoAtual = { modo: 'treino', adv: null };
  iniciarPartida({ adv: null, treino: true, aoTerminar: () => {} });
}

// ------------------------------------------------------------ campanha
let campanha = null;

function abrirCampanha() {
  campanha = camp.carregarCampanha();
  if (!campanha || campanha.campeao) campanha = camp.novaCampanha(pref.dificuldade);
  desenharCampanha();
  mostrar('campanha');
}

function desenharCampanha() {
  const c = campanha;
  $('dif-campanha').textContent = '· ' + DIFICULDADES[c.dificuldade].nome;
  $('trilha').innerHTML = camp.FASES.map((f, i) => `<li class="${i < c.fase ? 'feito' : i === c.fase ? 'atual' : ''}">${f.replace('Grupo · ', '')}</li>`).join('');

  // próximo jogo
  const pj = $('proximo-jogo');
  pj.innerHTML = '';
  const bt = $('bt-jogar-campanha');
  if (c.eliminado) {
    pj.innerHTML = `<div class="fase">Eliminado na fase de grupos</div><p>O Brasil terminou em ${c.posicaoGrupo}º lugar. Vamos tentar de novo?</p>`;
    bt.textContent = 'Nova campanha';
  } else {
    const adv = camp.adversarioDaFase(c);
    const fase = document.createElement('div');
    fase.className = 'fase';
    fase.textContent = camp.FASES[c.fase];
    const conf = document.createElement('div');
    conf.className = 'confronto';
    const lado = (a, nome, forca) => {
      const d = document.createElement('div');
      d.className = 'lado';
      d.append(bandeira(a));
      const n = document.createElement('div'); n.textContent = nome; d.append(n);
      const f = document.createElement('div'); f.className = 'forca-time'; f.textContent = 'Força ' + forca; d.append(f);
      return d;
    };
    const x = document.createElement('div'); x.className = 'x'; x.textContent = 'x';
    conf.append(lado(BRASIL, 'Brasil', 91), x, lado(adv, adv.nome, adv.forca));
    const mandoEl = document.createElement('div');
    mandoEl.className = 'forca-time';
    mandoEl.textContent = 'Mando de campo: ' + NOME_MANDO[mandoDaCampanha(c.fase)];
    pj.append(fase, conf, mandoEl);
    if (c.perdeuMataMata) {
      const p = document.createElement('p');
      p.textContent = 'Perdemos este jogo. Tente de novo!';
      pj.append(p);
    }
    if (c.fase >= 3 && c.posicaoGrupo) {
      const p = document.createElement('p');
      p.className = 'historico';
      p.textContent = `Brasil passou do grupo em ${c.posicaoGrupo}º lugar. Agora é mata-mata: perdeu, sai!`;
      pj.append(p);
    }
    const hist = c.resultados.slice(-3).map(r => {
      const a = ADVERSARIOS.find(x => x.sigla === r.adv);
      return `${camp.FASES[r.fase].replace('Grupo · ', '')}: Brasil ${r.golsBR} x ${r.golsAdv} ${a.nome}${r.penaltis !== null ? (r.penaltis ? ' (venceu nos pênaltis)' : ' (perdeu nos pênaltis)') : ''}`;
    });
    if (hist.length) {
      const h = document.createElement('div');
      h.className = 'historico';
      h.innerHTML = hist.join('<br>');
      pj.append(h);
    }
    bt.textContent = c.perdeuMataMata ? 'Tentar de novo' : 'Jogar!';
  }

  // tabela do grupo
  const cl = camp.classificacao(c);
  $('tabela-grupo').innerHTML = '<tr><th>Seleção</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>' +
    cl.map((l, i) => {
      const a = l.sigla === 'BRA' ? BRASIL : ADVERSARIOS.find(x => x.sigla === l.sigla);
      return `<tr class="${l.sigla === 'BRA' ? 'br' : ''} ${i < 2 && c.fase >= 3 ? 'passa' : ''}"><td>${a.nome}</td><td>${l.pts}</td><td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td><td>${l.sg}</td></tr>`;
    }).join('');
}

function jogarCampanha() {
  if (campanha.eliminado) { campanha = camp.novaCampanha(pref.dificuldade); desenharCampanha(); return; }
  if (campanha.perdeuMataMata) campanha = camp.tentarDeNovo(campanha);
  const c = campanha;
  pref.dificuldade = c.dificuldade;
  const adv = camp.adversarioDaFase(c);
  const fase = c.fase;
  const mataMata = fase >= 3;
  jogoAtual = { modo: 'campanha', adv };
  const mando = mandoDaCampanha(fase);
  iniciarPartida({
    adv, mataMata, mando, noite: fase >= 6 || fase === 2,
    aoTerminar: res => {
      const [a, b] = res.gols;
      if (res.precisaPenaltis) {
        hud.msg('Pênaltis!', 2, true);
        som.narrar('Vai para os pênaltis!');
        setTimeout(() => {
          iniciarPenaltis({
            adv, mando, noite: fase >= 6 || fase === 2,
            aoTerminar: rp => terminarJogoCampanha(a, b, adv, fase, rp.vencedor === 0, rp.placar, res.marcadores),
          });
        }, 1800);
        return;
      }
      terminarJogoCampanha(a, b, adv, fase, null, null, res.marcadores);
    },
  });
}

function terminarJogoCampanha(a, b, adv, fase, venceuPen, placarPen, marcadores = []) {
  camp.registrarJogo(campanha, a, b, venceuPen, marcadores);
  camp.registrarArtilheirosPerfil(marcadores);
  const venceu = a > b || venceuPen === true;
  const estrelas = camp.calcularEstrelas(a, b, venceu);
  ultimosPontos = jog.registrarResultado({
    modo: 'campanha', golsPro: a, golsContra: b, venceu, empate: !venceu && a === b && venceuPen === null,
    estrelas, dificuldade: campanha.dificuldade, titulo: !!campanha.campeao,
  });
  if (campanha.campeao) {
    const perfil = camp.carregarPerfil();
    perfil.trofeus[campanha.dificuldade] = true;
    camp.salvarPerfil(perfil);
    const premios = calcularPremios(campanha, 'BRA');
    camp.guardarUltimaCopa(campanha, 'BRA');
    camp.apagarCampanha();
    mostrarResultado({
      titulo: 'CAMPEÃO!', golsBR: a, golsAdv: b, adv, estrelas, marcadores,
      texto: 'O Brasil venceu a final!', penaltis: placarPen,
      botoes: [{ texto: 'Ir para a premiação!', classe: 'amarelo', acao: () => iniciarCerimonia({ brasilCampeao: true, adv, premios }) }],
    });
    return;
  }
  if (fase === 7 && !venceu) {
    // perdeu a final: o adversário levanta a taça
    const premios = calcularPremios(campanha, adv.sigla);
    camp.guardarUltimaCopa(campanha, adv.sigla);
    mostrarResultado({
      titulo: 'Vice-campeão', golsBR: a, golsAdv: b, adv, estrelas, marcadores, penaltis: placarPen,
      texto: `A ${adv.nome} venceu a final. Mas dá para jogar a final de novo!`,
      botoes: [{ texto: 'Ver a premiação', classe: 'amarelo', acao: () => iniciarCerimonia({ brasilCampeao: false, adv, premios }) }],
    });
    return;
  }
  let texto, titulo;
  if (fase < 3) {
    titulo = a > b ? 'Vitória!' : a === b ? 'Empate' : 'Derrota';
    texto = campanha.eliminado ? 'O Brasil não passou do grupo.' : fase === 2 ? 'Fase de grupos encerrada!' : 'Próximo jogo do grupo!';
  } else {
    titulo = venceu ? 'Classificado!' : 'Eliminado...';
    texto = venceu ? `O Brasil avançou para: ${camp.FASES[campanha.fase]}` : 'Mas dá para tentar este jogo de novo!';
  }
  mostrarResultado({
    titulo, golsBR: a, golsAdv: b, adv, estrelas, texto, penaltis: placarPen, marcadores,
    botoes: [{ texto: 'Continuar', classe: 'amarelo', acao: () => { encerrarJogo(); montarCena(false); abrirCampanha(); } }],
  });
}

// Prêmios da Copa: artilheiro e melhor jogador do campeão
function calcularPremios(c, siglaCampeao) {
  const ranking = camp.rankingArtilharia(c, 50);
  const artilheiro = ranking[0] || null;
  const doCampeao = ranking.find(r => r.sigla === siglaCampeao);
  let melhor = doCampeao ? doCampeao.nome : null;
  if (!melhor) melhor = siglaCampeao === 'BRA' ? 'Neymar' : elencoAdversario(ADVERSARIOS.find(a => a.sigla === siglaCampeao))[7].nome;
  return { artilheiro, melhor, siglaCampeao };
}

function nomeSelecao(sigla) {
  return sigla === 'BRA' ? 'Brasil' : (ADVERSARIOS.find(a => a.sigla === sigla) || {}).nome || sigla;
}

function iniciarCerimonia({ brasilCampeao, adv, premios }) {
  encerrarJogo();
  montarCena(true, brasilCampeao ? 0.8 : 0.5, adv ? adv.kit : null);
  mostrar('menu');
  $('menu').classList.remove('ativa');
  const titulares = SELECAO.titulares.map(n => SELECAO.jogadores.find(j => j.num === n));
  const vencedor = brasilCampeao
    ? { nome: 'Brasil', kit: SELECAO.kit, kitGoleiro: SELECAO.kitGoleiro, jogadores: titulares, coresConfete: [0xffd400, 0x0a9b3c, 0x1646b8, 0xffffff] }
    : { nome: adv.nome, kit: adv.kit, kitGoleiro: { camisa: 0xff4fa0, detalhe: 0x222222, calcao: 0x222222, meiao: 0xff4fa0 }, jogadores: elencoAdversario(adv), coresConfete: [adv.kit.camisa, adv.kit.detalhe, 0xffd400, 0xffffff] };
  som.iniciarTorcida(brasilCampeao ? 0.8 : 0.5);
  jogo = new Cerimonia({
    cena, camera, torcida, vencedor, timeTorcida: brasilCampeao ? 0 : 1,
    titulo: brasilCampeao ? 'É HEXA!' : 'CAMPEÃO!',
    subtitulo: brasilCampeao ? 'BRASIL CAMPEÃO DO MUNDO' : adv.nome.toUpperCase() + ' CAMPEÃ DO MUNDO',
  });
  $('cer-titulo').textContent = brasilCampeao ? 'É HEXA!' : `${adv.nome} campeã`;
  $('cer-texto').textContent = brasilCampeao
    ? 'O Brasil é campeão do mundo pela sexta vez!'
    : 'O Brasil ficou com o vice. Na próxima a taça é nossa!';
  const art = premios.artilheiro;
  $('cer-premios').innerHTML = `
    <div class="premio"><span class="icone">🏆</span><b>Campeão</b><span>${nomeSelecao(premios.siglaCampeao)}</span></div>
    <div class="premio"><span class="icone">⚽</span><b>Chuteira de Ouro</b><span>${art ? `${art.nome} (${nomeSelecao(art.sigla)}) · ${art.gols} ${art.gols === 1 ? 'gol' : 'gols'}` : '—'}</span></div>
    <div class="premio"><span class="icone">⭐</span><b>Bola de Ouro</b><span>${premios.melhor}</span></div>`;
  const bt = $('cer-botoes');
  bt.innerHTML = '';
  const botao = (texto, classe, acao) => { const b = document.createElement('button'); b.className = 'bt ' + classe; b.textContent = texto; b.onclick = acao; bt.appendChild(b); };
  botao('Ver artilharia', 'azul', () => abrirArtilharia('copa', () => sobrepor('campeao', true)));
  if (!brasilCampeao) botao('Jogar a final de novo', 'amarelo', () => { sobrepor('campeao', false); encerrarJogo(); montarCena(false); abrirCampanha(); });
  botao('Voltar ao menu', brasilCampeao ? 'amarelo' : 'verde', voltarAoMenu);
  sobrepor('campeao', true);
  setTimeout(() => som.narrar(brasilCampeao ? 'É hexa! É hexa! O Brasil é campeão do mundo!' : `${adv.nome} é campeã do mundo.`), 2200);
}

// ------------------------------------------------------------ artilharia
let aoVoltarArtilharia = null;
let abaArtilharia = 'copa';
function abrirArtilharia(aba = 'copa', aoVoltar = null) {
  aoVoltarArtilharia = aoVoltar;
  abaArtilharia = aba;
  desenharArtilharia();
  sobrepor('campeao', false);
  mostrar('artilharia');
}

function desenharArtilharia() {
  document.querySelectorAll('#abas-artilharia button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === abaArtilharia));
  let lista = [], legenda = '';
  if (abaArtilharia === 'copa') {
    const c = camp.carregarCampanha();
    const perfil = camp.carregarPerfil();
    if (c && Object.keys(c.artilharia || {}).length) {
      lista = camp.rankingArtilharia(c, 15);
      legenda = `Copa em andamento · ${camp.FASES[Math.min(c.fase, 7)]}`;
    } else if (perfil.ultimaCopa) {
      lista = perfil.ultimaCopa.ranking;
      legenda = `Última Copa · campeão: ${nomeSelecao(perfil.ultimaCopa.campeao)}`;
    } else legenda = 'Jogue a campanha Rumo à Taça para ver a artilharia da Copa.';
  } else {
    lista = camp.rankingHistorico(20);
    legenda = lista.length ? 'Gols do Brasil em amistosos e campanhas' : 'Os gols do Brasil em todos os jogos aparecem aqui.';
  }
  $('legenda-artilharia').textContent = legenda;
  const medalha = i => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`);
  $('tabela-artilharia').innerHTML = lista.length
    ? '<tr><th></th><th>Jogador</th><th>Seleção</th><th>Gols</th></tr>' + lista.map((r, i) => {
      const adv = r.sigla === 'BRA' ? BRASIL : ADVERSARIOS.find(a => a.sigla === r.sigla);
      return `<tr class="${r.sigla === 'BRA' ? 'br' : ''}"><td>${medalha(i)}</td><td>${r.nome}</td><td><span class="band-cel" data-sigla="${r.sigla}"></span> ${adv ? adv.nome : r.sigla}</td><td><b>${r.gols}</b></td></tr>`;
    }).join('')
    : '';
  document.querySelectorAll('#tabela-artilharia .band-cel').forEach(el => {
    const s = el.dataset.sigla;
    el.appendChild(bandeira(s === 'BRA' ? BRASIL : ADVERSARIOS.find(a => a.sigla === s), true));
  });
}

function voltarDaArtilharia() {
  const f = aoVoltarArtilharia;
  aoVoltarArtilharia = null;
  if (f) { f(); if (jogo && jogo instanceof Cerimonia) $('menu').classList.remove('ativa'); }
  else mostrar('menu');
}
$('abas-artilharia').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  abaArtilharia = b.dataset.aba;
  desenharArtilharia();
});

// ------------------------------------------------------------ substituições
let selecionadoSai = null;
function abrirSubstituicoes() {
  if (!jogo || typeof jogo.elencoParaSubstituir !== 'function') return;
  selecionadoSai = null;
  $('sub-erro').textContent = '';
  desenharSubstituicoes();
  sobrepor('pausa', false);
  sobrepor('substituicoes', true);
}

function desenharSubstituicoes() {
  const el = jogo.elencoParaSubstituir();
  $('sub-contador').textContent = `${el.feitas}/${el.max}`;
  const barra = v => `<span class="mini-energia"><i style="width:${Math.round(v * 100)}%;background:${v > 0.6 ? '#3ddc6b' : v > 0.3 ? '#ffd400' : '#ff4d4d'}"></i></span>`;
  $('sub-campo').innerHTML = el.emCampo.map(j => `
    <button class="linha-sub ${selecionadoSai === j.num ? 'selecionado' : ''}" data-sai="${j.num}">
      <span class="num">${j.num}</span><span class="nome">${j.nome}${j.amarelos ? ' 🟨' : ''}</span><span class="pos">${j.papel}</span>${barra(j.energia)}
    </button>`).join('');
  $('sub-banco').innerHTML = el.reservas.map(d => `
    <button class="linha-sub" data-entra="${d.num}" ${selecionadoSai === null || el.feitas >= el.max ? 'disabled' : ''}>
      <span class="num">${d.num}</span><span class="nome">${d.nome}</span><span class="pos">${d.pos}</span><span class="geral">${Math.round((d.vel + d.chu + d.pas + d.dri + d.def + d.fis) / 6 + 6)}</span>
    </button>`).join('') || '<p class="dica">Ninguém mais no banco.</p>';
  $('sub-instrucao').textContent = el.feitas >= el.max
    ? 'Você já fez as 5 substituições.'
    : selecionadoSai === null ? '1) Toque em quem vai SAIR (veja a energia).' : '2) Agora toque em quem vai ENTRAR.';
}

$('substituicoes').addEventListener('click', e => {
  const sai = e.target.closest('[data-sai]');
  const entra = e.target.closest('[data-entra]');
  if (sai) { selecionadoSai = Number(sai.dataset.sai); $('sub-erro').textContent = ''; desenharSubstituicoes(); }
  if (entra && selecionadoSai !== null) {
    const erro = jogo.substituir(selecionadoSai, Number(entra.dataset.entra));
    $('sub-erro').textContent = erro || '';
    if (!erro) selecionadoSai = null;
    desenharSubstituicoes();
  }
});
// ------------------------------------------------------------ cadastro de jogadores
const avatarHTML = (j, grande = false) => `<span class="avatar ${grande ? 'grande' : ''}" style="background:${j.cor}">${j.numero}</span>`;
let editandoId = null;
let corEscolhida = jog.CORES_AVATAR[0];

function atualizarChipJogador() {
  const j = jog.jogadorAtual();
  $('menu-avatar').innerHTML = j ? avatarHTML(j) : '';
  $('menu-apelido').textContent = j ? j.apelido : 'Ninguém';
}

function abrirCadastro() {
  const lista = jog.listarJogadores();
  $('cad-voltar').hidden = !jog.jogadorAtual();
  if (!lista.length) { abrirFormCadastro(null); mostrar('cadastro'); return; }
  $('cad-titulo').textContent = 'Quem vai jogar?';
  $('cad-form').hidden = true;
  $('cad-lista').hidden = false;
  const atualId = jog.idJogadorAtual();
  $('cad-lista').innerHTML = lista.map(j => `
    <div class="cad-cartao ${j.id === atualId ? 'atual' : ''}" data-escolher="${j.id}" role="button" tabindex="0">
      <button class="cad-editar" data-editar="${j.id}" aria-label="Editar ${j.apelido}">Editar</button>
      ${avatarHTML(j, true)}<b>${j.apelido}</b><small>${(j.stats && j.stats.pontos) || 0} pontos</small>
    </div>`).join('') +
    `<button class="cad-cartao cad-novo" data-novo="1"><span class="mais">+</span><b>Novo jogador</b></button>`;
  mostrar('cadastro');
}

function abrirFormCadastro(id) {
  editandoId = id;
  const j = id ? jog.listarJogadores().find(x => x.id === id) : null;
  $('cad-titulo').textContent = j ? 'Editar jogador' : 'Novo jogador';
  $('cad-lista').hidden = true;
  $('cad-form').hidden = false;
  $('cad-apagar').hidden = !j;
  $('cad-apagar').dataset.confirmar = '';
  $('cad-apagar').textContent = 'Apagar jogador';
  $('cad-cancelar').hidden = !jog.listarJogadores().length;
  $('cad-erro').textContent = '';
  $('cad-apelido').value = j ? j.apelido : '';
  $('cad-numero').value = j ? j.numero : 10;
  corEscolhida = j ? j.cor : jog.CORES_AVATAR[jog.listarJogadores().length % jog.CORES_AVATAR.length];
  $('cad-favorito').innerHTML = SELECAO.jogadores.filter(d => d.pos !== 'GOL').map(d => `<option value="${d.nome}">${d.num} · ${d.nome}</option>`).join('');
  $('cad-favorito').value = j ? j.favorito : 'Neymar';
  $('cad-cores').innerHTML = jog.CORES_AVATAR.map(c => `<button type="button" style="background:${c}" data-cor="${c}" aria-label="Cor ${c}"></button>`).join('');
  atualizarPreviaCadastro();
}

function atualizarPreviaCadastro() {
  const apelido = $('cad-apelido').value.trim();
  const numero = Math.max(1, Math.min(99, Number($('cad-numero').value) || 10));
  $('cad-previa-avatar').innerHTML = avatarHTML({ cor: corEscolhida, numero }, true);
  $('cad-previa-nome').textContent = apelido || 'Seu apelido';
  $('cad-cores').querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b.dataset.cor === corEscolhida));
}

$('cad-apelido').addEventListener('input', atualizarPreviaCadastro);
$('cad-numero').addEventListener('input', atualizarPreviaCadastro);
$('cad-cores').addEventListener('click', e => {
  const b = e.target.closest('[data-cor]');
  if (b) { corEscolhida = b.dataset.cor; atualizarPreviaCadastro(); }
});
$('cad-form').addEventListener('submit', e => {
  e.preventDefault();
  const apelido = $('cad-apelido').value;
  const erro = jog.validarApelido(apelido, editandoId);
  if (erro) { $('cad-erro').textContent = erro; $('cad-apelido').focus(); return; }
  const dados = { apelido, numero: $('cad-numero').value, cor: corEscolhida, favorito: $('cad-favorito').value };
  if (editandoId) { jog.editarJogador(editandoId, dados); jog.escolherJogador(editandoId); }
  else jog.criarJogador(dados);
  aoTrocarJogador();
});
$('cad-lista').addEventListener('click', e => {
  const editar = e.target.closest('[data-editar]');
  if (editar) { abrirFormCadastro(editar.dataset.editar); return; }
  if (e.target.closest('[data-novo]')) { abrirFormCadastro(null); return; }
  const escolher = e.target.closest('[data-escolher]');
  if (escolher) { jog.escolherJogador(escolher.dataset.escolher); aoTrocarJogador(); }
});
$('cad-lista').addEventListener('keydown', e => {
  const c = e.target.closest('[data-escolher]');
  if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); jog.escolherJogador(c.dataset.escolher); aoTrocarJogador(); }
});

function aoTrocarJogador() {
  const j = jog.jogadorAtual();
  atualizarChipJogador();
  atualizarContadorEstrelas();
  campanha = null;
  mostrar('menu');
  if (j) som.narrar(`Bem-vindo, ${j.apelido}!`);
}

// ------------------------------------------------------------ ranking de jogadores
let criterioRanking = 'pontos';
function abrirRanking() {
  desenharRanking();
  mostrar('ranking');
}
function desenharRanking() {
  document.querySelectorAll('#abas-ranking button').forEach(b => b.classList.toggle('ativo', b.dataset.criterio === criterioRanking));
  const lista = jog.ranking(criterioRanking);
  const atualId = jog.idJogadorAtual();
  const medalha = i => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`);
  const col = c => (c === criterioRanking ? 'destaque' : '');
  $('tabela-ranking').innerHTML = lista.length
    ? `<tr><th></th><th style="text-align:left">Jogador</th><th>Pontos</th><th>Jogos</th><th>Vitórias</th><th>Gols</th><th>Títulos</th><th>★</th></tr>` +
      lista.map((j, i) => `<tr class="${j.id === atualId ? 'atual' : ''}">
        <td class="pos">${medalha(i)}</td>
        <td class="nome"><div>${avatarHTML(j)}<span>${j.apelido}</span></div></td>
        <td class="${col('pontos')}">${j.stats.pontos}</td>
        <td>${j.stats.jogos}</td>
        <td class="${col('vitorias')}">${j.stats.vitorias}</td>
        <td class="${col('golsPro')}">${j.stats.golsPro}</td>
        <td class="${col('titulos')}">${j.stats.titulos}</td>
        <td>${j.stats.estrelas}</td></tr>`).join('')
    : '';
  const P = jog.PONTOS;
  $('legenda-ranking').textContent = lista.length
    ? `Vitória ${P.vitoria} · empate ${P.empate} · gol ${P.gol} · estrela ${P.estrela} · título ${P.titulo} · vitória nos pênaltis ${P.vitoriaPenaltis}. No Titular os pontos valem 1,5×; no Penta, 2×.`
    : 'Cadastre jogadores e jogue para aparecer no ranking.';
}
$('abas-ranking').addEventListener('click', e => {
  const b = e.target.closest('[data-criterio]');
  if (b) { criterioRanking = b.dataset.criterio; desenharRanking(); }
});

// ------------------------------------------------------------ álbum
let aoVoltarDoAlbum = null;
function abrirAlbum(aoVoltar = null) {
  aoVoltarDoAlbum = aoVoltar;
  const perfil = camp.carregarPerfil();
  const todas = camp.TODAS_FIGURINHAS();
  $('progresso-album').textContent = `· ${perfil.figurinhas.length}/${todas.length} figurinhas · ★ ${perfil.estrelas}`;
  $('grade-album').innerHTML = todas.map(f => perfil.figurinhas.includes(f.id)
    ? figurinhaHTML(f, ultimasNovas.has(f.id), ultimasNovas.has(f.id) ? 'NOVA!' : '')
    : `<div class="figurinha vazia"><div class="geral">?</div><div class="camisa"></div><div><div class="nome">${f.num ? 'Nº ' + f.num : 'Técnico'}</div><div class="pos">${f.pos}</div></div></div>`).join('');
  const nomes = [['mirim', 'bronze', 'Craque Mirim'], ['titular', 'prata', 'Titular'], ['penta', 'ouro', 'Penta']];
  $('trofeus').innerHTML = nomes.map(([k, cls, n]) => `<div class="trofeu ${cls} ${perfil.trofeus[k] ? 'ganho' : ''}"><div class="copa"></div>Hexa no ${n}</div>`).join('');
  mostrar('album');
  const primeiraNova = document.querySelector('#grade-album .selo.novo');
  if (primeiraNova) primeiraNova.closest('.figurinha').scrollIntoView({ block: 'center', behavior: 'smooth' });
  ultimasNovas = new Set();
}

function voltarDoAlbum() {
  const f = aoVoltarDoAlbum;
  aoVoltarDoAlbum = null;
  if (f) f(); else mostrar('menu');
}

function verReplay() {
  if (!jogo || typeof jogo.iniciarReplay !== 'function') return;
  jogo.pausado = false;
  sobrepor('pausa', false);
  jogo.iniciarReplay();
}
$('bt-replay').addEventListener('click', verReplay);

// ------------------------------------------------------------ pausa
function pausar(ligado) {
  if (!jogo) return;
  jogo.pausado = ligado;
  sobrepor('pausa', ligado);
}
$('bt-pausa').addEventListener('click', () => pausar(true));
window.addEventListener('keydown', e => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && jogo && telaAtual === 'hud') pausar(!jogo.pausado);
  if (e.code === 'KeyR' && jogo && telaAtual === 'hud' && !jogo.pausado) verReplay();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && jogo && !jogo.terminou) pausar(true); });

// ------------------------------------------------------------ cliques dos botões
document.body.addEventListener('click', e => {
  som.destravarAudio();
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const acao = b.dataset.acao;
  switch (acao) {
    case 'campanha': abrirCampanha(); break;
    case 'amistoso': abrirEscolha('amistoso'); break;
    case 'penaltis': abrirEscolha('penaltis'); break;
    case 'treino': jogarTreino(); break;
    case 'album': abrirAlbum(); break;
    case 'voltar-album': voltarDoAlbum(); break;
    case 'replay': verReplay(); break;
    case 'trocar-jogador': abrirCadastro(); break;
    case 'cad-voltar': mostrar('menu'); break;
    case 'cad-cancelar': abrirCadastro(); break;
    case 'cad-apagar':
      if (b.dataset.confirmar === 'sim') {
        jog.apagarJogador(editandoId);
        atualizarChipJogador();
        abrirCadastro();
      } else {
        b.dataset.confirmar = 'sim';
        b.textContent = 'Toque de novo para apagar';
      }
      break;
    case 'ranking': abrirRanking(); break;
    case 'voltar-ranking': mostrar('menu'); break;
    case 'substituicoes': abrirSubstituicoes(); break;
    case 'fechar-sub': sobrepor('substituicoes', false); sobrepor('pausa', true); break;
    case 'sub-voltar-jogo': sobrepor('substituicoes', false); pausar(false); break;
    case 'artilharia': abrirArtilharia('copa'); break;
    case 'artilharia-campanha': abrirArtilharia('copa', () => mostrar('campanha')); break;
    case 'voltar-artilharia': voltarDaArtilharia(); break;
    case 'ajuda': mostrar('ajuda'); break;
    case 'voltar': mostrar(voltarPara); break;
    case 'som': som.alternarMudo(); atualizarBotoesSom(); break;
    case 'continuar': pausar(false); break;
    case 'sair': voltarAoMenu(); break;
    case 'menu': voltarAoMenu(); break;
    case 'jogar-campanha': jogarCampanha(); break;
    case 'reiniciar-campanha':
      // confirmação dentro do jogo: o primeiro toque pergunta, o segundo confirma
      if (b.dataset.confirmar === 'sim') {
        clearTimeout(b._timer);
        b.dataset.confirmar = '';
        b.textContent = 'Começar de novo';
        campanha = camp.novaCampanha(pref.dificuldade);
        desenharCampanha();
      } else {
        b.dataset.confirmar = 'sim';
        b.textContent = 'Toque de novo para apagar o progresso';
        b._timer = setTimeout(() => { b.dataset.confirmar = ''; b.textContent = 'Começar de novo'; }, 3500);
      }
      break;
  }
});
window.addEventListener('pointerdown', () => som.destravarAudio(), { once: true });
window.addEventListener('keydown', () => som.destravarAudio(), { once: true });

// ------------------------------------------------------------ loop principal
iniciarControles();
montarCena(false);
atualizarChipJogador();
if (!jog.jogadorAtual()) abrirCadastro();
const relogio = new THREE.Clock();
let anguloMenu = 0;

function quadro() {
  requestAnimationFrame(quadro);
  const dt = Math.min(relogio.getDelta(), 0.1);
  atualizarControles(dt);
  if (torcida) torcida.atualizar(dt);
  if (jogo) {
    jogo.atualizar(dt);
  } else {
    // câmera passeando pelo estádio atrás do menu
    anguloMenu += dt * 0.06;
    camera.position.set(Math.sin(anguloMenu) * 62, 20 + Math.sin(anguloMenu * 0.7) * 4, Math.cos(anguloMenu) * 48);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(cena, camera);
}
quadro();

// para depurar no console do navegador
window.rumo = { get jogo() { return jogo; }, entrada };
