// lib/skins.ts
// Cosmetic radio skin registry. Each skin defines a complete visual theme
// (colors, fonts, spacing) that RadioBody and other UI components consume.
// Skins are purchasable via IAP; the `default` skin is free.

export interface SkinColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  /** Power indicator LED color — distinct from accent for skins with multiple highlight colors */
  power: string;
  /** Station name display color — distinct from accent for skins with multiple highlight colors */
  station: string;
}

export interface SkinFonts {
  primary: string;
  secondary: string;
}

export interface SkinSpacing {
  compact: number;
  comfortable: number;
}

export interface Skin {
  id: string;
  name: string;
  description: string;
  price: number;
  colors: SkinColors;
  fonts: SkinFonts;
  spacing: SkinSpacing;
}

const DEFAULT_SKIN: Skin = {
  id: 'default',
  name: 'Default CRT',
  description: 'Classic green-phosphor CRT terminal.',
  price: 0,
  colors: {
    background: '#030303',
    surface: '#0A0A0A',
    text: '#E0E0E0',
    textSecondary: '#666666',
    accent: '#FF8C00',
    border: '#2A2A2A',
    power: '#39FF14',
    station: '#FF8C00',
  },
  fonts: {
    primary: 'Courier',
    secondary: 'Courier New',
  },
  spacing: {
    compact: 4,
    comfortable: 16,
  },
};

const SKIN_REGISTRY: Record<string, Skin> = {
  default: DEFAULT_SKIN,
  vintage_wood: {
    id: 'vintage_wood',
    name: 'Vintage Wood',
    description: 'Warm walnut cabinet radio from the 1940s.',
    price: 0.99,
    colors: {
      background: '#3E2723',
      surface: '#5D4037',
      text: '#D7CCC8',
      textSecondary: '#A1887F',
      accent: '#A1887F',
      border: '#4E342E',
      power: '#A1887F',
      station: '#A1887F',
    },
    fonts: {
      primary: 'Georgia',
      secondary: 'Times New Roman',
    },
    spacing: {
      compact: 4,
      comfortable: 18,
    },
  },
  military_green: {
    id: 'military_green',
    name: 'Military Green',
    description: 'Tactical field radio, olive drab casing.',
    price: 0.99,
    colors: {
      background: '#1B2417',
      surface: '#2E3B23',
      text: '#C5D1A0',
      textSecondary: '#8BC34A',
      accent: '#8BC34A',
      border: '#1B3A0A',
      power: '#8BC34A',
      station: '#8BC34A',
    },
    fonts: {
      primary: 'Courier',
      secondary: 'Courier New',
    },
    spacing: {
      compact: 4,
      comfortable: 16,
    },
  },
  space_age_blue: {
    id: 'space_age_blue',
    name: 'Space Age Blue',
    description: 'Futuristic cockpit interface from orbit.',
    price: 0.99,
    colors: {
      background: '#0A0E27',
      surface: '#1A1F4E',
      text: '#82B1FF',
      textSecondary: '#448AFF',
      accent: '#448AFF',
      border: '#1A237E',
      power: '#448AFF',
      station: '#448AFF',
    },
    fonts: {
      primary: 'Courier New',
      secondary: 'Courier',
    },
    spacing: {
      compact: 6,
      comfortable: 20,
    },
  },
  digital_pixel: {
    id: 'digital_pixel',
    name: 'Digital Pixel',
    description: '8-bit retro green terminal, pure matrix.',
    price: 0.99,
    colors: {
      background: '#0A0A0A',
      surface: '#111111',
      text: '#33FF33',
      textSecondary: '#00CC00',
      accent: '#00FF00',
      border: '#003300',
      power: '#00FF00',
      station: '#00FF00',
    },
    fonts: {
      primary: 'Courier',
      secondary: 'Courier New',
    },
    spacing: {
      compact: 2,
      comfortable: 14,
    },
  },
};

export const SKINS: Record<string, Skin> = SKIN_REGISTRY;

export const SKIN_IDS = Object.keys(SKINS);

export const PURCHASABLE_SKIN_IDS = SKIN_IDS.filter((id) => (SKIN_REGISTRY[id]?.price ?? 0) > 0);

export function getSkin(skinId: string): Skin {
  return SKIN_REGISTRY[skinId] ?? DEFAULT_SKIN;
}

export const DEFAULT_SKIN_ID = 'default';
