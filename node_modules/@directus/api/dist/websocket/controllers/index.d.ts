/// <reference types="node" resolution-mode="require"/>
/// <reference types="node/http.js" />
/// <reference types="pino-http" />
import type { Server as httpServer } from 'http';
import { GraphQLSubscriptionController } from './graphql.js';
import { WebSocketController } from './rest.js';
export declare function createWebSocketController(server: httpServer): void;
export declare function getWebSocketController(): WebSocketController | undefined;
export declare function createSubscriptionController(server: httpServer): void;
export declare function getSubscriptionController(): GraphQLSubscriptionController | undefined;
export * from './graphql.js';
export * from './rest.js';
