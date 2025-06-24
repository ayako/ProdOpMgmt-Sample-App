const database = require('../services/database');

class Factory {
  constructor(data) {
    this.factory_id = data.factory_id;
    this.factory_name = data.factory_name;
    this.factory_code = data.factory_code;
    this.location = data.location;
    this.contact_person = data.contact_person;
    this.contact_email = data.contact_email;
    this.contact_phone = data.contact_phone;
    this.production_capacity = data.production_capacity;
    this.specialities = data.specialities;
    this.status = data.status || 'active';
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static async create(factoryData) {
    const factory = new Factory({
      ...factoryData,
      factory_id: factoryData.factory_id || `FAC${Date.now()}${Math.random().toString(36).substr(2, 3).toUpperCase()}`
    });

    return await database.create('factories', factory);
  }

  static async findById(factoryId) {
    return await database.findById('factories', factoryId, 'factory_id');
  }

  static async findAll(conditions = {}) {
    return await database.findAll('factories', conditions);
  }

  static async update(factoryId, updates) {
    const updatedData = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    return await database.update('factories', factoryId, updatedData, 'factory_id');
  }

  static async findBySpeciality(speciality) {
    const factories = await this.findAll();
    return factories.filter(factory => 
      factory.specialities && factory.specialities.toLowerCase().includes(speciality.toLowerCase())
    );
  }

  static async findActiveFactories() {
    return await this.findAll({ status: 'active' });
  }

  static async delete(factoryId) {
    return await database.delete('factories', factoryId, 'factory_id');
  }
}

module.exports = Factory;