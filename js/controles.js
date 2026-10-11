// =============================================================
//  CONTROLES — teclado (computador) e toque (celular/tablet)
//  Teclado: setas ou WASD = correr | J = passe | K = chute | L ou Shift = corrida
//           I = trocar de jogador | U = carrinho
// =============================================================

export const entrada = {
  x: 0, y: 0,                 // direção do joystick (x: direita, y: para cima na tela)
  passe: false, chute: false, corrida: false,
  passeApertou: false, passeSoltou: false,
  trocaApertou: false, carrinhoApertou: false,
  chuteApertou: false, chuteSoltou: false,
  tempoPasse: 0, tempoChute: 0,
};

const teclas = new Set();
let joyX = 0, joyY = 0, joyAtivo = false;
const toque = { passe: false, chute: false, corrida: false, troca: false, carrinho: false };
let anterior = { passe: false, chute: false, troca: false, carrinho: false };

export function iniciarControles() {
  const digitando = e => e.target && e.target.closest && e.target.closest('input, select, textarea');
  window.addEventListener('keydown', e => {
    if (digitando(e)) return; // escrevendo o apelido: as teclas não controlam o jogador
    teclas.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => teclas.delete(e.code));
  window.addEventListener('blur', () => teclas.clear());

  const base = document.getElementById('joystick');
  const pino = document.getElementById('joystick-pino');
  let idToque = null;
  const raio = 55;
  function mover(cx, cy) {
    const r = base.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > raio) { dx *= raio / d; dy *= raio / d; }
    pino.style.transform = `translate(${dx}px, ${dy}px)`;
    joyX = dx / raio;
    joyY = -dy / raio;
    joyAtivo = true;
  }
  function soltar() {
    idToque = null; joyAtivo = false; joyX = joyY = 0;
    pino.style.transform = 'translate(0px, 0px)';
  }
  base.addEventListener('pointerdown', e => {
    idToque = e.pointerId;
    base.setPointerCapture(e.pointerId);
    mover(e.clientX, e.clientY);
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === idToque) mover(e.clientX, e.clientY); });
  base.addEventListener('pointerup', soltar);
  base.addEventListener('pointercancel', soltar);

  for (const nome of ['passe', 'chute', 'corrida', 'troca', 'carrinho']) {
    const b = document.getElementById('bt-' + nome);
    b.addEventListener('pointerdown', e => { e.preventDefault(); toque[nome] = true; b.classList.add('apertado'); b.setPointerCapture(e.pointerId); });
    const fim = () => { toque[nome] = false; b.classList.remove('apertado'); };
    b.addEventListener('pointerup', fim);
    b.addEventListener('pointercancel', fim);
  }
}

// Chamado uma vez por quadro, antes da lógica do jogo
export function atualizarControles(dt) {
  let x = 0, y = 0;
  if (teclas.has('ArrowLeft') || teclas.has('KeyA')) x -= 1;
  if (teclas.has('ArrowRight') || teclas.has('KeyD')) x += 1;
  if (teclas.has('ArrowUp') || teclas.has('KeyW')) y += 1;
  if (teclas.has('ArrowDown') || teclas.has('KeyS')) y -= 1;
  if (joyAtivo) { x = joyX; y = joyY; }
  const d = Math.hypot(x, y);
  if (d > 1) { x /= d; y /= d; }
  entrada.x = x; entrada.y = y;

  const passe = teclas.has('KeyJ') || teclas.has('Space') || toque.passe;
  const chute = teclas.has('KeyK') || toque.chute;
  entrada.corrida = teclas.has('KeyL') || teclas.has('ShiftLeft') || teclas.has('ShiftRight') || toque.corrida;

  entrada.passeApertou = passe && !anterior.passe;
  entrada.passeSoltou = !passe && anterior.passe;
  entrada.chuteApertou = chute && !anterior.chute;
  entrada.chuteSoltou = !chute && anterior.chute;
  entrada.passe = passe;
  entrada.chute = chute;
  entrada.tempoPasse = passe ? entrada.tempoPasse + dt : (entrada.passeSoltou ? entrada.tempoPasse : 0);
  entrada.tempoChute = chute ? entrada.tempoChute + dt : (entrada.chuteSoltou ? entrada.tempoChute : 0);
  const troca = teclas.has('KeyI') || toque.troca;
  const carrinho = teclas.has('KeyU') || toque.carrinho;
  entrada.trocaApertou = troca && !anterior.troca;
  entrada.carrinhoApertou = carrinho && !anterior.carrinho;
  anterior = { passe, chute, troca, carrinho };
}

export function teclaApertada(codigo) { return teclas.has(codigo); }
