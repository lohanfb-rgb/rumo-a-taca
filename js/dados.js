// =============================================================
//  DADOS DO JOGO
//  Aqui ficam os 26 convocados, os adversários e a formação.
//  Nomes parecidos com os da Seleção de verdade; o Neymar tem o nome real.
//  ATENÇÃO: antes de publicar na App Store, troque os nomes por inventados
//  (nome e imagem de jogador real precisam de licença).
// =============================================================

// Visual de cada jogador: pele (0 = mais clara ... 5 = mais escura), cabelo, cor do cabelo e barba
const PRETO = 0x15100c, CASTANHO = 0x3b2314, CLARO = 0x6b4a2a;
const v = (pele, cabelo, corCabelo = PRETO, barba = false) => ({ pele, cabelo, corCabelo, barba });

// Atributos de 0 a 99: vel = Velocidade, chu = Chute, pas = Passe,
// dri = Drible, def = Defesa, fis = Físico
export const SELECAO = {
  nome: 'Brasil',
  sigla: 'BRA',
  tecnico: 'Professor Ancelote',
  kit: { camisa: 0xffd400, detalhe: 0x0a9b3c, calcao: 0x1646b8, meiao: 0xffffff },
  kitGoleiro: { camisa: 0x222222, detalhe: 0x0a9b3c, calcao: 0x222222, meiao: 0x222222 },
  jogadores: [
    { num: 1, nome: 'Alisão', pos: 'GOL', vel: 62, chu: 45, pas: 78, dri: 42, def: 90, fis: 84, visual: v(1, 'curto', CASTANHO, true) },
    { num: 23, nome: 'Ederso', pos: 'GOL', vel: 60, chu: 50, pas: 88, dri: 45, def: 87, fis: 83, visual: v(1, 'raspado', CASTANHO, true) },
    { num: 12, nome: 'Bentão', pos: 'GOL', vel: 58, chu: 40, pas: 66, dri: 38, def: 82, fis: 80, visual: v(2, 'curto') },

    { num: 4, nome: 'Marquinho', pos: 'ZAG', vel: 78, chu: 58, pas: 80, dri: 66, def: 89, fis: 80, visual: v(2, 'curto', PRETO, true) },
    { num: 3, nome: 'Gabriel Magalhão', pos: 'ZAG', vel: 74, chu: 60, pas: 72, dri: 58, def: 88, fis: 90, visual: v(3, 'curto', PRETO, true) },
    { num: 14, nome: 'Militinho', pos: 'ZAG', vel: 80, chu: 56, pas: 70, dri: 60, def: 87, fis: 86, visual: v(3, 'curto') },
    { num: 15, nome: 'Bremão', pos: 'ZAG', vel: 76, chu: 48, pas: 64, dri: 52, def: 87, fis: 89, visual: v(3, 'raspado', PRETO, true) },

    { num: 2, nome: 'Vandersom', pos: 'LAT', vel: 87, chu: 62, pas: 76, dri: 78, def: 78, fis: 76, visual: v(4, 'curto') },
    { num: 6, nome: 'Wesly', pos: 'LAT', vel: 89, chu: 60, pas: 74, dri: 80, def: 75, fis: 74, visual: v(4, 'cacheado') },
    { num: 13, nome: 'Danilão', pos: 'LAT', vel: 74, chu: 64, pas: 80, dri: 72, def: 82, fis: 78, visual: v(3, 'raspado', PRETO, true) },
    { num: 16, nome: 'Alex Sandrão', pos: 'LAT', vel: 76, chu: 62, pas: 80, dri: 74, def: 79, fis: 77, visual: v(4, 'careca', PRETO, true) },

    { num: 5, nome: 'Casemirão', pos: 'VOL', vel: 66, chu: 74, pas: 84, dri: 72, def: 88, fis: 87, visual: v(2, 'curto', PRETO, true) },
    { num: 17, nome: 'Andrézinho', pos: 'VOL', vel: 72, chu: 64, pas: 82, dri: 76, def: 82, fis: 78, visual: v(4, 'curto') },
    { num: 18, nome: 'Andrey Santo', pos: 'VOL', vel: 74, chu: 68, pas: 80, dri: 75, def: 80, fis: 79, visual: v(3, 'curto') },

    { num: 8, nome: 'Bruno Guimarão', pos: 'MEI', vel: 72, chu: 78, pas: 89, dri: 84, def: 78, fis: 80, visual: v(1, 'cacheado', CASTANHO, true) },
    { num: 10, nome: 'Neymar', pos: 'MEI', vel: 86, chu: 88, pas: 92, dri: 96, def: 35, fis: 62, visual: v(2, 'moicano', CLARO, true) },
    { num: 19, nome: 'Paquetinha', pos: 'MEI', vel: 76, chu: 80, pas: 85, dri: 86, def: 66, fis: 75, visual: v(3, 'moicano', PRETO, true) },
    { num: 20, nome: 'Gersão', pos: 'MEI', vel: 74, chu: 76, pas: 85, dri: 82, def: 70, fis: 77, visual: v(3, 'curto', PRETO, true) },
    { num: 21, nome: 'Joelintom', pos: 'MEI', vel: 76, chu: 74, pas: 78, dri: 78, def: 74, fis: 86, visual: v(3, 'curto', PRETO, true) },

    { num: 7, nome: 'Vinny Jr.', pos: 'PON', vel: 96, chu: 85, pas: 82, dri: 94, def: 30, fis: 70, visual: v(4, 'cacheado') },
    { num: 11, nome: 'Rafinho', pos: 'PON', vel: 90, chu: 87, pas: 85, dri: 88, def: 40, fis: 68, visual: v(2, 'comprido', CASTANHO, true) },
    { num: 22, nome: 'Rodrygão', pos: 'PON', vel: 90, chu: 84, pas: 82, dri: 89, def: 32, fis: 64, visual: v(4, 'curto') },
    { num: 25, nome: 'Estevinho', pos: 'PON', vel: 89, chu: 82, pas: 80, dri: 90, def: 30, fis: 60, visual: v(3, 'cacheado') },

    { num: 9, nome: 'Matheus Cunho', pos: 'ATA', vel: 84, chu: 87, pas: 80, dri: 86, def: 40, fis: 80, visual: v(2, 'cacheado', PRETO, true) },
    { num: 24, nome: 'Endriquinho', pos: 'ATA', vel: 86, chu: 85, pas: 72, dri: 82, def: 32, fis: 80, visual: v(4, 'curto') },
    { num: 26, nome: 'Richarlisão', pos: 'ATA', vel: 82, chu: 84, pas: 72, dri: 78, def: 42, fis: 84, visual: v(4, 'raspado', PRETO, true) },
  ],
  // Os 11 titulares no 4-3-3 (números das camisas, na ordem da FORMACAO):
  // goleiro, lateral direito, zagueiros, lateral esquerdo, volante, meias, ponta direita, centroavante, ponta esquerda
  titulares: [1, 2, 4, 3, 6, 5, 8, 10, 11, 9, 7],
};
// Formação 4-3-3 para um time que ataca para a direita (+x).
// x vai de -52 (nosso gol) até +52 (gol adversário); z vai de -34 a +34.
export const FORMACAO = [
  { x: -49, z: 0, papel: 'GOL' },
  { x: -34, z: 22, papel: 'LAT' },
  { x: -37, z: 8, papel: 'ZAG' },
  { x: -37, z: -8, papel: 'ZAG' },
  { x: -34, z: -22, papel: 'LAT' },
  { x: -22, z: 0, papel: 'VOL' },
  { x: -10, z: 13, papel: 'MEI' },
  { x: -10, z: -13, papel: 'MEI' },
  { x: 6, z: 21, papel: 'PON' },
  { x: 9, z: 0, papel: 'ATA' },
  { x: 6, z: -21, papel: 'PON' },
];

