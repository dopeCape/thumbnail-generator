import Logger from "../services/logger.service";

export default class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    baseDelay: number = 1000,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error = new Error('Operation failed with no specific error'); // Initialize with default

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        Logger.log(`${operationName} - Attempt ${attempt + 1}/${maxRetries + 1}`);
        const result = await operation();

        if (attempt > 0) {
          Logger.log(`${operationName} - Succeeded on attempt ${attempt + 1}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        Logger.error(`${operationName} - Attempt ${attempt + 1} failed`, error);

        if (this.shouldNotRetry(error)) {
          Logger.log(`${operationName} - Non-retryable error, failing immediately`);
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          Logger.log(`${operationName} - Waiting ${delay}ms before retry ${attempt + 2}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    Logger.error(`${operationName} - All ${maxRetries + 1} attempts failed`);
    throw lastError;
  }

  private static shouldNotRetry(error: any): boolean {
    if (error.status === 401 || error.status === 403) return true;
    if (error.status === 400 && error.message?.includes('validation')) return true;
    if (error.code === 'INVALID_API_KEY') return true;

    return false;
  }
}
