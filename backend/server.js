/**
 * Root server entry point.
 * Forwards execution to modern modular backend in `src/server.js`.
 * Prevents ERR_MODULE_NOT_FOUND and app crashes when executing from project root.
 */
import './src/server.js';
