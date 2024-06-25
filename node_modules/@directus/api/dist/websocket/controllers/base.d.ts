/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node/http.js" />
/// <reference types="pino-http" />
import type { IncomingMessage, Server as httpServer } from 'http';
import type { RateLimiterAbstract } from 'rate-limiter-flexible';
import type internal from 'stream';
import WebSocket from 'ws';
import { AuthMode, WebSocketAuthMessage, WebSocketMessage } from '../messages.js';
import type { AuthenticationState, UpgradeContext, WebSocketClient } from '../types.js';
export default abstract class SocketController {
    server: WebSocket.Server;
    clients: Set<WebSocketClient>;
    authentication: {
        mode: AuthMode;
        timeout: number;
    };
    endpoint: string;
    maxConnections: number;
    private rateLimiter;
    private authInterval;
    constructor(httpServer: httpServer, configPrefix: string);
    protected getEnvironmentConfig(configPrefix: string): {
        endpoint: string;
        authentication: {
            mode: AuthMode;
            timeout: number;
        };
        maxConnections: number;
    };
    protected getRateLimiter(): RateLimiterAbstract | null;
    private catchInvalidMessages;
    protected handleUpgrade(request: IncomingMessage, socket: internal.Duplex, head: Buffer): Promise<void>;
    protected handleTokenUpgrade({ request, socket, head }: UpgradeContext, token: string): Promise<void>;
    protected handleHandshakeUpgrade({ request, socket, head }: UpgradeContext): Promise<void>;
    createClient(ws: WebSocket, { accountability, expires_at }: AuthenticationState): WebSocketClient;
    protected parseMessage(data: string): WebSocketMessage;
    protected handleAuthRequest(client: WebSocketClient, message: WebSocketAuthMessage): Promise<void>;
    setTokenExpireTimer(client: WebSocketClient): void;
    checkClientTokens(): void;
    terminate(): void;
}
