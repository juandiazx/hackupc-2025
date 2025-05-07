/**
 * AWS Lambda for Alexa Financial Assistant Skill
 * @description Enhanced implementation with robust error handling and diagnostic capabilities
 * 
 * IMPORTANT: This Lambda function requires the following IAM permissions:
 * - s3:GetObject, s3:HeadObject, s3:ListBucket for reading financial data from S3
 * - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents for CloudWatch logging
 * 
 * Required environment variables:
 * - BUCKET_NAME: Name of the S3 bucket containing transaction data
 * - TRANSACTIONS_FILE: Path to the CSV file in the S3 bucket
 * - GEMINI_API_KEY: API key for Google Gemini AI
 * - DEBUG_MODE: Set to 'true' for additional logging (optional)
 */

import AWS from 'aws-sdk';
import Papa from 'papaparse'; // For CSV processing
import https from 'https';

const s3 = new AWS.S3();

// S3 Configuration
const BUCKET_NAME = process.env.BUCKET_NAME; // Your S3 bucket name
const TRANSACTIONS_FILE = process.env.TRANSACTIONS_FILE; // Path to CSV file in S3

// Enable debug mode
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// Initialize Gemini client using direct HTTP requests instead of the library
let initializeError = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check if API key is available
if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY environment variable');
  initializeError = 'Missing GEMINI_API_KEY environment variable';
} else {
  console.log('✅ Gemini API key found');
}

/**
 * Main function that handles Alexa requests
 */
export const handler = async (event, context) => {
  try {
    console.log('📥 Event received:', JSON.stringify(event, null, 2));
    
    // Verify if it's an Alexa Skills Kit request
    if (event.session && event.request) {
      // Determine request type
      const requestType = event.request?.type;
      console.log(`📌 Request type: ${requestType}`);
      
      // Handle different request types
      if (requestType === "LaunchRequest") {
        return handleLaunchRequest();
      } 
      else if (requestType === "IntentRequest") {
        return handleIntentRequest(event);
      }
      else if (requestType === "SessionEndedRequest") {
        return buildResponse("See you soon!", true);
      }
      else {
        return buildResponse("I don't understand that type of request. Please try again.");
      }
    } else {
      // Not an Alexa request
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Not an Alexa Skills Kit request' })
      };
    }
  } catch (error) {
    console.error('❌ Error:', error);
    return buildResponse("I'm sorry, there was an error processing your request. Please try again later.");
  }
};

/**
 * Handles LaunchRequest (when user starts the skill)
 */
async function handleLaunchRequest() {
  // Check if there was an initialization error and inform the user if needed
  if (initializeError) {
    console.warn('⚠️ Initialization error detected at launch:', initializeError);
    return buildResponse(
      "Welcome to your Financial Assistant. We're experiencing some technical issues at the moment. Our team is working to resolve them as soon as possible.",
      true
    );
  }
  
  return buildResponse(
    "Welcome to your Financial Assistant! What can I help you with today?",
    false,
    "You can ask about your spending, categories, or trends. What would you like to know?"
  );
}

/**
 * Handles IntentRequest (when user makes a specific query)
 */
