import { useEnv } from '@directus/env';
import { getSimpleHash } from '@directus/utils';
import Keyv from 'keyv';
import { useBus } from './bus/index.js';
import { useLogger } from './logger.js';
import { redisConfigAvailable } from './redis/index.js';
import { compress, decompress } from './utils/compress.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';
import { getMilliseconds } from './utils/get-milliseconds.js';
import { validateEnv } from './utils/validate-env.js';
import { createRequire } from 'node:module';
const logger = useLogger();
const env = useEnv();
const require = createRequire(import.meta.url);
let cache = null;
let systemCache = null;
let localSchemaCache = null;
let sharedSchemaCache = null;
let lockCache = null;
let messengerSubscribed = false;
const messenger = useBus();
if (redisConfigAvailable() && env['CACHE_STORE'] === 'memory' && env['CACHE_AUTO_PURGE'] && !messengerSubscribed) {
    messengerSubscribed = true;
    messenger.subscribe('schemaChanged', async (opts) => {
        if (cache && opts?.['autoPurgeCache'] !== false) {
            await cache.clear();
        }
    });
}
export function getCache() {
    if (env['CACHE_ENABLED'] === true && cache === null) {
        validateEnv(['CACHE_NAMESPACE', 'CACHE_TTL', 'CACHE_STORE']);
        cache = getKeyvInstance(env['CACHE_STORE'], getMilliseconds(env['CACHE_TTL']));
        cache.on('error', (err) => logger.warn(err, `[cache] ${err}`));
    }
    if (systemCache === null) {
        systemCache = getKeyvInstance(env['CACHE_STORE'], getMilliseconds(env['CACHE_SYSTEM_TTL']), '_system');
        systemCache.on('error', (err) => logger.warn(err, `[system-cache] ${err}`));
    }
    if (sharedSchemaCache === null) {
        sharedSchemaCache = getKeyvInstance(env['CACHE_STORE'], getMilliseconds(env['CACHE_SYSTEM_TTL']), '_schema_shared');
        sharedSchemaCache.on('error', (err) => logger.warn(err, `[shared-schema-cache] ${err}`));
    }
    if (localSchemaCache === null) {
        localSchemaCache = getKeyvInstance('memory', getMilliseconds(env['CACHE_SYSTEM_TTL']), '_schema');
        localSchemaCache.on('error', (err) => logger.warn(err, `[schema-cache] ${err}`));
    }
    if (lockCache === null) {
        lockCache = getKeyvInstance(env['CACHE_STORE'], undefined, '_lock');
        lockCache.on('error', (err) => logger.warn(err, `[lock-cache] ${err}`));
    }
    return { cache, systemCache, sharedSchemaCache, localSchemaCache, lockCache };
}
export async function flushCaches(forced) {
    const { cache } = getCache();
    await clearSystemCache({ forced });
    await cache?.clear();
}
export async function clearSystemCache(opts) {
    const { systemCache, localSchemaCache, lockCache, sharedSchemaCache } = getCache();
    // Flush system cache when forced or when system cache lock not set
    if (opts?.forced || !(await lockCache.get('system-cache-lock'))) {
        await lockCache.set('system-cache-lock', true, 10000);
        await systemCache.clear();
        await lockCache.delete('system-cache-lock');
    }
    await sharedSchemaCache.clear();
    await localSchemaCache.clear();
    messenger.publish('schemaChanged', { autoPurgeCache: opts?.autoPurgeCache });
}
export async function setSystemCache(key, value, ttl) {
    const { systemCache, lockCache } = getCache();
    if (!(await lockCache.get('system-cache-lock'))) {
        await setCacheValue(systemCache, key, value, ttl);
    }
}
export async function getSystemCache(key) {
    const { systemCache } = getCache();
    return await getCacheValue(systemCache, key);
}
export async function setSchemaCache(schema) {
    const { localSchemaCache, sharedSchemaCache } = getCache();
    const schemaHash = getSimpleHash(JSON.stringify(schema));
    await sharedSchemaCache.set('hash', schemaHash);
    await localSchemaCache.set('schema', schema);
    await localSchemaCache.set('hash', schemaHash);
}
export async function getSchemaCache() {
    const { localSchemaCache, sharedSchemaCache } = getCache();
    const sharedSchemaHash = await sharedSchemaCache.get('hash');
    if (!sharedSchemaHash)
        return;
    const localSchemaHash = await localSchemaCache.get('hash');
    if (!localSchemaHash || localSchemaHash !== sharedSchemaHash)
        return;
    return await localSchemaCache.get('schema');
}
export async function setCacheValue(cache, key, value, ttl) {
    const compressed = await compress(value);
    await cache.set(key, compressed, ttl);
}
export async function getCacheValue(cache, key) {
    const value = await cache.get(key);
    if (!value)
        return undefined;
    const decompressed = await decompress(value);
    return decompressed;
}
function getKeyvInstance(store, ttl, namespaceSuffix) {
    switch (store) {
        case 'redis':
            return new Keyv(getConfig('redis', ttl, namespaceSuffix));
        case 'memory':
        default:
            return new Keyv(getConfig('memory', ttl, namespaceSuffix));
    }
}
function getConfig(store = 'memory', ttl, namespaceSuffix = '') {
    const config = {
        namespace: `${env['CACHE_NAMESPACE']}${namespaceSuffix}`,
        ttl,
    };
    if (store === 'redis') {
        const KeyvRedis = require('@keyv/redis');
        config.store = new KeyvRedis(env['REDIS'] || getConfigFromEnv('REDIS'), { useRedisSets: false });
    }
    return config;
}
