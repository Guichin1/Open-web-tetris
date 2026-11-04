const CLIMB_METERS_PER_SECOND = 1;
const METERS_PER_FLOOR = 10;
const GRID_PIXELS_PER_FLOOR = 128;
const INITIAL_RANK_PROGRESS = 10;
const RANK_PROGRESS_PER_LEVEL = 2;
const CLEAR_GRACE_SECONDS = 5;
const BASE_PROGRESS_DECAY_PER_SECOND = 0.25;
const PROGRESS_DECAY_PER_RANK = 0.05;
const ALTITUDE_PER_ATTACK = 0.5;

const BASE_ATTACK_BY_LINES = [0, 0, 1, 2, 4];

function requirementForRank(rank) {
  return INITIAL_RANK_PROGRESS + (rank - 1) * RANK_PROGRESS_PER_LEVEL;
}

function attackValueForClear(linesCleared, spinType, backToBack) {
  let attack = BASE_ATTACK_BY_LINES[linesCleared] ?? 0;
  if (spinType !== 'none') attack = Math.max(attack, linesCleared * 2 || 1);
  if (backToBack && attack > 0) attack++;
  return attack;
}

export class TowerMode {
  constructor() {
    this.id = 'tower';
    this.reset();
  }

  reset() {
    this.elapsedSeconds = 0;
    this.altitude = 0;
    this.floor = 1;
    this.climbRank = 1;
    this.climbProgress = 0;
    this.clearGraceRemaining = CLEAR_GRACE_SECONDS;
  }

  update(deltaMs) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;

    let remainingSeconds = deltaMs / 1000;
    this.elapsedSeconds += remainingSeconds;
    this.altitude += remainingSeconds * CLIMB_METERS_PER_SECOND * this.climbRank;

    if (this.clearGraceRemaining > 0) {
      const graceUsed = Math.min(this.clearGraceRemaining, remainingSeconds);
      this.clearGraceRemaining -= graceUsed;
      remainingSeconds -= graceUsed;
    }

    if (remainingSeconds > 0) {
      const decay = (BASE_PROGRESS_DECAY_PER_SECOND +
        (this.climbRank - 1) * PROGRESS_DECAY_PER_RANK) * remainingSeconds;
      this.climbProgress -= decay;
      if (this.climbProgress < 0) {
        this.climbRank = Math.max(1, this.climbRank - 1);
        this.climbProgress = 0;
      }
    }

    this.floor = Math.floor(this.altitude / METERS_PER_FLOOR) + 1;
  }

  onClear({ linesCleared, spinType = 'none', combo = -1, backToBack = false }) {
    if (!Number.isInteger(linesCleared) || linesCleared < 0 || linesCleared > 4) return;

    const attack = attackValueForClear(linesCleared, spinType, backToBack);
    if (attack > 0) {
      this.altitude += attack * ALTITUDE_PER_ATTACK * this.climbRank;
      this.floor = Math.floor(this.altitude / METERS_PER_FLOOR) + 1;
    }

    if (linesCleared === 0 && spinType === 'none') return;

    const comboProgress = combo > 0 ? Math.min(combo, 10) * 0.25 : 0;
    const spinProgress = spinType !== 'none' ? 1 : 0;
    const backToBackProgress = backToBack ? 0.5 : 0;
    this.climbProgress += linesCleared + comboProgress + spinProgress + backToBackProgress;
    this.clearGraceRemaining = CLEAR_GRACE_SECONDS;

    while (this.climbProgress >= requirementForRank(this.climbRank)) {
      this.climbProgress -= requirementForRank(this.climbRank);
      this.climbRank++;
      this.clearGraceRemaining = CLEAR_GRACE_SECONDS;
    }
  }

  getStatus() {
    return {
      altitude: this.altitude,
      floor: this.floor,
      climbRank: this.climbRank,
      climbProgress: this.climbProgress,
      climbRequirement: requirementForRank(this.climbRank),
      gridOffset: Number((
        (this.altitude % METERS_PER_FLOOR) *
        (GRID_PIXELS_PER_FLOOR / METERS_PER_FLOOR)
      ).toFixed(2)),
      gridSize: GRID_PIXELS_PER_FLOOR,
    };
  }
}
