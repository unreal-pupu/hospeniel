/**
 * Client-side Throttling and Debouncing Utilities
 * 
 * Provides throttling and debouncing for UI interactions to prevent
 * excessive API calls and improve user experience.
 */

/**
 * Throttle function - limits how often a function can be called
 * @param func Function to throttle
 * @param delay Delay in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  // Validate function input
  if (typeof func !== 'function') {
    console.error('Throttle: First argument must be a function');
    return function() {
      console.warn('Throttle: Cannot execute - function is not valid');
    };
  }

  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    // Check if function still exists
    if (typeof func !== 'function') {
      console.warn('Throttle: Function is no longer valid');
      return;
    }

    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      try {
        func.apply(this, args);
      } catch (error) {
        console.error('Throttle: Error executing function:', error);
      }
    } else {
      // Schedule call for remaining time
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        // Check if function still exists before executing
        if (typeof func === 'function') {
          lastCall = Date.now();
          try {
            func.apply(this, args);
          } catch (error) {
            console.error('Throttle: Error executing delayed function:', error);
          }
        }
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function - delays function execution until after wait time
 * @param func Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  // Validate function input
  if (typeof func !== 'function') {
    console.error('Debounce: First argument must be a function');
    return function() {
      console.warn('Debounce: Cannot execute - function is not valid');
    };
  }

  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    // Check if function still exists
    if (typeof func !== 'function') {
      console.warn('Debounce: Function is no longer valid');
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      // Check if function still exists before executing
      if (typeof func === 'function') {
        try {
          func.apply(this, args);
        } catch (error) {
          console.error('Debounce: Error executing function:', error);
        }
      }
      timeoutId = null;
    }, delay);
  };
}

/**
 * Rate-limited fetch wrapper
 * Prevents excessive API calls from client side
 */
class RateLimitedFetch {
  private requestQueue: Array<{
    url: string;
    options: RequestInit;
    resolve: (value: Response) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private minDelay = 100; // Minimum 100ms between requests

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minDelay) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minDelay - timeSinceLastRequest)
        );
      }

      const { url, options, resolve, reject } = this.requestQueue.shift()!;

      try {
        const response = await fetch(url, options);
        
        // Check for rate limit headers
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retrySeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
          
          console.warn("Rate limit exceeded, retrying after", retrySeconds, "seconds");
          
          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
          const retryResponse = await fetch(url, options);
          resolve(retryResponse);
        } else {
          resolve(response);
        }
      } catch (error) {
        reject(error as Error);
      }

      this.lastRequestTime = Date.now();
    }

    this.processing = false;
  }
}

// Export singleton instance
export const rateLimitedFetch = new RateLimitedFetch();

/**
 * Predefined throttle/debounce delays
 */
export const ThrottleDelays = {
  SEARCH: 300, // 300ms for search inputs
  SCROLL: 200, // 200ms for infinite scroll
  BUTTON_CLICK: 1000, // 1 second for button clicks
  FORM_SUBMIT: 2000, // 2 seconds for form submissions
  API_CALL: 100, // 100ms minimum between API calls
  ADD_TO_CART: 1000, // 1 second for add to cart actions
};