async function handleIntentRequest(event) {
  const intent = event.request?.intent;
  const intentName = intent?.name;
  
  if (intentName === "ConversacionIntent") {
    const mensaje = intent?.slots?.mensaje?.value;
    if (!mensaje) {
      return buildResponse(
        "I didn't quite catch that. Could you rephrase your question?",
        false,
        "You can ask about your spending or finances. What would you like to know?"
      );
    }
    
    console.log(`📝 User message: "${mensaje}"`);
    
    // Check if there was an initialization error
    if (initializeError) {
      console.warn('⚠️ Initialization error detected:', initializeError);
      return buildResponse("I'm sorry, we're experiencing technical difficulties right now. Please try again later.", true);
    }
    
    // Get financial data from S3
    try {
      const transactionData = await getTransactionsFromS3();
      
      // Process query with AI
      const respuesta = await processWithAI(mensaje, transactionData);
      
      // Add a reprompt to keep the session open
      const repromptText = "Is there anything else you'd like to know about your finances?";
      
      return buildResponse(respuesta, false, repromptText);
      
    } catch (error) {
      console.error('❌ Error getting data or processing with AI:', error);
      return buildResponse("I couldn't access your financial data right now. Please try again later.", true);
    }
  }
  else if (intentName === "DiagnosticIntent") {
    try {
      // Test S3 connection
      const s3Test = await testS3Connection();
      
      // Test Gemini connection if S3 is working
      let geminiTest = { success: false, error: 'Not tested' };
      if (!initializeError && s3Test.success) {
        geminiTest = await testGeminiConnection();
      } else if (initializeError) {
        geminiTest = { success: false, error: initializeError };
      }
      
      // Format results for Alexa response
      let responseText = "";
      if (s3Test.success && geminiTest.success) {
        responseText = "All diagnostics passed successfully. Both S3 and Gemini connections are working properly.";
      } else {
        responseText = "Some issues were found during diagnostics. ";
        if (!s3Test.success) {
          responseText += "S3 Error: " + s3Test.error + ". ";
        }
        if (!geminiTest.success) {
          responseText += "Gemini Error: " + geminiTest.error + ". ";
        }
      }
      
      return buildResponse(
        responseText,
        false,
        "Would you like to try accessing your financial data now?"
      );
    } catch (diagError) {
      console.error('❌ Diagnostic error:', diagError);
      return buildResponse("Error running diagnostics. Please check CloudWatch logs for more details.", true);
    }
  }
  else if (intentName === "AMAZON.HelpIntent") {
    return buildResponse(
      "You can ask me about your spending, like 'how much did I spend on transportation?' or 'what are my main expenses?' You can also ask about needs versus wants in your spending habits.",
      false,
      "What would you like to know about your finances?"
    );
  }
  else if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
    return buildResponse("See you soon! I'm here whenever you need to review your finances.", true);
  }
  else {
    return buildResponse(
      "I don't recognize that instruction. Can you say it differently?",
      false,
      "Try asking about your spending or recent transactions."
    );
  }
}

/**
 * Gets financial transactions from S3 with enhanced error handling
 */
