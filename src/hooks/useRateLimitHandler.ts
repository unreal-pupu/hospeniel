/**
 * Hook for handling rate limit errors from API responses
 */
import { useState, useCallback } from "react";

interface RateLimitError {
  error: string;
  retryAfter?: number;
  message?: string;
}

export function useRateLimitHandler() {
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const handleRateLimitError = useCallback((error: any): boolean => {
    // Check if it's a rate limit error (429 status)
    if (error?.status === 429 || error?.response?.status === 429) {
      const errorData: RateLimitError = error?.data || error?.response?.data || {};
      const message = errorData.message || errorData.error || "Too many requests. Please try again later.";
      const retryAfter = errorData.retryAfter || 60;

      setRateLimitError(message);
      
      // Auto-clear error after retry time
      setTimeout(() => {
        setRateLimitError(null);
      }, retryAfter * 1000);

      return true; // Indicates rate limit error was handled
    }

    return false; // Not a rate limit error
  }, []);

  const checkResponseForRateLimit = useCallback(async (response: Response): Promise<Response> => {
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || errorData.error || "Too many requests. Please try again later.";
      const retryAfter = errorData.retryAfter || 60;

      setRateLimitError(message);
      
      // Auto-clear error after retry time
      setTimeout(() => {
        setRateLimitError(null);
      }, retryAfter * 1000);

      throw new Error(message);
    }

    return response;
  }, []);

  return {
    rateLimitError,
    setRateLimitError,
    handleRateLimitError,
    checkResponseForRateLimit,
  };
}




