import { ForbiddenError } from '@directus/errors';
import { clearSystemCache, getCache } from '../../cache.js';
import { AuthorizationService } from '../authorization.js';
import { ItemsService } from '../items.js';
import { withAppMinimalPermissions } from './lib/with-app-minimal-permissions.js';
export class PermissionsService extends ItemsService {
    systemCache;
    constructor(options) {
        super('directus_permissions', options);
        const { systemCache } = getCache();
        this.systemCache = systemCache;
    }
    getAllowedFields(action, collection) {
        const results = this.accountability?.permissions?.filter((permission) => {
            let matchesCollection = true;
            if (collection) {
                matchesCollection = permission.collection === collection;
            }
            const matchesAction = permission.action === action;
            return collection ? matchesCollection && matchesAction : matchesAction;
        }) ?? [];
        const fieldsPerCollection = {};
        for (const result of results) {
            const { collection, fields } = result;
            if (!fieldsPerCollection[collection])
                fieldsPerCollection[collection] = [];
            fieldsPerCollection[collection].push(...(fields ?? []));
        }
        return fieldsPerCollection;
    }
    async readByQuery(query, opts) {
        const result = (await super.readByQuery(query, opts));
        return withAppMinimalPermissions(this.accountability, result, query.filter);
    }
    async createOne(data, opts) {
        const res = await super.createOne(data, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async createMany(data, opts) {
        const res = await super.createMany(data, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async updateBatch(data, opts) {
        const res = await super.updateBatch(data, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async updateMany(keys, data, opts) {
        const res = await super.updateMany(keys, data, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async upsertMany(payloads, opts) {
        const res = await super.upsertMany(payloads, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async deleteMany(keys, opts) {
        const res = await super.deleteMany(keys, opts);
        await clearSystemCache({ autoPurgeCache: opts?.autoPurgeCache });
        if (this.cache && opts?.autoPurgeCache !== false) {
            await this.cache.clear();
        }
        return res;
    }
    async getItemPermissions(collection, primaryKey) {
        if (!this.accountability?.user)
            throw new ForbiddenError();
        if (this.accountability?.admin) {
            return {
                update: { access: true },
                delete: { access: true },
                share: { access: true },
            };
        }
        const itemPermissions = {
            update: { access: false },
            delete: { access: false },
            share: { access: false },
        };
        let updateAction = 'update';
        const schema = this.schema.collections[collection];
        if (schema?.singleton) {
            const itemsService = new ItemsService(collection, {
                knex: this.knex,
                schema: this.schema,
            });
            const query = {
                fields: [schema.primary],
                limit: 1,
            };
            try {
                const result = await itemsService.readByQuery(query);
                if (!result[0])
                    updateAction = 'create';
            }
            catch {
                updateAction = 'create';
            }
        }
        const authorizationService = new AuthorizationService({
            knex: this.knex,
            accountability: this.accountability,
            schema: this.schema,
        });
        await Promise.all(Object.keys(itemPermissions).map((key) => {
            const action = key;
            const checkAction = action === 'update' ? updateAction : action;
            return authorizationService
                .checkAccess(checkAction, collection, primaryKey)
                .then(() => (itemPermissions[action].access = true))
                .catch(() => { });
        }));
        if (schema?.singleton && itemPermissions.update.access) {
            const query = {
                filter: {
                    _and: [
                        ...(this.accountability?.role ? [{ role: { _eq: this.accountability.role } }] : []),
                        { collection: { _eq: collection } },
                        { action: { _eq: updateAction } },
                    ],
                },
                fields: ['presets', 'fields'],
            };
            try {
                const result = await this.readByQuery(query);
                const permission = result[0];
                if (permission) {
                    itemPermissions.update.presets = permission['presets'];
                    itemPermissions.update.fields = permission['fields'];
                }
            }
            catch {
                // No permission
            }
        }
        return itemPermissions;
    }
}
