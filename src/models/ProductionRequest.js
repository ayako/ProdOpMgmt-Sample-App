const database = require('../services/database');

class ProductionRequest {
  constructor(data) {
    this.request_id = data.request_id;
    this.requester_id = data.requester_id;
    this.factory_id = data.factory_id;
    this.product_id = data.product_id;
    this.requested_quantity = data.requested_quantity;
    this.current_quantity = data.current_quantity;
    this.adjustment_type = data.adjustment_type; // 'increase', 'decrease'
    this.priority = data.priority; // 'high', 'medium', 'low'
    this.response_deadline = data.response_deadline;
    this.delivery_deadline = data.delivery_deadline;
    this.reason = data.reason;
    this.status = data.status || 'submitted';
    this.status_memo = data.status_memo;
    this.revision_count = data.revision_count || 0;
    this.revision_reason = data.revision_reason;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static async create(requestData) {
    const request = new ProductionRequest({
      ...requestData,
      request_id: `REQ${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    });

    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.create(tableName, request);
  }

  static async findById(requestId) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.findById(tableName, requestId, 'request_id');
  }

  static async findAll(conditions = {}) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.findAll(tableName, conditions);
  }

  static async update(requestId, updates) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const updatedData = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await database.update(tableName, requestId, updatedData, 'request_id');
  }

  static async updateStatus(requestId, newStatus, memo = '') {
    return await this.update(requestId, {
      status: newStatus,
      status_memo: memo
    });
  }

  static async findByStatus(status) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.findAll(tableName, { status });
  }

  static async findByFactory(factoryId) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.findAll(tableName, { factory_id: factoryId });
  }

  static async findPendingRequests() {
    return await this.findByStatus('submitted');
  }

  static async delete(requestId) {
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    return await database.delete(tableName, requestId, 'request_id');
  }
}

module.exports = ProductionRequest;