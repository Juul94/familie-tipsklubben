export const SUPERLIGA_TEAMS = [
  'FCK',
  'Brøndby',
  'FCM',
  'AGF',
  'FCN',
  'Randers',
  'Silkeborg',
  'Viborg',
  'Sønderjyske',
  'OB',
  'Lyngby',
  'Horsens',
] as const;

export type SuperligaTeam = (typeof SUPERLIGA_TEAMS)[number];
