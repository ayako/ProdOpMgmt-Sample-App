const { app } = require('@azure/functions');
const { createDatabaseService } = require('../shared/database');

// Factory Selection Agent - Intelligent factory matching
app.http('factory-selection-agent', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Factory Selection Agent triggered');

        try {
            const requestBody = await request.json();
            const { action, data } = requestBody;

            const database = createDatabaseService();
            await database.initialize();

            let result;

            switch (action) {
                case 'select_factory':
                    result = await selectOptimalFactory(data, database, context);
                    break;
                case 'evaluate_capacity':
                    result = await evaluateFactoryCapacity(data, database, context);
                    break;
                case 'get_recommendations':
                    result = await getFactoryRecommendations(data, database, context);
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
            context.log.error('Factory Selection Agent error:', error);
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

async function selectOptimalFactory(requestData, database, context) {
    context.log('Selecting optimal factory for request:', requestData.product_id);

    // 1. Get all active factories
    const factories = await database.findAll('factories', { status: 'active' });

    if (factories.length === 0) {
        throw new Error('No active factories available');
    }

    // 2. Get product information
    const product = await database.findById('products', requestData.product_id, 'product_id');
    
    if (!product) {
        throw new Error('Product not found');
    }

    // 3. Score factories based on multiple criteria
    const factoryScores = await Promise.all(factories.map(async (factory) => {
        const score = await calculateFactoryScore(factory, product, requestData, database, context);
        return {
            factory,
            score,
            reasoning: score.reasoning
        };
    }));

    // 4. Sort by score and select the best factory
    factoryScores.sort((a, b) => b.score.total - a.score.total);
    const selectedFactory = factoryScores[0];

    context.log(`Selected factory: ${selectedFactory.factory.factory_name} (Score: ${selectedFactory.score.total})`);

    return {
        selectedFactory: selectedFactory.factory,
        score: selectedFactory.score,
        reasoning: selectedFactory.reasoning,
        alternatives: factoryScores.slice(1, 3), // Top 2 alternatives
        selectionCriteria: {
            specialityMatch: selectedFactory.score.speciality,
            capacity: selectedFactory.score.capacity,
            location: selectedFactory.score.location,
            history: selectedFactory.score.history
        }
    };
}

async function calculateFactoryScore(factory, product, requestData, database, context) {
    let score = {
        speciality: 0,
        capacity: 0,
        location: 0,
        history: 0,
        total: 0,
        reasoning: []
    };

    // 1. Speciality matching (40% weight)
    if (factory.specialities && product.category) {
        const specialities = factory.specialities.toLowerCase();
        const category = product.category.toLowerCase();
        
        if (specialities.includes(category)) {
            score.speciality = 40;
            score.reasoning.push(`Factory specializes in ${product.category}`);
        } else if (specialities.includes('general') || specialities.includes('汎用')) {
            score.speciality = 20;
            score.reasoning.push('Factory has general production capabilities');
        }
    }

    // 2. Production capacity (30% weight)
    if (factory.production_capacity && requestData.requested_quantity) {
        const capacityRatio = factory.production_capacity / requestData.requested_quantity;
        if (capacityRatio >= 2) {
            score.capacity = 30;
            score.reasoning.push('Sufficient production capacity');
        } else if (capacityRatio >= 1) {
            score.capacity = 20;
            score.reasoning.push('Adequate production capacity');
        } else if (capacityRatio >= 0.5) {
            score.capacity = 10;
            score.reasoning.push('Limited but possible capacity');
        }
    } else {
        score.capacity = 15; // Default moderate score
    }

    // 3. Location preference (15% weight)
    if (factory.location) {
        // Simple location scoring - can be enhanced with actual distance calculation
        if (factory.location.includes('東京') || factory.location.includes('首都圏')) {
            score.location = 15;
            score.reasoning.push('Favorable location for distribution');
        } else {
            score.location = 10;
            score.reasoning.push('Standard location');
        }
    }

    // 4. Historical performance (15% weight)
    const historicalScore = await getHistoricalPerformance(factory.factory_id, database, context);
    score.history = historicalScore;
    if (historicalScore > 10) {
        score.reasoning.push('Good historical performance');
    }

    // Calculate total score
    score.total = score.speciality + score.capacity + score.location + score.history;

    return score;
}

async function getHistoricalPerformance(factoryId, database, context) {
    try {
        // Get recent requests for this factory
        const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
        const recentRequests = await database.findAll(tableName, { factory_id: factoryId });

        if (recentRequests.length === 0) {
            return 5; // Neutral score for new factories
        }

        // Calculate success rate
        const completedRequests = recentRequests.filter(req => 
            ['completed', 'approved'].includes(req.status)
        );
        const successRate = completedRequests.length / recentRequests.length;

        // Convert to score (0-15 points)
        return Math.round(successRate * 15);
    } catch (error) {
        context.log.error('Error calculating historical performance:', error);
        return 5; // Default neutral score
    }
}

async function evaluateFactoryCapacity(data, database, context) {
    context.log('Evaluating factory capacity for:', data.factory_id);

    const factory = await database.findById('factories', data.factory_id, 'factory_id');
    
    if (!factory) {
        throw new Error('Factory not found');
    }

    // Get current workload
    const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
    const activeRequests = await database.findAll(tableName, { 
        factory_id: data.factory_id,
        status: 'approved'
    });

    const currentWorkload = activeRequests.reduce((total, req) => 
        total + (req.requested_quantity || 0), 0
    );

    const availableCapacity = (factory.production_capacity || 1000) - currentWorkload;
    const utilizationRate = currentWorkload / (factory.production_capacity || 1000);

    return {
        factory_id: data.factory_id,
        factory_name: factory.factory_name,
        total_capacity: factory.production_capacity || 1000,
        current_workload: currentWorkload,
        available_capacity: Math.max(0, availableCapacity),
        utilization_rate: Math.round(utilizationRate * 100),
        can_handle_request: availableCapacity >= (data.requested_quantity || 0),
        recommendation: utilizationRate < 0.8 ? 'recommended' : 
                      utilizationRate < 0.95 ? 'caution' : 'not_recommended'
    };
}

async function getFactoryRecommendations(data, database, context) {
    context.log('Getting factory recommendations for product:', data.product_id);

    const mockRequest = {
        product_id: data.product_id,
        requested_quantity: data.quantity || 100,
        priority: data.priority || 'medium'
    };

    const selection = await selectOptimalFactory(mockRequest, database, context);

    return {
        recommendations: [
            selection.selectedFactory,
            ...(selection.alternatives || []).map(alt => alt.factory)
        ].slice(0, 3),
        criteria: selection.selectionCriteria,
        reasoning: selection.reasoning
    };
}