const { app } = require('@azure/functions');
const { createAIService } = require('../shared/ai');

// Response Processing Agent - AI-powered response analysis
app.http('response-processing-agent', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Response Processing Agent triggered');

        try {
            const requestBody = await request.json();
            const { action, data } = requestBody;

            const aiService = createAIService();
            let result;

            switch (action) {
                case 'process_response':
                    result = await processFactoryResponse(data.responseText, aiService, context);
                    break;
                case 'extract_data':
                    result = await extractStructuredData(data.text, data.schema, aiService, context);
                    break;
                case 'evaluate_confidence':
                    result = await evaluateConfidence(data.originalText, data.extractedData, aiService, context);
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
            context.log.error('Response Processing Agent error:', error);
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

async function processFactoryResponse(responseText, aiService, context) {
    context.log('Processing factory response text');

    const schema = {
        request_id: 'string',
        acceptance_status: 'string', // 'accepted', 'rejected', 'conditional'
        available_quantity: 'number',
        available_date: 'string',
        additional_cost: 'number',
        comments: 'string',
        conditions: 'string'
    };

    try {
        // Extract structured data
        const extractedData = await aiService.extractStructuredData(responseText, schema);
        
        // Evaluate confidence
        const confidence = await aiService.evaluateConfidence(responseText, extractedData);

        // Additional validation
        const validationResult = validateExtractedData(extractedData);

        return {
            data: extractedData,
            confidence: confidence,
            validation: validationResult,
            originalText: responseText,
            processingTimestamp: new Date().toISOString()
        };

    } catch (error) {
        context.log.error('Factory response processing failed:', error);
        
        // Fallback to traditional text analysis
        const fallbackResult = await fallbackTextAnalysis(responseText, context);
        
        return {
            data: fallbackResult,
            confidence: 0.3, // Low confidence for fallback
            originalText: responseText,
            error: error.message,
            fallbackUsed: true,
            processingTimestamp: new Date().toISOString()
        };
    }
}

async function extractStructuredData(text, schema, aiService, context) {
    context.log('Extracting structured data');
    
    try {
        const result = await aiService.extractStructuredData(text, schema);
        return result;
    } catch (error) {
        context.log.error('Structured data extraction failed:', error);
        throw error;
    }
}

async function evaluateConfidence(originalText, extractedData, aiService, context) {
    context.log('Evaluating confidence');
    
    try {
        const confidence = await aiService.evaluateConfidence(originalText, extractedData);
        return confidence;
    } catch (error) {
        context.log.error('Confidence evaluation failed:', error);
        return 0.5; // Default moderate confidence
    }
}

function validateExtractedData(data) {
    const validation = {
        isValid: true,
        warnings: [],
        errors: []
    };

    // Check required fields
    if (!data.request_id) {
        validation.errors.push('Request ID is missing');
        validation.isValid = false;
    }

    if (!data.acceptance_status) {
        validation.errors.push('Acceptance status is missing');
        validation.isValid = false;
    }

    // Validate acceptance status values
    const validStatuses = ['accepted', 'rejected', 'conditional'];
    if (data.acceptance_status && !validStatuses.includes(data.acceptance_status.toLowerCase())) {
        validation.warnings.push(`Unusual acceptance status: ${data.acceptance_status}`);
    }

    // Validate numeric fields
    if (data.available_quantity && (isNaN(data.available_quantity) || data.available_quantity < 0)) {
        validation.warnings.push('Available quantity should be a positive number');
    }

    if (data.additional_cost && (isNaN(data.additional_cost) || data.additional_cost < 0)) {
        validation.warnings.push('Additional cost should be a positive number');
    }

    // Validate dates
    if (data.available_date && isNaN(Date.parse(data.available_date))) {
        validation.warnings.push('Available date format may be invalid');
    }

    return validation;
}

async function fallbackTextAnalysis(text, context) {
    context.log('Using fallback text analysis');
    
    const lowerText = text.toLowerCase();
    const result = {
        request_id: extractRequestId(text),
        acceptance_status: 'unknown',
        comments: text,
        fallback: true
    };

    // Simple keyword-based analysis
    if (lowerText.includes('承認') || lowerText.includes('受諾') || lowerText.includes('ok') || lowerText.includes('accept')) {
        result.acceptance_status = 'accepted';
    } else if (lowerText.includes('拒否') || lowerText.includes('ng') || lowerText.includes('reject') || lowerText.includes('不可')) {
        result.acceptance_status = 'rejected';
    } else if (lowerText.includes('条件') || lowerText.includes('conditional') || lowerText.includes('要検討')) {
        result.acceptance_status = 'conditional';
    }

    // Try to extract quantities
    const quantityMatch = text.match(/(\d+)(?:個|台|本|件|units?)/i);
    if (quantityMatch) {
        result.available_quantity = parseInt(quantityMatch[1]);
    }

    // Try to extract dates
    const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    if (dateMatch) {
        result.available_date = dateMatch[1];
    }

    return result;
}

function extractRequestId(text) {
    // Try to extract request ID from text
    const patterns = [
        /REQ[A-Z0-9]+/i,
        /依頼[番号]?[:：]?\s*([A-Z0-9]+)/i,
        /request[^a-z]*id[:：]?\s*([A-Z0-9]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1] || match[0];
        }
    }

    return null;
}