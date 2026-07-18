import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../../lib/storage';

jest.mock('@react-native-async-storage/async-storage');

const mockAsyncStorage = jest.mocked(AsyncStorage);

describe('Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets value by key', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({ test: 'value' }));

    const result = await storage.get<{ test: string }>('test-key');
    expect(result).toEqual({ test: 'value' });
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('returns null for missing key', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);

    const result = await storage.get('missing');
    expect(result).toBeNull();
  });

  it('sets value by key', async () => {
    await storage.set('test-key', { foo: 'bar' });
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify({ foo: 'bar' }),
    );
  });

  it('removes value by key', async () => {
    await storage.remove('test-key');
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
  });
});
