// =============================================================
//  CAMPANHA RUMO À TAÇA + PERFIL (estrelas, figurinhas, troféus)
//  Tudo fica salvo só neste aparelho (localStorage).
// =============================================================
import { ADVERSARIOS, SELECAO, elencoAdversario, sortearAutor } from './dados.js';

const CHAVE_CAMPANHA = 'rumoATaca.campanha';
const CHAVE_PERFIL = 'rumoATaca.perfil';

export const FASES = ['Grupo · Jogo 1', 'Grupo · Jogo 2', 'Grupo · Jogo 3', '16 avos de final', 'Oitavas de final', 'Quartas de final', 'Semifinal', 'FINAL'];

function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem salvar, tudo bem */ }
}

// ------------------------------------------------------------ perfil
export function carregarPerfil() {
  return ler(CHAVE_PERFIL, { estrelas: 0, estrelasGastas: 0, figurinhas: [], trofeus: {} });
}
export function salvarPerfil(p) { gravar(CHAVE_PERFIL, p); }

export function calcularEstrelas(golsPro, golsContra, venceu) {
  let e = 0;
  if (venceu) e++;
  if (golsPro >= 3) e++;
  if (golsContra === 0) e++;
  return e;
}

// Cada 5 estrelas = 1 pacote com 3 figurinhas
export function adicionarEstrelas(perfil, qtd) {
  perfil.estrelas += qtd;
  const pacotes = [];
  while (perfil.estrelas - perfil.estrelasGastas >= 5) {
    perfil.estrelasGastas += 5;
    const pacote = [];
    for (let i = 0; i < 3; i++) {
      const todas = TODAS_FIGURINHAS();
      const faltando = todas.filter(f => !perfil.figurinhas.includes(f.id));
      const fonte = faltando.length && Math.random() < 0.7 ? faltando : todas;
      const f = fonte[(Math.random() * fonte.length) | 0];
      const nova = !perfil.figurinhas.includes(f.id);
      pacote.push({ ...f, nova });
      if (nova) perfil.figurinhas.push(f.id);
    }
    pacotes.push(pacote);
  }
  salvarPerfil(perfil);
  return pacotes;
}

export function TODAS_FIGURINHAS() {
  const lista = SELECAO.jogadores.map(j => {
    const geral = j.pos === 'GOL'
      ? Math.round((j.def * 2 + j.fis + j.pas) / 4)
      : Math.round((j.vel + j.chu + j.pas + j.dri + j.def + j.fis) / 6 + 6);
    return { id: 'j' + j.num, num: j.num, nome: j.nome, pos: j.pos, geral: Math.min(geral, 99) };
  });
  lista.push({ id: 'tec', num: 0, nome: SELECAO.tecnico, pos: 'TÉC', geral: 99 });
  return lista;
}

// ------------------------------------------------------------ campanha
export function carregarCampanha() { return ler(CHAVE_CAMPANHA, null); }
export function apagarCampanha() { try { localStorage.removeItem(CHAVE_CAMPANHA); } catch (e) { /* ok */ } }

export function novaCampanha(dificuldade) {
  const embaralhar = a => [...a].sort(() => Math.random() - 0.5);
  const fortes = embaralhar(ADVERSARIOS.filter(a => a.forca >= 84));
  const medios = embaralhar(ADVERSARIOS.filter(a => a.forca >= 76 && a.forca < 84));
  const fracos = embaralhar(ADVERSARIOS.filter(a => a.forca < 76));
  const grupo = [fracos[0], medios[0], fortes[0]].map(a => a.sigla);
  // adversários do mata-mata: cada vez mais fortes, sem repetir o grupo
  const usados = new Set(grupo);
  const pegar = (min, max) => {
    const op = embaralhar(ADVERSARIOS.filter(a => a.forca >= min && a.forca <= max && !usados.has(a.sigla)));
    const a = op[0] || embaralhar(ADVERSARIOS.filter(x => !usados.has(x.sigla)))[0];
    usados.add(a.sigla);
    return a.sigla;
  };
  const final = pegar(90, 99);
  const mata = [pegar(70, 79), pegar(77, 83), pegar(81, 87), pegar(84, 89), final];
  const c = {
    dificuldade,
    fase: 0,
    grupo: ['BRA', ...grupo],
    tabela: Object.fromEntries(['BRA', ...grupo].map(s => [s, { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }])),
    adversarios: [...grupo, ...mata],
    resultados: [],
    artilharia: {},
    eliminado: false,
    campeao: false,
  };
  gravar(CHAVE_CAMPANHA, c);
  return c;
}

export function salvarCampanha(c) { gravar(CHAVE_CAMPANHA, c); }

export function adversarioDaFase(c) {
  return ADVERSARIOS.find(a => a.sigla === c.adversarios[c.fase]);
}

function registrar(tab, a, b, ga, gb) {
  const A = tab[a], B = tab[b];
  A.j++; B.j++;
  A.gp += ga; A.gc += gb; B.gp += gb; B.gc += ga;
  if (ga > gb) { A.v++; B.d++; A.pts += 3; }
  else if (ga < gb) { B.v++; A.d++; B.pts += 3; }
  else { A.e++; B.e++; A.pts++; B.pts++; }
}

