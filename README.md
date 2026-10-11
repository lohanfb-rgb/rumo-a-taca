# Rumo à Taça

Jogo de futebol 3D da Seleção Brasileira rumo ao Hexa, feito por pai e filho.

## Jogar

- **No celular ou no computador:** abra o link do GitHub Pages do projeto. No celular, vire a tela de lado.
- **No computador, sem internet de hospedagem:** dê dois cliques em `JOGAR.bat` (precisa do Node.js) ou rode `node servidor.js` e abra http://localhost:8080.

## Controles

| Ação | Teclado | Celular |
| --- | --- | --- |
| Correr | Setas ou WASD | Joystick |
| Passe (segure para passe longo) | J | PASSE |
| Chute (segure para dar força) | K | CHUTE |
| Arrancada | L | CORRIDA |
| Trocar de jogador | I | TROCA |
| Carrinho | U | CARRINHO |
| Replay do último gol | R | REPLAY |
| Pausa e substituições | P | II |

## Modos

Rumo à Taça (campanha de 8 jogos até a final), Amistoso, Pênaltis e Treino. Tem álbum de figurinhas, artilharia e cerimônia de premiação.

## Onde mudar as coisas

- Nomes, atributos e visual dos jogadores: `js/dados.js`
- Regras e inteligência da partida: `js/partida.js`
