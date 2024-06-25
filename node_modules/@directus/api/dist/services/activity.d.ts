import type { Item, PrimaryKey } from '@directus/types';
import type { AbstractServiceOptions, MutationOptions } from '../types/index.js';
import { ItemsService } from './items.js';
import { NotificationsService } from './notifications.js';
import { UsersService } from './users.js';
export declare class ActivityService extends ItemsService {
    notificationsService: NotificationsService;
    usersService: UsersService;
    constructor(options: AbstractServiceOptions);
    createOne(data: Partial<Item>, opts?: MutationOptions): Promise<PrimaryKey>;
}
