import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for serverless environments
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection pool with optimized settings
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings for better memory management
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for new connections
});

// Create Drizzle instance with pooled connection
export const db = drizzle({ client: pool, schema });

// Monitor pool health
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Graceful shutdown
export async function closePool() {
  await pool.end();
  console.log('Database pool closed');
}