async function getTransactionsFromS3() {
  try {
    // Check if environment variables are set
    if (!BUCKET_NAME || !TRANSACTIONS_FILE) {
      console.error('❌ Missing environment variables:', { 
        BUCKET_NAME: BUCKET_NAME || 'MISSING', 
        TRANSACTIONS_FILE: TRANSACTIONS_FILE || 'MISSING'
      });
      throw new Error('Configuration error: Missing S3 environment variables');
    }
    
    console.log(`🔍 Attempting to get file ${TRANSACTIONS_FILE} from bucket ${BUCKET_NAME}`);
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: TRANSACTIONS_FILE
    };
    
    // First, check if the file exists
    try {
      await s3.headObject(params).promise();
      console.log('✅ File exists in S3');
    } catch (headErr) {
      if (headErr.code === 'NotFound') {
        console.error(`❌ File ${TRANSACTIONS_FILE} does not exist in bucket ${BUCKET_NAME}`);
        throw new Error(`File not found: ${TRANSACTIONS_FILE}`);
      } else if (headErr.code === 'Forbidden') {
        console.error(`❌ Permission denied accessing S3 bucket ${BUCKET_NAME}. Check IAM permissions.`, headErr);
        throw new Error('S3 access denied: Insufficient permissions to access the bucket. Verify Lambda IAM role.');
      }
      console.error('❌ Error checking file existence:', headErr);
      throw new Error(`S3 access error: ${headErr.message || headErr.code}`);
    }
    
    // Now get the file contents
    const data = await s3.getObject(params).promise();
    const csvContent = data.Body.toString('utf-8');
    
    // Log a sample of the CSV content to debug format issues
    if (DEBUG_MODE) {
      console.log('📄 CSV Sample (first 200 chars):', csvContent.substring(0, 200));
    }
    
    // Enhanced CSV parsing with more detailed error handling
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      trimHeaders: true, // Trim whitespace from headers
      error: (error) => {
        console.error('❌ CSV parsing error:', error);
      }
    });
    
    if (parseResult.errors && parseResult.errors.length > 0) {
      console.error('❌ CSV parsing had errors:', parseResult.errors);
    }
    
    console.log(`📊 CSV Headers found: ${parseResult.meta.fields.join(', ')}`);
    console.log(`📊 Rows parsed: ${parseResult.data.length}`);
    
    // Check for required fields in the first row
    if (parseResult.data.length > 0) {
      const firstRow = parseResult.data[0];
      const requiredFields = ['amount', 'date', 'category'];
      const missingFields = requiredFields.filter(field => {
        // Check for field in both original and lowercase form
        const fieldExists = parseResult.meta.fields.some(header => 
          header.toLowerCase() === field.toLowerCase()
        );
        return !fieldExists;
      });
      
      if (missingFields.length > 0) {
        console.error(`❌ Missing required fields in CSV: ${missingFields.join(', ')}`);
        throw new Error(`CSV format error: Missing fields ${missingFields.join(', ')}`);
      }
    }
    
    // Normalize data with detailed logging
    const normalizedData = [];
    
    for (let i = 0; i < parseResult.data.length; i++) {
      const tx = parseResult.data[i];
      
      // Skip rows that are completely empty
      if (Object.values(tx).every(value => value === null || value === '')) {
        console.warn(`⚠️ Skipping empty row at index ${i}`);
        continue;
      }
      
      try {
        // Handle possible column name variations with case-insensitive matching
        const amount = tx.amount || tx.Amount || 0;
        const date = tx.date || tx.Date || 'unknown';
        const category = tx.category || tx.Category || 'uncategorized';
        const description = tx.description || tx['description/merchant'] || '';
        
        // Get the predicted expense type from CSV (updating to match new format)
        const expenseType = tx.predicted_expense_type || 'unknown';
        
        // Validate amount is a number
        if (typeof amount !== 'number') {
          console.warn(`⚠️ Non-numeric amount at row ${i+1}: ${amount}`);
        }
        
        normalizedData.push({
          amount: typeof amount === 'number' ? amount : 0,
          date: date,
          category: category,
          description: description,
          expenseType: expenseType // Updated to use predicted_expense_type from CSV
        });
      } catch (rowErr) {
        console.error(`❌ Error processing row ${i+1}:`, rowErr, tx);
      }
    }
    
    // Log data summary
    const categories = [...new Set(normalizedData.map(tx => tx.category))];
    const expenseTypes = [...new Set(normalizedData.map(tx => tx.expenseType))];
    
    console.log(`📊 Summary: Found ${normalizedData.length} valid transactions`);
    console.log(`📊 Categories: ${categories.join(', ')}`);
    console.log(`📊 Expense types: ${expenseTypes.join(', ')}`);
    
    // Add total to sanity check
    const total = normalizedData.reduce((sum, tx) => sum + tx.amount, 0);
    console.log(`📊 Total amount: $${total.toFixed(2)}`);
    
    return normalizedData;
  } catch (error) {
    console.error('❌ Error in getTransactionsFromS3:', error);
    throw new Error(`Transactions data error: ${error.message}`);
  }
}

/**
 * Process user query with AI using the raw financial data from the last 30 days
 */
