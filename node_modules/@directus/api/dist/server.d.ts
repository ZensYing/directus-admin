/// <reference types="node" resolution-mode="require"/>
/// <reference types="node/http.js" />
/// <reference types="pino-http" />
import * as http from 'http';
export declare let SERVER_ONLINE: boolean;
export declare function createServer(): Promise<http.Server>;
export declare function startServer(): Promise<void>;
