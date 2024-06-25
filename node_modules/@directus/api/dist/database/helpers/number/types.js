import { DatabaseHelper } from '../types.js';
export class NumberDatabaseHelper extends DatabaseHelper {
    addSearchCondition(dbQuery, collection, name, value) {
        return dbQuery.orWhere({ [`${collection}.${name}`]: value });
    }
    isNumberValid(_value, _info) {
        return true;
    }
}
