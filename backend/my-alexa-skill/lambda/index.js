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
        return buildResponse("¡Hasta pronto!", true);
      }
      else {
        return buildResponse("No entiendo ese tipo de solicitud. Por favor, intenta de nuevo.");
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
    return buildResponse("Lo siento, ha ocurrido un error procesando tu solicitud. Por favor, intenta de nuevo más tarde.");
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
      "Bienvenido a tu asistente financiero. Estamos experimentando problemas técnicos en este momento. Nuestro equipo está trabajando para resolverlos lo antes posible."
    );
  }
  
  return buildResponse(
    "Bienvenido a tu asistente financiero. Puedo ayudarte a consultar tus gastos, analizar tus finanzas o responder a preguntas sobre tus hábitos de consumo. ¿En qué puedo ayudarte hoy?"
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
      return buildResponse("No he entendido tu consulta. ¿Podrías reformularla?");
    }
    
    console.log(`📝 User message: "${mensaje}"`);
    
    // Check if there was an initialization error
    if (initializeError) {
      console.warn('⚠️ Initialization error detected:', initializeError);
      return buildResponse("Lo siento, estamos experimentando problemas técnicos en este momento. Por favor, intenta más tarde.");
    }
    
    // Get financial data from S3
    try {
      const transactionData = await getTransactionsFromS3();
      
      // Process query with AI
      const respuesta = await processWithAI(mensaje, transactionData);
      return buildResponse(respuesta);
      
    } catch (error) {
      console.error('❌ Error getting data or processing with AI:', error);
      return buildResponse("No he podido acceder a tus datos financieros en este momento. Por favor, intenta de nuevo más tarde.");
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
        responseText = "Todos los diagnósticos pasaron correctamente. La conexión a S3 y Gemini está funcionando.";
      } else {
        responseText = "Se encontraron problemas en el diagnóstico. ";
        if (!s3Test.success) {
          responseText += "Error en S3: " + s3Test.error + ". ";
        }
        if (!geminiTest.success) {
          responseText += "Error en Gemini: " + geminiTest.error + ". ";
        }
      }
      
      return buildResponse(responseText);
    } catch (diagError) {
      console.error('❌ Diagnostic error:', diagError);
      return buildResponse("Error al ejecutar diagnósticos. Revisa los registros de CloudWatch para más detalles.");
    }
  }
  else if (intentName === "AMAZON.HelpIntent") {
    return buildResponse(
      "Puedes preguntarme sobre tus gastos, como por ejemplo '¿cuánto he gastado en transporte?' o '¿cuáles son mis gastos principales?'. También puedes preguntar sobre gastos por necesidad versus deseos."
    );
  }
  else if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
    return buildResponse("¡Hasta pronto! Estoy aquí cuando necesites revisar tus finanzas.", true);
  }
  else {
    return buildResponse("No reconozco esa instrucción. ¿Puedes decirlo de otra manera?");
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
      const missingFields = requiredFields.filter(field => 
        firstRow[field] === undefined && 
        firstRow[field.toLowerCase()] === undefined
      );
      
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
        // Handle possible column name variations
        const amount = tx.amount || tx.Amount || 0;
        const date = tx.date || tx.Date || 'unknown';
        const category = tx.category || tx.Category || 'uncategorized';
        const description = tx.description || tx['description/merchant'] || '';
        const expenseType = tx.expense_type || tx.expenseType || 'unknown';
        
        // Validate amount is a number
        if (typeof amount !== 'number') {
          console.warn(`⚠️ Non-numeric amount at row ${i+1}: ${amount}`);
        }
        
        normalizedData.push({
          amount: typeof amount === 'number' ? amount : 0,
          date: date,
          category: category,
          description: description,
          expenseType: expenseType
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
 * Process user query with AI using the financial data with improved error handling
 * This version uses direct HTTPS calls instead of the Gemini library
 */
async function processWithAI(userQuery, transactionData) {
  try {
    // Validate input data
    if (!userQuery || typeof userQuery !== 'string') {
      console.error('❌ Invalid userQuery:', userQuery);
      return "No he entendido tu consulta. ¿Podrías reformularla?";
    }
    
    if (!transactionData || !Array.isArray(transactionData) || transactionData.length === 0) {
      console.error('❌ Invalid or empty transactionData:', transactionData);
      return "No tengo datos financieros disponibles para analizar en este momento.";
    }
    
    console.log(`🔍 Processing user query: "${userQuery}" with ${transactionData.length} transactions`);
    
    // Validate we have a working API key
    if (!GEMINI_API_KEY) {
      console.error('❌ Gemini API key missing');
      return "No puedo procesar tu consulta en este momento debido a un problema de configuración.";
    }
    
    // Preprocess and validate data
    const validTransactions = transactionData.filter(tx => 
      tx && typeof tx.amount === 'number' && !isNaN(tx.amount)
    );
    
    if (validTransactions.length === 0) {
      console.error('❌ No valid transactions found after filtering');
      return "No he encontrado transacciones válidas para analizar.";
    }
    
    // Calculate totals and classify data
    const totalGastado = validTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Expenses by category
    const gastosPorCategoria = {};
    validTransactions.forEach(tx => {
      const category = tx.category || 'Sin categoría';
      if (!gastosPorCategoria[category]) {
        gastosPorCategoria[category] = 0;
      }
      gastosPorCategoria[category] += tx.amount;
    });
    
    // Expenses by type (need vs want)
    const gastosPorTipo = {
      need: 0,
      want: 0,
      unknown: 0
    };
    
    validTransactions.forEach(tx => {
      if (tx.expenseType === 'need') {
        gastosPorTipo.need += tx.amount;
      } else if (tx.expenseType === 'want') {
        gastosPorTipo.want += tx.amount;
      } else {
        gastosPorTipo.unknown += tx.amount;
      }
    });
    
    // Organize dates to see the time period
    const fechas = validTransactions
      .map(tx => tx.date)
      .filter(date => date && date.trim() !== '')
      .sort();
    
    const fechaInicio = fechas.length > 0 ? fechas[0] : 'desconocida';
    const fechaFin = fechas.length > 0 ? fechas[fechas.length - 1] : 'desconocida';
    
    // Format data for analysis
    const categoriasOrdenadas = Object.entries(gastosPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`);
    
    const porcentajeNecesidades = totalGastado > 0 
      ? (gastosPorTipo.need / totalGastado * 100).toFixed(1) 
      : 0;
    
    const porcentajeDeseos = totalGastado > 0 
      ? (gastosPorTipo.want / totalGastado * 100).toFixed(1) 
      : 0;
    
    // Examples of recent transactions for context
    // Sort by date descending to get the most recent ones
    const transaccionesOrdenadas = [...validTransactions].sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date) - new Date(a.date);
    });
    
    const ejemplos = transaccionesOrdenadas.slice(0, 5).map(tx => ({
      amount: tx.amount,
      date: tx.date,
      category: tx.category,
      description: tx.description || 'Sin descripción',
      expenseType: tx.expenseType || 'unknown'
    }));
    
    // Build prompt for AI
    const prompt = `
Eres un asistente financiero personal que analiza gastos de una persona.

DATOS FINANCIEROS DEL USUARIO:
- Período de tiempo: ${fechaInicio} a ${fechaFin}
- Total gastado: $${totalGastado.toFixed(2)}
- Principales categorías de gasto: ${categoriasOrdenadas.join(', ')}
- Distribución de gastos: ${porcentajeNecesidades}% en necesidades, ${porcentajeDeseos}% en deseos
- Ejemplos de transacciones recientes: ${JSON.stringify(ejemplos, null, 2)}

La consulta del usuario es: "${userQuery}"

Instrucciones:
1. Responde con información relevante a la consulta basándote en los datos proporcionados.
2. Sé conversacional, útil y conciso. 
3. Limita tu respuesta a máximo 3 frases ya que esto será convertido en voz.
4. Si te preguntan sobre datos que no tienes, menciona que solo tienes información sobre gastos en el período indicado.
5. No presentes grandes cantidades de datos numéricos ya que esto es difícil de seguir en formato de voz.
6. Al hablar de cantidades de dinero, redondea a números enteros para facilitar la comprensión.
`;

    // Log prompt for debugging
    if (DEBUG_MODE) {
      console.log('🤖 Prompt for Gemini:', prompt);
    }

    // Call Gemini API directly using HTTPS instead of the library
    try {
      const response = await callGeminiAPI(prompt);
      console.log(`🤖 AI Response: "${response}"`);
      
      return response;
    } catch (geminiError) {
      console.error('❌ Error in Gemini API call:', geminiError);
      
      // Handle different types of Gemini errors
      if (geminiError.message && geminiError.message.includes('UNAUTHENTICATED')) {
        console.error('❌ Authentication error with Gemini API. Check API key.');
        return "No puedo acceder al servicio de análisis en este momento debido a un problema de autenticación.";
      } else if (geminiError.message && geminiError.message.includes('RESOURCE_EXHAUSTED')) {
        console.error('❌ Rate limit exceeded in Gemini API.');
        return "Estoy experimentando demasiadas solicitudes en este momento. Por favor, intenta de nuevo en unos minutos.";
      } else {
        return "No he podido analizar tus datos financieros en este momento. Por favor, intenta de nuevo más tarde.";
      }
    }
  } catch (error) {
    console.error('❌ General error in processWithAI:', error);
    return "He tenido un problema al procesar tu consulta. Por favor, intenta de nuevo con una pregunta diferente.";
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
        title: "Asistente Financiero",
        content: speechText
      },
      shouldEndSession: endSession
    }
  };
}