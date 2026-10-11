// =============================================================
//  JOGADOR 3D — proporções de atleta de verdade, com joelhos e
//  cotovelos que dobram, rosto, barba e vários cortes de cabelo.
// =============================================================
import * as THREE from 'three';

export const PELES = [0xf3d2b3, 0xe8b98f, 0xd09a6a, 0xa8704a, 0x7a4a2c, 0x5a3520];
const CORES_CABELO = [0x1a1410, 0x2b1a0f, 0x3b2314, 0x5a3a20, 0xc9a25a, 0x111111];
const ESTILOS = ['curto', 'raspado', 'black', 'cacheado', 'moicano', 'comprido', 'curto', 'raspado'];
const ESCALA = 1.25; // um pouco maiores que o real para enxergar bem no celular

const geo = {
  chuteira: new THREE.BoxGeometry(0.11, 0.07, 0.27),
  canela: new THREE.CapsuleGeometry(0.052, 0.33, 4, 10),
  coxa: new THREE.CapsuleGeometry(0.074, 0.3, 4, 10),
  calcaoPerna: new THREE.CylinderGeometry(0.098, 0.09, 0.22, 12),
  quadril: new THREE.CylinderGeometry(0.165, 0.15, 0.2, 14),
  tronco: new THREE.CapsuleGeometry(0.165, 0.34, 6, 16),
  pescoco: new THREE.CylinderGeometry(0.052, 0.058, 0.12, 10),
  cabeca: new THREE.SphereGeometry(0.112, 20, 16),
  orelha: new THREE.SphereGeometry(0.025, 8, 6),
  olhoBranco: new THREE.SphereGeometry(0.017, 8, 6),
  pupila: new THREE.SphereGeometry(0.009, 6, 4),
  sobrancelha: new THREE.BoxGeometry(0.036, 0.008, 0.01),
  nariz: new THREE.ConeGeometry(0.014, 0.035, 6),
  boca: new THREE.BoxGeometry(0.036, 0.006, 0.006),
  manga: new THREE.CylinderGeometry(0.066, 0.058, 0.17, 10),
  braco: new THREE.CapsuleGeometry(0.046, 0.2, 4, 8),
  antebraco: new THREE.CapsuleGeometry(0.041, 0.2, 4, 8),
  mao: new THREE.SphereGeometry(0.045, 10, 8),
  luva: new THREE.SphereGeometry(0.062, 10, 8),
  // cabelos
  capCurto: new THREE.SphereGeometry(0.119, 18, 10, 0, Math.PI * 2, 0, 1.25),
  capRaspado: new THREE.SphereGeometry(0.115, 18, 10, 0, Math.PI * 2, 0, 1.15),
  black: new THREE.SphereGeometry(0.15, 16, 12),
  cacho: new THREE.SphereGeometry(0.035, 6, 5),
  moicano: new THREE.BoxGeometry(0.04, 0.06, 0.2),
  comprido: new THREE.BoxGeometry(0.2, 0.16, 0.06),
  barba: new THREE.SphereGeometry(0.116, 16, 8, 0.2, Math.PI - 0.4, 1.75, 0.85),
  sombra: new THREE.CircleGeometry(0.45, 16),
  anel: new THREE.RingGeometry(0.75, 0.95, 28),
  seta: new THREE.ConeGeometry(0.28, 0.5, 4),
};
const matOlho = new THREE.MeshBasicMaterial({ color: 0xffffff });
const matPupila = new THREE.MeshBasicMaterial({ color: 0x1a120c });
const matBoca = new THREE.MeshBasicMaterial({ color: 0x6b2a22 });
const matChuteira = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 });

