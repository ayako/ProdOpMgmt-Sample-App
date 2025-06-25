const database = require('../src/services/database');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function loadCSVData(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function loadSampleData() {
  console.log('Loading sample data...');
  
  try {
    // Load data from CSV files
    const dataDir = path.join(__dirname, '../database');
    
    // Load users
    console.log('Loading users...');
    const users = await loadCSVData(path.join(dataDir, 'users.csv'));
    for (const user of users) {
        await database.create('users', user);
    }
    
    // Load factories
    console.log('Loading factories...');
    const factories = await loadCSVData(path.join(dataDir, 'factories.csv'));
    for (const factory of factories) {
        await database.create('factories', factory);
    }
    
    // Load products
    console.log('Loading products...');
    const products = await loadCSVData(path.join(dataDir, 'products.csv'));
    for (const product of products) {
        await database.create('products', product);
    }
    
    // Load production requests
    console.log('Loading production requests...');
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const requests = await loadCSVData(path.join(dataDir, 'production_adjustment_requests.csv'));
    for (const request of requests) {
        await database.create(tableName, request);
    }
    
    // Load status history
    console.log('Loading status history...');
    const statusHistory = await loadCSVData(path.join(dataDir, 'status_history.csv'));
    for (const history of statusHistory) {
        await database.create('status_history', history);
    }
    
    console.log('Sample data loading completed successfully!');
    
  } catch (error) {
    console.error('Failed to load sample data:', error);
    throw error;
  }
}

module.exports = { loadSampleData };