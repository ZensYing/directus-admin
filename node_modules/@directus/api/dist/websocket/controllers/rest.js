import { useEnv } from '@directus/env';
import { parseJSON } from '@directus/utils';
import emitter from '../../emitter.js';
import { useLogger } from '../../logger.js';
import { refreshAccountability } from '../authenticate.js';
import { WebSocketError, handleWebSocketError } from '../errors.js';
import { WebSocketMessage } from '../messages.js';
import SocketController from './base.js';
const logger = useLogger();
export class WebSocketController extends SocketController {
    constructor(httpServer) {
        super(httpServer, 'WEBSOCKETS_REST');
        const env = useEnv();
        this.server.on('connection', (ws, auth) => {
            this.bindEvents(this.createClient(ws, auth));
        });
        logger.info(`WebSocket Server started at ws://${env['HOST']}:${env['PORT']}${this.endpoint}`);
    }
    bindEvents(client) {
        client.on('parsed-message', async (message) => {
            try {
                message = WebSocketMessage.parse(await emitter.emitFilter('websocket.message', message, { client }));
                client.accountability = await refreshAccountability(client.accountability);
                emitter.emitAction('websocket.message', { message, client });
            }
            catch (error) {
                handleWebSocketError(client, error, 'server');
                return;
            }
        });
        client.on('error', (event) => {
            emitter.emitAction('websocket.error', { client, event });
        });
        client.on('close', (event) => {
            emitter.emitAction('websocket.close', { client, event });
        });
        emitter.emitAction('websocket.connect', { client });
    }
    parseMessage(data) {
        let message;
        try {
            message = parseJSON(data);
        }
        catch (err) {
            throw new WebSocketError('server', 'INVALID_PAYLOAD', 'Unable to parse the incoming message.');
        }
        return message;
    }
}