function texturaCamisa(corCamisa, corDetalhe, numero, nomeCurto) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  const hex = '#' + corCamisa.toString(16).padStart(6, '0');
  const det = '#' + corDetalhe.toString(16).padStart(6, '0');
  g.fillStyle = hex;
  g.fillRect(0, 0, 256, 128);
  // gola
  g.fillStyle = det;
  g.fillRect(0, 0, 256, 9);
  // u = 0.5 fica nas costas; u perto de 0 é o peito
  g.font = 'bold 60px Arial';
  g.textAlign = 'center';
  g.fillText(String(numero), 128, 98);
  g.font = 'bold 15px Arial';
  g.fillText(nomeCurto.toUpperCase().slice(0, 11), 128, 34);
  // escudo e número pequeno no peito
  g.beginPath();
  g.arc(20, 40, 8, 0, Math.PI * 2);
  g.fill();
  g.font = 'bold 14px Arial';
  g.fillText(String(numero), 236, 44);
  // listras laterais
  g.fillRect(60, 9, 4, 119);
  g.fillRect(192, 9, 4, 119);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function visualPadrao(indice) {
  return {
    pele: indice % PELES.length,
    cabelo: ESTILOS[(indice * 5) % ESTILOS.length],
    corCabelo: CORES_CABELO[(indice * 7) % CORES_CABELO.length],
    barba: indice % 3 === 0,
  };
}

function montarCabelo(cabeca, estilo, mat) {
  const add = (g, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    cabeca.add(m);
    return m;
  };
  switch (estilo) {
    case 'careca': break;
    case 'raspado': add(geo.capRaspado, 0, 0.012, -0.006, -0.25); break;
    case 'black': add(geo.black, 0, 0.05, -0.02, 0, 1, 0.82, 1); break;
    case 'cacheado':
      add(geo.capCurto, 0, 0.018, -0.008, -0.28);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        add(geo.cacho, Math.cos(a) * 0.08, 0.085 + (i % 2) * 0.02, Math.sin(a) * 0.075 - 0.01);
      }
      add(geo.cacho, 0, 0.12, 0, 0, 1.4, 1, 1.4);
      break;
    case 'moicano':
      add(geo.capRaspado, 0, 0.01, -0.006, -0.25);
      add(geo.moicano, 0, 0.115, -0.01, -0.15);
      break;
    case 'comprido':
      add(geo.capCurto, 0, 0.02, -0.01, -0.3);
      add(geo.comprido, 0, -0.03, -0.1, 0.1);
      break;
    default: add(geo.capCurto, 0, 0.016, -0.008, -0.28);
  }
}

