import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

// Connection configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds

// Connection state management
let connectionState = {
  isConnected: false,
  lastError: null as string | null,
  retryCount: 0,
  lastRetryTime: 0,
  client: null as SupabaseClient | null
};

// Create Supabase client with enhanced configuration
function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    },
    global: {
      headers: { 'x-application-name': 'psychology-files' }
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 2
      }
    }
  });
}

// Initialize or get existing client
export function getSupabaseClient(): SupabaseClient {
  if (!connectionState.client) {
    connectionState.client = createSupabaseClient();
  }
  return connectionState.client;
}

// Export supabase instance
export const supabase = getSupabaseClient();

// Helper function to implement exponential backoff
function getRetryDelay(retryCount: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY);
}

// Add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeout);
    })
  ]);
}

// Initialize Supabase connection
export async function initializeSupabase(): Promise<void> {
  if (connectionState.isConnected) return;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = getSupabaseClient();
      
      // Test connection with timeout
      await withTimeout(
        client.auth.getSession(),
        CONNECTION_TIMEOUT
      );

      connectionState.isConnected = true;
      connectionState.lastError = null;
      connectionState.retryCount = 0;
      return;
    } catch (error: any) {
      connectionState.isConnected = false;
      connectionState.lastError = error.message || 'Unknown error';
      connectionState.retryCount++;
      connectionState.lastRetryTime = Date.now();

      console.error(`Connection attempt ${attempt + 1} failed:`, error);

      if (attempt < MAX_RETRIES - 1) {
        const delay = getRetryDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Failed to connect after ${MAX_RETRIES} attempts: ${error.message}`);
      }
    }
  }
}

// Wrapper for Supabase operations with retry logic
export async function supabaseQuery<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  customTimeout?: number
): Promise<T> {
  if (!connectionState.isConnected) {
    await initializeSupabase();
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await withTimeout(
        operation(),
        customTimeout || CONNECTION_TIMEOUT
      );

      if (error) {
        if (error.status === 401) {
          connectionState.isConnected = false;
          throw new Error('Authentication error. Please log in again.');
        }
        throw error;
      }

      return data as T;
    } catch (error: any) {
      console.error(`Query attempt ${attempt + 1} failed:`, error);

      if (attempt < MAX_RETRIES - 1) {
        const delay = getRetryDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to execute query after all retries');
}

// Get connection status
export function getConnectionStatus() {
  return {
    isConnected: connectionState.isConnected,
    lastError: connectionState.lastError,
    retryCount: connectionState.retryCount,
    lastRetryTime: connectionState.lastRetryTime
  };
}

// Initialize connection on module load
initializeSupabase().catch(error => {
  console.error('Initial Supabase connection failed:', error);
  connectionState.lastError = error.message;
});