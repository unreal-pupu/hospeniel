/**
 * Rate Limiter Utility for Hospineil Platform
 * 
 * Provides server-side rate limiting for API endpoints to prevent abuse
 * and ensure fair usage across all user roles.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  identifier?: string; // Optional identifier (user ID, email, etc.)
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number; // Seconds until retry is allowed
}

// In-memory store for rate limiting (for production, use Redis or similar)
// Key format: "endpoint:identifier:window"
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client identifier from request (IP address or user ID)
 */
function getClientIdentifier(req: Request, userId?: string): string {
  // Prefer user ID if available (more accurate for authenticated users)
  if (userId) {
    return userId;
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0] || realIp || "unknown";
  
  return ip;
}

/**
 * Rate limit check
 * Returns true if request should be allowed, false if rate limited
 */
export function checkRateLimit(
  endpoint: string,
  req: Request,
  config: RateLimitConfig,
  userId?: string
): RateLimitResult {
  const identifier = config.identifier || getClientIdentifier(req, userId);
  const windowKey = `${endpoint}:${identifier}:${Math.floor(Date.now() / config.windowMs)}`;
  
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const resetTime = windowStart + config.windowMs;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(windowKey);
  
  if (!entry || entry.resetTime < now) {
    // New window or expired entry
    entry = { count: 0, resetTime };
    rateLimitStore.set(windowKey, entry);
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    // Log throttled request
    console.warn(`🚫 Rate limit exceeded: ${endpoint}`, {
      identifier,
      count: entry.count,
      maxRequests: config.maxRequests,
      retryAfter,
      timestamp: new Date().toISOString(),
    });
    
    return {
      success: false,
      remaining: 0,
      resetTime,
      retryAfter,
    };
  }
  
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime,
  };
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: Request, ...args: any[]) => Promise<Response>
) {
  return async (req: Request, ...args: any[]): Promise<Response> => {
    // Extract user ID from request if available (for authenticated endpoints)
    let userId: string | undefined;
    try {
      // Try to get user from auth header or session
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        // If you have a way to extract user ID from token, do it here
        // For now, we'll rely on IP-based limiting
      }
    } catch (error) {
      // Ignore auth extraction errors
    }
    
    // Check rate limit
    const endpoint = new URL(req.url).pathname;
    const result = checkRateLimit(endpoint, req, config, userId);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
          retryAfter: result.retryAfter,
          message: `Rate limit exceeded. Please wait ${result.retryAfter} seconds before trying again.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": result.retryAfter?.toString() || "60",
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    const response = await handler(req, ...args);
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", config.maxRequests.toString());
    headers.set("X-RateLimit-Remaining", result.remaining.toString());
    headers.set("X-RateLimit-Reset", new Date(result.resetTime).toISOString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Login attempts: 5 per minute per IP/user
  LOGIN: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Registration: 3 per hour per IP
  REGISTRATION: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  
  // General API requests: 100 per minute per IP
  API: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Checkout/Payment: 10 per minute per IP/user
  CHECKOUT: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Real-time updates: 30 per minute per IP/user
  REALTIME: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  
  // Search/Explore: 50 per minute per IP
  SEARCH: {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
  },
};




