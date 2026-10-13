/* ============================================
   Lara World — Tutorial Data (src/tutorial/tutorial-data.js)
   11 steps of onboarding content
   ============================================ */

export const TUTORIAL_STEPS = [
  {
    icon: '🌍',
    title: 'Bem-vindo ao Lara World',
    text: 'Lara World é um jogo de trilha para crianças. O objetivo é chegar na casa 20 antes do outro jogador e vencer o mundo!',
    note: 'Jogue com o mouse ou com o dedo. No teclado, use as setas para navegar e Esc para voltar.'
  },
  {
    icon: '🧭',
    title: 'Escolha o modo de jogo',
    text: 'No menu inicial você encontra três modos: Jogo Rápido, Modo Aventura e Modo Arcade. Cada um traz uma diversão diferente.'
  },
  {
    icon: '⚡',
    title: 'Jogo Rápido',
    text: 'Uma partida em um mundo só. Escolha o mundo, prepare os jogadores e jogue até alguém chegar na chegada.'
  },
  {
    icon: '🗺️',
    title: 'Modo Aventura',
    text: 'Percorra os cinco mundos em uma campanha e acumule pontos. No final, quem tiver mais pontos vence a aventura!',
    note: 'A campanha existe somente na sessão atual e termina se a página for recarregada.'
  },
  {
    icon: '🎮',
    title: 'Modo Arcade',
    text: 'Jogue minigames avulsos, sem tabuleiro: Meteoro, Dino Runner, Memória, Match-3, Dragões e o Quiz Lara World. Supere os seus recordes!'
  },
  {
    icon: '👥',
    title: 'Prepare os jogadores',
    text: 'Escolha nomes e personagens: Lara, Léo, Dino ou Byte. Você pode jogar com outra pessoa no mesmo aparelho ou contra a Máquina.',
    note: 'No Jogo Rápido, você também escolhe o mundo da partida.'
  },
  {
    icon: '🎲',
    title: 'Descubra quem começa',
    text: 'Antes da partida, os jogadores rolam o dado. Quem tirar o maior número começa.',
    note: 'Na aventura há um único sorteio: o vencedor começa os mundos 1, 3 e 5; o outro participante começa os mundos 2 e 4.'
  },
  {
    icon: '🏃',
    title: 'Role o dado e avance',
    text: 'Na sua vez, toque em "Jogar Dado". Seu personagem avança casa por casa pelo caminho.',
    note: 'No celular, o botão "Jogar Dado" fica fixo na parte de baixo da tela.'
  },
  {
    icon: '❓',
    title: 'Casas especiais e desafios',
    text: 'Cada casa pode trazer um evento diferente:',
    items: [
      '❓ Desafio',
      '⏩ Avançar',
      '⏪ Voltar',
      '🎲 Jogue de novo',
      '⏸️ Pule a vez',
      '🔄 Troque de lugar',
      '🔙 Volte ao início',
      '🏆 Chegada'
    ],
    note: 'Responda as perguntas educativas. No Modo Aventura, cada resposta correta vale 10 pontos e até 2 acertos pontuam por participante em cada mundo.'
  },
  {
    icon: '🏆',
    title: 'Minigames e recompensas',
    text: 'Algumas casas abrem minigames. Vencendo, você ganha recompensas no tabuleiro.',
    note: 'No Modo Aventura, uma vitória vale 20 pontos e até 1 minigame pontua por participante em cada mundo. No Arcade, os minigames são avulsos.'
  },
  {
    icon: '🏆',
    title: 'Vitória e recomeço',
    text: 'O primeiro a chegar na casa 20 vence o mundo. Na tela de vitória, jogue novamente ou volte ao menu.',
    note: 'No Modo Aventura, vencer um mundo vale 30 pontos e o mapa mostra o placar antes da próxima etapa. Use o botão de som no topo para ligar ou desligar o áudio.'
  }
];

export const TUTORIAL_SEEN_KEY = 'lara-world-tutorial-seen';
