export const CHUMA_LEVELS = [
  {
    id: 'beginner',
    min: 0,
    max: 5,
    name: 'BEGINNER CHUMA',
    malayalamName: 'തുടക്കക്കാരൻ ചുമ',
    badge: 'LVL 1 - AMATEUR',
    color: '#34d399',
    description: 'Mild acoustic disturbance. Lungs are still functioning within acceptable civil parameters.'
  },
  {
    id: 'enthusiast',
    min: 6,
    max: 15,
    name: 'CHUMA ENTHUSIAST',
    malayalamName: 'ചുമ പ്രേമി',
    badge: 'LVL 2 - HOBBYIST',
    color: '#fbbf24',
    description: 'Noticeable respiratory passion. You are coughing with genuine artistic intent.'
  },
  {
    id: 'specialist',
    min: 16,
    max: 30,
    name: 'CHUMA SPECIALIST',
    malayalamName: 'സ്പെഷ്യലിസ്റ്റ് ചുമ',
    badge: 'LVL 3 - EXPERT',
    color: '#f97316',
    description: 'Advanced thoracic vibration detected. People in 50-meter radius are putting on masks.'
  },
  {
    id: 'promax',
    min: 31,
    max: 50,
    name: 'CHUMA PRO MAX',
    malayalamName: 'ചുമ പ്രോ മാക്സ്',
    badge: 'LVL 4 - TITAN',
    color: '#ff334b',
    description: 'Industrial grade coughing. Biological warranty of your trachea is officially void.'
  },
  {
    id: 'finalboss',
    min: 51,
    max: Infinity,
    name: 'CHUMA FINAL BOSS',
    malayalamName: 'അന്തിമ ചുമ ദൈവം',
    badge: 'LVL MAX - APOCALYPSE',
    color: '#a855f7',
    description: 'God-tier bronchial catastrophe. Local seismographs are recording anomalous tremors.'
  }
];

export function getChumaLevel(coughCount) {
  const count = Math.max(0, coughCount || 0);
  for (const level of CHUMA_LEVELS) {
    if (count >= level.min && count <= level.max) {
      return level;
    }
  }
  return CHUMA_LEVELS[CHUMA_LEVELS.length - 1];
}

export function getLevelProgress(coughCount) {
  const level = getChumaLevel(coughCount);
  if (level.max === Infinity) {
    return { progress: 100, remaining: 0, nextLevel: null };
  }
  const range = level.max - level.min + 1;
  const currentInRange = coughCount - level.min;
  const progress = Math.min(100, Math.round((currentInRange / range) * 100));
  const remaining = (level.max + 1) - coughCount;
  const nextLevelIndex = CHUMA_LEVELS.findIndex(l => l.id === level.id) + 1;
  const nextLevel = CHUMA_LEVELS[nextLevelIndex] || null;

  return { progress, remaining, nextLevel };
}
