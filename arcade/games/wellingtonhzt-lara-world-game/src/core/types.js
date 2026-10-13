/**
 * @typedef {Object} QuestionPolicy
 * @property {Object.<string, number>} categoryWeights - Pesos percentuais por categoria
 * @property {{ min?: number, max?: number }} [levelRange] - Faixa de nível (1-3)
 */

/**
 * @typedef {Object} WorldConfig
 * @property {string} id - Identificador único do mundo ("floresta-encantada")
 * @property {string} name - Nome exibido ("🌳 Floresta Encantada")
 * @property {string} description - Descrição do mundo
 * @property {string} version - Versão do config ("1.0")
 * @property {"main"|"subworld"} type - Se é mundo principal ou submundo
 * @property {ThemeConfig} theme - Configuração visual
 * @property {BoardConfig} board - Configuração do tabuleiro
 * @property {RulesConfig} rules - Regras específicas do mundo
 * @property {ObjectiveConfig[]} objectives - Objetivos de vitória
 * @property {PortalConfig[]} portals - Portais do mundo
 * @property {QuestionPolicy} [questionPolicy] - Política de seleção de perguntas
 * @property {AssetsConfig} assets - Assets do mundo (sons, sprites, bg)
 * @property {Object.<number, EventConfig[]>} events - Mapa casa → eventos
 * @property {Object.<string, Function>} [customEventHandlers] - Handlers de eventos customizados
 * @property {string[]} [subWorlds] - IDs dos submundos associados
 */

/**
 * @typedef {Object} ThemeConfig
 * @property {string} cssClass - Classe CSS do mundo
 * @property {Object} colors - Cores do tema
 * @property {string} colors.primary
 * @property {string} colors.secondary
 * @property {string} colors.accent
 * @property {string} colors.background
 * @property {string} colors.text
 * @property {string} colors.cellDefault
 * @property {string} colors.cellSpecial
 * @property {Object} gradients - Gradientes CSS
 * @property {string} gradients.background
 * @property {string} [gradients.overlay]
 * @property {Decoration[]} decorations - Decorações/partículas
 * @property {string[]} animations - Animações do tema
 */

/**
 * @typedef {Object} LayoutEntry
 * @property {string} id - Identificador único do layout (ex: "padrao", "orbita")
 * @property {string} name - Nome exibido (ex: "Padrão", "Órbita")
 * @property {string} description - Descrição curta do formato
 * @property {Array<{id: number, x: number, y: number}>} cells - Posições % das casas
 */

/**
 * @typedef {Object} BoardConfig
 * @property {number} totalCells - Total de casas
 * @property {number} startCell - Casa inicial
 * @property {number} finishCell - Casa final (vitória)
 * @property {Object.<number, {x: number, y: number}>} [positions] - Posições % das casas (formato mapa)
 * @property {Array<{id: number, x: number, y: number}>} [cells] - Posições % das casas (formato array, alternativa ao positions)
 * @property {Object.<string, LayoutEntry>} [layouts] - Múltiplos formatos de tabuleiro (alternativa a cells/positions)
 * @property {string} [defaultLayout] - ID do layout padrão (obrigatório se layouts existir)
 * @property {string[]} cellIcons - Emoji/ícone por casa
 * @property {"linear"|"circular"|"branched"} pathType - Tipo da trilha
 */

/**
 * @typedef {Object} RulesConfig
 * @property {"d6"|"d8"|"d12"|"custom"} diceType - Tipo de dado
 * @property {boolean} passStartBonus - Ganha bônus ao passar início?
 * @property {boolean} reverseMovement - Movimento reverso?
 * @property {string[]} extraDiceConditions - Condições para dado extra
 * @property {number} [slipChance] - Chance de escorregar (0-1)
 * @property {number} [slipDelta] - Casas para trás ao escorregar
 */

/**
 * @typedef {Object} ObjectiveConfig
 * @property {"reachEnd"|"collectItems"|"answerQuestions"|"findKey"|"defeatBoss"} type
 * @property {Object} [params] - Parâmetros do objetivo
 * @property {string} label - Descrição exibida
 * @property {boolean} [optional] - Objetivo secundário?
 */

