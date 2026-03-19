export function getLevelFromXP(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

export function getXPForNextLevel(level: number): number {
  return Math.pow(level + 1, 2) * 100
}

export function getXPForCurrentLevel(level: number): number {
  return Math.pow(level, 2) * 100
}

export function getProgress(xp: number) {
  const level = getLevelFromXP(xp)

  const currentLevelXP = getXPForCurrentLevel(level)
  const nextLevelXP = getXPForNextLevel(level)

  const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP)

  return {
    level,
    currentLevelXP,
    nextLevelXP,
    progress,
  }
}