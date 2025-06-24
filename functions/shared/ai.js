require('dotenv').config();
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

class AIService {
  constructor() {
    this.client = new OpenAIClient(
      process.env.OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.OPENAI_API_KEY)
    );
    this.modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4';
  }

  async extractStructuredData(text, schema) {
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
}

function createAIService() {
  return new AIService();
}

module.exports = { AIService, createAIService };