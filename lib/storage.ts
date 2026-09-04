import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn('storage', `Failed to read key "${key}"`, error);
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.warn('storage', `Failed to write key "${key}"`, error);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logger.warn('storage', `Failed to remove key "${key}"`, error);
    }
  },
};
