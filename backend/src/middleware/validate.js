/**
 * Build a middleware that validates and replaces `req[source]` with the
 * parsed result. Throwing a ZodError lets the error handler shape the 400.
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.parse(req[source]);
  req[source] = result;
  next();
};

export default validate;
