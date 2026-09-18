import type Phaser from 'phaser';
import { CHARACTERS } from '../game/characters';
import { getFaceUrl } from '../game/faces';
import { getBestDistanceM, getLastCharacterId } from '../game/storage';
import { gameEvents } from '../game/events';
import type { RunResult } from '../game/types';

/**
 * All DOM/HTML overlay wiring lives here. The title, HUD, character
 * select screen, touch jump button and the game-over dialog are plain
 * HTML/CSS (see index.html + src/style.css) layered on top of the Phaser
 * canvas — this keeps every piece of text crisp and guarantees the title
 * can never be visually covered by a game graphic, on any screen size.
 */

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

const isTouchDevice = (): boolean =>
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function formatMeters(distanceM: number): string {
  return `${Math.floor(distanceM)} m`;
}

export function initUi(game: Phaser.Game): void {
  const hud = byId('hud');
  const hudDistance = byId('hud-distance');
  const hudBest = byId('hud-best');
  const jumpButton = byId<HTMLButtonElement>('jump-button');

  const selectScreen = byId('character-select-screen');
  const characterGrid = byId('character-grid');
  const selectBestScore = byId('select-best-score');
  const startButton = byId<HTMLButtonElement>('start-button');

  const gameOverDialog = byId('game-over-dialog');
  const gameOverDistance = byId('game-over-distance');
  const gameOverBest = byId('game-over-best');
  const gameOverRecord = byId('game-over-record');
  const retryButton = byId<HTMLButtonElement>('retry-button');
  const switchCharacterButton = byId<HTMLButtonElement>('switch-character-button');

  let selectedCharacterId = getLastCharacterId() ?? CHARACTERS[0].id;

  // --- Character select grid -------------------------------------------------
  const cardButtons = new Map<string, HTMLButtonElement>();

  function renderCharacterGrid(): void {
    characterGrid.innerHTML = '';
    cardButtons.clear();
    for (const character of CHARACTERS) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card';
      card.setAttribute('aria-pressed', String(character.id === selectedCharacterId));
      card.dataset.characterId = character.id;

      const img = document.createElement('img');
      img.src = getFaceUrl(character.facePath);
      img.alt = character.name;
      img.width = 88;
      img.height = 88;
      img.draggable = false;

      const name = document.createElement('span');
      name.className = 'character-name';
      name.textContent = character.name;

      card.append(img, name);
      card.addEventListener('click', () => selectCharacter(character.id));
      characterGrid.appendChild(card);
      cardButtons.set(character.id, card);
    }
    updateSelectionHighlight();
  }

  function updateSelectionHighlight(): void {
    for (const [id, card] of cardButtons) {
      const selected = id === selectedCharacterId;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
  }

  function selectCharacter(id: string): void {
    selectedCharacterId = id;
    updateSelectionHighlight();
  }

  // --- Screen visibility -------------------------------------------------
  function showSelectScreen(): void {
    selectBestScore.textContent = formatMeters(getBestDistanceM());
    selectScreen.classList.remove('hidden');
    gameOverDialog.classList.add('hidden');
    hud.classList.add('hidden');
    jumpButton.classList.add('hidden');
  }

  function showPlayUi(): void {
    selectScreen.classList.add('hidden');
    gameOverDialog.classList.add('hidden');
    hud.classList.remove('hidden');
    if (isTouchDevice()) jumpButton.classList.remove('hidden');
    hudDistance.textContent = `Distanz: ${formatMeters(0)}`;
    hudBest.textContent = `Bestwert: ${formatMeters(getBestDistanceM())}`;
  }

  function showGameOverDialog(result: RunResult): void {
    hud.classList.add('hidden');
    jumpButton.classList.add('hidden');
    gameOverDistance.textContent = `Distanz: ${formatMeters(result.distanceM)}`;
    gameOverBest.textContent = `Bestwert: ${formatMeters(result.bestDistanceM)}`;
    gameOverRecord.classList.toggle('hidden', !result.isNewRecord);
    gameOverDialog.classList.remove('hidden');
  }

  // --- Game control --------------------------------------------------------
  function startRun(characterId: string): void {
    showPlayUi();
    game.scene.stop('GameScene');
    game.scene.start('GameScene', { characterId });
  }

  startButton.addEventListener('click', () => startRun(selectedCharacterId));
  retryButton.addEventListener('click', () => startRun(selectedCharacterId));
  switchCharacterButton.addEventListener('click', () => {
    game.scene.stop('GameScene');
    showSelectScreen();
  });

  const onJumpButtonPress = (event: Event): void => {
    event.preventDefault();
    gameEvents.emitTyped('request-jump');
  };
  jumpButton.addEventListener('pointerdown', onJumpButtonPress);

  gameEvents.onTyped('distance-update', ({ distanceM }) => {
    hudDistance.textContent = `Distanz: ${formatMeters(distanceM)}`;
  });

  gameEvents.onTyped('game-over', (result) => {
    showGameOverDialog(result);
  });

  renderCharacterGrid();
  showSelectScreen();
}
