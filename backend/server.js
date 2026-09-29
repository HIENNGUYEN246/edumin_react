import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import registerCollection from './routes/collectionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import {
  User,
  Teacher,
  Student,
  Department,
  Course,
  OpenRegistration,
  StudentRegistration,
  Assignment,
  Document,
} from './models/index.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 4000;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in backend/.env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

const collections = [
  { path: 'users', model: User },
  { path: 'teachers', model: Teacher },
  { path: 'students', model: Student },
  { path: 'departments', model: Department },
  { path: 'courses', model: Course },
  { path: 'open-registrations', model: OpenRegistration },
  { path: 'student-registrations', model: StudentRegistration },
  { path: 'assignments', model: Assignment },
  { path: 'documents', model: Document },
];

collections.forEach(({ path, model }) => {
  app.use(`/api/${path}`, registerCollection(model));
});

app.get('/', (req, res) => {
  res.json({ message: 'Edumin backend is running' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Edumin backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

startServer();
