import { Readable } from 'node:stream';

declare class StorageManager {
    private drivers;
    private locations;
    registerDriver(name: string, driver: typeof Driver): void;
    registerLocation(name: string, config: DriverConfig): void;
    location(name: string): Driver;
}
interface Range {
    start: number | undefined;
    end: number | undefined;
}
type Stat = {
    size: number;
    modified: Date;
};
declare class Driver {
    constructor(config: Record<string, unknown>);
    read(filepath: string, range?: Range): Promise<Readable>;
    write(filepath: string, content: Readable, type?: string): Promise<void>;
    delete(filepath: string): Promise<void>;
    stat(filepath: string): Promise<Stat>;
    exists(filepath: string): Promise<boolean>;
    move(src: string, dest: string): Promise<void>;
    copy(src: string, dest: string): Promise<void>;
    list(prefix?: string): AsyncIterable<string>;
}
type DriverConfig = {
    driver: string;
    options: Record<string, unknown>;
};

export { Driver, type DriverConfig, type Range, type Stat, StorageManager };
