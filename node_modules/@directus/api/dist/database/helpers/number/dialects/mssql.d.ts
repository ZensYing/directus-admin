import type { Knex } from 'knex';
import { NumberDatabaseHelper, type NumberInfo } from '../types.js';
import type { NumericValue } from '@directus/types';
export declare class NumberHelperMSSQL extends NumberDatabaseHelper {
    addSearchCondition(dbQuery: Knex.QueryBuilder, collection: string, name: string, value: NumericValue): Knex.QueryBuilder;
    isNumberValid(value: NumericValue, info: NumberInfo): boolean;
}
