import { ObjectCannedACL, ServerSideEncryption } from '@aws-sdk/client-s3';
import { Driver, Range } from '@directus/storage';
import { Readable } from 'node:stream';

type DriverS3Config = {
    root?: string;
    key?: string;
    secret?: string;
    bucket: string;
    acl?: ObjectCannedACL;
    serverSideEncryption?: ServerSideEncryption;
    endpoint?: string;
    region?: string;
    forcePathStyle?: boolean;
};
declare class DriverS3 implements Driver {
    private config;
    private client;
    private root;
    constructor(config: DriverS3Config);
    private getClient;
    private fullPath;
    read(filepath: string, range?: Range): Promise<Readable>;
    stat(filepath: string): Promise<{
        size: number;
        modified: Date;
    }>;
    exists(filepath: string): Promise<boolean>;
    move(src: string, dest: string): Promise<void>;
    copy(src: string, dest: string): Promise<void>;
    write(filepath: string, content: Readable, type?: string): Promise<void>;
    delete(filepath: string): Promise<void>;
    list(prefix?: string): AsyncGenerator<string, void, unknown>;
}

export { DriverS3, type DriverS3Config, DriverS3 as default };
