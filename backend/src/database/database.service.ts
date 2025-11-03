import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';
import { setTimeout as delay } from 'timers/promises';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private creatingPool = false;
  private poolErrorCount = 0;
  private readonly MAX_ERROR_COUNT = 10;

  constructor(private readonly configService: ConfigService) {}

  private createPool(): Pool {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }

    // Reduced pool size to prevent conflicts and better error handling
    const pool = new Pool({
      connectionString,
      max: 10, // Reduced from 20 to prevent overwhelming the database
      idleTimeoutMillis: 10000, // Close idle clients faster (10 seconds)
      connectionTimeoutMillis: 5000, // Faster timeout (5 seconds)
      // Don't let the pool hang on shutdown
      allowExitOnIdle: true,
    });

    // Log pool errors but handle them gracefully
    pool.on('error', (error) => {
      this.logger.warn('Database pool error detected, will recreate pool on next operation', error);
      // Mark pool as unhealthy so it gets recreated
      if (this.pool === pool) {
        this.pool = null;
      }
    });

    // Handle connection errors gracefully
    pool.on('connect', () => {
      // Reset error count on successful connection
      if (this.poolErrorCount > 0) {
        this.poolErrorCount = 0;
      }
    });

    return pool;
  }

  private getPool(): Pool {
    // If pool is broken or doesn't exist, create a new one
    if (!this.pool) {
      // Prevent concurrent pool creation
      if (this.creatingPool) {
        // Wait a bit and retry if pool is being created
        return this.createPool(); // Fallback: create a temporary pool
      }
      this.creatingPool = true;
      try {
        this.pool = this.createPool();
      } catch (error) {
        this.logger.error('Failed to create database pool', error as Error);
        throw error;
      } finally {
        this.creatingPool = false;
      }
    }

    return this.pool;
  }

  private isRecoverableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errorObj = error as { code?: string; message?: string };
    const code = errorObj.code;
    const message = errorObj.message?.toLowerCase() || '';

    // Check for specific error codes
    if (code && ['57P01', '57P02', '57P03', '53300', '57P04'].includes(code)) {
      return true;
    }

    // Check for shutdown/termination messages
    if (
      message.includes('shutdown') ||
      message.includes('termination') ||
      message.includes('db_termination')
    ) {
      return true;
    }

    return false;
  }

  private async withRetry<T>(operation: () => Promise<T>, attempt = 1): Promise<T> {
    const MAX_ATTEMPTS = 3;
    try {
      return await operation();
    } catch (error) {
      const isRecoverable = this.isRecoverableError(error);

      if (isRecoverable && attempt < MAX_ATTEMPTS) {
        // Reset pool on recoverable errors
        if (this.pool) {
          try {
            await this.pool.end().catch(() => {
              // Ignore errors when ending broken pool
            });
          } catch {
            // Ignore
          }
          this.pool = null;
        }

        const delayMs = Math.min(200 * attempt, 1000);
        this.logger.debug(
          `Database operation failed (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${delayMs}ms...`,
        );
        await delay(delayMs);
        return this.withRetry(operation, attempt + 1);
      }

      // If not recoverable or max attempts reached, throw
      throw error;
    }
  }

  async runQuery<T = unknown>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    // Add timeout wrapper to prevent hanging
    const queryPromise = (async () => {
      try {
        return await this.withRetry(async () => {
          try {
            const pool = this.getPool();
            return await pool.query<T>(text, params);
          } catch (error) {
            // If query fails, mark pool as potentially broken
            if (this.isRecoverableError(error)) {
              this.pool = null;
            }
            throw error;
          }
        });
      } catch (error) {
        // If retry failed, try one more time with a fresh pool
        if (this.isRecoverableError(error)) {
          this.pool = null;
          try {
            const pool = this.getPool();
            return await pool.query<T>(text, params);
          } catch {
            // Final failure - throw the original error
            throw error;
          }
        }
        throw error;
      }
    })();

    // Add 30 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database query timeout after 30 seconds'));
      }, 30000);
    });

    try {
      return await Promise.race([queryPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error('Database query failed or timed out', error as Error);
      throw error;
    }
  }

  async withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    // Add timeout wrapper to prevent hanging
    const operationPromise = (async () => {
      try {
        return await this.withRetry(async () => {
          const pool = this.getPool();
          let client: PoolClient | null = null;
          try {
            client = await pool.connect();
            return await callback(client);
          } catch (error) {
            // If operation fails, mark pool as potentially broken
            if (this.isRecoverableError(error)) {
              this.pool = null;
            }
            throw error;
          } finally {
            // Always release client, even if there was an error
            if (client) {
              try {
                client.release();
              } catch (releaseError) {
                // If release fails, the connection is likely broken - mark pool as unhealthy
                this.logger.warn('Failed to release database client', releaseError as Error);
                this.pool = null;
              }
            }
          }
        });
      } catch (error) {
        // If retry failed, try one more time with a fresh pool
        if (this.isRecoverableError(error)) {
          this.pool = null;
          const pool = this.getPool();
          let client: PoolClient | null = null;
          try {
            client = await pool.connect();
            return await callback(client);
          } catch {
            throw error; // Throw original error
          } finally {
            if (client) {
              try {
                client.release();
              } catch (releaseError) {
                this.logger.warn(
                  'Failed to release database client on retry',
                  releaseError as Error,
                );
                this.pool = null;
              }
            }
          }
        }
        throw error;
      }
    })();

    // Add 30 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database operation timeout after 30 seconds'));
      }, 30000);
    });

    try {
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error('Database operation failed or timed out', error as Error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error) {
        // Ignore shutdown errors - pool might already be closed
        this.logger.debug(`Pool shutdown warning: ${(error as Error).message}`);
      }
      this.pool = null;
    }
  }
}