async function processWithAI(userQuery, transactionData) {
  try {
    // Validate input data
    if (!userQuery || typeof userQuery !== 'string') {
      console.error('❌ Invalid userQuery:', userQuery);
      return "I didn't understand your question. Could you rephrase it?";
    }
    
    if (!transactionData || !Array.isArray(transactionData) || transactionData.length === 0) {
      console.error('❌ Invalid or empty transactionData:', transactionData);
      return "I don't have any financial data available for analysis right now.";
    }
    
    console.log(`🔍 Processing user query: "${userQuery}" with ${transactionData.length} transactions`);
    
    // Validate we have a working API key
    if (!GEMINI_API_KEY) {
      console.error('❌ Gemini API key missing');
      return "I can't process your query right now due to a configuration issue.";
    }
    
    // Filter for valid transactions
    const validTransactions = transactionData.filter(tx => 
      tx && typeof tx.amount === 'number' && !isNaN(tx.amount) && tx.date
    );
    
    if (validTransactions.length === 0) {
      console.error('❌ No valid transactions found after filtering');
      return "I couldn't find any valid transactions to analyze.";
    }
    
    // Get current date and calculate date ranges
    const currentDate = new Date();
    
    // Parse all transaction dates first to avoid repeated parsing
    const transactionsWithParsedDates = validTransactions.map(tx => {
      try {
        const parsedDate = new Date(tx.date);
        return {
          ...tx,
          parsedDate: !isNaN(parsedDate.getTime()) ? parsedDate : null
        };
      } catch (dateError) {
        console.warn(`⚠️ Could not parse date: ${tx.date}`, dateError);
        return {
          ...tx,
          parsedDate: null
        };
      }
    }).filter(tx => tx.parsedDate !== null);
    
    if (transactionsWithParsedDates.length === 0) {
      console.error('❌ No transactions with valid dates found');
      return "I couldn't find any transactions with valid dates to analyze.";
    }
    
    // Sort transactions by date (newest first)
    transactionsWithParsedDates.sort((a, b) => b.parsedDate - a.parsedDate);
    
    // Determine date range from the data itself
    const newestDate = transactionsWithParsedDates[0].parsedDate;
    const oldestDate = transactionsWithParsedDates[transactionsWithParsedDates.length - 1].parsedDate;
    
    console.log(`📊 Transaction date range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}`);
    
    // Calculate week and month ranges based on the newest transaction date
    // This ensures we have data even if "current date" is newer than our data
    const oneWeekAgo = new Date(newestDate);
    oneWeekAgo.setDate(newestDate.getDate() - 7);
    
    const oneMonthAgo = new Date(newestDate);
    oneMonthAgo.setMonth(newestDate.getMonth() - 1);
    
    // Filter for different time periods
    const lastWeekTransactions = transactionsWithParsedDates.filter(tx => 
      tx.parsedDate >= oneWeekAgo && tx.parsedDate <= newestDate
    );
    
    const lastMonthTransactions = transactionsWithParsedDates.filter(tx => 
      tx.parsedDate >= oneMonthAgo && tx.parsedDate <= newestDate
    );
    
    // Use all transactions by default, but provide week/month filters in context
    const allTransactions = transactionsWithParsedDates;
    
    console.log(`📊 Found:
      - ${allTransactions.length} total transactions
      - ${lastWeekTransactions.length} transactions in the last week
      - ${lastMonthTransactions.length} transactions in the last month`);
    
    // Format the transactions for AI processing (removing parsed date)
    const formatForAI = (transactions) => transactions.map(tx => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category || 'Uncategorized',
      description: tx.description || 'No description',
      expenseType: tx.expenseType || 'unknown'
    }));
    
    // Prepare three versions of data for different time periods
    const allTxData = formatForAI(allTransactions);
    const lastWeekTxData = formatForAI(lastWeekTransactions);
    const lastMonthTxData = formatForAI(lastMonthTransactions);
    
    // Calculate needs vs. wants summaries for each time period
    // For new expense type classification - updated to match new format
    const calculateNeedsVsWants = (transactions) => {
      const needsTotal = transactions
        .filter(tx => tx.expenseType?.toLowerCase() === 'need')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const wantsTotal = transactions
        .filter(tx => tx.expenseType?.toLowerCase() === 'want')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const uncategorizedTotal = transactions
        .filter(tx => !['need', 'want'].includes(tx.expenseType?.toLowerCase()))
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      return {
        needs: needsTotal,
        wants: wantsTotal,
        uncategorized: uncategorizedTotal,
        total: needsTotal + wantsTotal + uncategorizedTotal,
        needsPercentage: Math.round((needsTotal / (needsTotal + wantsTotal + uncategorizedTotal)) * 100) || 0,
        wantsPercentage: Math.round((wantsTotal / (needsTotal + wantsTotal + uncategorizedTotal)) * 100) || 0
      };
    };
    
    const allTxSummary = calculateNeedsVsWants(allTransactions);
    const lastWeekTxSummary = calculateNeedsVsWants(lastWeekTransactions);
    const lastMonthTxSummary = calculateNeedsVsWants(lastMonthTransactions);
    
    // Add needs vs. wants insights to the prompt for AI
    const needsWantsInsights = `
NEEDS VS WANTS ANALYSIS:
Last Week: ${lastWeekTxSummary.needsPercentage}% needs ($${lastWeekTxSummary.needs.toFixed(2)}), ${lastWeekTxSummary.wantsPercentage}% wants ($${lastWeekTxSummary.wants.toFixed(2)})
Last Month: ${lastMonthTxSummary.needsPercentage}% needs ($${lastMonthTxSummary.needs.toFixed(2)}), ${lastMonthTxSummary.wantsPercentage}% wants ($${lastMonthTxSummary.wants.toFixed(2)})
All Time: ${allTxSummary.needsPercentage}% needs ($${allTxSummary.needs.toFixed(2)}), ${allTxSummary.wantsPercentage}% wants ($${allTxSummary.wants.toFixed(2)})
`;
    
    // Build prompt for AI with context about available time periods
    const prompt = `
You are a friendly and helpful personal financial assistant analyzing a person's spending habits. Be conversational, relatable, and sound like a real assistant (not a robot).

USER'S FINANCIAL DATA:
Full date range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}
Last week: ${oneWeekAgo.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]} (${lastWeekTransactions.length} transactions)
Last month: ${oneMonthAgo.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]} (${lastMonthTransactions.length} transactions)

${needsWantsInsights}

ALL TRANSACTIONS (${allTransactions.length} total):
${JSON.stringify(allTxData, null, 2)}

LAST WEEK TRANSACTIONS (${lastWeekTransactions.length} total):
${JSON.stringify(lastWeekTxData, null, 2)}

LAST MONTH TRANSACTIONS (${lastMonthTransactions.length} total):
${JSON.stringify(lastMonthTxData, null, 2)}

The user's question is: "${userQuery}"

Instructions:
1. First determine which time period the user is asking about:
   - If they ask about "last week" or "this week", use LAST WEEK TRANSACTIONS
   - If they ask about "last month" or "this month", use LAST MONTH TRANSACTIONS
   - If they ask about a specific date range, filter the ALL TRANSACTIONS to match that range
   - If they don't specify a time period, use LAST MONTH TRANSACTIONS by default
2. Carefully analyze the appropriate transaction data to specifically address the user's question.
3. Use precise data and exact calculations based on the raw data provided.
4. The 'expenseType' field classifies transactions as either 'need' or 'want', use this information if the user asks about spending necessities vs discretionary purchases.
5. Be conversational, helpful, and concise. Sound like a friendly assistant, not a robot.
6. Try to limit your response to a maximum of 3 sentences since this will be converted to speech.
7. When mentioning expense categories, provide specific examples of what might be in those categories.
8. If asked about data you don't have, mention the date range you do have data for.
9. When talking about money amounts, round to whole numbers for easier understanding.
10. Use a natural, friendly tone with contractions (I've, you've, we're) and conversational phrases.
11. If the user asks about a specific date range, filter the ALL TRANSACTIONS to match that range and provide insights based on that filtered data.
12. When you talk about expense categories, give specific real data examples, like "You spent $50 on groceries at Walmart on 22 March at 4PM" or "You spent $20 on coffee at Starbucks on 10 May at 7PM".
`;

    // Log prompt size for debugging
    if (DEBUG_MODE) {
      console.log(`🤖 Prompt size: ${Buffer.byteLength(prompt, 'utf8')} bytes`);
      console.log('🤖 Sample of prompt:', prompt.substring(0, 500) + '...');
    }

    // Call Gemini API
    try {
      const response = await callGeminiAPI(prompt);
      console.log(`🤖 AI Response: "${response}"`);
      
      return response;
    } catch (geminiError) {
      console.error('❌ Error in Gemini API call:', geminiError);
      
      // Check if the error might be due to prompt size
      if (Buffer.byteLength(prompt, 'utf8') > 100000) { // Arbitrary limit, adjust based on actual Gemini limits
        console.error('❌ Prompt might be too large:', Buffer.byteLength(prompt, 'utf8'), 'bytes');
        
        // Try with a smaller subset of data - just use the most relevant time period
        console.log('🔄 Retrying with reduced dataset');
        
        // Determine which data is most relevant based on the query
        let relevantData;
        const queryLower = userQuery.toLowerCase();
        
        if (queryLower.includes('week') || queryLower.includes('7 days')) {
          relevantData = lastWeekTxData;
          console.log('🔍 Using week data for reduced prompt');
        } else if (queryLower.includes('month') || queryLower.includes('30 days')) {
          relevantData = lastMonthTxData;
          console.log('🔍 Using month data for reduced prompt');
        } else {
          // Default to month data, but limit to 50 transactions if needed
          relevantData = lastMonthTxData.length > 50 ? lastMonthTxData.slice(0, 50) : lastMonthTxData;
          console.log('🔍 Using default (month) data for reduced prompt');
        }
        
        // Calculate needs vs. wants for this reduced dataset
        const relevantTxSummary = calculateNeedsVsWants(relevantData);
        const reducedNeedsWantsInsights = `
NEEDS VS WANTS ANALYSIS:
Selected Period: ${relevantTxSummary.needsPercentage}% needs ($${relevantTxSummary.needs.toFixed(2)}), ${relevantTxSummary.wantsPercentage}% wants ($${relevantTxSummary.wants.toFixed(2)})
`;
        
        const reducedPrompt = `
You are a friendly and helpful personal financial assistant analyzing a person's spending habits. Be conversational, relatable, and sound like a real assistant (not a robot).

USER'S FINANCIAL DATA:
Full date range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}

${reducedNeedsWantsInsights}

TRANSACTIONS (${relevantData.length} total):
${JSON.stringify(relevantData, null, 2)}

The user's question is: "${userQuery}"

Instructions:
1. Carefully analyze the transaction data provided to specifically address the user's question.
2. Use precise data and exact calculations based on the provided data.
3. The 'expenseType' field classifies transactions as either 'need' or 'want', use this information if the user asks about spending necessities vs discretionary purchases.
4. Be conversational, helpful, and concise. Sound like a friendly assistant, not a robot.
5. Limit your response to a maximum of 3 sentences since this will be converted to speech.
6. If asked about data you don't have, mention the date range you do have data for.
7. When talking about money amounts, round to whole numbers for easier understanding.
8. Use a natural, friendly tone with contractions (I've, you've, we're) and conversational phrases.
9. If the user asks about a specific date range, filter the ALL TRANSACTIONS to match that range and provide insights based on that filtered data.
10. When you talk about expense categories, give specific real data examples, like "You spent $50 on groceries at Walmart on 22 March at 4PM" or "You spent $20 on coffee at Starbucks on 10 May at 7PM".
`;
          
        try {
          const reducedResponse = await callGeminiAPI(reducedPrompt);
          return reducedResponse;
        } catch (reducedError) {
          console.error('❌ Error with reduced dataset:', reducedError);
          return "I couldn't analyze your financial data right now due to technical limitations. Could you try asking something more specific?";
        }
      }
      
      // Handle different types of Gemini errors
      if (geminiError.message && geminiError.message.includes('UNAUTHENTICATED')) {
        console.error('❌ Authentication error with Gemini API. Check API key.');
        return "I can't access the analysis service right now due to an authentication issue.";
      } else if (geminiError.message && geminiError.message.includes('RESOURCE_EXHAUSTED')) {
        console.error('❌ Rate limit exceeded in Gemini API.');
        return "I'm experiencing too many requests right now. Could you try again in a few minutes?";
      } else {
        return "I couldn't analyze your financial data right now. Please try again later.";
      }
    }
  } catch (error) {
    console.error('❌ General error in processWithAI:', error);
    return "I had a problem processing your question. Could you try asking something different?";
  }
}

