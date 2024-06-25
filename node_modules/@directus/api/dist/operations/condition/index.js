import { validatePayload } from '@directus/utils';
import { defineOperationApi } from '@directus/extensions';
export default defineOperationApi({
    id: 'condition',
    handler: ({ filter }, { data }) => {
        const errors = validatePayload(filter, data, { requireAll: true });
        if (errors.length > 0) {
            throw errors;
        }
        else {
            return null;
        }
    },
});
