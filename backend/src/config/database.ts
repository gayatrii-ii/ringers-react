import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env.js';

/**
 * Enterprise PostgreSQL Connection Pool
 * Tuned for production loads (10+ vendors, 20+ riders, 10,000+ customers).
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected PostgreSQL client error in pool:', err.message);
});

/**
 * Execute parameterized query on the pool
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (env.NODE_ENV === 'development' && duration > 100) {
    console.warn(`⚠️ Slow query (${duration}ms): ${text.slice(0, 100)}...`);
  }

  return res;
}

/**
 * Execute a unit of work inside a managed database transaction.
 * Automatically performs BEGIN, COMMIT, and ROLLBACK upon errors.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify database connectivity during server startup
 */
export async function testDatabaseConnection(): Promise<void> {
  try {
    const res = await pool.query<{ now: string }>('SELECT NOW() as now');
    console.log(`✅ PostgreSQL Connected successfully. Server time: ${res.rows[0]?.now}`);
  } catch (error) {
    console.error('❌ Database connection failed at startup:', error);
    throw error;
  }
}