// Seleções adversárias (jogadores inventados). forca vai de 60 a 92.
export const ADVERSARIOS = [
  { nome: 'Argentina', sigla: 'ARG', forca: 90, kit: { camisa: 0x8fd0ff, detalhe: 0xffffff, calcao: 0x101a3a, meiao: 0x101a3a }, bandeira: ['#74acdf', '#ffffff', '#74acdf'] },
  { nome: 'França', sigla: 'FRA', forca: 90, kit: { camisa: 0x1c2b6b, detalhe: 0xffffff, calcao: 0xffffff, meiao: 0xd0202c }, bandeira: ['#0055a4', '#ffffff', '#ef4135'], vertical: true },
  { nome: 'Inglaterra', sigla: 'ING', forca: 87, kit: { camisa: 0xffffff, detalhe: 0xcc1f2f, calcao: 0x1a2550, meiao: 0xffffff }, bandeira: ['#ffffff', '#cf142b', '#ffffff'] },
  { nome: 'Espanha', sigla: 'ESP', forca: 88, kit: { camisa: 0xc8102e, detalhe: 0xffd200, calcao: 0x1a2550, meiao: 0x1a2550 }, bandeira: ['#aa151b', '#f1bf00', '#aa151b'] },
  { nome: 'Alemanha', sigla: 'ALE', forca: 86, kit: { camisa: 0xffffff, detalhe: 0x111111, calcao: 0x111111, meiao: 0xffffff }, bandeira: ['#000000', '#dd0000', '#ffce00'] },
  { nome: 'Portugal', sigla: 'POR', forca: 86, kit: { camisa: 0xa50d1f, detalhe: 0x0b6b2f, calcao: 0x0b6b2f, meiao: 0xa50d1f }, bandeira: ['#006600', '#ff0000', '#ff0000'], vertical: true },
  { nome: 'Holanda', sigla: 'HOL', forca: 84, kit: { camisa: 0xff6a00, detalhe: 0xffffff, calcao: 0xff6a00, meiao: 0xff6a00 }, bandeira: ['#ae1c28', '#ffffff', '#21468b'] },
  { nome: 'Uruguai', sigla: 'URU', forca: 82, kit: { camisa: 0x5cb8f0, detalhe: 0xffffff, calcao: 0x111111, meiao: 0x111111 }, bandeira: ['#ffffff', '#0038a8', '#ffffff'] },
  { nome: 'Itália', sigla: 'ITA', forca: 83, kit: { camisa: 0x1550b8, detalhe: 0xffffff, calcao: 0xffffff, meiao: 0x1550b8 }, bandeira: ['#009246', '#ffffff', '#ce2b37'], vertical: true },
  { nome: 'Croácia', sigla: 'CRO', forca: 81, kit: { camisa: 0xffffff, detalhe: 0xd8102b, calcao: 0xffffff, meiao: 0x1a2a8a }, bandeira: ['#ff0000', '#ffffff', '#171796'] },
  { nome: 'Marrocos', sigla: 'MAR', forca: 80, kit: { camisa: 0xc1272d, detalhe: 0x006233, calcao: 0x006233, meiao: 0xc1272d }, bandeira: ['#c1272d', '#c1272d', '#c1272d'] },
  { nome: 'Japão', sigla: 'JAP', forca: 79, kit: { camisa: 0x0b1f6b, detalhe: 0xffffff, calcao: 0x0b1f6b, meiao: 0x0b1f6b }, bandeira: ['#ffffff', '#ffffff', '#ffffff'], bola: '#bc002d' },
  { nome: 'México', sigla: 'MEX', forca: 78, kit: { camisa: 0x006847, detalhe: 0xce1126, calcao: 0xffffff, meiao: 0xce1126 }, bandeira: ['#006847', '#ffffff', '#ce1126'], vertical: true },
  { nome: 'Estados Unidos', sigla: 'EUA', forca: 77, kit: { camisa: 0xffffff, detalhe: 0x0a3161, calcao: 0x0a3161, meiao: 0xffffff }, bandeira: ['#b31942', '#ffffff', '#0a3161'] },
  { nome: 'Senegal', sigla: 'SEN', forca: 78, kit: { camisa: 0xffffff, detalhe: 0x00853f, calcao: 0xffffff, meiao: 0xffffff }, bandeira: ['#00853f', '#fdef42', '#e31b23'], vertical: true },
  { nome: 'Coreia do Sul', sigla: 'COR', forca: 75, kit: { camisa: 0xd8102b, detalhe: 0x111111, calcao: 0x111111, meiao: 0xd8102b }, bandeira: ['#ffffff', '#ffffff', '#ffffff'], bola: '#cd2e3a' },
  { nome: 'Suíça', sigla: 'SUI', forca: 76, kit: { camisa: 0xd52b1e, detalhe: 0xffffff, calcao: 0xffffff, meiao: 0xd52b1e }, bandeira: ['#d52b1e', '#d52b1e', '#d52b1e'] },
  { nome: 'Austrália', sigla: 'AUS', forca: 72, kit: { camisa: 0x00843d, detalhe: 0xffcd00, calcao: 0x00843d, meiao: 0x00843d }, bandeira: ['#012169', '#012169', '#012169'] },
  { nome: 'Canadá', sigla: 'CAN', forca: 72, kit: { camisa: 0xd52b1e, detalhe: 0xffffff, calcao: 0xd52b1e, meiao: 0xd52b1e }, bandeira: ['#d52b1e', '#ffffff', '#d52b1e'], vertical: true },
  { nome: 'Gana', sigla: 'GAN', forca: 71, kit: { camisa: 0xffffff, detalhe: 0x111111, calcao: 0xffffff, meiao: 0xffffff }, bandeira: ['#ce1126', '#fcd116', '#006b3f'] },
  { nome: 'Egito', sigla: 'EGI', forca: 70, kit: { camisa: 0xce1126, detalhe: 0xffffff, calcao: 0xffffff, meiao: 0x111111 }, bandeira: ['#ce1126', '#ffffff', '#000000'] },
  { nome: 'Nova Zelândia', sigla: 'NZL', forca: 62, kit: { camisa: 0xffffff, detalhe: 0x111111, calcao: 0x111111, meiao: 0xffffff }, bandeira: ['#00247d', '#00247d', '#00247d'] },
];

