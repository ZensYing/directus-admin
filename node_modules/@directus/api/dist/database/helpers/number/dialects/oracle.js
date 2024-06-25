import { NumberDatabaseHelper } from '../types.js';
import { maybeStringifyBigInt } from '../utils/maybe-stringify-big-int.js';
export class NumberHelperOracle extends NumberDatabaseHelper {
    addSearchCondition(dbQuery, collection, name, value) {
        return dbQuery.orWhere({ [`${collection}.${name}`]: maybeStringifyBigInt(value) });
    }
}
