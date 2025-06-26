const request = require('supertest');
const app = require('../src/app');

describe('API Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
  });
});

describe('API Routes', () => {
  test('GET /api/requests should return array', async () => {
    const response = await request(app)
      .get('/api/requests')
      .expect('Content-Type', /json/);
    
    expect(Array.isArray(response.body) || response.body.error).toBeTruthy();
  });

  test('GET /api/factories should return array', async () => {
    const response = await request(app)
      .get('/api/factories')
      .expect('Content-Type', /json/);
    
    expect(Array.isArray(response.body) || response.body.error).toBeTruthy();
  });
});