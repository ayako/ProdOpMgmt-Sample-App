const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.configured = false;
    this.mockMode = true;
    
    // Check if email is configured
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        this.transporter = nodemailer.createTransporter({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT) || 993,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        this.configured = true;
        this.mockMode = false;
      } catch (error) {
        console.log('Email configuration failed - using mock mode:', error.message);
      }
    } else {
      console.log('Email not configured - using mock mode');
    }
  }

  // Mock email data for demonstration
  getMockEmails() {
    return [
      {
        id: 'EMAIL_001',
        messageId: 'mock_msg_001',
        subject: 'Re: 生産調整依頼 R-001 - 回答',
        from: 'factory1@example.com',
        to: 'production@company.com',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        body: `
お疲れ様です。

依頼ID: R-001 についてご回答いたします。

【回答内容】
受諾状況: 条件付き受諾
対応可能数量: 400個
対応可能日: 2024-01-30
追加費用: 50000円
条件: 材料費高騰により追加費用が発生いたします

以上、ご確認よろしくお願いいたします。

工場A 担当者
        `,
        attachments: [],
        processed: false
      },
      {
        id: 'EMAIL_002', 
        messageId: 'mock_msg_002',
        subject: 'Re: 生産調整依頼 R-003 - 納期変更について',
        from: 'factory2@example.com',
        to: 'production@company.com', 
        date: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        body: `
いつもお世話になっております。

依頼番号 R-003 について回答させていただきます。

ステータス: 受諾
数量: 500個（要求通り）
納期: 2024-02-05（当初より3日遅れ）
理由: 他案件との調整により少し遅れが生じます

よろしくお願いします。
        `,
        attachments: [],
        processed: false
      },
      {
        id: 'EMAIL_003',
        messageId: 'mock_msg_003', 
        subject: '生産調整 R-007 進捗報告',
        from: 'factory3@example.com',
        to: 'production@company.com',
        date: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        body: `
進捗報告いたします。

依頼ID: R-007
現在の状況: 生産中
進捗率: 80%
完了予定: 2024-01-28

順調に進んでおります。

工場C
        `,
        attachments: [],
        processed: false
      }
    ];
  }

  // Read unprocessed emails (mock implementation)
  async readUnprocessedEmails() {
    if (this.mockMode) {
      console.log('Reading mock emails...');
      return this.getMockEmails().filter(email => !email.processed);
    }

    // Real implementation would use IMAP to fetch unread emails
    // For now, return empty array as real email integration is not configured
    console.log('Real email reading not implemented yet');
    return [];
  }

  // Mark email as processed
  async markEmailAsProcessed(emailId) {
    if (this.mockMode) {
      console.log(`Marking mock email ${emailId} as processed`);
      return true;
    }

    // Real implementation would mark email as read or move to processed folder
    return true;
  }

  // Extract attachments from email
  async extractAttachments(email) {
    if (this.mockMode) {
      // Mock implementation - return empty attachments
      return [];
    }

    // Real implementation would extract and decode attachments
    return email.attachments || [];
  }

  // Parse email content and extract request information
  parseEmailContent(emailBody, subject) {
    const content = {
      subject: subject || '',
      body: emailBody || '',
      extractedInfo: {}
    };

    // Extract request ID from subject or body
    const requestIdMatch = (subject + ' ' + emailBody).match(/[RｒR][-－\-]?(\d{3,})/i);
    if (requestIdMatch) {
      content.extractedInfo.request_id = 'R-' + requestIdMatch[1].padStart(3, '0');
    }

    return content;
  }
}

module.exports = new EmailService();