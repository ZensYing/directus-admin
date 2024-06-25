import { appAccessMinimalPermissions } from '@directus/system-data';
import { filterItems } from '../../../utils/filter-items.js';
import { mergePermissions } from '../../../utils/merge-permissions.js';
export function withAppMinimalPermissions(accountability, permissions, filter) {
    if (accountability?.app === true) {
        const filteredAppMinimalPermissions = filterItems(appAccessMinimalPermissions.map((permission) => ({
            ...permission,
            role: accountability.role,
        })), filter);
        return mergePermissions('or', permissions, filteredAppMinimalPermissions);
    }
    return permissions;
}
