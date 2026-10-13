/* ============================================
   Lara World — About Screen (src/about/about-screen.js)
   "Sobre o Lara World" overlay with sections
   ============================================ */

import { APP_VERSION } from '../version.js';

console.log('[ABOUT] módulo carregado');

let _overlayEl = null;
let _cardEl = null;
let _closeBtn = null;
let _versionEl = null;
let _initialized = false;
let _lastFocusedElement = null;

function _handleKeydown(e) {
  if (!_overlayEl || _overlayEl.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    hideAboutScreen();
  }
}

function _handleOverlayClick(e) {
  if (e.target === _overlayEl) {
    hideAboutScreen();
  }
}

function _updateVersion() {
  if (_versionEl) {
    _versionEl.textContent = 'Versão ' + APP_VERSION;
  }
}

function _createSection(heading, items) {
  var section = document.createElement('div');
  section.className = 'about-section';
  var h3 = document.createElement('h3');
  h3.textContent = heading;
  section.appendChild(h3);
  var ul = document.createElement('ul');
  items.forEach(function (item) {
    var li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  section.appendChild(ul);
  return section;
}

function _renderContent() {
  if (!_overlayEl) return;

  _overlayEl.innerHTML = '';

  var card = document.createElement('div');
  card.className = 'about-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Sobre o Lara World');

  var closeBtn = document.createElement('button');
  closeBtn.className = 'about-close-btn';
  closeBtn.setAttribute('aria-label', 'Fechar');
  closeBtn.textContent = '\u2715';
  card.appendChild(closeBtn);

  var title = document.createElement('h2');
  title.className = 'about-title';
  title.textContent = 'Sobre o Lara World';
  card.appendChild(title);

  var versionDiv = document.createElement('div');
  versionDiv.className = 'about-version';
  _versionEl = versionDiv;
  card.appendChild(versionDiv);

  var sectionPresentation = document.createElement('div');
  sectionPresentation.className = 'about-section';
  var h3Pres = document.createElement('h3');
  h3Pres.textContent = 'Apresentação';
  sectionPresentation.appendChild(h3Pres);
  var pPres = document.createElement('p');
  pPres.textContent = 'Lara World é um jogo de trilha infantil para navegador, feito para aprender brincando. Percorra cinco mundos temáticos, responda perguntas educativas e jogue minigames, sozinho contra a Máquina ou com outra pessoa no mesmo dispositivo.';
  sectionPresentation.appendChild(pPres);
  card.appendChild(sectionPresentation);

  var features = [
    '5 mundos temáticos',
    'Personagens Lara, Léo, Dino e Byte',
    'Casas especiais e desafios educativos',
    '6 minigames, incluindo o Quiz Lara World',
    '3 modos de jogo: Jogo Rápido, Modo Aventura e Modo Arcade',
    'Áudio e efeitos sonoros',
    'Multiplayer local, humano contra humano ou contra a Máquina',
    'Funciona em desktop, tablet e celular'
  ];
  card.appendChild(_createSection('O que você encontra no jogo', features));

  var modes = [
    'Jogo Rápido: uma partida em um mundo escolhido',
    'Modo Aventura: campanha pelos cinco mundos com pontos acumulados',
    'Modo Arcade: minigames avulsos, com recordes'
  ];
  card.appendChild(_createSection('Modos de jogo', modes));

  var educativeItems = [
    '228 perguntas educativas em 9 categorias',
    'Matemática, Português, Animais, Espaço, Natureza, Dinossauros, Lógica, Cores e Formas e Conhecimentos Gerais',
    'Quiz Lara World: teste seus conhecimentos no Arcade'
  ];
  card.appendChild(_createSection('Conteúdo educativo', educativeItems));

  var techItems = [
    'Tecnologias: HTML, CSS e JavaScript',
    'Docker e Nginx para publicação',
    'Código versionado no GitHub',
    'Desenvolvimento assistido por inteligência artificial',
    'Projeto independente, criado para aprender brincando'
  ];
  card.appendChild(_createSection('Tecnologia e desenvolvimento', techItems));

  var sectionStatus = document.createElement('div');
  sectionStatus.className = 'about-section';
  var h3Status = document.createElement('h3');
  h3Status.textContent = 'Status do projeto';
  sectionStatus.appendChild(h3Status);
  var pStatus = document.createElement('p');
  pStatus.textContent = 'O Lara World está na versão estável v1.0.0, com os três modos e os cinco mundos jogáveis.';
  sectionStatus.appendChild(pStatus);
  var subtitle = document.createElement('div');
  subtitle.className = 'about-subtitle';
  subtitle.textContent = 'Evoluções futuras';
  sectionStatus.appendChild(subtitle);
  var devItems = [
    'Salvar e continuar a campanha',
    'Histórico de aventuras e ranking',
    'Temas musicais por mundo',
    'Animação de asas dos dragões',
    'Novos mundos e minigames',
    'Expansão do banco de perguntas'
  ];
  var ulDev = document.createElement('ul');
  devItems.forEach(function (d) {
    var li = document.createElement('li');
    li.textContent = d;
    ulDev.appendChild(li);
  });
  sectionStatus.appendChild(ulDev);
  card.appendChild(sectionStatus);

  var musicCredits = [
    '🎵 “Gunma-chan Gambol” — Yubatake · OpenGameArt · CC BY 4.0',
    '🎵 “Upbeat Background Loop - Casual Video Game Music” — Cyberwave-Orchestra · Pixabay',
    '🎵 “So Happy With My 8-bit Game” — DJARTMUSIC · Pixabay'
  ];
  card.appendChild(_createSection('🎵 Músicas', musicCredits));

  var creditsItems = [
    'Desenvolvido por Wellington Lima',
    'Feito com amor para Lara Silva ❤️',
    'Projeto pessoal e educativo'
  ];
  card.appendChild(_createSection('Créditos', creditsItems));

  var backBtn = document.createElement('button');
  backBtn.className = 'about-back-btn';
  backBtn.textContent = '\u2190 Voltar ao Menu';
  card.appendChild(backBtn);

  _overlayEl.appendChild(card);

  _cardEl = card;
  _closeBtn = card.querySelector('.about-close-btn');
  if (_closeBtn) {
    _closeBtn.addEventListener('click', function () {
      hideAboutScreen();
    });
  }

  backBtn.addEventListener('click', function () {
    hideAboutScreen();
  });

  _updateVersion();
}

export function initAboutScreen() {
  console.log('[ABOUT] init executado');
  if (_initialized) return;
  _initialized = true;

  _overlayEl = document.getElementById('about-overlay');
  if (!_overlayEl) {
    console.error('[About] Elemento #about-overlay nao encontrado no DOM');
    return;
  }

  _renderContent();

  _overlayEl.addEventListener('click', _handleOverlayClick);
  document.addEventListener('keydown', _handleKeydown);
}

export function showAboutScreen() {
  console.log('[ABOUT] tela aberta');
  if (!_overlayEl) return;
  _lastFocusedElement = document.activeElement;
  if (_cardEl) {
    _cardEl.scrollTop = 0;
  }
  _overlayEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () {
    _overlayEl.classList.add('visible');
  });
  if (_closeBtn) {
    setTimeout(function () { _closeBtn.focus(); }, 100);
  }
}

export function hideAboutScreen() {
  if (!_overlayEl) return;
  _overlayEl.classList.remove('visible');
  document.body.style.overflow = '';
  var mainMenu = document.getElementById('main-menu');
  if (mainMenu) {
    mainMenu.classList.remove('hidden');
  }
  setTimeout(function () {
    _overlayEl.classList.add('hidden');
    if (_lastFocusedElement && _lastFocusedElement.focus) {
      _lastFocusedElement.focus();
    }
  }, 300);
}
