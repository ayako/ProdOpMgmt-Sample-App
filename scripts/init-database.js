require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const database = require('../src/services/database');

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

async function initializeDatabase() {
    console.log('Initializing database with sample data...');
    
    try {
        await database.initialize();
        
        // Load data from CSV files
        const dataDir = path.join(__dirname, '../database');
        
        // Load users
        console.log('Loading users...');
        const users = await loadCSVData(path.join(dataDir, 'users.csv'));
        for (const user of users) {
            try {
                await database.create('users', user);
            } catch (error) {
                console.log(`User ${user.user_id} already exists or error:`, error.message);
            }
        }
        
        // Load factories
        console.log('Loading factories...');
        const factories = await loadCSVData(path.join(dataDir, 'factories.csv'));
        for (const factory of factories) {
            try {
                await database.create('factories', factory);
            } catch (error) {
                console.log(`Factory ${factory.factory_id} already exists or error:`, error.message);
            }
        }
        
        // Load products
        console.log('Loading products...');
        const products = await loadCSVData(path.join(dataDir, 'products.csv'));
        for (const product of products) {
            try {
                await database.create('products', product);
            } catch (error) {
                console.log(`Product ${product.product_id} already exists or error:`, error.message);
            }
        }
        
        // Load production requests
        console.log('Loading production requests...');
        const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
        const requests = await loadCSVData(path.join(dataDir, 'production_adjustment_requests.csv'));
        for (const request of requests) {
            try {
                await database.create(tableName, request);
            } catch (error) {
                console.log(`Request ${request.request_id} already exists or error:`, error.message);
            }
        }
        
        // Load factory responses
        console.log('Loading factory responses...');
        const responses = await loadCSVData(path.join(dataDir, 'factory_responses.csv'));
        for (const response of responses) {
            try {
                await database.create('factory_responses', response);
            } catch (error) {
                console.log(`Response ${response.response_id} already exists or error:`, error.message);
            }
        }
        
        // Load status history
        console.log('Loading status history...');
        const statusHistory = await loadCSVData(path.join(dataDir, 'status_history.csv'));
        for (const history of statusHistory) {
            try {
                await database.create('status_history', history);
            } catch (error) {
                console.log(`History ${history.history_id} already exists or error:`, error.message);
            }
        }
        
        console.log('Database initialization completed successfully!');
        
        // Display summary
        const userCount = await database.findAll('users');
        const factoryCount = await database.findAll('factories');
        const productCount = await database.findAll('products');
        const requestCount = await database.findAll(tableName);
        
        console.log('\n=== Data Summary ===');
        console.log(`Users: ${userCount.length}`);
        console.log(`Factories: ${factoryCount.length}`);
        console.log(`Products: ${productCount.length}`);
        console.log(`Requests: ${requestCount.length}`);
        
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    } finally {
        await database.close();
    }
}

// Check if running directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Initialization complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };