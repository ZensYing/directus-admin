/// <reference types="qs" />
import type { RequestHandler } from 'express';
import { type Logger } from 'pino';
export declare const _cache: {
    logger: Logger<never> | undefined;
};
export declare const useLogger: () => Logger<never>;
export declare const createLogger: () => Logger<never>;
export declare const createExpressLogger: () => RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
