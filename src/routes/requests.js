const express = require('express');
const router = express.Router();
const ProductionRequest = require('../models/ProductionRequest');
const StatusHistory = require('../models/StatusHistory');
const aiService = require('../services/ai');

// Get all production requests
router.get('/', async (req, res) => {
  try {
    const { status, factory_id } = req.query;
    let requests;

    if (status) {
      requests = await ProductionRequest.findByStatus(status);
    } else if (factory_id) {
      requests = await ProductionRequest.findByFactory(factory_id);
    } else {
      requests = await ProductionRequest.findAll();
    }

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
  }
});

// Get specific production request
router.get('/:id', async (req, res) => {
  try {
    const request = await ProductionRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: 'Failed to fetch request', error: error.message });
  }
});

// Create new production request
router.post('/', async (req, res) => {
  try {
    const requestData = req.body;
    
    // Validate required fields
    const requiredFields = ['requester_id', 'factory_id', 'product_id', 'requested_quantity', 'adjustment_type'];
    const missingFields = requiredFields.filter(field => !requestData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missingFields 
      });
    }

    const newRequest = await ProductionRequest.create(requestData);
    
    // Record initial status in history
    await StatusHistory.recordStatusChange(
      newRequest.request_id,
      null,
      'submitted',
      requestData.requester_id,
      'Initial request creation'
    );

    res.status(201).json(newRequest);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Failed to create request', error: error.message });
  }
});

// Update production request
router.put('/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const updates = req.body;

    // Check if request exists
    const existingRequest = await ProductionRequest.findById(requestId);
    if (!existingRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // If status is being updated, record the change
    if (updates.status && updates.status !== existingRequest.status) {
      await StatusHistory.recordStatusChange(
        requestId,
        existingRequest.status,
        updates.status,
        updates.changed_by || 'SYSTEM',
        updates.change_reason || 'Status update'
      );
    }

    const updatedRequest = await ProductionRequest.update(requestId, updates);
    res.json(updatedRequest);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ message: 'Failed to update request', error: error.message });
  }
});

// Process factory response (AI-powered)
router.post('/:id/process-response', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { responseText } = req.body;

    if (!responseText) {
      return res.status(400).json({ message: 'Response text is required' });
    }

    // Check if request exists
    const existingRequest = await ProductionRequest.findById(requestId);
    if (!existingRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Process the response using AI
    const processedResponse = await aiService.processFactoryResponse(responseText);

    if (processedResponse.data && processedResponse.confidence > 0.7) {
      // Auto-update status based on AI processing
      const newStatus = determineNewStatus(existingRequest.status, processedResponse.data.acceptance_status);
      
      await ProductionRequest.update(requestId, {
        status: newStatus,
        status_memo: `AI processed: ${processedResponse.data.acceptance_status}`
      });

      // Record status change
      await StatusHistory.recordStatusChange(
        requestId,
        existingRequest.status,
        newStatus,
        'AI_AGENT',
        `Factory response processed with ${Math.round(processedResponse.confidence * 100)}% confidence`
      );
    }

    res.json({
      requestId,
      processedResponse,
      autoUpdated: processedResponse.confidence > 0.7
    });
  } catch (error) {
    console.error('Error processing factory response:', error);
    res.status(500).json({ message: 'Failed to process response', error: error.message });
  }
});

// Get request status history
router.get('/:id/history', async (req, res) => {
  try {
    const requestId = req.params.id;
    const history = await StatusHistory.findByRequestId(requestId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching request history:', error);
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
});

// Delete production request
router.delete('/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Check if request exists
    const existingRequest = await ProductionRequest.findById(requestId);
    if (!existingRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await ProductionRequest.delete(requestId);
    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ message: 'Failed to delete request', error: error.message });
  }
});

// Helper function to determine new status
function determineNewStatus(currentStatus, acceptanceStatus) {
  if (currentStatus === 'submitted' && acceptanceStatus) {
    switch (acceptanceStatus.toLowerCase()) {
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
  return currentStatus;
}

module.exports = router;