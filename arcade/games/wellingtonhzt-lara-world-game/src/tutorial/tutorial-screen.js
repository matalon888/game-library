/* ============================================
   Lara World — Tutorial Screen (src/tutorial/tutorial-screen.js)
   9-step onboarding with progress, keyboard, localStorage
   ============================================ */

import { TUTORIAL_STEPS, TUTORIAL_SEEN_KEY } from './tutorial-data.js';

console.log('[TUTORIAL] módulo carregado');

let _overlayEl = null;
let _cardEl = null;
let _contentEl = null;
let _dotsContainer = null;
let _prevBtn = null;
let _nextBtn = null;
let _closeBtn = null;
let _skipBtn = null;
let _stepCounterEl = null;
let _currentStep = 0;
let _initialized = false;
let _lastFocusedElement = null;

function _handleKeydown(e) {
  if (!_overlayEl || _overlayEl.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    hideTutorialScreen();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    _goNext();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    _goPrev();
  }
}

function _handleOverlayClick(e) {
  if (e.target === _overlayEl) {
    hideTutorialScreen();
  }
}

function _updateView() {
  if (!_contentEl || !_dotsContainer || !_prevBtn || !_nextBtn) return;

  var step = TUTORIAL_STEPS[_currentStep];
  if (!step) return;

  if (_cardEl) {
    _cardEl.scrollTop = 0;
  }

  if (_stepCounterEl) {
    _stepCounterEl.textContent = (_currentStep + 1) + ' de ' + TUTORIAL_STEPS.length;
  }

  _contentEl.innerHTML = '';
  var iconDiv = document.createElement('div');
  iconDiv.className = 'tutorial-step-icon';
  iconDiv.textContent = step.icon;
  _contentEl.appendChild(iconDiv);

  var titleDiv = document.createElement('div');
  titleDiv.className = 'tutorial-step-title';
  titleDiv.textContent = step.title;
  _contentEl.appendChild(titleDiv);

  var textDiv = document.createElement('div');
  textDiv.className = 'tutorial-step-text';
  textDiv.textContent = step.text;
  _contentEl.appendChild(textDiv);

  if (step.note) {
    var noteDiv = document.createElement('div');
    noteDiv.className = 'tutorial-step-note';
    noteDiv.textContent = step.note;
    _contentEl.appendChild(noteDiv);
  }

  if (step.items && step.items.length > 0) {
    var listDiv = document.createElement('div');
    listDiv.className = 'tutorial-step-list';
    step.items.forEach(function (item) {
      var itemDiv = document.createElement('div');
      itemDiv.className = 'tutorial-step-list-item';
      itemDiv.textContent = item;
      listDiv.appendChild(itemDiv);
    });
    _contentEl.appendChild(listDiv);
  }

  _dotsContainer.innerHTML = '';
  for (var i = 0; i < TUTORIAL_STEPS.length; i++) {
    var dot = document.createElement('span');
    dot.className = 'tutorial-dot' + (i === _currentStep ? ' active' : '');
    dot.setAttribute('aria-label', 'Passo ' + (i + 1));
    _dotsContainer.appendChild(dot);
  }

  _prevBtn.disabled = _currentStep === 0;
  _prevBtn.style.visibility = _currentStep === 0 ? 'hidden' : 'visible';

  var isLast = _currentStep === TUTORIAL_STEPS.length - 1;
  _nextBtn.textContent = isLast ? 'Começar a Jogar' : 'Próximo →';

  if (_skipBtn) {
    _skipBtn.style.display = isLast ? 'none' : '';
  }
}

function _goNext() {
  if (_currentStep < TUTORIAL_STEPS.length - 1) {
    _currentStep++;
    _updateView();
  } else {
    _markSeen();
    hideTutorialScreen();
  }
}

function _goPrev() {
  if (_currentStep > 0) {
    _currentStep--;
    _updateView();
  }
}

function _skipTutorial() {
  _markSeen();
  hideTutorialScreen();
}

function _markSeen() {
  try {
    localStorage.setItem(TUTORIAL_SEEN_KEY, JSON.stringify({ completed: true, version: 1 }));
  } catch (e) {
    /* silent */
  }
}

function _buildDOM() {
  if (!_overlayEl) return;

  _overlayEl.innerHTML = '';
  _overlayEl.classList.add('hidden');

  var card = document.createElement('div');
  card.className = 'tutorial-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Como Jogar');

  var closeBtn = document.createElement('button');
  closeBtn.className = 'tutorial-close-btn';
  closeBtn.setAttribute('aria-label', 'Fechar tutorial');
  closeBtn.textContent = '\u2715';
  card.appendChild(closeBtn);

  var stepCounter = document.createElement('div');
  stepCounter.className = 'tutorial-step-counter';
  _stepCounterEl = stepCounter;
  card.appendChild(stepCounter);

  var content = document.createElement('div');
  content.className = 'tutorial-content';
  card.appendChild(content);

  var dots = document.createElement('div');
  dots.className = 'tutorial-dots';
  card.appendChild(dots);

  var skipBtn = document.createElement('button');
  skipBtn.className = 'tutorial-skip-btn';
  skipBtn.textContent = 'Pular tutorial';
  card.appendChild(skipBtn);
  _skipBtn = skipBtn;

  var nav = document.createElement('div');
  nav.className = 'tutorial-nav';

  var prev = document.createElement('button');
  prev.className = 'tutorial-nav-btn tutorial-prev-btn';
  prev.textContent = '\u2190 Voltar';
  nav.appendChild(prev);

  var next = document.createElement('button');
  next.className = 'tutorial-nav-btn tutorial-next-btn';
  next.textContent = 'Próximo \u2192';
  nav.appendChild(next);

  card.appendChild(nav);
  _overlayEl.appendChild(card);

  _contentEl = content;
  _cardEl = card;
  _dotsContainer = dots;
  _prevBtn = prev;
  _nextBtn = next;
  _closeBtn = closeBtn;

  _closeBtn.addEventListener('click', function () {
    hideTutorialScreen();
  });
  _prevBtn.addEventListener('click', function () {
    _goPrev();
  });
  _nextBtn.addEventListener('click', function () {
    _goNext();
  });
  _skipBtn.addEventListener('click', function () {
    _skipTutorial();
  });

  _currentStep = 0;
  _updateView();
}

export function initTutorialScreen() {
  console.log('[TUTORIAL] init executado');
  if (_initialized) return;
  _initialized = true;

  _overlayEl = document.getElementById('tutorial-overlay');
  if (!_overlayEl) {
    console.error('[Tutorial] Elemento #tutorial-overlay não encontrado no DOM');
    return;
  }

  _buildDOM();
  _overlayEl.addEventListener('click', _handleOverlayClick);
  document.addEventListener('keydown', _handleKeydown);
}

export function showTutorialScreen() {
  console.log('[TUTORIAL] tela aberta');
  if (!_overlayEl) return;
  _lastFocusedElement = document.activeElement;
  _currentStep = 0;
  _updateView();
  _overlayEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function () {
    _overlayEl.classList.add('visible');
  });
  setTimeout(function () { _nextBtn.focus(); }, 100);
}

export function hideTutorialScreen() {
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

export function hasSeenTutorial() {
  try {
    var raw = localStorage.getItem(TUTORIAL_SEEN_KEY);
    if (raw === '1') return true;
    if (!raw) return false;
    var parsed = JSON.parse(raw);
    return parsed && parsed.completed === true;
  } catch (e) {
    return false;
  }
}

export function resetTutorialSeen() {
  try {
    localStorage.removeItem(TUTORIAL_SEEN_KEY);
  } catch (e) {
    /* silent */
  }
}
