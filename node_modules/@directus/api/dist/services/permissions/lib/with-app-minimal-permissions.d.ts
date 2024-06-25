import type { Accountability, Permission, Query } from '@directus/types';
export declare function withAppMinimalPermissions(accountability: Accountability | null, permissions: Permission[], filter: Query['filter']): Permission[];
