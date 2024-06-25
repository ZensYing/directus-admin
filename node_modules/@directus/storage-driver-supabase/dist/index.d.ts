import { Driver, Range } from '@directus/storage';
import { Readable } from 'node:stream';

type DriverSupabaseConfig = {
    bucket: string;
    serviceRole: string;
    projectId?: string;
    /** Allows a custom Supabase endpoint for self-hosting */
    endpoint?: string;
    root?: string;
};
declare class DriverSupabase implements Driver {
    private config;
    private client;
    private bucket;
    constructor(config: DriverSupabaseConfig);
    private get endpoint();
    private getClient;
    private getBucket;
    private fullPath;
    private getAuthenticatedUrl;
    read(filepath: string, range?: Range): Promise<Readable>;
    stat(filepath: string): Promise<{
        size: any;
        modified: Date;
    }>;
    exists(filepath: string): Promise<boolean>;
    move(src: string, dest: string): Promise<void>;
    copy(src: string, dest: string): Promise<void>;
    write(filepath: string, content: Readable, type?: string): Promise<void>;
    delete(filepath: string): Promise<void>;
    list(prefix?: string): AsyncIterable<string>;
    listGenerator(prefix: string): AsyncIterable<string>;
}

export { DriverSupabase, type DriverSupabaseConfig, DriverSupabase as default };
