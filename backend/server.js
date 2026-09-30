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
  Attendance,
} from './models/index.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 4000;

if (!MONGO_URI) {
  console.error('Missing MONGO_URI in backend/.env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/feedbacks', feedbackRoutes);

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
  { path: 'attendances', model: Attendance },
];

collections.forEach(({ path, model }) => {
  app.use(`/api/${path}`, registerCollection(model));
});

app.get('/', (req, res) => {
  res.json({ message: 'Edumin backend is running' });
});

app.use(errorHandler);

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

const server = app.listen(PORT, () => {
  console.log(`Edumin backend listening on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please check running node processes or update PORT in backend/.env`);
  } else {
    console.error('Server error:', error);
  }
});
