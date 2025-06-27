const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

class AIService {
  constructor() {
    // Check if Azure OpenAI is configured
    if (process.env.OPENAI_ENDPOINT && process.env.OPENAI_API_KEY) {
      this.client = new OpenAIClient(
        process.env.OPENAI_ENDPOINT,
        new AzureKeyCredential(process.env.OPENAI_API_KEY)
      );
      this.modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4o-mini';
      this.configured = true;
    } else {
      console.log('Azure OpenAI not configured - using mock responses');
      this.configured = false;
    }
  }

  async extractStructuredData(text, schema) {
    if (!this.configured) {
      // Return mock data for testing
      return {
        request_id: 'MOCK001',
        acceptance_status: 'accepted',
        available_quantity: 100,
        comments: 'Mock response for testing',
        mock: true
      };
    }
    
    try {
      const prompt = `
        Please extract structured data from the following text according to the provided schema.
        Return the result as valid JSON only, without any additional explanation.

        Text: ${text}

        Expected Schema: ${JSON.stringify(schema, null, 2)}

        Extract the relevant information and format it according to the schema.
      `;

      const response = await this.client.getChatCompletions(this.modelName, [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract information from text and return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        maxTokens: 1000
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('AI extraction failed:', error);
      throw new Error('Failed to extract structured data');
    }
  }

  async evaluateConfidence(originalText, extractedData) {
    if (!this.configured) {
      return 0.8; // Mock confidence for testing
    }
    
    try {
      const prompt = `
        Evaluate the confidence level of the extracted data based on the original text.
        Return a confidence score between 0 and 1, where 1 is completely confident.

        Original Text: ${originalText}
        Extracted Data: ${JSON.stringify(extractedData, null, 2)}

        Consider:
        - How clearly the information is stated in the original text
        - Whether all required fields were found
        - The accuracy of the extraction

        Return only a number between 0 and 1.
      `;

      const response = await this.client.getChatCompletions(this.modelName, [
        {
          role: 'system',
          content: 'You are a confidence evaluation assistant. Return only a decimal number between 0 and 1.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.1,
        maxTokens: 10
      });

      const confidence = parseFloat(response.choices[0].message.content.trim());
      return isNaN(confidence) ? 0.5 : Math.max(0, Math.min(1, confidence));
    } catch (error) {
      console.error('Confidence evaluation failed:', error);
      return 0.5; // Default moderate confidence
    }
  }

  async generateResponse(prompt, options = {}) {
    try {
      const response = await this.client.getChatCompletions(this.modelName, [
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 500,
        ...options
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('AI generation failed:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async processFactoryResponse(responseText) {
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
      const extractedData = await this.extractStructuredData(responseText, schema);
      const confidence = await this.evaluateConfidence(responseText, extractedData);

      return {
        data: extractedData,
        confidence: confidence,
        originalText: responseText,
        processingTimestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Factory response processing failed:', error);
      return {
        data: null,
        confidence: 0,
        originalText: responseText,
        error: error.message,
        processingTimestamp: new Date().toISOString()
      };
    }
  }

  // New method for processing email status updates
  async processEmailStatusUpdate(emailContent, subject) {
    const schema = {
      request_id: 'string',
      status_update: 'string', // 'in_progress', 'completed', 'delayed', 'issue'
      progress_percentage: 'number',
      completion_date: 'string',
      issues: 'string',
      additional_info: 'string'
    };

    try {
      const fullText = `件名: ${subject}\n\n本文: ${emailContent}`;
      const extractedData = await this.extractStructuredData(fullText, schema);
      const confidence = await this.evaluateConfidence(fullText, extractedData);

      return {
        data: extractedData,
        confidence: confidence,
        originalText: fullText,
        processingTimestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Email status update processing failed:', error);
      return {
        data: null,
        confidence: 0,
        originalText: `件名: ${subject}\n\n本文: ${emailContent}`,
        error: error.message,
        processingTimestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new AIService();