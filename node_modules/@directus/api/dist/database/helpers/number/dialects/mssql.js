import { maybeStringifyBigInt } from '../utils/maybe-stringify-big-int.js';
import { numberInRange } from '../utils/number-in-range.js';
import { NumberDatabaseHelper } from '../types.js';
export class NumberHelperMSSQL extends NumberDatabaseHelper {
    addSearchCondition(dbQuery, collection, name, value) {
        return dbQuery.orWhere({ [`${collection}.${name}`]: maybeStringifyBigInt(value) });
    }
    isNumberValid(value, info) {
        return numberInRange(value, info);
    }
}
