import { useEnv } from '@directus/env';
import { toBoolean } from '@directus/utils';
import { GraphQLSubscriptionController } from './graphql.js';
import { WebSocketController } from './rest.js';
let websocketController;
let subscriptionController;
export function createWebSocketController(server) {
    const env = useEnv();
    if (toBoolean(env['WEBSOCKETS_REST_ENABLED'])) {
        websocketController = new WebSocketController(server);
    }
}
export function getWebSocketController() {
    return websocketController;
}
export function createSubscriptionController(server) {
    const env = useEnv();
    if (toBoolean(env['WEBSOCKETS_GRAPHQL_ENABLED'])) {
        subscriptionController = new GraphQLSubscriptionController(server);
    }
}
export function getSubscriptionController() {
    return subscriptionController;
}
export * from './graphql.js';
export * from './rest.js';
