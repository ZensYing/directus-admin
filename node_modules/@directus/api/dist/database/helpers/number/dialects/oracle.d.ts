import type { Knex } from 'knex';
import { NumberDatabaseHelper } from '../types.js';
import type { NumericValue } from '@directus/types';
export declare class NumberHelperOracle extends NumberDatabaseHelper {
    addSearchCondition(dbQuery: Knex.QueryBuilder, collection: string, name: string, value: NumericValue): Knex.QueryBuilder;
}
