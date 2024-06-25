/**
 * Exported to be able to test the anonymous callback function
 */
export declare const jobCallback: () => void;
/**
 * Initialize the telemetry tracking. Will generate a report on start, and set a schedule to report
 * every 6 hours
 *
 * @returns Whether or not telemetry has been initialized
 */
export declare const initTelemetry: () => Promise<boolean>;
