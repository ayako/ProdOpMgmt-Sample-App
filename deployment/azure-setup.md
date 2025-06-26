# Azure Deployment Configuration

## Azure App Service (Web Application)

### App Service Plan
- **Name**: pom-solution-app-plan
- **OS**: Linux
- **Runtime**: Node.js 18 LTS
- **Pricing Tier**: B1 (Basic) or higher for production

### App Service Settings
```bash
# Create resource group
az group create --name pom-solution-rg --location "Japan East"

# Create App Service Plan
az appservice plan create \
  --name pom-solution-app-plan \
  --resource-group pom-solution-rg \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group pom-solution-rg \
  --plan pom-solution-app-plan \
  --name pom-solution-webapp \
  --runtime "NODE|18-lts"
```

### Environment Variables
Configure the following app settings:
```bash
az webapp config appsettings set \
  --resource-group pom-solution-rg \
  --name pom-solution-webapp \
  --settings \
    NODE_ENV=production \
    DB_SERVER="your-sql-server.database.windows.net" \
    DB_NAME="production_management" \
    DB_USER="your-username" \
    DB_PASSWORD="your-password" \
    OPENAI_ENDPOINT="https://your-openai.openai.azure.com/" \
    OPENAI_API_KEY="your-openai-key" \
    OPENAI_MODEL_NAME="gpt-4" \
    FUNCTIONS_ENDPOINT="https://your-functions.azurewebsites.net" \
    FUNCTIONS_KEY="your-functions-key"
```

## Azure Functions (Automation Agents)

### Function App
```bash
# Create storage account for functions
az storage account create \
  --name pomfunctionsstorage \
  --resource-group pom-solution-rg \
  --location "Japan East" \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --resource-group pom-solution-rg \
  --consumption-plan-location "Japan East" \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name pom-solution-functions \
  --storage-account pomfunctionsstorage
```

### Function Environment Variables
```bash
az functionapp config appsettings set \
  --resource-group pom-solution-rg \
  --name pom-solution-functions \
  --settings \
    DB_SERVER="your-sql-server.database.windows.net" \
    DB_NAME="production_management" \
    DB_USER="your-username" \
    DB_PASSWORD="your-password" \
    OPENAI_ENDPOINT="https://your-openai.openai.azure.com/" \
    OPENAI_API_KEY="your-openai-key" \
    OPENAI_MODEL_NAME="gpt-4"
```

## Azure SQL Database

### SQL Server and Database
```bash
# Create SQL Server
az sql server create \
  --name pom-solution-sql \
  --resource-group pom-solution-rg \
  --location "Japan East" \
  --admin-user sqladmin \
  --admin-password "YourSecurePassword123!"

# Configure firewall to allow Azure services
az sql server firewall-rule create \
  --resource-group pom-solution-rg \
  --server pom-solution-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az sql db create \
  --resource-group pom-solution-rg \
  --server pom-solution-sql \
  --name production_management \
  --service-objective Basic
```

### Database Schema Deployment
Execute the SQL script in `database/schema.sql` against the created database.

## Azure OpenAI Service

### OpenAI Resource
```bash
# Create OpenAI resource
az cognitiveservices account create \
  --name pom-solution-openai \
  --resource-group pom-solution-rg \
  --location "Japan East" \
  --kind OpenAI \
  --sku S0
```

### Model Deployment
Deploy GPT-4 model through Azure Portal or API:
- Model: gpt-4
- Deployment name: gpt-4-deployment
- Version: Latest available

## Alternative: Azure CosmosDB

If using CosmosDB instead of SQL Database:
```bash
# Create CosmosDB account
az cosmosdb create \
  --name pom-solution-cosmos \
  --resource-group pom-solution-rg \
  --default-consistency-level Session \
  --locations regionName="Japan East" failoverPriority=0 isZoneRedundant=False

# Create database
az cosmosdb sql database create \
  --account-name pom-solution-cosmos \
  --resource-group pom-solution-rg \
  --name production_management
```

## Deployment Steps

1. **Prepare Code**
   ```bash
   # Build and package
   npm install
   npm run test
   ```

2. **Deploy Web App**
   ```bash
   # Using Azure CLI
   az webapp deployment source config-zip \
     --resource-group pom-solution-rg \
     --name pom-solution-webapp \
     --src deployment.zip
   ```

3. **Deploy Functions**
   ```bash
   # Navigate to functions directory
   cd functions
   
   # Deploy using Azure Functions Core Tools
   func azure functionapp publish pom-solution-functions
   ```

4. **Initialize Database**
   ```bash
   # Run initialization script (requires database connection)
   npm run init-db
   ```

## Monitoring and Logging

### Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app pom-solution-insights \
  --location "Japan East" \
  --resource-group pom-solution-rg
```

### Enable Application Insights for Web App and Functions
```bash
# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app pom-solution-insights \
  --resource-group pom-solution-rg \
  --query instrumentationKey -o tsv)

# Configure Web App
az webapp config appsettings set \
  --resource-group pom-solution-rg \
  --name pom-solution-webapp \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY

# Configure Functions
az functionapp config appsettings set \
  --resource-group pom-solution-rg \
  --name pom-solution-functions \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY
```

## Security Considerations

1. **Key Vault Integration**
   ```bash
   # Create Key Vault
   az keyvault create \
     --name pom-solution-vault \
     --resource-group pom-solution-rg \
     --location "Japan East"
   
   # Store secrets
   az keyvault secret set --vault-name pom-solution-vault --name "DatabasePassword" --value "YourSecurePassword123!"
   az keyvault secret set --vault-name pom-solution-vault --name "OpenAIKey" --value "your-openai-key"
   ```

2. **Managed Identity** 
   Enable system-assigned managed identity for App Service and Functions to access Key Vault securely.

3. **Network Security**
   - Configure VNet integration for App Service
   - Use Private Endpoints for SQL Database and other services
   - Implement proper CORS policies

## Cost Optimization

- Use Azure Reserved Instances for predictable workloads
- Configure auto-scaling based on metrics
- Monitor and optimize resource usage through Azure Cost Management
- Consider using Azure SQL Database serverless for development/testing

## Backup and Disaster Recovery

- Enable automated backups for Azure SQL Database
- Configure geo-redundancy for critical data
- Implement backup policies for App Service and Functions
- Set up monitoring and alerting for system health