import { Action } from '@directus/constants';
import { InvalidPayloadError, UnprocessableContentError } from '@directus/errors';
import Joi from 'joi';
import { assign, pick } from 'lodash-es';
import objectHash from 'object-hash';
import { getCache } from '../cache.js';
import getDatabase from '../database/index.js';
import emitter from '../emitter.js';
import { shouldClearCache } from '../utils/should-clear-cache.js';
import { ActivityService } from './activity.js';
import { AuthorizationService } from './authorization.js';
import { ItemsService } from './items.js';
import { PayloadService } from './payload.js';
import { RevisionsService } from './revisions.js';
export class VersionsService extends ItemsService {
    authorizationService;
    constructor(options) {
        super('directus_versions', options);
        this.authorizationService = new AuthorizationService({
            accountability: this.accountability,
            knex: this.knex,
            schema: this.schema,
        });
    }
    async validateCreateData(data) {
        if (!data['key'])
            throw new InvalidPayloadError({ reason: `"key" is required` });
        // Reserves the "main" version key for the version query parameter
        if (data['key'] === 'main')
            throw new InvalidPayloadError({ reason: `"main" is a reserved version key` });
        if (!data['collection']) {
            throw new InvalidPayloadError({ reason: `"collection" is required` });
        }
        if (!data['item'])
            throw new InvalidPayloadError({ reason: `"item" is required` });
        const { CollectionsService } = await import('./collections.js');
        const collectionsService = new CollectionsService({
            accountability: null,
            knex: this.knex,
            schema: this.schema,
        });
        const existingCollection = await collectionsService.readOne(data['collection']);
        if (!existingCollection.meta?.versioning) {
            throw new UnprocessableContentError({
                reason: `Content Versioning is not enabled for collection "${data['collection']}"`,
            });
        }
        const existingVersions = await super.readByQuery({
            aggregate: { count: ['*'] },
            filter: { key: { _eq: data['key'] }, collection: { _eq: data['collection'] }, item: { _eq: data['item'] } },
        });
        if (existingVersions[0]['count'] > 0) {
            throw new UnprocessableContentError({
                reason: `Version "${data['key']}" already exists for item "${data['item']}" in collection "${data['collection']}"`,
            });
        }
        // will throw an error if the accountability does not have permission to read the item
        await this.authorizationService.checkAccess('read', data['collection'], data['item']);
    }
    async getMainItem(collection, item, query) {
        // will throw an error if the accountability does not have permission to read the item
        await this.authorizationService.checkAccess('read', collection, item);
        const itemsService = new ItemsService(collection, {
            knex: this.knex,
            accountability: this.accountability,
            schema: this.schema,
        });
        return await itemsService.readOne(item, query);
    }
    async verifyHash(collection, item, hash) {
        const mainItem = await this.getMainItem(collection, item);
        const mainHash = objectHash(mainItem);
        return { outdated: hash !== mainHash, mainHash };
    }
    async getVersionSavesById(id) {
        const revisionsService = new RevisionsService({
            knex: this.knex,
            schema: this.schema,
        });
        const result = await revisionsService.readByQuery({
            filter: { version: { _eq: id } },
        });
        return result.map((revision) => revision['delta']);
    }
    async getVersionSaves(key, collection, item) {
        const filter = {
            key: { _eq: key },
            collection: { _eq: collection },
        };
        if (item) {
            filter['item'] = { _eq: item };
        }
        const versions = await this.readByQuery({ filter });
        if (!versions?.[0])
            return null;
        const saves = await this.getVersionSavesById(versions[0]['id']);
        return saves;
    }
    async createOne(data, opts) {
        await this.validateCreateData(data);
        const mainItem = await this.getMainItem(data['collection'], data['item']);
        data['hash'] = objectHash(mainItem);
        return super.createOne(data, opts);
    }
    async createMany(data, opts) {
        if (!Array.isArray(data)) {
            throw new InvalidPayloadError({ reason: 'Input should be an array of items' });
        }
        const keyCombos = new Set();
        for (const item of data) {
            await this.validateCreateData(item);
            const keyCombo = `${item['key']}-${item['collection']}-${item['item']}`;
            if (keyCombos.has(keyCombo)) {
                throw new UnprocessableContentError({
                    reason: `Cannot create multiple versions on "${item['item']}" in collection "${item['collection']}" with the same key "${item['key']}"`,
                });
            }
            keyCombos.add(keyCombo);
            const mainItem = await this.getMainItem(item['collection'], item['item']);
            item['hash'] = objectHash(mainItem);
        }
        return super.createMany(data, opts);
    }
    async updateMany(keys, data, opts) {
        // Only allow updates on "key" and "name" fields
        const versionUpdateSchema = Joi.object({
            key: Joi.string(),
            name: Joi.string().allow(null).optional(),
        });
        const { error } = versionUpdateSchema.validate(data);
        if (error)
            throw new InvalidPayloadError({ reason: error.message });
        if ('key' in data) {
            // Reserves the "main" version key for the version query parameter
            if (data['key'] === 'main')
                throw new InvalidPayloadError({ reason: `"main" is a reserved version key` });
            const keyCombos = new Set();
            for (const pk of keys) {
                const { collection, item } = await this.readOne(pk, { fields: ['collection', 'item'] });
                const keyCombo = `${data['key']}-${collection}-${item}`;
                if (keyCombos.has(keyCombo)) {
                    throw new UnprocessableContentError({
                        reason: `Cannot update multiple versions on "${item}" in collection "${collection}" to the same key "${data['key']}"`,
                    });
                }
                keyCombos.add(keyCombo);
                const existingVersions = await super.readByQuery({
                    aggregate: { count: ['*'] },
                    filter: { id: { _neq: pk }, key: { _eq: data['key'] }, collection: { _eq: collection }, item: { _eq: item } },
                });
                if (existingVersions[0]['count'] > 0) {
                    throw new UnprocessableContentError({
                        reason: `Version "${data['key']}" already exists for item "${item}" in collection "${collection}"`,
                    });
                }
            }
        }
        return super.updateMany(keys, data, opts);
    }
    async save(key, data) {
        const version = await super.readOne(key);
        const payloadService = new PayloadService(this.collection, {
            accountability: this.accountability,
            knex: this.knex,
            schema: this.schema,
        });
        const activityService = new ActivityService({
            knex: this.knex,
            schema: this.schema,
        });
        const revisionsService = new RevisionsService({
            knex: this.knex,
            schema: this.schema,
        });
        const { item, collection } = version;
        const activity = await activityService.createOne({
            action: Action.VERSION_SAVE,
            user: this.accountability?.user ?? null,
            collection,
            ip: this.accountability?.ip ?? null,
            user_agent: this.accountability?.userAgent ?? null,
            origin: this.accountability?.origin ?? null,
            item,
        });
        const revisionDelta = await payloadService.prepareDelta(data);
        await revisionsService.createOne({
            activity,
            version: key,
            collection,
            item,
            data: revisionDelta,
            delta: revisionDelta,
        });
        const { cache } = getCache();
        if (shouldClearCache(cache, undefined, collection)) {
            cache.clear();
        }
        return data;
    }
    async promote(version, mainHash, fields) {
        const { id, collection, item } = (await this.readOne(version));
        // will throw an error if the accountability does not have permission to update the item
        await this.authorizationService.checkAccess('update', collection, item);
        const { outdated } = await this.verifyHash(collection, item, mainHash);
        if (outdated) {
            throw new UnprocessableContentError({
                reason: `Main item has changed since this version was last updated`,
            });
        }
        const saves = await this.getVersionSavesById(id);
        const versionResult = assign({}, ...saves);
        const payloadToUpdate = fields ? pick(versionResult, fields) : versionResult;
        const itemsService = new ItemsService(collection, {
            accountability: this.accountability,
            schema: this.schema,
        });
        const payloadAfterHooks = await emitter.emitFilter(['items.promote', `${collection}.items.promote`], payloadToUpdate, {
            collection,
            item,
            version,
        }, {
            database: getDatabase(),
            schema: this.schema,
            accountability: this.accountability,
        });
        const updatedItemKey = await itemsService.updateOne(item, payloadAfterHooks);
        emitter.emitAction(['items.promote', `${collection}.items.promote`], {
            payload: payloadAfterHooks,
            collection,
            item: updatedItemKey,
            version,
        }, {
            database: getDatabase(),
            schema: this.schema,
            accountability: this.accountability,
        });
        return updatedItemKey;
    }
}
