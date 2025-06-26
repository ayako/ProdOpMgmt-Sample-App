const { app } = require('@azure/functions');
const { createDatabaseService } = require('../shared/database');

// Status Management Agent - Automated status tracking and updates
app.http('status-management-agent', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Status Management Agent triggered');

        try {
            const requestBody = await request.json();
            const { action, data } = requestBody;

            const database = createDatabaseService();
            await database.initialize();

            let result;

            switch (action) {
                case 'update_status':
                    result = await updateRequestStatus(data, database, context);
                    break;
                case 'check_transitions':
                    result = await checkStatusTransitions(data, database, context);
                    break;
                case 'auto_progress':
                    result = await autoProgressStatuses(database, context);
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
            context.log.error('Status Management Agent error:', error);
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

async function updateRequestStatus(data, database, context) {
    const { request_id, new_status, changed_by = 'SYSTEM_AGENT', change_reason = '' } = data;

    context.log(`Updating status for request ${request_id} to ${new_status}`);

    // 1. Get current request
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const currentRequest = await database.findById(tableName, request_id, 'request_id');

    if (!currentRequest) {
        throw new Error(`Request ${request_id} not found`);
    }

    const previousStatus = currentRequest.status;

    // 2. Validate status transition
    const isValidTransition = validateStatusTransition(previousStatus, new_status);
    if (!isValidTransition.valid) {
        throw new Error(`Invalid status transition: ${previousStatus} -> ${new_status}. ${isValidTransition.reason}`);
    }

    // 3. Update request status
    const updatedRequest = await database.update(tableName, request_id, {
        status: new_status,
        status_memo: change_reason,
        updated_at: new Date().toISOString()
    }, 'request_id');

    // 4. Record status history
    await database.create('status_history', {
        history_id: `HIST${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        request_id: request_id,
        previous_status: previousStatus,
        new_status: new_status,
        changed_by: changed_by,
        change_reason: change_reason,
        changed_at: new Date().toISOString()
    });

    // 5. Check for automatic next actions
    const nextActions = determineNextActions(new_status, updatedRequest, context);

    context.log(`Status updated successfully: ${previousStatus} -> ${new_status}`);

    return {
        request_id: request_id,
        previous_status: previousStatus,
        new_status: new_status,
        updated_at: updatedRequest.updated_at,
        next_actions: nextActions,
        change_recorded: true
    };
}

function validateStatusTransition(fromStatus, toStatus) {
    const validTransitions = {
        'submitted': ['under_review', 'responded', 'cancelled'],
        'under_review': ['responded', 'approved', 'rejected', 'cancelled'],
        'responded': ['approved', 'rejected', 'under_review'],
        'approved': ['in_progress', 'completed', 'cancelled'],
        'rejected': ['under_review', 'cancelled'],
        'in_progress': ['completed', 'cancelled', 'on_hold'],
        'on_hold': ['in_progress', 'cancelled'],
        'completed': [], // Terminal state
        'cancelled': [], // Terminal state
        'overdue': ['under_review', 'responded', 'cancelled']
    };

    const allowedTransitions = validTransitions[fromStatus] || [];
    
    if (allowedTransitions.includes(toStatus)) {
        return { valid: true };
    }

    return { 
        valid: false, 
        reason: `Transition from '${fromStatus}' to '${toStatus}' is not allowed. Valid transitions: ${allowedTransitions.join(', ')}` 
    };
}

function determineNextActions(newStatus, request, context) {
    const actions = [];

    switch (newStatus) {
        case 'submitted':
            actions.push({
                type: 'notification',
                target: 'factory',
                message: 'New production adjustment request received'
            });
            break;

        case 'approved':
            actions.push({
                type: 'notification',
                target: 'requester',
                message: 'Request approved - production will begin'
            });
            actions.push({
                type: 'schedule_followup',
                days: 7,
                action: 'check_progress'
            });
            break;

        case 'rejected':
            actions.push({
                type: 'notification',
                target: 'requester',
                message: 'Request rejected - please review and resubmit if needed'
            });
            break;

        case 'completed':
            actions.push({
                type: 'notification',
                target: 'all',
                message: 'Production adjustment completed successfully'
            });
            actions.push({
                type: 'archive',
                delay_days: 30
            });
            break;

        case 'overdue':
            actions.push({
                type: 'escalation',
                target: 'manager',
                message: 'Request is overdue and requires attention'
            });
            break;
    }

    return actions;
}

async function checkStatusTransitions(data, database, context) {
    const { request_id } = data;

    context.log(`Checking valid transitions for request: ${request_id}`);

    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const request = await database.findById(tableName, request_id, 'request_id');

    if (!request) {
        throw new Error(`Request ${request_id} not found`);
    }

    const currentStatus = request.status;
    const validTransitions = {
        'submitted': ['under_review', 'responded', 'cancelled'],
        'under_review': ['responded', 'approved', 'rejected', 'cancelled'],
        'responded': ['approved', 'rejected', 'under_review'],
        'approved': ['in_progress', 'completed', 'cancelled'],
        'rejected': ['under_review', 'cancelled'],
        'in_progress': ['completed', 'cancelled', 'on_hold'],
        'on_hold': ['in_progress', 'cancelled'],
        'completed': [],
        'cancelled': [],
        'overdue': ['under_review', 'responded', 'cancelled']
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    return {
        request_id: request_id,
        current_status: currentStatus,
        allowed_transitions: allowedTransitions,
        is_terminal: allowedTransitions.length === 0,
        transition_rules: allowedTransitions.map(status => ({
            to_status: status,
            requires_approval: ['approved', 'completed'].includes(status),
            auto_allowed: ['under_review', 'overdue'].includes(status)
        }))
    };
}

async function autoProgressStatuses(database, context) {
    context.log('Checking for automatic status progressions');

    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const allRequests = await database.findAll(tableName);
    
    const progressedRequests = [];
    const now = new Date();

    for (const request of allRequests) {
        let shouldProgress = false;
        let newStatus = request.status;
        let reason = '';

        // Check for overdue requests
        if (request.response_deadline && !['completed', 'cancelled', 'rejected'].includes(request.status)) {
            const deadline = new Date(request.response_deadline);
            if (deadline < now && request.status !== 'overdue') {
                shouldProgress = true;
                newStatus = 'overdue';
                reason = 'Response deadline exceeded';
            }
        }

        // Check for auto-completion conditions
        if (request.status === 'in_progress') {
            const deliveryDeadline = new Date(request.delivery_deadline);
            if (deliveryDeadline < now) {
                // Could auto-complete if past delivery date
                // This would typically require additional verification
                context.log(`Request ${request.request_id} may be ready for completion (past delivery date)`);
            }
        }

        if (shouldProgress) {
            try {
                await updateRequestStatus({
                    request_id: request.request_id,
                    new_status: newStatus,
                    changed_by: 'AUTO_SYSTEM',
                    change_reason: reason
                }, database, context);

                progressedRequests.push({
                    request_id: request.request_id,
                    from_status: request.status,
                    to_status: newStatus,
                    reason: reason
                });
            } catch (error) {
                context.log.error(`Error auto-progressing request ${request.request_id}:`, error);
            }
        }
    }

    context.log(`Auto-progressed ${progressedRequests.length} requests`);

    return {
        processed_count: allRequests.length,
        progressed_count: progressedRequests.length,
        progressed_requests: progressedRequests,
        timestamp: now.toISOString()
    };
}