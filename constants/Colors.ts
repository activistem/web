export type AppColors = {
  bg: string;
  primary: string;
  primary2: string;
  green: string;
  green2: string;
  text: string;
  textBody: string;
  muted: string;
  mutedLight: string;
  faint: string;
  glass: string;
  glassBorder: string;
  card: string;
  cardBorder: string;
  surface: string;
  headerBg: string;
  inputBg: string;
  tabBarBg: string;
  overlay45: string;
  overlay30: string;
  divider: string;
};

export const darkColors: AppColors = {
  bg: '#080714',
  primary: '#7C5BF5',
  primary2: '#A78BFA',
  green: '#00D084',
  green2: '#00F596',
  text: '#FFFFFF',
  textBody: 'rgba(255,255,255,0.82)',
  muted: 'rgba(255,255,255,0.55)',
  mutedLight: 'rgba(255,255,255,0.38)',
  faint: 'rgba(255,255,255,0.2)',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.08)',
  surface: '#1a1730',
  headerBg: 'rgba(8,7,20,0.9)',
  inputBg: 'rgba(255,255,255,0.07)',
  tabBarBg: '#080714',
  overlay45: 'rgba(255,255,255,0.45)',
  overlay30: 'rgba(255,255,255,0.3)',
  divider: 'rgba(255,255,255,0.07)',
};

export const lightColors: AppColors = {
  bg: '#F5F3FF',
  primary: '#7C5BF5',
  primary2: '#5B3FD4',
  green: '#00A86B',
  green2: '#00C97A',
  text: '#0D0B1A',
  textBody: 'rgba(13,11,26,0.82)',
  muted: 'rgba(13,11,26,0.5)',
  mutedLight: 'rgba(13,11,26,0.35)',
  faint: 'rgba(13,11,26,0.2)',
  glass: 'rgba(13,11,26,0.04)',
  glassBorder: 'rgba(13,11,26,0.12)',
  card: 'rgba(13,11,26,0.04)',
  cardBorder: 'rgba(13,11,26,0.1)',
  surface: '#FFFFFF',
  headerBg: 'rgba(245,243,255,0.94)',
  inputBg: 'rgba(13,11,26,0.06)',
  tabBarBg: '#F5F3FF',
  overlay45: 'rgba(13,11,26,0.4)',
  overlay30: 'rgba(13,11,26,0.28)',
  divider: 'rgba(13,11,26,0.08)',
};

// backward-compat default (dark)
export const Colors = darkColors;
