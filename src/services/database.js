const sql = require('mssql');
const { CosmosClient } = require('@azure/cosmos');

class DatabaseService {
  constructor() {
    this.sqlConfig = {
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT) || 1433,
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };

    this.cosmosClient = null;
    this.database = null;
    this.sqlPool = null;
    
    // Determine which database to use based on environment
    this.useCosmosDB = process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY;
  }

  async initialize() {
    try {
      if (this.useCosmosDB) {
        await this.initializeCosmosDB();
      } else if (this.isConfigured()) {
        await this.initializeSQLServer();
      } else {
        console.log('Database not configured - using mock mode');
        this.mockMode = true;
      }
      console.log(`Database initialized: ${this.useCosmosDB ? 'CosmosDB' : this.mockMode ? 'Mock Mode' : 'SQL Server'}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      console.log('Falling back to mock mode');
      this.mockMode = true;
    }
  }

  isConfigured() {
    return this.sqlConfig.server && this.sqlConfig.database && this.sqlConfig.user && this.sqlConfig.password;
  }

  async initializeSQLServer() {
    this.sqlPool = await sql.connect(this.sqlConfig);
  }

  async initializeCosmosDB() {
    this.cosmosClient = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY
    });

    const databaseResponse = await this.cosmosClient.databases.createIfNotExists({
      id: process.env.COSMOS_DATABASE || 'production_management'
    });
    this.database = databaseResponse.database;

    // Create containers
    await this.createContainers();
  }

  async createContainers() {
    const containers = [
      { id: 'users', partitionKey: '/user_id' },
      { id: 'factories', partitionKey: '/factory_id' },
      { id: 'products', partitionKey: '/product_id' },
      { id: 'production_requests', partitionKey: '/request_id' },
      { id: 'factory_responses', partitionKey: '/request_id' },
      { id: 'status_history', partitionKey: '/request_id' }
    ];

    for (const containerDef of containers) {
      await this.database.containers.createIfNotExists(containerDef);
    }
  }

  // Generic CRUD operations
  async create(tableName, data) {
    if (this.mockMode) {
      console.log(`Mock create in ${tableName}:`, data);
      return { ...data, id: 'MOCK_ID_' + Date.now() };
    }
    
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      const { resource } = await container.items.create(data);
      return resource;
    } else {
      const request = this.sqlPool.request();
      const columns = Object.keys(data).join(', ');
      const values = Object.keys(data).map(key => `@${key}`).join(', ');
      
      Object.keys(data).forEach(key => {
        request.input(key, data[key]);
      });

      const query = `INSERT INTO ${tableName} (${columns}) OUTPUT INSERTED.* VALUES (${values})`;
      const result = await request.query(query);
      return result.recordset[0];
    }
  }

  async findById(tableName, id, idField = 'id') {
    if (this.mockMode) {
      console.log(`Mock findById in ${tableName} with id:`, id);
      return null;
    }
    
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      const { resource } = await container.item(id, id).read();
      return resource;
    } else {
      const request = this.sqlPool.request();
      request.input('id', id);
      const result = await request.query(`SELECT * FROM ${tableName} WHERE ${idField} = @id`);
      return result.recordset[0];
    }
  }

  async findAll(tableName, conditions = {}) {
    if (this.mockMode) {
      console.log(`Mock findAll in ${tableName} with conditions:`, conditions);
      return [];
    }
    
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      const { resources } = await container.items.readAll().fetchAll();
      return resources;
    } else {
      const request = this.sqlPool.request();
      let query = `SELECT * FROM ${tableName}`;
      
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${key} = @${key}`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        
        Object.keys(conditions).forEach(key => {
          request.input(key, conditions[key]);
        });
      }

      const result = await request.query(query);
      return result.recordset;
    }
  }

  async update(tableName, id, data, idField = 'id') {
    if (this.mockMode) {
      console.log(`Mock update in ${tableName} with id:`, id, 'data:', data);
      return { ...data, [idField]: id };
    }
    
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      const { resource } = await container.item(id, id).replace(data);
      return resource;
    } else {
      const request = this.sqlPool.request();
      const setClause = Object.keys(data)
        .filter(key => key !== idField)
        .map(key => `${key} = @${key}`)
        .join(', ');

      request.input('id', id);
      Object.keys(data).forEach(key => {
        if (key !== idField) {
          request.input(key, data[key]);
        }
      });

      const query = `UPDATE ${tableName} SET ${setClause} OUTPUT INSERTED.* WHERE ${idField} = @id`;
      const result = await request.query(query);
      return result.recordset[0];
    }
  }

  async delete(tableName, id, idField = 'id') {
    if (this.mockMode) {
      console.log(`Mock delete in ${tableName} with id:`, id);
      return { deleted: true };
    }
    
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      await container.item(id, id).delete();
      return { deleted: true };
    } else {
      const request = this.sqlPool.request();
      request.input('id', id);
      await request.query(`DELETE FROM ${tableName} WHERE ${idField} = @id`);
      return { deleted: true };
    }
  }

  async delete(tableName, id, idField = 'id') {
    if (this.useCosmosDB) {
      const container = this.database.container(tableName);
      await container.item(id, id).delete();
      return { deleted: true };
    } else {
      const request = this.sqlPool.request();
      request.input('id', id);
      await request.query(`DELETE FROM ${tableName} WHERE ${idField} = @id`);
      return { deleted: true };
    }
  }

  async close() {
    if (this.sqlPool) {
      await this.sqlPool.close();
    }
  }
}

module.exports = new DatabaseService();