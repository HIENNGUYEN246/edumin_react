const fetch = globalThis.fetch || require('node-fetch');

const API = process.env.API_URL || 'http://localhost:4000/api';

async function run() {
  try {
    console.log('Fetching current /auth...');
    const res = await fetch(`${API}/auth`);
    const body = await res.json();
    console.log('Current teachers count:', (body.teachersData || []).length);

    const testTeacher = {
      id: 9999,
      name: 'Test Giang Vien',
      email: 'testgv@university.edu.vn',
      password: '123',
      status: 'Active',
    };

    // Append test teacher
    const next = { ...body, teachersData: [...(body.teachersData || []), testTeacher] };

    console.log('PUT /auth with test teacher...');
    const putRes = await fetch(`${API}/auth`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`PUT failed ${putRes.status}: ${text}`);
    }
    console.log('PUT ok, re-fetching /auth...');

    const after = await (await fetch(`${API}/auth`)).json();
    const found = (after.teachersData || []).find((t) => Number(t.id) === 9999);
    console.log('Found test teacher after PUT:', found);
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  }
}

run();
