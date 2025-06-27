const emailService = require('../src/services/email');
const aiService = require('../src/services/ai');

describe('Email Service', () => {
  describe('readUnprocessedEmails', () => {
    it('should return mock emails in mock mode', async () => {
      const emails = await emailService.readUnprocessedEmails();
      
      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThan(0);
      
      // Check email structure
      const email = emails[0];
      expect(email).toHaveProperty('id');
      expect(email).toHaveProperty('subject');
      expect(email).toHaveProperty('body');
      expect(email).toHaveProperty('from');
      expect(email).toHaveProperty('date');
    });
  });

  describe('parseEmailContent', () => {
    it('should extract request ID from email content', () => {
      const subject = 'Re: 生産調整依頼 R-001 - 回答';
      const body = '依頼ID: R-001 について回答いたします。';
      
      const result = emailService.parseEmailContent(body, subject);
      
      expect(result.subject).toBe(subject);
      expect(result.body).toBe(body);
      expect(result.extractedInfo.request_id).toBe('R-001');
    });

    it('should handle different request ID formats', () => {
      const testCases = [
        { input: 'R-123', expected: 'R-123' },
        { input: 'R123', expected: 'R-123' },
        { input: 'r-456', expected: 'R-456' },
        { input: 'Ｒ－789', expected: 'R-789' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = emailService.parseEmailContent(`依頼ID: ${input}`, '');
        expect(result.extractedInfo.request_id).toBe(expected);
      });
    });
  });

  describe('markEmailAsProcessed', () => {
    it('should mark email as processed in mock mode', async () => {
      const result = await emailService.markEmailAsProcessed('EMAIL_001');
      expect(result).toBe(true);
    });
  });
});

describe('AI Service Email Processing', () => {
  describe('processEmailStatusUpdate', () => {
    it('should process email content and return structured data', async () => {
      const emailContent = `
依頼ID: R-001 について進捗報告いたします。

現在の状況: 生産中
進捗率: 80%
完了予定: 2024-01-30

順調に進んでおります。
      `;
      const subject = '進捗報告 - R-001';

      const result = await aiService.processEmailStatusUpdate(emailContent, subject);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('originalText');
      expect(result).toHaveProperty('processingTimestamp');
      
      // In mock mode, we expect some basic structure
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty content gracefully', async () => {
      const result = await aiService.processEmailStatusUpdate('', '');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('originalText');
    });
  });
});