function simularPlacar(forcaA, forcaB) {
  const gols = f => {
    let g = 0;
    const chance = 0.18 + (f - 70) / 100;
    for (let i = 0; i < 6; i++) if (Math.random() < chance) g++;
    return g;
  };
  return [gols(forcaA - (forcaB - 80) * 0.5), gols(forcaB - (forcaA - 80) * 0.5)];
}

export function classificacao(c) {
  return Object.entries(c.tabela)
    .map(([sigla, t]) => ({ sigla, ...t, sg: t.gp - t.gc }))
    .sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp);
}

// ------------------------------------------------------------ artilharia
function somarGol(c, nome, sigla) {
  const k = sigla + '|' + nome;
  if (!c.artilharia[k]) c.artilharia[k] = { nome, sigla, gols: 0 };
  c.artilharia[k].gols++;
}

// gols de um jogo simulado: sorteia os autores no elenco de cada seleção
function golsSimulados(c, sigla, qtd) {
  const adv = ADVERSARIOS.find(a => a.sigla === sigla);
  if (!adv) return;
  const elenco = elencoAdversario(adv);
  for (let i = 0; i < qtd; i++) somarGol(c, sortearAutor(elenco).nome, sigla);
}

// outros jogos da Copa acontecendo ao mesmo tempo (para a artilharia ficar disputada)
function simularOutrosJogos(c, quantos) {
  const disponiveis = ADVERSARIOS.filter(a => !c.grupo.includes(a.sigla));
  for (let i = 0; i < quantos; i++) {
    const embaralhados = [...disponiveis].sort(() => Math.random() - 0.5);
    const [a, b] = embaralhados;
    const [x, y] = simularPlacar(a.forca, b.forca);
    golsSimulados(c, a.sigla, x);
    golsSimulados(c, b.sigla, y);
  }
}

export function rankingArtilharia(c, limite = 10) {
  return Object.values(c.artilharia || {}).sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome)).slice(0, limite);
}

// Artilheiros do Brasil em todos os jogos (amistosos e campanhas), salvo no perfil
export function registrarArtilheirosPerfil(marcadores) {
  const perfil = carregarPerfil();
  perfil.artilheiros = perfil.artilheiros || {};
  for (const m of marcadores || []) {
    if (m.time !== 0 || m.contra) continue;
    perfil.artilheiros[m.nome] = (perfil.artilheiros[m.nome] || 0) + 1;
  }
  salvarPerfil(perfil);
}

export function rankingHistorico(limite = 15) {
  const perfil = carregarPerfil();
  return Object.entries(perfil.artilheiros || {}).map(([nome, gols]) => ({ nome, sigla: 'BRA', gols }))
    .sort((a, b) => b.gols - a.gols).slice(0, limite);
}

// Guarda a artilharia da última Copa terminada
export function guardarUltimaCopa(c, campeao) {
  const perfil = carregarPerfil();
  perfil.ultimaCopa = { ranking: rankingArtilharia(c, 15), campeao, dificuldade: c.dificuldade };
  salvarPerfil(perfil);
}

// Registra o jogo do Brasil e devolve o que aconteceu
export function registrarJogo(c, golsBR, golsAdv, venceuPenaltis = null, marcadores = []) {
  const adv = c.adversarios[c.fase];
  if (!c.artilharia) c.artilharia = {};
  for (const m of marcadores) {
    if (m.contra) continue;
    somarGol(c, m.nome, m.time === 0 ? 'BRA' : adv);
  }
  simularOutrosJogos(c, c.fase < 3 ? 4 : 2);
  c.resultados.push({ fase: c.fase, adv, golsBR, golsAdv, penaltis: venceuPenaltis });
  if (c.fase < 3) {
    registrar(c.tabela, 'BRA', adv, golsBR, golsAdv);
    // o outro jogo da rodada do grupo
    const outros = c.grupo.filter(s => s !== 'BRA' && s !== adv);
    const fa = ADVERSARIOS.find(a => a.sigla === outros[0]).forca;
    const fb = ADVERSARIOS.find(a => a.sigla === outros[1]).forca;
    const [x, y] = simularPlacar(fa, fb);
    registrar(c.tabela, outros[0], outros[1], x, y);
    golsSimulados(c, outros[0], x);
    golsSimulados(c, outros[1], y);
    c.fase++;
    if (c.fase === 3) {
      const cl = classificacao(c);
      const pos = cl.findIndex(l => l.sigla === 'BRA');
      const terceiroBom = pos === 2 && cl[2].pts >= 4;
      if (pos > 1 && !terceiroBom) c.eliminado = true;
      c.posicaoGrupo = pos + 1;
    }
  } else {
    const venceu = golsBR > golsAdv || venceuPenaltis === true;
    if (venceu) {
      c.fase++;
      if (c.fase >= FASES.length) c.campeao = true;
    } else {
      c.perdeuMataMata = true; // pode tentar o mesmo jogo de novo
    }
  }
  salvarCampanha(c);
  return c;
}

export function tentarDeNovo(c) {
  if (c.eliminado) return novaCampanha(c.dificuldade);
  c.perdeuMataMata = false;
  salvarCampanha(c);
  return c;
}