/**
 * Direct API call to Gemini API without using the library
 */
async function callGeminiAPI(prompt) {
  return new Promise((resolve, reject) => {
    // API endpoint for Gemini
    const geminiEndpoint = 'generativelanguage.googleapis.com';
    const path = `/v1/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    // Request data
    const requestData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    });
    
    // Request options
    const options = {
      hostname: geminiEndpoint,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    // Create request
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.error(`❌ API request failed with status code: ${res.statusCode}`);
        reject(new Error(`API request failed with status code: ${res.statusCode}`));
        return;
      }
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const responseJson = JSON.parse(data);
          
          // Extract text from Gemini response
          if (responseJson.candidates && 
              responseJson.candidates[0] && 
              responseJson.candidates[0].content && 
              responseJson.candidates[0].content.parts && 
              responseJson.candidates[0].content.parts[0] && 
              responseJson.candidates[0].content.parts[0].text) {
            
            const responseText = responseJson.candidates[0].content.parts[0].text.trim();
            resolve(responseText);
          } else {
            console.error('❌ Unexpected API response structure:', data.substring(0, 500));
            reject(new Error('Unexpected API response structure'));
          }
        } catch (parseError) {
          console.error('❌ Error parsing API response:', parseError);
          reject(parseError);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Error making API request:', error);
      reject(error);
    });
    
    // Write data to request body
    req.write(requestData);
    req.end();
  });
}

/**
 * Test function to validate S3 connectivity
 */
async function testS3Connection() {
  try {
    console.log('🔍 Testing S3 connection...');
    const buckets = await s3.listBuckets().promise();
    console.log(`✅ S3 connection successful. Found ${buckets.Buckets.length} buckets`);
    
    // Check if our target bucket exists
    const bucketExists = buckets.Buckets.some(bucket => bucket.Name === BUCKET_NAME);
    if (!bucketExists) {
      console.error(`❌ Target bucket ${BUCKET_NAME} does not exist or is not accessible`);
    } else {
      console.log(`✅ Target bucket ${BUCKET_NAME} exists and is accessible`);
      
      // List objects in the bucket
      const objects = await s3.listObjectsV2({ Bucket: BUCKET_NAME }).promise();
      console.log(`📄 Found ${objects.Contents.length} objects in bucket`);
      
      // Check if our transactions file exists
      const fileExists = objects.Contents.some(obj => obj.Key === TRANSACTIONS_FILE);
      if (!fileExists) {
        console.error(`❌ Target file ${TRANSACTIONS_FILE} not found in bucket`);
      } else {
        console.log(`✅ Target file ${TRANSACTIONS_FILE} exists`);
      }
    }
    
    return {
      success: true,
      bucketExists,
      bucketsCount: buckets.Buckets.length
    };
  } catch (error) {
    console.error('❌ S3 connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test function to validate Gemini API connectivity using direct HTTPS
 */
async function testGeminiConnection() {
  try {
    if (!GEMINI_API_KEY) {
      console.error('❌ Missing Gemini API key');
      return { 
        success: false, 
        error: 'Missing Gemini API key' 
      };
    }
    
    console.log('🔍 Testing Gemini connection...');
    
    // Use our direct API call function
    const testResponse = await callGeminiAPI("Say 'connection test successful'");
    
    console.log('✅ Gemini API connection successful');
    return {
      success: true,
      response: testResponse
    };
  } catch (error) {
    console.error('❌ Gemini API connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enhanced buildResponse function with debugging info
 */
function buildResponse(speechText, endSession = false) {
  // Log the response being sent back to Alexa
  console.log(`🔊 Response to Alexa: "${speechText}" (endSession: ${endSession})`);
  
  return {
    version: "1.0",
    response: {
      outputSpeech: {
        type: "PlainText",
        text: speechText
      },
      card: {
        type: "Simple",
        title: "Financial Assistant",
        content: speechText
      },
      shouldEndSession: endSession
    }
  };
}