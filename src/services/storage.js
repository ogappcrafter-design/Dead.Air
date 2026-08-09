import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVE_KEY = 'dead_air_save_v1';
export const PURCHASE_KEY = 'dead_air_purchases_v1';

/**
 * Storage is best-effort: a game that cannot write its save should keep
 * playing rather than crash, so every path swallows and reports failure.
 */
export async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function clearKeys(keys) {
  try {
    await AsyncStorage.multiRemove(keys);
    return true;
  } catch {
    return false;
  }
}
