/// <reference types="node" resolution-mode="require"/>
import type { Range, Stat } from '@directus/storage';
import type { Accountability } from '@directus/types';
import type { Knex } from 'knex';
import type { Readable } from 'node:stream';
import type { AbstractServiceOptions, TransformationSet } from '../types/index.js';
import { AuthorizationService } from './authorization.js';
import { FilesService } from './files.js';
export declare class AssetsService {
    knex: Knex;
    accountability: Accountability | null;
    authorizationService: AuthorizationService;
    filesService: FilesService;
    constructor(options: AbstractServiceOptions);
    getAsset(id: string, transformation?: TransformationSet, range?: Range): Promise<{
        stream: Readable;
        file: any;
        stat: Stat;
    }>;
}
