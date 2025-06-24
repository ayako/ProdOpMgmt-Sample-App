const { app } = require('@azure/functions');
const { createDatabaseService } = require('../shared/database');
const { createAIService } = require('../shared/ai');

// Coordination Agent - Main orchestrator
app.http('coordination-agent', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Coordination Agent triggered');

        try {
            const requestBody = await request.json();
            const { action, data } = requestBody;

            const database = createDatabaseService();
            await database.initialize();

            let result;

            switch (action) {
                case 'process_new_request':
                    result = await processNewRequest(data, database, context);
                    break;
                case 'process_factory_response':
                    result = await processFactoryResponse(data, database, context);
                    break;
                case 'check_overdue_requests':
                    result = await checkOverdueRequests(database, context);
                    break;
                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, result })
            };

        } catch (error) {
            context.log.error('Coordination Agent error:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    error: error.message 
                })
            };
        }
    }
});

async function processNewRequest(requestData, database, context) {
    context.log('Processing new request:', requestData.request_id);

    // 1. Validate request data
    if (!requestData.request_id || !requestData.factory_id || !requestData.product_id) {
        throw new Error('Invalid request data');
    }

    // 2. Store request in database
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    await database.create(tableName, requestData);

    // 3. Trigger factory selection if needed
    if (!requestData.factory_id) {
        context.log('Triggering factory selection');
        // Call factory selection agent
        await callAgent('factory-selection-agent', {
            action: 'select_factory',
            data: requestData
        });
    }

    // 4. Trigger communication agent
    context.log('Triggering communication agent');
    await callAgent('communication-agent', {
        action: 'send_request',
        data: requestData
    });

    // 5. Record status history
    await database.create('status_history', {
        history_id: `HIST${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        request_id: requestData.request_id,
        previous_status: null,
        new_status: 'submitted',
        changed_by: 'COORDINATION_AGENT',
        change_reason: 'Request submitted and sent to factory',
        changed_at: new Date().toISOString()
    });

    return {
        request_id: requestData.request_id,
        status: 'submitted',
        message: 'Request processed and sent to factory'
    };
}

async function processFactoryResponse(responseData, database, context) {
    context.log('Processing factory response for request:', responseData.request_id);

    // 1. Call response processing agent
    const processedResponse = await callAgent('response-processing-agent', {
        action: 'process_response',
        data: responseData
    });

    // 2. Update request status based on processed response
    if (processedResponse.data && processedResponse.confidence > 0.7) {
        await callAgent('status-management-agent', {
            action: 'update_status',
            data: {
                request_id: responseData.request_id,
                new_status: determineNewStatus(processedResponse.data.acceptance_status),
                changed_by: 'AI_AGENT',
                change_reason: `Factory response processed with ${Math.round(processedResponse.confidence * 100)}% confidence`
            }
        });
    }

    return {
        request_id: responseData.request_id,
        processed: true,
        confidence: processedResponse.confidence
    };
}

async function checkOverdueRequests(database, context) {
    context.log('Checking for overdue requests');

    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const requests = await database.findAll(tableName);
    
    const now = new Date();
    const overdueRequests = requests.filter(req => {
        const deadline = new Date(req.response_deadline);
        return deadline < now && !['completed', 'rejected', 'approved'].includes(req.status);
    });

    context.log(`Found ${overdueRequests.length} overdue requests`);

    // Process each overdue request
    for (const request of overdueRequests) {
        // Update status to overdue
        await callAgent('status-management-agent', {
            action: 'update_status',
            data: {
                request_id: request.request_id,
                new_status: 'overdue',
                changed_by: 'COORDINATION_AGENT',
                change_reason: 'Response deadline exceeded'
            }
        });

        // Send notification
        await callAgent('communication-agent', {
            action: 'send_overdue_notification',
            data: request
        });
    }

    return {
        overdueCount: overdueRequests.length,
        processedRequests: overdueRequests.map(r => r.request_id)
    };
}

async function callAgent(agentName, payload) {
    const functionsEndpoint = process.env.FUNCTIONS_ENDPOINT;
    const functionsKey = process.env.FUNCTIONS_KEY;
    
    if (!functionsEndpoint) {
        console.log(`Would call ${agentName} with:`, payload);
        return { success: true, mock: true };
    }

    const axios = require('axios');
    
    const response = await axios.post(
        `${functionsEndpoint}/api/${agentName}`,
        payload,
        {
            headers: {
                'x-functions-key': functionsKey,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data;
}

function determineNewStatus(acceptanceStatus) {
    switch (acceptanceStatus?.toLowerCase()) {
        case 'accepted':
            return 'approved';
        case 'rejected':
            return 'rejected';
        case 'conditional':
            return 'under_review';
        default:
            return 'responded';
    }
}