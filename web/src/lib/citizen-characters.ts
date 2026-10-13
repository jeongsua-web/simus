/** Stable appearance IDs shared with Unity's Happiness modular character variants. */
export const CITIZEN_CHARACTERS = [
  { id: 'npc_01', label: '짧은 가르마', portrait: '/characters/custom/npc_01_none.png' },
  { id: 'npc_02', label: '비니 · 짧은 머리', portrait: '/characters/custom/npc_02_none.png' },
  { id: 'npc_03', label: '앞머리 단발', portrait: '/characters/custom/npc_03_none.png' },
  { id: 'npc_04', label: '단발', portrait: '/characters/custom/npc_04_none.png' },
  { id: 'npc_05', label: '앞머리 포니테일', portrait: '/characters/custom/npc_05_none.png' },
  { id: 'npc_06', label: '모자 · 포니테일', portrait: '/characters/custom/npc_06_none.png' },
  { id: 'npc_07', label: '양갈래 머리', portrait: '/characters/custom/npc_07_none.png' },
  { id: 'npc_08', label: '옆으로 묶은 머리', portrait: '/characters/custom/npc_08_none.png' },
  { id: 'npc_09', label: '앞머리 긴 생머리', portrait: '/characters/custom/npc_09_none.png' },
  { id: 'npc_10', label: '긴 생머리', portrait: '/characters/custom/npc_10_none.png' },
  { id: 'npc_11', label: '모자 · 곱슬 단발', portrait: '/characters/custom/npc_11_none.png' },
  { id: 'npc_12', label: '올림머리', portrait: '/characters/custom/npc_12_none.png' },
  { id: 'npc_13', label: '민머리', portrait: '/characters/custom/npc_13_none.png' },
  { id: 'npc_14', label: '긴 곱슬머리', portrait: '/characters/custom/npc_14_none.png' },
  { id: 'npc_15', label: '앞머리 짧은 머리', portrait: '/characters/custom/npc_15_none.png' },
  { id: 'npc_16', label: '낮게 묶은 짧은 머리', portrait: '/characters/custom/npc_16_none.png' },
] as const;

export type CitizenCharacter = (typeof CITIZEN_CHARACTERS)[number];
export type CitizenCharacterId = CitizenCharacter['id'];
export function isCitizenCharacterId(value: unknown): value is CitizenCharacterId {
  return typeof value === 'string' && CITIZEN_CHARACTERS.some(character => character.id === value);
}
export const CITIZEN_GLASSES = [
  { id: 'none', label: '안경 없음' },
  { id: 'square', label: '사각 안경' },
  { id: 'round', label: '동그란 안경' },
] as const;
export type CitizenGlassesId = (typeof CITIZEN_GLASSES)[number]['id'];
export function isCitizenGlassesId(value: unknown): value is CitizenGlassesId {
  return typeof value === 'string' && CITIZEN_GLASSES.some(glasses => glasses.id === value);
}
export function getDefaultCitizenGlasses(id?: string | null): CitizenGlassesId {
  return id === 'npc_01' ? 'square' : id === 'npc_04' ? 'round' : 'none';
}
export function getCitizenPortrait(id: CitizenCharacterId, glassesId: CitizenGlassesId): string {
  return `/characters/custom/${id}_${glassesId}.png`;
}
export function getCitizenCharacter(id?: string | null, glassesId?: string | null):
  (Omit<CitizenCharacter, 'portrait'> & { portrait: string }) | undefined {
  const character = CITIZEN_CHARACTERS.find(character => character.id === id);
  if (!character) return undefined;
  const glasses = isCitizenGlassesId(glassesId) ? glassesId : getDefaultCitizenGlasses(id);
  return { ...character, portrait: getCitizenPortrait(character.id, glasses) };
}
/** Compatibility alias used by server projections for existing records. */
export const defaultCitizenGlasses = getDefaultCitizenGlasses;