/**
 * @typedef {Object} PortalConfig
 * @property {string} id - ID único do portal
 * @property {string} name - Nome exibido
 * @property {string} description - Descrição
 * @property {number} sourceCell - Casa que ativa o portal
 * @property {"fixed"|"secret"|"temporary"|"conditional"|"one-way"} type
 * @property {string} targetWorldId - ID do mundo de destino
 * @property {Object} entrance - Configuração de entrada
 * @property {string} entrance.message - Mensagem ao encontrar portal
 * @property {string} [entrance.effect] - Efeito visual ("fade"|"zoom"|"flash")
 * @property {boolean} entrance.requiresConfirmation - Jogador escolhe?
 * @property {Object} [entrance.requirements] - Requisitos (portal condicional)
 * @property {Object} exitBehavior - Comportamento ao sair do submundo
 * @property {number} exitBehavior.returnCell - Casa de retorno
 * @property {number} exitBehavior.bonusCells - Casas bônus ao retornar
 * @property {string} exitBehavior.message - Mensagem de retorno
 * @property {boolean} exitBehavior.clearsPenalties - Remove penalidades?
 * @property {Object} lifetime - Ciclo de vida do portal
 * @property {number|null} lifetime.maxActivations
 * @property {number|null} lifetime.expiresAfterTurn
 * @property {boolean} lifetime.expiresOnComplete
 */

/**
 * @typedef {Object} EventConfig
 * @property {"move"|"challenge"|"skipTurn"|"extraTurn"|"portal"|"resetPosition"|"finishWorld"|"item"} type
 * @property {Object} [params] - Parâmetros do evento
 * @property {number} [params.target] - Casa alvo (move/resetPosition)
 * @property {number} [params.delta] - Deslocamento (move)
 * @property {string} [params.category] - Categoria do desafio (challenge)
 * @property {string} [params.portalId] - ID do portal (portal)
 * @property {string} [params.itemId] - ID do item (item)
 * @property {number} [params.count] - Quantidade (item/skipTurn)
 * @property {string} [description] - Texto exibido ao jogador
 * @property {Object} [condition] - Condição para disparo
 * @property {string} condition.type - Tipo da condição
 * @property {*} [condition.value] - Valor da condição
 * @property {number} [probability] - Chance de disparar (0-1)
 * @property {boolean} [once] - Dispara apenas uma vez?
 */

/**
 * @typedef {Object} GameSession
 * @property {"rapido"|"carreira"} modoJogo - Modo de jogo
 * @property {string} worldId - ID do mundo escolhido
 * @property {boolean} isRandom - Mundo aleatório?
 * @property {string} campaignId - ID da campanha (Carreira)
 * @property {string[]} worlds - Ordem dos mundos
 * @property {number} currentWorldIndex - Índice do mundo atual
 * @property {string[]} completedWorlds - Mundos concluídos
 * @property {number} campaignScore - Placar acumulado
 * @property {Player[]} players - Jogadores
 * @property {boolean} isSinglePlayer - Modo 1 jogador?
 * @property {Object} drawState - Estado do sorteio
 * @property {number} seed - Seed de aleatoriedade
 */

/**
 * @typedef {Object} GameState
 * @property {string} mundoAtual - ID do mundo carregado
 * @property {PlayerState[]} players - Estado dos jogadores
 * @property {number} currentPlayerIndex - Índice do jogador atual
 * @property {number} turnCount - Contador de turnos
 * @property {boolean} isMoving - Animação em andamento?
 * @property {boolean} gameOver - Jogo encerrado?
 * @property {boolean} botScheduled - Turno do bot agendado?
 * @property {Object[]} worldStack - Pilha de mundos (portal)
 * @property {boolean} overlayActive - Overlay visível?
 * @property {string|null} overlayType - Tipo do overlay ativo
 * @property {Object[]} history - Histórico da partida
 */

/**
 * @typedef {Object} PlayerState
 * @property {number} id - ID do jogador
 * @property {string} name - Nome
 * @property {string} emoji - Emoji do avatar
 * @property {number} posicao - Casa atual
 * @property {number} rodadasPerdidas - Rodadas perdidas restantes
 * @property {boolean} isBot - É bot?
 */

/**
 * @typedef {Object} QuestionItem
 * @property {string} id - ID único da pergunta
 * @property {string} category - Categoria
 * @property {string} subcategory - Subcategoria
 * @property {string} question - Texto da pergunta
 * @property {string[]} options - Opções de resposta
 * @property {number} correctOption - Índice da resposta correta
 * @property {string} explanation - Explicação da resposta
 * @property {number} level - Nível de dificuldade (1-5)
 * @property {string[]} tags - Tags para filtragem
 * @property {boolean} active - Se a pergunta está ativa
 */

/**
 * @typedef {Object.<string, QuestionItem[]>} QuestionCatalog
 */
