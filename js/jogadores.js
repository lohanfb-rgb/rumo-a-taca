// =============================================================
//  JOGADORES CADASTRADOS E RANKING
//  Cada pessoa que joga neste aparelho tem um cadastro (apelido, camisa,
//  cor e craque favorito) com o próprio progresso e as próprias estatísticas.
//  Não guardamos e-mail, senha nem idade: tudo fica só neste aparelho.
// =============================================================

const CHAVE_LISTA = 'rumoATaca.jogadores';
const CHAVE_ATUAL = 'rumoATaca.jogadorAtual';

export const CORES_AVATAR = ['#ffd400', '#0a9b3c', '#1646b8', '#d83a3a', '#7a3cb8', '#ff8a1f', '#14a3a3', '#e05aa0'];

// Pontos do ranking
export const PONTOS = { vitoria: 30, empate: 10, gol: 5, estrela: 10, titulo: 200, vitoriaPenaltis: 15 };
const MULT_DIFICULDADE = { mirim: 1, titular: 1.5, penta: 2 };

function ler(chave, padrao) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem salvar, tudo bem */ }
}

export function listarJogadores() { return ler(CHAVE_LISTA, []); }
function salvarLista(lista) { gravar(CHAVE_LISTA, lista); }

export function idJogadorAtual() {
  try { return localStorage.getItem(CHAVE_ATUAL) || null; } catch (e) { return null; }
}

export function jogadorAtual() {
  const id = idJogadorAtual();
  return listarJogadores().find(j => j.id === id) || null;
}

export function escolherJogador(id) {
  try { localStorage.setItem(CHAVE_ATUAL, id); } catch (e) { /* ok */ }
}

function statsVazias() {
  return { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, titulos: 0, estrelas: 0, pontos: 0, penaltisVencidos: 0 };
}

// Valida o apelido e devolve uma mensagem de erro, ou null se estiver tudo certo
export function validarApelido(apelido, idIgnorar = null) {
  const a = (apelido || '').trim();
  if (a.length < 2) return 'O apelido precisa ter pelo menos 2 letras.';
  if (a.length > 14) return 'O apelido pode ter no máximo 14 letras.';
  if (!/^[\p{L}\p{N} ._-]+$/u.test(a)) return 'Use só letras, números, espaço, ponto ou traço.';
  if (listarJogadores().some(j => j.id !== idIgnorar && j.apelido.toLowerCase() === a.toLowerCase())) return 'Já existe um jogador com esse apelido.';
  return null;
}

export function criarJogador({ apelido, numero, cor, favorito }) {
  const lista = listarJogadores();
  const id = 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const novo = {
    id, apelido: apelido.trim(), numero: Math.max(1, Math.min(99, Number(numero) || 10)),
    cor: cor || CORES_AVATAR[0], favorito: favorito || 'Neymar', criadoEm: new Date().toISOString(), stats: statsVazias(),
  };
  lista.push(novo);
  salvarLista(lista);
  // o primeiro cadastro herda o progresso que já existia antes dos cadastros
  if (lista.length === 1) migrarProgressoAntigo(id);
  escolherJogador(id);
  return novo;
}

export function editarJogador(id, dados) {
  const lista = listarJogadores();
  const j = lista.find(x => x.id === id);
  if (!j) return;
  Object.assign(j, {
    apelido: dados.apelido.trim(),
    numero: Math.max(1, Math.min(99, Number(dados.numero) || j.numero)),
    cor: dados.cor || j.cor,
    favorito: dados.favorito || j.favorito,
  });
  salvarLista(lista);
}

export function apagarJogador(id) {
  salvarLista(listarJogadores().filter(j => j.id !== id));
  try {
    localStorage.removeItem('rumoATaca.perfil.' + id);
    localStorage.removeItem('rumoATaca.campanha.' + id);
    if (idJogadorAtual() === id) localStorage.removeItem(CHAVE_ATUAL);
  } catch (e) { /* ok */ }
}

function migrarProgressoAntigo(id) {
  try {
    for (const base of ['rumoATaca.perfil', 'rumoATaca.campanha']) {
      const v = localStorage.getItem(base);
      if (v && !localStorage.getItem(base + '.' + id)) {
        localStorage.setItem(base + '.' + id, v);
        localStorage.removeItem(base);
      }
    }
  } catch (e) { /* ok */ }
}

// Registra o resultado de um jogo do jogador atual e devolve quantos pontos ele ganhou
// modo: 'amistoso' | 'campanha' | 'penaltis'
export function registrarResultado({ modo, golsPro = 0, golsContra = 0, venceu = false, empate = false, estrelas = 0, dificuldade = 'mirim', titulo = false }) {
  const lista = listarJogadores();
  const j = lista.find(x => x.id === idJogadorAtual());
  if (!j) return 0;
  const s = j.stats = { ...statsVazias(), ...j.stats };
  let pontos = 0;
  if (modo === 'penaltis') {
    if (venceu) { s.penaltisVencidos++; pontos += PONTOS.vitoriaPenaltis; }
  } else {
    s.jogos++;
    s.golsPro += golsPro;
    s.golsContra += golsContra;
    if (venceu) { s.vitorias++; pontos += PONTOS.vitoria; }
    else if (empate) { s.empates++; pontos += PONTOS.empate; }
    else s.derrotas++;
    pontos += golsPro * PONTOS.gol;
  }
  s.estrelas += estrelas;
  pontos += estrelas * PONTOS.estrela;
  if (titulo) { s.titulos++; pontos += PONTOS.titulo; }
  pontos = Math.round(pontos * (MULT_DIFICULDADE[dificuldade] || 1));
  s.pontos += pontos;
  salvarLista(lista);
  return pontos;
}

// criterio: 'pontos' | 'golsPro' | 'titulos' | 'vitorias'
export function ranking(criterio = 'pontos') {
  return listarJogadores()
    .map(j => ({ ...j, stats: { ...statsVazias(), ...j.stats } }))
    .sort((a, b) => b.stats[criterio] - a.stats[criterio] || b.stats.pontos - a.stats.pontos || a.apelido.localeCompare(b.apelido));
}
