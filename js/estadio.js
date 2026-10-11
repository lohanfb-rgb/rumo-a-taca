// =============================================================
//  ESTÁDIO 3D — gramado, linhas, gols, arquibancada e luzes
// =============================================================
import * as THREE from 'three';

export const CAMPO = { comp: 105, larg: 68, golLarg: 7.32, golAlt: 2.44 };
export const MEIO_X = CAMPO.comp / 2;   // 52.5
export const MEIO_Z = CAMPO.larg / 2;   // 34

function texturaGramado() {
  const W = 2048, H = 1400;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  // área desenhada: 121 x 84 metros (campo + borda)
  const AREA_X = 121, AREA_Z = 84;
  const sx = W / AREA_X, sz = H / AREA_Z;
  const X = x => (x + AREA_X / 2) * sx;
  const Z = z => (z + AREA_Z / 2) * sz;

  g.fillStyle = '#2f8a3a';
  g.fillRect(0, 0, W, H);
  // faixas do corte da grama
  const faixas = 18;
  for (let i = 0; i < faixas; i++) {
    if (i % 2) continue;
    const x0 = -MEIO_X + (CAMPO.comp / faixas) * i;
    g.fillStyle = '#37993f';
    g.fillRect(X(x0), Z(-MEIO_Z), (CAMPO.comp / faixas) * sx, CAMPO.larg * sz);
  }
  // leve ruído
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.14 * sx;
  const ret = (x0, z0, x1, z1) => g.strokeRect(X(x0), Z(z0), (x1 - x0) * sx, (z1 - z0) * sz);
  ret(-MEIO_X, -MEIO_Z, MEIO_X, MEIO_Z);
  g.beginPath(); g.moveTo(X(0), Z(-MEIO_Z)); g.lineTo(X(0), Z(MEIO_Z)); g.stroke();
  g.beginPath(); g.ellipse(X(0), Z(0), 9.15 * sx, 9.15 * sz, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'white';
  const ponto = (x, z) => { g.beginPath(); g.ellipse(X(x), Z(z), 0.3 * sx, 0.3 * sz, 0, 0, Math.PI * 2); g.fill(); };
  ponto(0, 0);
  for (const lado of [-1, 1]) {
    const fundo = lado * MEIO_X;
    // grande área
    ret(Math.min(fundo, fundo - lado * 16.5), -20.16, Math.max(fundo, fundo - lado * 16.5), 20.16);
    // pequena área
    ret(Math.min(fundo, fundo - lado * 5.5), -9.16, Math.max(fundo, fundo - lado * 5.5), 9.16);
    ponto(fundo - lado * 11, 0);
    // meia-lua
    g.beginPath();
    const ang = Math.acos(5.5 / 9.15);
    const base = lado > 0 ? Math.PI : 0;
    g.ellipse(X(fundo - lado * 11), Z(0), 9.15 * sx, 9.15 * sz, 0, base - ang, base + ang);
    g.stroke();
    // escanteios
    for (const lz of [-1, 1]) {
      g.beginPath();
      const cx = X(fundo), cz = Z(lz * MEIO_Z);
      const a0 = lado > 0 ? (lz > 0 ? Math.PI : Math.PI / 2) : (lz > 0 ? -Math.PI / 2 : 0);
      g.ellipse(cx, cz, 1 * sx, 1 * sz, 0, a0, a0 + Math.PI / 2);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, AREA_X, AREA_Z };
}

function texturaTorcida(corA, corB) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#1b2430';
  g.fillRect(0, 0, 512, 128);
  const cores = [corA, corA, corA, corB, corB, '#ffffff', '#1646b8', '#e8c39e', '#8d5a3b'];
  for (let y = 4; y < 128; y += 8) {
    for (let x = 2; x < 512; x += 6) {
      g.fillStyle = cores[(Math.random() * cores.length) | 0];
      g.fillRect(x + Math.random() * 2, y + Math.random() * 2, 4, 5);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

function criarGol(lado) {
  const grupo = new THREE.Group();
  const branco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const r = 0.07;
  const meia = CAMPO.golLarg / 2;
  const trave = new THREE.CylinderGeometry(r, r, CAMPO.golAlt + r, 12);
  for (const z of [-meia, meia]) {
    const t = new THREE.Mesh(trave, branco);
    t.position.set(0, CAMPO.golAlt / 2, z);
    t.castShadow = true;
    grupo.add(t);
  }
  const tv = new THREE.Mesh(new THREE.CylinderGeometry(r, r, CAMPO.golLarg + 2 * r, 12), branco);
  tv.rotation.x = Math.PI / 2;
  tv.position.set(0, CAMPO.golAlt, 0);
  tv.castShadow = true;
  grupo.add(tv);

  // rede
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 64, 64);
  const texRede = new THREE.CanvasTexture(cv);
  texRede.wrapS = texRede.wrapT = THREE.RepeatWrapping;
  const fundo = 2.2;
  const matRede = (rx, ry) => {
    const t = texRede.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  };
  const atras = new THREE.Mesh(new THREE.PlaneGeometry(CAMPO.golLarg, CAMPO.golAlt), matRede(24, 8));
  atras.rotation.y = Math.PI / 2;
  atras.position.set(lado * fundo, CAMPO.golAlt / 2, 0);
  grupo.add(atras);
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(fundo, CAMPO.golLarg), matRede(7, 24));
  teto.rotation.x = Math.PI / 2;
  teto.position.set(lado * fundo / 2, CAMPO.golAlt, 0);
  grupo.add(teto);
  for (const z of [-meia, meia]) {
    const lat = new THREE.Mesh(new THREE.PlaneGeometry(fundo, CAMPO.golAlt), matRede(7, 8));
    lat.position.set(lado * fundo / 2, CAMPO.golAlt / 2, z);
    grupo.add(lat);
  }
  grupo.position.x = lado * MEIO_X;
  return grupo;
}

export function criarEstadio(cena, noite = false) {
  cena.background = new THREE.Color(noite ? 0x0b1530 : 0x8ec9ff);
  cena.fog = new THREE.Fog(cena.background, 140, 320);

  const hemi = new THREE.HemisphereLight(noite ? 0x8899cc : 0xdff1ff, 0x2a5a2a, noite ? 0.7 : 1.0);
  cena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, noite ? 1.6 : 2.2);
  sol.position.set(-30, 70, 40);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const s = sol.shadow.camera;
  s.left = -70; s.right = 70; s.top = 50; s.bottom = -50; s.near = 10; s.far = 200;
  sol.shadow.bias = -0.0005;
  cena.add(sol);

  const { tex, AREA_X, AREA_Z } = texturaGramado();
  const gramado = new THREE.Mesh(
    new THREE.PlaneGeometry(AREA_X, AREA_Z),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
  );
  gramado.rotation.x = -Math.PI / 2;
  gramado.receiveShadow = true;
  cena.add(gramado);

  // pista ao redor
  const pista = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 130),
    new THREE.MeshStandardMaterial({ color: 0x2d6e33, roughness: 1 })
  );
  pista.rotation.x = -Math.PI / 2;
  pista.position.y = -0.02;
  cena.add(pista);

  cena.add(criarGol(1));
  cena.add(criarGol(-1));

  // placas de publicidade (do próprio jogo)
  const placaCv = document.createElement('canvas');
  placaCv.width = 1024; placaCv.height = 64;
  const pg = placaCv.getContext('2d');
  const textos = ['RUMO À TAÇA', 'VAI BRASIL!', 'RUMO AO HEXA', 'FEITO POR PAI E FILHO'];
  for (let i = 0; i < 4; i++) {
    pg.fillStyle = i % 2 ? '#0a9b3c' : '#1646b8';
    pg.fillRect(i * 256, 0, 256, 64);
    pg.fillStyle = i % 2 ? '#ffd400' : '#ffffff';
    pg.font = 'bold 30px Arial';
    pg.textAlign = 'center';
    pg.fillText(textos[i], i * 256 + 128, 43);
  }
  const placaTex = new THREE.CanvasTexture(placaCv);
  placaTex.colorSpace = THREE.SRGBColorSpace;
  placaTex.wrapS = THREE.RepeatWrapping;
  const placaMat = (rep) => {
    const t = placaTex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 });
  };
  const placaLongo = new THREE.BoxGeometry(110, 1, 0.2);
  for (const z of [-1, 1]) {
    const p = new THREE.Mesh(placaLongo, placaMat(4));
    p.position.set(0, 0.5, z * (MEIO_Z + 4));
    if (z > 0) p.visible = false; // lado da câmera: não atrapalha a visão
    cena.add(p);
  }
  for (const x of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 60), placaMat(2));
    p.position.set(x * (MEIO_X + 5), 0.5, 0);
    cena.add(p);
  }

  // arquibancadas (3 lados; o lado da câmera fica aberto)
  const texT = texturaTorcida('#2a4a9a', '#1f3a7a'); // cadeiras azuis (a torcida 3D senta em cima)
  const matT = new THREE.MeshStandardMaterial({ map: texT, roughness: 1 });
  const matConcreto = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 1 });
  function arquibancada(largura, x, z, rotY) {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const degrau = new THREE.Mesh(new THREE.BoxGeometry(largura, 3, 5), [matConcreto, matConcreto, matConcreto, matConcreto, matT, matConcreto]);
      degrau.position.set(0, 1.5 + i * 3, -i * 5);
      g.add(degrau);
    }
    const cobertura = new THREE.Mesh(new THREE.BoxGeometry(largura, 0.6, 18), new THREE.MeshStandardMaterial({ color: 0xe9eef3 }));
    cobertura.position.set(0, 18, -9);
    g.add(cobertura);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.userData.largura = largura;
    cena.add(g);
    return g;
  }
  const arquibancadas = [
    arquibancada(130, 0, -(MEIO_Z + 9), 0),
    arquibancada(90, MEIO_X + 11, 0, -Math.PI / 2),    // atrás do gol da direita
    arquibancada(90, -(MEIO_X + 11), 0, Math.PI / 2),  // atrás do gol da esquerda
  ];

  // torres de iluminação
  const matTorre = new THREE.MeshStandardMaterial({ color: 0x555b66 });
  for (const [x, z] of [[-60, -48], [60, -48], [-62, 42], [62, 42]]) {
    const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 36, 8), matTorre);
    torre.position.set(x, 18, z);
    cena.add(torre);
    const painel = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: noite ? 0xffffee : 0x777777 }));
    painel.position.set(x, 36, z);
    painel.lookAt(0, 0, 0);
    cena.add(painel);
    if (noite) {
      const luz = new THREE.PointLight(0xffffff, 900, 160, 1.6);
      luz.position.set(x, 34, z);
      cena.add(luz);
    }
  }
  return { arquibancadas };
}
