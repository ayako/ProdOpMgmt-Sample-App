const sql = require('mssql');
const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

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
    
    // Mock data store for when no real database is available
    this.mockData = {};
    
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
        await this.loadMockData();
      }
      console.log(`Database initialized: ${this.useCosmosDB ? 'CosmosDB' : this.mockMode ? 'Mock Mode' : 'SQL Server'}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      console.log('Falling back to mock mode');
      this.mockMode = true;
      await this.loadMockData();
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
      
      // Initialize table if it doesn't exist
      if (!this.mockData[tableName]) {
        this.mockData[tableName] = [];
      }
      
      // Add data to mock store
      const item = { ...data, id: 'MOCK_ID_' + Date.now() };
      this.mockData[tableName].push(item);
      return item;
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
      
      // Return empty array if table doesn't exist
      if (!this.mockData[tableName]) {
        return [];
      }
      
      let results = this.mockData[tableName];
      
      // Apply conditions if any
      if (Object.keys(conditions).length > 0) {
        results = results.filter(item => {
          return Object.keys(conditions).every(key => 
            item[key] === conditions[key]
          );
        });
      }
      
      return results;
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

  async close() {
    if (this.sqlPool) {
      await this.sqlPool.close();
    }
  }

  async loadCSVData(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      if (!fs.existsSync(filePath)) {
        console.log(`CSV file not found: ${filePath}`);
        resolve([]);
        return;
      }
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async loadMockData() {
    try {
      console.log('Loading sample data for mock mode...');
      const dataDir = path.join(__dirname, '../../database');
      
      // Load users
      const users = await this.loadCSVData(path.join(dataDir, 'users.csv'));
      this.mockData['users'] = users;
      
      // Load factories and normalize status
      const factories = await this.loadCSVData(path.join(dataDir, 'factories.csv'));
      const normalizedFactories = factories.map(factory => ({
        ...factory,
        status: this.normalizeFactoryStatus(factory.status)
      }));
      this.mockData['factories'] = normalizedFactories;
      
      // Load products
      const products = await this.loadCSVData(path.join(dataDir, 'products.csv'));
      this.mockData['products'] = products;
      
      // Load production requests and convert Japanese status to English
      const requests = await this.loadCSVData(path.join(dataDir, 'production_adjustment_requests.csv'));
      const normalizedRequests = requests.map((request, index) => {
        const normalized = {
          ...request,
          status: this.normalizeStatus(request.status),
          adjustment_type: this.normalizeAdjustmentType(request.adjustment_type),
          priority: this.normalizePriority(request.priority)
        };
        
        // For demo purposes, make some entries have today's date to show dashboard values
        const today = new Date().toISOString();
        const todayDateOnly = new Date().toISOString().split('T')[0];
        
        // Make the first 2 'responded' requests updated today
        if (normalized.status === 'responded' && index < 2) {
          normalized.updated_at = today;
        }
        
        // Make one request submitted today  
        if (normalized.status === 'submitted') {
          normalized.created_at = today;
          normalized.updated_at = today;
        }
        
        // Update response_deadline to make some overdue for demo
        if (index === 0) {
          // Make first request overdue
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          normalized.response_deadline = yesterday.toISOString();
        }
        
        return normalized;
      });
      this.mockData['production_adjustment_requests'] = normalizedRequests;
      
      // Load factory responses  
      const responses = await this.loadCSVData(path.join(dataDir, 'factory_responses.csv'));
      this.mockData['factory_responses'] = responses;
      
      // Load status history
      const statusHistory = await this.loadCSVData(path.join(dataDir, 'status_history.csv'));
      this.mockData['status_history'] = statusHistory;
      
      console.log(`Mock data loaded: ${users.length} users, ${factories.length} factories, ${products.length} products, ${normalizedRequests.length} requests`);
    } catch (error) {
      console.error('Failed to load mock data:', error);
      // Initialize empty structures so app doesn't crash
      this.mockData = {
        'users': [],
        'factories': [],
        'products': [],
        'production_adjustment_requests': [],
        'factory_responses': [],
        'status_history': []
      };
    }
  }

  normalizeFactoryStatus(japaneseStatus) {
    const statusMap = {
      '稼働中': 'active',
      '停止中': 'inactive'
    };
    return statusMap[japaneseStatus] || japaneseStatus;
  }

  normalizeStatus(japaneseStatus) {
    const statusMap = {
      '送信済み': 'submitted',
      '確認中': 'under_review', 
      '回答済み': 'responded',
      '承認済み': 'approved',
      '拒否': 'rejected',
      '完了': 'completed'
    };
    return statusMap[japaneseStatus] || japaneseStatus;
  }

  normalizeAdjustmentType(japaneseType) {
    const typeMap = {
      '増産': 'increase',
      '減産': 'decrease'
    };
    return typeMap[japaneseType] || japaneseType;
  }

  normalizePriority(japanesePriority) {
    const priorityMap = {
      '高': 'high',
      '中': 'medium', 
      '低': 'low'
    };
    return priorityMap[japanesePriority] || japanesePriority;
  }
}

module.exports = new DatabaseService();