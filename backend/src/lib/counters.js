import { Counter } from '../modules/shared/counter.model.js';

/**
 * Atomically increment and return the next sequence value for a named counter.
 * Used to generate stable numeric codes (teacher/student IDs) without races.
 *
 * If `syncFrom` is provided, the counter is first reconciled to the highest
 * existing `field` value in that model. This self-heals a counter that fell
 * behind the data (e.g. records inserted outside this flow, or a dropped
 * `counters` collection), preventing duplicate-key errors on the numeric id.
 *
 * @param {string} key
 * @param {{ model: import('mongoose').Model, field?: string }} [syncFrom]
 */
export async function nextSequence(key, syncFromOrSession, syncFrom) {
  const sync = syncFromOrSession && syncFromOrSession.model ? syncFromOrSession : syncFrom;
  if (sync?.model) {
    const field = sync.field || 'id';
    const top = await sync.model
      .findOne({}, { [field]: 1 })
      .sort({ [field]: -1 })
      .lean();
    const maxId = Number(top?.[field]) || 0;

    const current = await Counter.findById(key).lean();
    if (!current || (current.value ?? 0) < maxId) {
      await Counter.findByIdAndUpdate(
        key,
        { $set: { value: maxId } },
        { upsert: true }
      );
    }
  }

  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return doc.value;
}
