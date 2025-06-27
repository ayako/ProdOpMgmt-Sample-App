const express = require('express');
const router = express.Router();
const emailService = require('../services/email');
const aiService = require('../services/ai');
const EmailStatusUpdate = require('../models/EmailStatusUpdate');
const StatusHistory = require('../models/StatusHistory');
const database = require('../services/database');

// Get email status updates
router.get('/status-updates', async (req, res) => {
  try {
    const updates = await EmailStatusUpdate.findRecent(20);
    res.json(updates);
  } catch (error) {
    console.error('Error fetching email status updates:', error);
    res.status(500).json({ message: 'Failed to fetch status updates', error: error.message });
  }
});

// Get email status updates for a specific request
router.get('/status-updates/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const updates = await EmailStatusUpdate.findByRequestId(requestId);
    res.json(updates);
  } catch (error) {
    console.error('Error fetching email status updates for request:', error);
    res.status(500).json({ message: 'Failed to fetch status updates for request', error: error.message });
  }
});

// Process emails and extract status information
router.post('/process-emails', async (req, res) => {
  try {
    console.log('Starting email processing...');
    
    // Read unprocessed emails
    const emails = await emailService.readUnprocessedEmails();
    console.log(`Found ${emails.length} unprocessed emails`);
    
    const processedResults = [];
    
    for (const email of emails) {
      try {
        console.log(`Processing email: ${email.subject}`);
        
        // Extract basic information from email
        const emailContent = emailService.parseEmailContent(email.body, email.subject);
        
        // Use AI to process email content for status updates
        const aiResult = await aiService.processEmailStatusUpdate(email.body, email.subject);
        
        console.log('AI processing result:', aiResult);
        
        if (aiResult.data && aiResult.data.request_id) {
          // Create email status update record
          const statusUpdate = await EmailStatusUpdate.create({
            email_id: email.id,
            request_id: aiResult.data.request_id,
            status_update: aiResult.data.status_update,
            progress_percentage: aiResult.data.progress_percentage,
            completion_date: aiResult.data.completion_date,
            issues: aiResult.data.issues,
            additional_info: aiResult.data.additional_info,
            email_subject: email.subject,
            email_body: email.body,
            email_from: email.from,
            email_date: email.date,
            ai_confidence: aiResult.confidence
          });

          // Update request status if needed
          if (aiResult.data.status_update && aiResult.confidence > 0.7) {
            const statusMapping = {
              'in_progress': 'under_review',
              'completed': 'completed', 
              'delayed': 'under_review',
              'issue': 'under_review'
            };

            const newStatus = statusMapping[aiResult.data.status_update];
            if (newStatus) {
              // Check if request exists
              const tableName = database.useCosmosDB ? 'production_requests' : 'production_adjustment_requests';
              const currentRequest = await database.findById(tableName, aiResult.data.request_id, 'request_id');
              
              if (currentRequest && currentRequest.status !== newStatus) {
                // Update request status
                await database.update(tableName, aiResult.data.request_id, {
                  status: newStatus,
                  status_memo: `Email status update: ${aiResult.data.status_update}`,
                  updated_at: new Date().toISOString()
                }, 'request_id');

                // Record status history
                await StatusHistory.recordStatusChange(
                  aiResult.data.request_id,
                  currentRequest.status,
                  newStatus,
                  'EMAIL_PROCESSOR',
                  `Status updated from email: ${email.subject}`
                );
              }
            }
          }

          processedResults.push({
            email_id: email.id,
            request_id: aiResult.data.request_id,
            status_update: statusUpdate,
            ai_confidence: aiResult.confidence
          });
        } else {
          processedResults.push({
            email_id: email.id,
            error: 'Could not extract request information',
            ai_result: aiResult
          });
        }
        
        // Mark email as processed
        await emailService.markEmailAsProcessed(email.id);
        
      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError);
        processedResults.push({
          email_id: email.id,
          error: emailError.message
        });
      }
    }

    res.json({
      success: true,
      processed_count: emails.length,
      results: processedResults
    });

  } catch (error) {
    console.error('Error in email processing:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process emails', 
      error: error.message 
    });
  }
});

// Manually process a single email (for testing)
router.post('/process-single-email', async (req, res) => {
  try {
    const { subject, body, from } = req.body;
    
    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    // Use AI to process email content
    const aiResult = await aiService.processEmailStatusUpdate(body, subject);
    
    res.json({
      success: true,
      ai_result: aiResult,
      extracted_info: aiResult.data
    });

  } catch (error) {
    console.error('Error processing single email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process email', 
      error: error.message 
    });
  }
});

module.exports = router;