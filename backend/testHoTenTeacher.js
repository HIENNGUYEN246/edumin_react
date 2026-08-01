const fetch = globalThis.fetch || require('node-fetch');

const API = process.env.API_URL || 'http://localhost:4000/api';

async function run() {
  try {
    const testTeacher = {
      id: 8888,
      hoTen: 'HoTen From Test',
      email: 'hoten@university.edu.vn',
      password: '123',
      status: 'Active',
      avatar: 'https://ui-avatars.com/api/?name=HT'
    };

    const payload = {
      users: [],
      teachersData: [testTeacher],
      studentsData: [],
      departmentsData: [],
      subjectsData: [],
      openRegistrationsData: [],
      studentRegistrationsData: [],
      assignmentsData: [],
      documentsData: [],
    };

    console.log('PUTting payload with teacher containing hoTen...');
    const putRes = await fetch(`${API}/auth`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await putRes.json();
    console.log('PUT response teachers:', data.teachersData);
  } catch (err) {
    console.error('Error', err.message || err);
    process.exitCode = 2;
  }
}

run();
