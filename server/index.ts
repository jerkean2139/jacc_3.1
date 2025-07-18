import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureProductionFiles, configureProductionServer, validateDeploymentEnvironment } from "./deployment-config";
import { createTestDataPlaceholders, setupProductionDirectories, validateProductionEnvironment, setupErrorHandling } from "./production-setup";
import { configureMemoryOptimization, configureProcessLimits } from "./memory-optimization";
import { setupSecurity } from "./security-middleware";

const app = express();

// Enable trust proxy for rate limiting behind proxies
app.set('trust proxy', 1);

// Configure iframe embedding and CORS for ISO Hub integration
app.use((req, res, next) => {
  // Allow iframe embedding from ISO Hub domains
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // For specific domains, use:
  // res.setHeader('X-Frame-Options', 'ALLOW-FROM https://iso-hub-domain.com');
  
  // Content Security Policy for iframe embedding
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.replit.app https://*.replit.dev https://iso-hub-domain.com"
  );
  
  // CORS headers for cross-origin requests
  const allowedOrigins = [
    'https://iso-hub-domain.com',
    'https://your-main-saas.com',
    /https:\/\/.*\.replit\.app$/,
    /https:\/\/.*\.replit\.dev$/
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  
  next();
});

// Apply security middleware before other middleware
setupSecurity(app);

// Serve static files from public directory
app.use(express.static('public'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup error handling first
  setupErrorHandling();
  
  // Enable memory optimization and cleanup
  console.log("🧹 Configuring memory optimization...");
  await configureMemoryOptimization();
  configureProcessLimits();
  
  // Perform startup cleanup
  const { performStartupCleanup } = await import('./memory-cleanup');
  await performStartupCleanup();
  
  // Configure deployment environment before starting server
  console.log("🚀 Initializing JACC deployment configuration...");
  createTestDataPlaceholders();
  setupProductionDirectories();
  ensureProductionFiles();
  configureProductionServer();
  
  const validationResults = validateProductionEnvironment();
  if (!validateDeploymentEnvironment()) {
    console.warn("⚠️ Some deployment checks failed, continuing with available configuration");
  }
  
  let server;
  try {
    server = await registerRoutes(app);
    console.log("✅ Routes registered successfully");
  } catch (error) {
    console.error("❌ Failed to register routes:", error);
    // Create a basic server if routes fail
    server = (await import('http')).createServer(app);
    console.log("⚠️ Using fallback server configuration");
  }
  
  console.log("✅ Server initialization complete");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment port or fallback to 5000
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  const host = "0.0.0.0"; // Always bind to 0.0.0.0 for Replit deployment
  
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
    if (process.env.NODE_ENV === "production") {
      console.log("✅ Production server ready for deployment");
    }
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
})();
