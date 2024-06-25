import { useEnv } from '@directus/env';
import formatTitle from '@directus/format-title';
import { spec } from '@directus/specs';
import { version } from 'directus/version';
import { cloneDeep, mergeWith } from 'lodash-es';
import { OAS_REQUIRED_SCHEMAS } from '../constants.js';
import getDatabase from '../database/index.js';
import { getRelationType } from '../utils/get-relation-type.js';
import { reduceSchema } from '../utils/reduce-schema.js';
import { GraphQLService } from './graphql/index.js';
import { isSystemCollection } from '@directus/system-data';
const env = useEnv();
export class SpecificationService {
    accountability;
    knex;
    schema;
    oas;
    graphql;
    constructor({ accountability, knex, schema }) {
        this.accountability = accountability || null;
        this.knex = knex || getDatabase();
        this.schema = schema;
        this.oas = new OASSpecsService({ knex, schema, accountability });
        this.graphql = new GraphQLSpecsService({ knex, schema, accountability });
    }
}
class OASSpecsService {
    accountability;
    knex;
    schema;
    constructor({ knex, schema, accountability }) {
        this.accountability = accountability || null;
        this.knex = knex || getDatabase();
        this.schema =
            this.accountability?.admin === true ? schema : reduceSchema(schema, accountability?.permissions || null);
    }
    async generate(host) {
        const permissions = this.accountability?.permissions ?? [];
        const tags = await this.generateTags();
        const paths = await this.generatePaths(permissions, tags);
        const components = await this.generateComponents(tags);
        const isDefaultPublicUrl = env['PUBLIC_URL'] === '/';
        const url = isDefaultPublicUrl && host ? host : env['PUBLIC_URL'];
        const spec = {
            openapi: '3.0.1',
            info: {
                title: 'Dynamic API Specification',
                description: 'This is a dynamically generated API specification for all endpoints existing on the current project.',
                version: version,
            },
            servers: [
                {
                    url,
                    description: 'Your current Directus instance.',
                },
            ],
            paths,
        };
        if (tags)
            spec.tags = tags;
        if (components)
            spec.components = components;
        return spec;
    }
    async generateTags() {
        const systemTags = cloneDeep(spec.tags);
        const collections = Object.values(this.schema.collections);
        const tags = [];
        for (const systemTag of systemTags) {
            // Check if necessary authentication level is given
            if (systemTag['x-authentication'] === 'admin' && !this.accountability?.admin)
                continue;
            if (systemTag['x-authentication'] === 'user' && !this.accountability?.user)
                continue;
            // Remaining system tags that don't have an associated collection are publicly available
            if (!systemTag['x-collection']) {
                tags.push(systemTag);
            }
        }
        for (const collection of collections) {
            const isSystem = isSystemCollection(collection.collection);
            // If the collection is one of the system collections, pull the tag from the static spec
            if (isSystem) {
                for (const tag of spec.tags) {
                    if (tag['x-collection'] === collection.collection) {
                        tags.push(tag);
                        break;
                    }
                }
            }
            else {
                const tag = {
                    name: 'Items' + formatTitle(collection.collection).replace(/ /g, ''),
                    'x-collection': collection.collection,
                };
                if (collection.note) {
                    tag.description = collection.note;
                }
                tags.push(tag);
            }
        }
        // Filter out the generic Items information
        return tags.filter((tag) => tag.name !== 'Items');
    }
    async generatePaths(permissions, tags) {
        const paths = {};
        if (!tags)
            return paths;
        for (const tag of tags) {
            const isSystem = 'x-collection' in tag === false || isSystemCollection(tag['x-collection']);
            if (isSystem) {
                for (const [path, pathItem] of Object.entries(spec.paths)) {
                    for (const [method, operation] of Object.entries(pathItem)) {
                        if (operation.tags?.includes(tag.name)) {
                            if (!paths[path]) {
                                paths[path] = {};
                            }
                            const hasPermission = this.accountability?.admin === true ||
                                'x-collection' in tag === false ||
                                !!permissions.find((permission) => permission.collection === tag['x-collection'] &&
                                    permission.action === this.getActionForMethod(method));
                            if (hasPermission) {
                                if ('parameters' in pathItem) {
                                    paths[path][method] = {
                                        ...operation,
                                        parameters: [...(pathItem.parameters ?? []), ...(operation?.parameters ?? [])],
                                    };
                                }
                                else {
                                    paths[path][method] = operation;
                                }
                            }
                        }
                    }
                }
            }
            else {
                const listBase = cloneDeep(spec.paths['/items/{collection}']);
                const detailBase = cloneDeep(spec.paths['/items/{collection}/{id}']);
                const collection = tag['x-collection'];
                const methods = ['post', 'get', 'patch', 'delete'];
                for (const method of methods) {
                    const hasPermission = this.accountability?.admin === true ||
                        !!permissions.find((permission) => permission.collection === collection && permission.action === this.getActionForMethod(method));
                    if (hasPermission) {
                        if (!paths[`/items/${collection}`])
                            paths[`/items/${collection}`] = {};
                        if (!paths[`/items/${collection}/{id}`])
                            paths[`/items/${collection}/{id}`] = {};
                        if (listBase?.[method]) {
                            paths[`/items/${collection}`][method] = mergeWith(cloneDeep(listBase[method]), {
                                description: listBase[method].description.replace('item', collection + ' item'),
                                tags: [tag.name],
                                parameters: 'parameters' in listBase ? this.filterCollectionFromParams(listBase.parameters) : [],
                                operationId: `${this.getActionForMethod(method)}${tag.name}`,
                                requestBody: ['get', 'delete'].includes(method)
                                    ? undefined
                                    : {
                                        content: {
                                            'application/json': {
                                                schema: {
                                                    oneOf: [
                                                        {
                                                            type: 'array',
                                                            items: {
                                                                $ref: `#/components/schemas/${tag.name}`,
                                                            },
                                                        },
                                                        {
                                                            $ref: `#/components/schemas/${tag.name}`,
                                                        },
                                                    ],
                                                },
                                            },
                                        },
                                    },
                                responses: {
                                    '200': {
                                        description: 'Successful request',
                                        content: method === 'delete'
                                            ? undefined
                                            : {
                                                'application/json': {
                                                    schema: {
                                                        properties: {
                                                            data: {
                                                                items: {
                                                                    $ref: `#/components/schemas/${tag.name}`,
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                    },
                                },
                            }, (obj, src) => {
                                if (Array.isArray(obj))
                                    return obj.concat(src);
                                return undefined;
                            });
                        }
                        if (detailBase?.[method]) {
                            paths[`/items/${collection}/{id}`][method] = mergeWith(cloneDeep(detailBase[method]), {
                                description: detailBase[method].description.replace('item', collection + ' item'),
                                tags: [tag.name],
                                operationId: `${this.getActionForMethod(method)}Single${tag.name}`,
                                parameters: 'parameters' in detailBase ? this.filterCollectionFromParams(detailBase.parameters) : [],
                                requestBody: ['get', 'delete'].includes(method)
                                    ? undefined
                                    : {
                                        content: {
                                            'application/json': {
                                                schema: {
                                                    $ref: `#/components/schemas/${tag.name}`,
                                                },
                                            },
                                        },
                                    },
                                responses: {
                                    '200': {
                                        content: method === 'delete'
                                            ? undefined
                                            : {
                                                'application/json': {
                                                    schema: {
                                                        properties: {
                                                            data: {
                                                                $ref: `#/components/schemas/${tag.name}`,
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                    },
                                },
                            }, (obj, src) => {
                                if (Array.isArray(obj))
                                    return obj.concat(src);
                                return undefined;
                            });
                        }
                    }
                }
            }
        }
        return paths;
    }
    async generateComponents(tags) {
        if (!tags)
            return;
        let components = cloneDeep(spec.components);
        if (!components)
            components = {};
        components.schemas = {};
        const tagSchemas = tags.reduce((schemas, tag) => [...schemas, ...(tag['x-schemas'] ? tag['x-schemas'] : [])], []);
        const requiredSchemas = [...OAS_REQUIRED_SCHEMAS, ...tagSchemas];
        for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
            if (requiredSchemas.includes(name)) {
                const collection = spec.tags?.find((tag) => tag.name === name)?.['x-collection'];
                components.schemas[name] = {
                    ...cloneDeep(schema),
                    ...(collection && { 'x-collection': collection }),
                };
            }
        }
        const collections = Object.values(this.schema.collections);
        for (const collection of collections) {
            const tag = tags.find((tag) => tag['x-collection'] === collection.collection);
            if (!tag)
                continue;
            const isSystem = isSystemCollection(collection.collection);
            const fieldsInCollection = Object.values(collection.fields);
            if (isSystem) {
                const schemaComponent = cloneDeep(spec.components.schemas[tag.name]);
                schemaComponent.properties = {};
                schemaComponent['x-collection'] = collection.collection;
                for (const field of fieldsInCollection) {
                    schemaComponent.properties[field.field] =
                        cloneDeep(spec.components.schemas[tag.name].properties[field.field]) || this.generateField(collection.collection, field, tags);
                }
                components.schemas[tag.name] = schemaComponent;
            }
            else {
                const schemaComponent = {
                    type: 'object',
                    properties: {},
                    'x-collection': collection.collection,
                };
                for (const field of fieldsInCollection) {
                    schemaComponent.properties[field.field] = this.generateField(collection.collection, field, tags);
                }
                components.schemas[tag.name] = schemaComponent;
            }
        }
        return components;
    }
    filterCollectionFromParams(parameters) {
        return parameters.filter((param) => param?.$ref !== '#/components/parameters/Collection');
    }
    getActionForMethod(method) {
        switch (method) {
            case 'post':
                return 'create';
            case 'patch':
                return 'update';
            case 'delete':
                return 'delete';
            case 'get':
            default:
                return 'read';
        }
    }
    generateField(collection, field, tags) {
        let propertyObject = {};
        propertyObject.nullable = field.nullable;
        if (field.note) {
            propertyObject.description = field.note;
        }
        const relation = this.schema.relations.find((relation) => (relation.collection === collection && relation.field === field.field) ||
            (relation.related_collection === collection && relation.meta?.one_field === field.field));
        if (!relation) {
            propertyObject = {
                ...propertyObject,
                ...this.fieldTypes[field.type],
            };
        }
        else {
            const relationType = getRelationType({
                relation,
                field: field.field,
                collection: collection,
            });
            if (relationType === 'm2o') {
                const relatedTag = tags.find((tag) => tag['x-collection'] === relation.related_collection);
                if (!relatedTag ||
                    !relation.related_collection ||
                    relation.related_collection in this.schema.collections === false) {
                    return propertyObject;
                }
                const relatedCollection = this.schema.collections[relation.related_collection];
                const relatedPrimaryKeyField = relatedCollection.fields[relatedCollection.primary];
                propertyObject.oneOf = [
                    {
                        ...this.fieldTypes[relatedPrimaryKeyField.type],
                    },
                    {
                        $ref: `#/components/schemas/${relatedTag.name}`,
                    },
                ];
            }
            else if (relationType === 'o2m') {
                const relatedTag = tags.find((tag) => tag['x-collection'] === relation.collection);
                if (!relatedTag || !relation.related_collection || relation.collection in this.schema.collections === false) {
                    return propertyObject;
                }
                const relatedCollection = this.schema.collections[relation.collection];
                const relatedPrimaryKeyField = relatedCollection.fields[relatedCollection.primary];
                if (!relatedTag || !relatedPrimaryKeyField)
                    return propertyObject;
                propertyObject.type = 'array';
                propertyObject.items = {
                    oneOf: [
                        {
                            ...this.fieldTypes[relatedPrimaryKeyField.type],
                        },
                        {
                            $ref: `#/components/schemas/${relatedTag.name}`,
                        },
                    ],
                };
            }
            else if (relationType === 'a2o') {
                const relatedTags = tags.filter((tag) => relation.meta.one_allowed_collections.includes(tag['x-collection']));
                propertyObject.type = 'array';
                propertyObject.items = {
                    oneOf: [
                        {
                            type: 'string',
                        },
                        ...relatedTags.map((tag) => ({
                            $ref: `#/components/schemas/${tag.name}`,
                        })),
                    ],
                };
            }
        }
        return propertyObject;
    }
    fieldTypes = {
        alias: {
            type: 'string',
        },
        bigInteger: {
            type: 'integer',
            format: 'int64',
        },
        binary: {
            type: 'string',
            format: 'binary',
        },
        boolean: {
            type: 'boolean',
        },
        csv: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        date: {
            type: 'string',
            format: 'date',
        },
        dateTime: {
            type: 'string',
            format: 'date-time',
        },
        decimal: {
            type: 'number',
        },
        float: {
            type: 'number',
            format: 'float',
        },
        hash: {
            type: 'string',
        },
        integer: {
            type: 'integer',
        },
        json: {},
        string: {
            type: 'string',
        },
        text: {
            type: 'string',
        },
        time: {
            type: 'string',
            format: 'time',
        },
        timestamp: {
            type: 'string',
            format: 'timestamp',
        },
        unknown: {},
        uuid: {
            type: 'string',
            format: 'uuid',
        },
        geometry: {
            type: 'object',
        },
        'geometry.Point': {
            type: 'object',
        },
        'geometry.LineString': {
            type: 'object',
        },
        'geometry.Polygon': {
            type: 'object',
        },
        'geometry.MultiPoint': {
            type: 'object',
        },
        'geometry.MultiLineString': {
            type: 'object',
        },
        'geometry.MultiPolygon': {
            type: 'object',
        },
    };
}
class GraphQLSpecsService {
    accountability;
    knex;
    schema;
    items;
    system;
    constructor(options) {
        this.accountability = options.accountability || null;
        this.knex = options.knex || getDatabase();
        this.schema = options.schema;
        this.items = new GraphQLService({ ...options, scope: 'items' });
        this.system = new GraphQLService({ ...options, scope: 'system' });
    }
    async generate(scope) {
        if (scope === 'items')
            return this.items.getSchema('sdl');
        if (scope === 'system')
            return this.system.getSchema('sdl');
        return null;
    }
}
