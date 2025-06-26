const database = require('../services/database');

class StatusHistory {
  constructor(data) {
    this.history_id = data.history_id;
    this.request_id = data.request_id;
    this.previous_status = data.previous_status;
    this.new_status = data.new_status;
    this.changed_by = data.changed_by;
    this.change_reason = data.change_reason;
    this.changed_at = data.changed_at || new Date().toISOString();
  }

  static async create(historyData) {
    const history = new StatusHistory({
      ...historyData,
      history_id: `HIST${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    });

    return await database.create('status_history', history);
  }

  static async findByRequestId(requestId) {
    return await database.findAll('status_history', { request_id: requestId });
  }

  static async findAll() {
    return await database.findAll('status_history');
  }

  static async recordStatusChange(requestId, previousStatus, newStatus, changedBy = 'SYSTEM', reason = '') {
    return await this.create({
      request_id: requestId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: changedBy,
      change_reason: reason
    });
  }
}

module.exports = StatusHistory;