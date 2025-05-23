// LLM service endpoint mappings
const LLM_ENDPOINTS = {
  'openai': 'https://api.openai.com',
  'anthropic': 'https://api.anthropic.com',
  'gemini': 'https://generativelanguage.googleapis.com',
  'groq': 'https://api.groq.com',
  'sambanova': 'https://api.sambanova.ai',
  'azure': 'https://YOUR_AZURE_RESOURCE_NAME.openai.azure.com',
  // Add more providers as needed
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Add logging
  console.log(`Incoming request to: ${request.url}`);
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return handleCORS(request);
  }
  
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(part => part);
  
  // Check if the first path segment matches any of our LLM providers
  if (pathParts.length > 0 && LLM_ENDPOINTS[pathParts[0]]) {
    const provider = pathParts[0];
    const targetEndpoint = LLM_ENDPOINTS[provider];
    console.log(`Proxying request to ${provider} at ${targetEndpoint}`);
    
    // Remove the provider prefix from the path
    const newPathname = '/' + pathParts.slice(1).join('/');
    
    // Create the new target URL
    const targetUrl = new URL(targetEndpoint);
    targetUrl.pathname = newPathname;
    targetUrl.search = url.search;
    
    // Clone the request and modify it for the target API
    const cleanedHeaders = new Headers();
    for (const [key, value] of request.headers) {
      // Skip Cloudflare-specific headers and other headers we want to clean
      if (!key.toLowerCase().startsWith('cf-') && 
          !['x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 
            'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-scheme',
            'x-forwarded-ssl', 'cdn-loop'].includes(key.toLowerCase())) {
        cleanedHeaders.set(key, value);
      }
    }
    
    const modifiedRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: cleanedHeaders,
      body: request.body,
      redirect: 'follow'
    });
    
    // Forward the request to the appropriate LLM API
    try {
      console.log('Forwarding request with cleaned headers:', 
                  JSON.stringify(Object.fromEntries(cleanedHeaders.entries()), null, 2));
      const response = await fetch(modifiedRequest);
      console.log(`Response received with status: ${response.status}`);
      
      // Create a new response with CORS headers
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
      
      // Add CORS headers
      modifiedResponse.headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
      modifiedResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      
      return modifiedResponse;
    } catch (error) {
      console.error(`Error proxying request to ${provider}:`, error);
      return new Response(`Error proxying request to ${provider}: ${error.message}`, { status: 500 });
    }
  }
  
  // If no valid provider is specified in the path
  console.log('Invalid provider path requested');
  return new Response('Invalid LLM provider path. Use /provider/api/path format.', { status: 400 });
}

function handleCORS(request) {
  // Handle CORS preflight requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
} 