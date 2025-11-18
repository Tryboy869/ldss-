// api.js - API GATEWAY LDSS avec Authentification
// NEXUS AXION 3.5 Architecture

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { LDSSBackend } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// ========== INITIALISER BACKEND ==========
let backend;

async function initBackend() {
  console.log('🔧 [API GATEWAY] Initializing backend...');
  try {
    backend = new LDSSBackend();
    await backend.init();
    console.log('✅ [API GATEWAY] Backend ready');
  } catch (error) {
    console.error('❌ [API GATEWAY] Backend initialization failed:', error);
    throw error;
  }
}

// ========== MIDDLEWARE AUTH ==========
function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  const sessionToken = req.headers['x-session-token'];
  
  if (!userId || !sessionToken) {
    console.warn('[API GATEWAY] ⚠️ Unauthorized access attempt');
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  // Valider session (simplifié pour MVP)
  req.userId = userId;
  req.sessionToken = sessionToken;
  
  console.log(`[API GATEWAY] ✅ Authenticated user: ${userId}`);
  next();
}

// ========== ROUTE MAP ==========
const routeMap = {
  // Auth routes (public)
  'POST:/api/auth/register': (req) => backend.registerUser(req.body),
  'POST:/api/auth/login': (req) => backend.loginUser(req.body),
  
  // Project routes (protected)
  'GET:/api/projects': (req) => backend.getUserProjects(req.userId),
  'POST:/api/projects': (req) => backend.createProject(req.userId, req.body),
  'GET:/api/projects/:id': (req) => backend.getProject(req.userId, req.params.id),
  'DELETE:/api/projects/:id': (req) => backend.deleteProject(req.userId, req.params.id),
  
  // Backend config routes (protected)
  'POST:/api/projects/:id/configure-backend': (req) => backend.configureProjectBackend(req.userId, req.params.id, req.body),
  'POST:/api/projects/:id/test-backend': (req) => backend.testProjectBackend(req.userId, req.params.id, req.body),
  
  // Data sync routes (protected)
  'GET:/api/projects/:id/data': (req) => backend.getProjectData(req.userId, req.params.id, req.query),
  'POST:/api/projects/:id/data': (req) => backend.storeProjectData(req.userId, req.params.id, req.body),
  
  // Health check (public)
  'GET:/api/health': () => backend.healthCheck(),
};

// ========== ROUTER CENTRAL ==========
function routeRequest(method, path, req) {
  const routeKey = `${method}:${path}`;
  
  console.log(`📡 [API GATEWAY] ${routeKey}`);
  console.log(`   └─ User: ${req.userId || 'anonymous'}`);
  
  const handler = routeMap[routeKey];
  
  if (!handler) {
    console.error(`❌ [API GATEWAY] Route not found: ${routeKey}`);
    throw new Error(`Route not mapped: ${routeKey}`);
  }
  
  return handler(req);
}

// ========== FRONTEND ==========
app.get('/', (req, res) => {
  console.log('🌐 [API GATEWAY] Serving frontend');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========== AUTH ENDPOINTS (PUBLIC) ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 [API GATEWAY] User registration');
    const result = await routeRequest('POST', '/api/auth/register', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Registration error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 [API GATEWAY] User login');
    const result = await routeRequest('POST', '/api/auth/login', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Login error:', error);
    res.status(401).json({ success: false, message: error.message });
  }
});

// ========== PROJECT ENDPOINTS (PROTECTED) ==========
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const result = await routeRequest('GET', '/api/projects', req);
    console.log(`✅ [API GATEWAY] Returned ${result.projects?.length || 0} projects`);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    console.log(`📝 [API GATEWAY] Creating project:`, req.body.name);
    const result = await routeRequest('POST', '/api/projects', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const result = await routeRequest('GET', '/api/projects/:id', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    console.log(`🗑️ [API GATEWAY] Deleting project:`, req.params.id);
    const result = await routeRequest('DELETE', '/api/projects/:id', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== BACKEND CONFIG ENDPOINTS (PROTECTED) ==========
app.post('/api/projects/:id/configure-backend', requireAuth, async (req, res) => {
  try {
    console.log(`⚙️ [API GATEWAY] Configuring backend for project:`, req.params.id);
    const result = await routeRequest('POST', '/api/projects/:id/configure-backend', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/projects/:id/test-backend', requireAuth, async (req, res) => {
  try {
    console.log(`🧪 [API GATEWAY] Testing backend for project:`, req.params.id);
    const result = await routeRequest('POST', '/api/projects/:id/test-backend', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== DATA SYNC ENDPOINTS (PROTECTED) ==========
app.get('/api/projects/:id/data', requireAuth, async (req, res) => {
  try {
    const result = await routeRequest('GET', '/api/projects/:id/data', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/projects/:id/data', requireAuth, async (req, res) => {
  try {
    console.log(`💾 [API GATEWAY] Storing data for project:`, req.params.id);
    const result = await routeRequest('POST', '/api/projects/:id/data', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== HEALTH CHECK (PUBLIC) ==========
app.get('/api/health', async (req, res) => {
  try {
    const result = await routeRequest('GET', '/api/health', req);
    res.json(result);
  } catch (error) {
    console.error('❌ [API GATEWAY] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== ERROR HANDLERS ==========
app.use((err, req, res, next) => {
  console.error('💥 [API GATEWAY] Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  console.warn(`⚠️ [API GATEWAY] 404: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// ========== START SERVER ==========
async function startServer() {
  try {
    await initBackend();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║   🌌 LDSS - Local Distributed Storage System         ║
║                                                       ║
║   🌐 Server:     http://0.0.0.0:${PORT}                       ║
║   📂 Frontend:   index.html                           ║
║   ⚙️  Backend:    server.js                            ║
║   🔀 Gateway:     api.js (this file)                  ║
║   🗄️  Database:   Turso (LibSQL)                      ║
║   ✅ Status:      Online                              ║
║                                                       ║
║   📚 Endpoints:  ${Object.keys(routeMap).length} routes mapped                   ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('💥 [API GATEWAY] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();