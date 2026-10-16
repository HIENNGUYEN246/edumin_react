/**
 * Parse pagination/search/sort query params into a normalized shape.
 * @param {Record<string, unknown>} query
 * @param {{ maxLimit?: number, defaultSort?: string }} [options]
 */
export function parseListQuery(query = {}, { maxLimit = 100, defaultSort = '-createdAt' } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sort = typeof query.sort === 'string' && query.sort ? query.sort : defaultSort;
  return { page, limit, search, sort, skip: (page - 1) * limit };
}

/**
 * Run a paginated find on a model and return `{ data, meta }`.
 * @param {import('mongoose').Model} Model
 */
export async function paginate(Model, { filter = {}, page, limit, skip, sort, populate, select } = {}) {
  let queryBuilder = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) queryBuilder = queryBuilder.populate(populate);
  if (select) queryBuilder = queryBuilder.select(select);

  const [data, total] = await Promise.all([
    queryBuilder.lean(),
    Model.countDocuments(filter),
  ]);

  return { data, meta: { page, limit, total, pages: Math.ceil(total / limit) || 0 } };
}

/** Build a case-insensitive regex OR filter across the given fields. */
export function searchFilter(search, fields = []) {
  if (!search || !fields.length) return {};
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}
