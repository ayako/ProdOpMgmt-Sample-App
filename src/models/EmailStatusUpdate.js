const database = require('../services/database');

class EmailStatusUpdate {
  constructor(data) {
    this.update_id = data.update_id;
    this.email_id = data.email_id;
    this.request_id = data.request_id;
    this.status_update = data.status_update;
    this.progress_percentage = data.progress_percentage;
    this.completion_date = data.completion_date;
    this.issues = data.issues;
    this.additional_info = data.additional_info;
    this.email_subject = data.email_subject;
    this.email_body = data.email_body;
    this.email_from = data.email_from;
    this.email_date = data.email_date;
    this.ai_confidence = data.ai_confidence;
    this.processed_at = data.processed_at || new Date().toISOString();
    this.created_at = data.created_at || new Date().toISOString();
  }

  static async create(updateData) {
    const update = new EmailStatusUpdate({
      ...updateData,
      update_id: `ESU${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    });

    return await database.create('email_status_updates', update);
  }

  static async findByRequestId(requestId) {
    return await database.findAll('email_status_updates', { request_id: requestId });
  }

  static async findAll() {
    return await database.findAll('email_status_updates');
  }

  static async findRecent(limit = 10) {
    const allUpdates = await this.findAll();
    return allUpdates
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }

  static async findByEmailId(emailId) {
    return await database.findAll('email_status_updates', { email_id: emailId });
  }
}

module.exports = EmailStatusUpdate;