// Nomes inventados para os jogadores adversários, por região
const NOMES = {
  hispano: ['Martínez', 'González', 'Fernández', 'López', 'Romero', 'Álvarez', 'Torres', 'Ruiz', 'Molina', 'Herrera', 'Castro', 'Rojas', 'Navarro', 'Ortiz', 'Vargas', 'Medina', 'Paredes', 'Acosta', 'Ramos', 'Morales', 'Peralta', 'Cabrera'],
  europeu: ['Dubois', 'Laurent', 'Moreau', 'Walker', 'Taylor', 'Müller', 'Schmidt', 'Weber', 'De Vries', 'Bakker', 'Rossi', 'Bianchi', 'Conti', 'Novak', 'Horvat', 'Kovač', 'Ferreira', 'Pereira', 'Meier', 'Keller', 'Fischer', 'Lambert'],
  africano: ['Diallo', 'Sarr', 'Ndiaye', 'Diop', 'Mensah', 'Owusu', 'Asare', 'Amrani', 'Benali', 'Haddad', 'El Idrissi', 'Farouk', 'Hassan', 'Kamara', 'Touré', 'Fofana', 'Traoré', 'Koné', 'Nasser', 'Bakr', 'Ouattara', 'Sow'],
  asiatico: ['Tanaka', 'Suzuki', 'Sato', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Han', 'Kobayashi', 'Kato', 'Yoshida', 'Mori', 'Seo'],
  FRA: ['Dubois', 'Laurent', 'Moreau', 'Lefèvre', 'Girard', 'Bonnet', 'Mercier', 'Fontaine', 'Rousseau', 'Blanc', 'Garnier', 'Chevalier', 'Faure'],
  ING: ['Walker', 'Taylor', 'Smith', 'Brown', 'Wright', 'Hughes', 'Cooper', 'Bennett', 'Turner', 'Parker', 'Ward', 'Carter', 'Fletcher'],
  ALE: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Wolf', 'Krüger', 'Braun'],
  ITA: ['Rossi', 'Bianchi', 'Conti', 'Ricci', 'Romano', 'Greco', 'Gallo', 'Mancini', 'Lombardi', 'Moretti', 'Rinaldi', 'Ferrari', 'Esposito'],
  HOL: ['De Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'De Boer', 'Mulder', 'Bos', 'Vos', 'Hendriks', 'Dekker', 'Brouwer', 'Jansen'],
  POR: ['Ferreira', 'Pereira', 'Santos', 'Oliveira', 'Rodrigues', 'Martins', 'Sousa', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Ribeiro', 'Pinto'],
  CRO: ['Novak', 'Horvat', 'Kovač', 'Babić', 'Marić', 'Jurić', 'Knežević', 'Petrović', 'Vuković', 'Matić', 'Tomić', 'Pavlović', 'Šarić'],
  SUI: ['Meier', 'Keller', 'Huber', 'Frei', 'Steiner', 'Brunner', 'Baumann', 'Gerber', 'Widmer', 'Zbinden', 'Moser', 'Graf', 'Roth'],
  anglo: ['Johnson', 'Williams', 'Miller', 'Davis', 'Wilson', 'Moore', 'Clark', 'Lewis', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Reid', 'Cooper'],
};
const REGIAO = {
  ARG: 'hispano', ESP: 'hispano', URU: 'hispano', MEX: 'hispano',
  FRA: 'FRA', ING: 'ING', ALE: 'ALE', POR: 'POR', HOL: 'HOL', ITA: 'ITA', CRO: 'CRO', SUI: 'SUI',
  MAR: 'africano', SEN: 'africano', GAN: 'africano', EGI: 'africano',
  JAP: 'asiatico', COR: 'asiatico',
  EUA: 'anglo', CAN: 'anglo', AUS: 'anglo', NZL: 'anglo',
};
// tons de pele mais comuns em cada região (0 = mais clara ... 5 = mais escura)
const PELES_REGIAO = { hispano: [0, 1, 1, 2, 2, 3], europeu: [0, 0, 1, 1, 2, 4], africano: [3, 4, 4, 5, 5, 2], asiatico: [0, 1, 1, 1, 2, 2], anglo: [0, 0, 1, 2, 4, 5] };
const CABELOS_ADV = ['curto', 'curto', 'raspado', 'cacheado', 'comprido', 'black', 'moicano', 'careca'];
const CORES_ADV = [0x15100c, 0x15100c, 0x3b2314, 0x5a3a20, 0xc9a25a];

export const NOMES_GERAIS = NOMES.europeu;

// Gerador de números "sorteados" que sempre dá o mesmo resultado para a mesma seleção
function sorteadorFixo(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let r = Math.imul(h ^ (h >>> 15), 1 | h);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const cacheElencos = new Map();
// Os 11 jogadores de cada seleção adversária: sempre os mesmos nomes e atributos
export function elencoAdversario(adv) {
  if (cacheElencos.has(adv.sigla)) return cacheElencos.get(adv.sigla);
  const rnd = sorteadorFixo(adv.sigla);
  const regiao = REGIAO[adv.sigla] || 'europeu';
  const nomes = [...NOMES[regiao]].sort(() => rnd() - 0.5);
  const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
  const elenco = FORMACAO.map((f, i) => {
    const b = adv.forca;
    const r = () => limitar(Math.round(b + (rnd() * 14 - 8)), 40, 97);
    const j = { num: [1, 2, 4, 3, 6, 5, 8, 10, 7, 9, 11][i], nome: nomes[i], pos: f.papel, vel: r(), chu: r(), pas: r(), dri: r(), def: r(), fis: r() };
    if (f.papel === 'ZAG' || f.papel === 'VOL') j.def = limitar(j.def + 6, 40, 97);
    if (f.papel === 'ATA' || f.papel === 'PON') { j.chu = limitar(j.chu + 5, 40, 97); j.def -= 15; }
    if (f.papel === 'GOL') j.def = limitar(b + 2, 50, 95);
    const peles = PELES_REGIAO[regiao] || PELES_REGIAO.europeu;
    j.visual = {
      pele: peles[Math.floor(rnd() * peles.length)],
      cabelo: CABELOS_ADV[Math.floor(rnd() * CABELOS_ADV.length)],
      corCabelo: CORES_ADV[Math.floor(rnd() * CORES_ADV.length)],
      barba: rnd() < 0.4,
    };
    return j;
  });
  cacheElencos.set(adv.sigla, elenco);
  return elenco;
}

// Sorteia quem fez o gol (atacante marca mais que zagueiro)
const PESO_GOL = { ATA: 6, PON: 4, MEI: 3, VOL: 1.2, LAT: 0.8, ZAG: 0.7, GOL: 0 };
export function sortearAutor(jogadores) {
  const total = jogadores.reduce((s, j) => s + (PESO_GOL[j.pos] || 0), 0);
  let x = Math.random() * total;
  for (const j of jogadores) { x -= PESO_GOL[j.pos] || 0; if (x <= 0) return j; }
  return jogadores[jogadores.length - 1];
}

export const DIFICULDADES = {
  mirim: { nome: 'Craque Mirim', velAdv: 0.9, reacaoGoleiroAdv: 0.6, roubada: 0.75, miraAuto: true, regrasCompletas: false },
  titular: { nome: 'Titular', velAdv: 0.97, reacaoGoleiroAdv: 0.7, roubada: 1.1, miraAuto: false, regrasCompletas: true },
  penta: { nome: 'Penta', velAdv: 1.04, reacaoGoleiroAdv: 0.82, roubada: 1.6, miraAuto: false, regrasCompletas: true },
};
