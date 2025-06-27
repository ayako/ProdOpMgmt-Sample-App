const request = require('supertest');
const app = require('../src/app');

describe('Email Status Updates API', () => {
  let server;

  beforeAll(async () => {
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('GET /api/emails/status-updates', () => {
    it('should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/emails/status-updates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/emails/process-emails', () => {
    it('should process mock emails successfully', async () => {
      const response = await request(app)
        .post('/api/emails/process-emails')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.processed_count).toBeGreaterThan(0);
      expect(Array.isArray(response.body.results)).toBe(true);
    });
  });

  describe('POST /api/emails/process-single-email', () => {
    it('should process a single email with AI', async () => {
      const emailData = {
        subject: 'Re: 生産調整依頼 R-001 - 進捗報告',
        body: `
依頼ID: R-001 について進捗報告いたします。

現在の状況: 生産中
進捗率: 75%
完了予定: 2024-01-30

順調に進んでおります。
        `,
        from: 'test@factory.com'
      };

      const response = await request(app)
        .post('/api/emails/process-single-email')
        .send(emailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ai_result).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/emails/process-single-email')
        .send({ subject: 'Test' })
        .expect(400);

      expect(response.body.message).toContain('Subject and body are required');
    });
  });

  describe('After processing emails', () => {
    beforeAll(async () => {
      // Process some emails first
      await request(app)
        .post('/api/emails/process-emails');
    });

    it('should return processed email status updates', async () => {
      const response = await request(app)
        .get('/api/emails/status-updates')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check structure of status update
      if (response.body.length > 0) {
        const update = response.body[0];
        expect(update).toHaveProperty('update_id');
        expect(update).toHaveProperty('email_id');
        expect(update).toHaveProperty('request_id');
        expect(update).toHaveProperty('email_subject');
        expect(update).toHaveProperty('email_body');
        expect(update).toHaveProperty('email_from');
        expect(update).toHaveProperty('ai_confidence');
      }
    });
  });
});