import { TowerMode } from './modes/tower.js';

class ClassicMode {
  constructor() {
    this.id = 'classic';
  }

  reset() {}

  update() {}

  getStatus() {
    return null;
  }
}

const MODE_FACTORIES = new Map([
  ['classic', () => new ClassicMode()],
  ['tower', () => new TowerMode()],
]);

export function createGameMode(modeId) {
  const createMode = MODE_FACTORIES.get(modeId);
  if (!createMode) throw new RangeError(`Unknown game mode: ${modeId}`);
  return createMode();
}
