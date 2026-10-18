import express from 'express';

const registerCollection = (Model) => {
  if (!Model) {
    throw new Error('Model is required for registerCollection');
  }

  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const records = await Model.find({}).lean();
      res.json(records);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (Array.isArray(req.body)) {
        if (Model.modelName === 'Attendance') {
          const results = [];
          for (const item of req.body) {
            const filter = item.id ? { id: item.id } : { studentId: item.studentId, regId: item.regId, date: item.date, shiftId: item.shiftId || '1' };
            const updated = await Model.findOneAndUpdate(filter, item, { upsert: true, new: true }).lean();
            results.push(updated);
          }
          return res.status(201).json(results);
        }
        await Model.deleteMany({});
        const created = req.body.length ? await Model.insertMany(req.body.map((item) => ({ ...item }))) : [];
        return res.status(201).json(created);
      }
      const single = await Model.create(req.body || {});
      res.status(201).json(single);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const updated = await Model.findOneAndUpdate({ _id: id }, body, {
        new: true,
        runValidators: true,
      }).lean();
      if (!updated) {
        return res.status(404).json({ error: 'Bản ghi không tồn tại' });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const deleted = await Model.findByIdAndDelete(id).lean();
      if (!deleted) {
        return res.status(404).json({ error: 'Bản ghi không tồn tại' });
      }
      res.json({ success: true, deleted });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

export default registerCollection;