// visual (opcional): { pele: 0..5, cabelo: 'curto'|'raspado'|'black'|'cacheado'|'moicano'|'comprido'|'careca', corCabelo, barba }
export function criarModeloJogador(kit, numero, nome, indiceVisual, visual = null, goleiro = false) {
  const vis = { ...visualPadrao(indiceVisual), ...(visual || {}) };
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  corpo.scale.setScalar(ESCALA);
  raiz.add(corpo);

  const pele = new THREE.MeshStandardMaterial({ color: PELES[vis.pele] ?? vis.pele, roughness: 0.65 });
  const matCabelo = new THREE.MeshStandardMaterial({ color: vis.corCabelo, roughness: 0.95 });
  const matCamisa = new THREE.MeshStandardMaterial({ map: texturaCamisa(kit.camisa, kit.detalhe, numero, nome.split(' ').slice(-1)[0]), roughness: 0.7 });
  const matMangas = new THREE.MeshStandardMaterial({ color: kit.camisa, roughness: 0.7 });
  const matCalcao = new THREE.MeshStandardMaterial({ color: kit.calcao, roughness: 0.7 });
  const matMeiao = new THREE.MeshStandardMaterial({ color: kit.meiao, roughness: 0.7 });
  const matLuva = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });

  const malha = (g, m, pai, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    pai.add(o);
    return o;
  };

  // pernas: quadril -> coxa -> joelho -> canela -> chuteira
  const pernas = [], joelhos = [];
  for (const lado of [-1, 1]) {
    const quadril = new THREE.Group();
    quadril.position.set(lado * 0.095, 0.92, 0);
    malha(geo.calcaoPerna, matCalcao, quadril, 0, -0.08, 0);
    malha(geo.coxa, pele, quadril, 0, -0.22, 0);
    const joelho = new THREE.Group();
    joelho.position.y = -0.42;
    malha(geo.canela, matMeiao, joelho, 0, -0.21, 0);
    malha(geo.chuteira, matChuteira, joelho, 0, -0.43, 0.05);
    quadril.add(joelho);
    corpo.add(quadril);
    pernas.push(quadril);
    joelhos.push(joelho);
  }
  malha(geo.quadril, matCalcao, corpo, 0, 0.93, 0);

  const tronco = malha(geo.tronco, matCamisa, corpo, 0, 1.25, 0);
  tronco.scale.set(1.22, 1, 0.78);
  malha(geo.pescoco, pele, corpo, 0, 1.6, 0);

  // braços: ombro -> manga -> braço -> cotovelo -> antebraço -> mão
  const bracos = [], cotovelos = [];
  for (const lado of [-1, 1]) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * 0.235, 1.49, 0);
    malha(geo.manga, matMangas, ombro, 0, -0.06, 0);
    malha(geo.braco, pele, ombro, 0, -0.16, 0);
    const cotovelo = new THREE.Group();
    cotovelo.position.y = -0.29;
    malha(geo.antebraco, pele, cotovelo, 0, -0.13, 0);
    malha(goleiro ? geo.luva : geo.mao, goleiro ? matLuva : pele, cotovelo, 0, -0.28, 0);
    ombro.add(cotovelo);
    ombro.rotation.z = lado * 0.1;
    corpo.add(ombro);
    bracos.push(ombro);
    cotovelos.push(cotovelo);
  }

  // cabeça e rosto
  const cabeca = new THREE.Group();
  cabeca.position.y = 1.76;
  const cranio = malha(geo.cabeca, pele, cabeca);
  cranio.scale.set(0.92, 1.08, 1);
  for (const lado of [-1, 1]) {
    malha(geo.orelha, pele, cabeca, lado * 0.105, 0, -0.005).scale.set(0.6, 1, 0.9);
    const ob = new THREE.Mesh(geo.olhoBranco, matOlho); ob.position.set(lado * 0.038, 0.015, 0.094); cabeca.add(ob);
    const pu = new THREE.Mesh(geo.pupila, matPupila); pu.position.set(lado * 0.038, 0.015, 0.108); cabeca.add(pu);
    const sb = new THREE.Mesh(geo.sobrancelha, matCabelo); sb.position.set(lado * 0.04, 0.042, 0.1); sb.rotation.z = -lado * 0.12; cabeca.add(sb);
  }
  const nariz = malha(geo.nariz, pele, cabeca, 0, -0.005, 0.112);
  nariz.rotation.x = Math.PI / 2.4;
  const boca = new THREE.Mesh(geo.boca, matBoca); boca.position.set(0, -0.045, 0.1); cabeca.add(boca);
  montarCabelo(cabeca, vis.cabelo, matCabelo);
  if (vis.barba) {
    const b = malha(geo.barba, matCabelo, cabeca);
    b.scale.set(0.95, 1.05, 1.02);
  }
  corpo.add(cabeca);

  const sombra = new THREE.Mesh(geo.sombra, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  raiz.add(sombra);

  return { raiz, corpo, pernas, joelhos, bracos, cotovelos, cabeca };
}

export function criarMarcadorControle() {
  const g = new THREE.Group();
  const anel = new THREE.Mesh(geo.anel, new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, depthWrite: false }));
  anel.rotation.x = -Math.PI / 2;
  anel.position.y = 0.04;
  g.add(anel);
  const seta = new THREE.Mesh(geo.seta, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
  seta.rotation.x = Math.PI;
  seta.position.y = 3.4;
  g.add(seta);
  g.userData.seta = seta;
  return g;
}

const L = THREE.MathUtils.lerp;

