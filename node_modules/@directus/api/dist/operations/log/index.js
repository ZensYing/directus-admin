import { defineOperationApi } from '@directus/extensions';
import { optionToString } from '@directus/utils';
import { useLogger } from '../../logger.js';
export default defineOperationApi({
    id: 'log',
    handler: ({ message }) => {
        const logger = useLogger();
        logger.info(optionToString(message));
    },
});
