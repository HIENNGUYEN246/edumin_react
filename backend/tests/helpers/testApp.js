import { createApp } from '../../src/app.js';

/**
 * A single app instance reused across requests within a test file.
 * The DB connection is managed globally by tests/setup.js.
 */
export const app = createApp();

export default app;