// Anima o corpo de acordo com a velocidade e o estado
export function animarJogador(j, dt, tempo) {
  const m = j.modelo;
  const vel = Math.hypot(j.vel.x, j.vel.z);
  j.fase += dt * (3.5 + vel * 1.45);
  const amp = Math.min(vel / 8, 1);
  const s = Math.sin(j.fase), c = Math.cos(j.fase);
  const [qE, qD] = m.pernas, [jE, jD] = m.joelhos, [oE, oD] = m.bracos, [cE, cD] = m.cotovelos;

  if (j.mergulho > 0) {
    // goleiro mergulhando, braços esticados
    m.corpo.rotation.z = L(m.corpo.rotation.z, -j.ladoMergulho * 1.35, 0.3);
    m.corpo.position.y = L(m.corpo.position.y, 0.5, 0.3);
    oE.rotation.z = oD.rotation.z = 0;
    oE.rotation.x = oD.rotation.x = Math.PI;
    cE.rotation.x = cD.rotation.x = 0;
    jE.rotation.x = 0.3; jD.rotation.x = 0.1;
    return;
  }
  if (j.carrinho > 0) {
    // carrinho: deita para trás e desliza com a perna esticada
    m.corpo.rotation.x = L(m.corpo.rotation.x, -1.15, 0.35);
    m.corpo.position.y = L(m.corpo.position.y, 0.12, 0.35);
    qD.rotation.x = -1.45; jD.rotation.x = 0;
    qE.rotation.x = -0.6; jE.rotation.x = 1.2;
    oE.rotation.x = oD.rotation.x = 0.9;
    cE.rotation.x = cD.rotation.x = -0.3;
    return;
  }
  m.corpo.rotation.z = L(m.corpo.rotation.z, 0, 0.2);

  if (j.comemorando > 0) {
    // braços para cima e pulinhos
    oE.rotation.x = oD.rotation.x = Math.PI * 0.92 + Math.sin(tempo * 12) * 0.15;
    oE.rotation.z = -0.35; oD.rotation.z = 0.35;
    cE.rotation.x = cD.rotation.x = -0.2;
    m.corpo.position.y = Math.abs(Math.sin(tempo * 8)) * 0.35;
    m.corpo.rotation.x = 0;
    qE.rotation.x = qD.rotation.x = -0.15;
    jE.rotation.x = jD.rotation.x = 0.4;
    return;
  }

  // corrida: coxas balançam, joelhos dobram quando a perna vai para trás,
  // cotovelos dobrados e braços opostos às pernas
  qE.rotation.x = s * amp * 0.85;
  qD.rotation.x = -s * amp * 0.85;
  jE.rotation.x = (0.1 + Math.max(0, c) * 1.3) * amp + 0.05;
  jD.rotation.x = (0.1 + Math.max(0, -c) * 1.3) * amp + 0.05;
  oE.rotation.x = -s * amp * 0.75;
  oD.rotation.x = s * amp * 0.75;
  oE.rotation.z = L(oE.rotation.z, -0.1, 0.2);
  oD.rotation.z = L(oD.rotation.z, 0.1, 0.2);
  const dobra = -0.25 - amp * 1.15;
  cE.rotation.x = dobra;
  cD.rotation.x = dobra;
  m.corpo.position.y = Math.abs(c) * amp * 0.07 - amp * 0.03;
  m.corpo.rotation.x = amp * 0.16;
  if (vel < 0.3) {
    // parado: respiração leve
    m.corpo.position.y = Math.sin(tempo * 2 + j.fase) * 0.006;
    jE.rotation.x = jD.rotation.x = 0.12;
  }

  if (j.apontando > 0) {
    // juiz: braço direito levantado (falta, gol, cartão)
    oD.rotation.x = Math.PI * 0.85;
    oD.rotation.z = 0.15;
    cD.rotation.x = 0;
  }

  if (j.animChute > 0) {
    // chute: joelho dobra para trás e depois a perna estica para frente
    const k = 1 - j.animChute / 0.3;
    qD.rotation.x = k < 0.35 ? 0.6 * (k / 0.35) : 0.6 - 2.2 * ((k - 0.35) / 0.65);
    jD.rotation.x = k < 0.35 ? 1.4 * (k / 0.35) : 1.4 * (1 - (k - 0.35) / 0.65);
    oE.rotation.z = -0.7;
  }
}
