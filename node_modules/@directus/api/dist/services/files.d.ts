/// <reference types="node" resolution-mode="require"/>
import type { BusboyFileStream, File, PrimaryKey } from '@directus/types';
import type { Readable } from 'node:stream';
import type { AbstractServiceOptions, MutationOptions } from '../types/index.js';
import { ItemsService } from './items.js';
type Metadata = Partial<Pick<File, 'height' | 'width' | 'description' | 'title' | 'tags' | 'metadata'>>;
export declare class FilesService extends ItemsService {
    constructor(options: AbstractServiceOptions);
    /**
     * Upload a single new file to the configured storage adapter
     */
    uploadOne(stream: BusboyFileStream | Readable, data: Partial<File> & {
        storage: string;
    }, primaryKey?: PrimaryKey, opts?: MutationOptions): Promise<PrimaryKey>;
    /**
     * Extract metadata from a buffer's content
     */
    getMetadata(stream: Readable, allowList?: string | string[]): Promise<Metadata>;
    /**
     * Import a single file from an external URL
     */
    importOne(importURL: string, body: Partial<File>): Promise<PrimaryKey>;
    /**
     * Create a file (only applicable when it is not a multipart/data POST request)
     * Useful for associating metadata with existing file in storage
     */
    createOne(data: Partial<File>, opts?: MutationOptions): Promise<PrimaryKey>;
    /**
     * Delete a file
     */
    deleteOne(key: PrimaryKey): Promise<PrimaryKey>;
    /**
     * Delete multiple files
     */
    deleteMany(keys: PrimaryKey[]): Promise<PrimaryKey[]>;
}
export {};
