/**
 * Redis client placeholder.
 * Install ioredis to activate: npm install ioredis
 *
 * Example usage:
 *   import redis from '../database/redis.js';
 *   await redis.set('key', 'value', 'EX', 3600);
 *   const val = await redis.get('key');
 */

let redis = null;

export const connectRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.log('[Redis] REDIS_URL not set – Redis disabled');
    return null;
  }
  try {
    // const Redis = (await import('ioredis')).default;
    // redis = new Redis(process.env.REDIS_URL);
    // redis.on('connect', () => console.log('[Redis] Connected'));
    // redis.on('error', (err) => console.error('[Redis] Error:', err));
    console.log('[Redis] Connection placeholder – install ioredis to enable');
  } catch (err) {
    console.error('[Redis] Failed to connect:', err.message);
  }
  return redis;
};

export default redis;
