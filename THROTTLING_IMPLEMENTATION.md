# Throttling Implementation for Hospineil Platform

## Overview
This document describes the comprehensive throttling system implemented across the Hospineil platform to prevent abuse, ensure fair usage, and maintain performance.

## Implementation Details

### 1. Server-Side Rate Limiting

#### Rate Limiter Utility (`src/lib/rateLimiter.ts`)
- In-memory rate limiting store (for production, consider Redis)
- Configurable rate limits per endpoint
- IP-based and user-based identification
- Automatic cleanup of expired entries

#### Rate Limit Configurations
- **Login**: 5 attempts per minute per IP/user
- **Registration**: 3 attempts per hour per IP
- **API Requests**: 100 requests per minute per IP
- **Checkout/Payment**: 10 requests per minute per IP/user
- **Real-time Updates**: 30 requests per minute per IP/user
- **Search/Explore**: 50 requests per minute per IP

#### Protected Endpoints
1. **`/api/register`** - Registration endpoint with 3/hour limit
2. **`/api/login`** - Login endpoint with 5/minute limit
3. **`/api/featured-vendors`** - Featured vendors with 50/minute limit
4. **`/api/orders`** - Order placement with 10/minute limit

### 2. Client-Side Throttling

#### Client Throttle Utility (`src/lib/clientThrottle.ts`)
- `throttle()` - Limits function execution frequency
- `debounce()` - Delays function execution until after wait time
- `RateLimitedFetch` - Wrapper for fetch with built-in rate limiting

#### Throttle Delays
- **Search**: 300ms
- **Scroll**: 200ms
- **Button Click**: 1000ms
- **Form Submit**: 2000ms
- **API Call**: 100ms minimum

#### Components with Client-Side Throttling
1. **Explore Page** (`src/app/explore/page.tsx`)
   - Throttled "Add to Cart" button clicks
   - Throttled "Place Order" button clicks
   - Debounced real-time subscription handler (1 second)

2. **Checkout Page** (`src/app/checkout/page.tsx`)
   - Throttled form submission (2 seconds)

3. **Registration Page** (`src/app/register/page.tsx`)
   - Rate limit error handling

### 3. Error Handling

#### Rate Limit Handler Hook (`src/hooks/useRateLimitHandler.ts`)
- Custom React hook for handling rate limit errors
- Automatic error message display
- Retry-after time management
- Response checking utilities

#### Error Messages
- Clear, user-friendly messages when limits are exceeded
- Includes retry time information
- Visual error indicators in UI

### 4. Logging and Monitoring

#### Server-Side Logging
- All throttled requests are logged with:
  - Endpoint name
  - Client identifier (IP/user ID)
  - Request count
  - Max requests allowed
  - Retry after time
  - Timestamp

#### Log Format
```
🚫 Rate limit exceeded: /api/endpoint {
  identifier: "ip_address_or_user_id",
  count: 6,
  maxRequests: 5,
  retryAfter: 45,
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### Server-Side Rate Limiting
```typescript
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

export async function POST(req: Request) {
  const rateLimitResult = checkRateLimit(
    "/api/endpoint",
    req,
    RateLimitConfigs.API
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }
  // ... rest of handler
}
```

### Client-Side Throttling
```typescript
import { throttle, ThrottleDelays } from "@/lib/clientThrottle";

const handleClick = throttle(async () => {
  // Your async operation
}, ThrottleDelays.BUTTON_CLICK);
```

### Rate Limit Error Handling
```typescript
import { useRateLimitHandler } from "@/hooks/useRateLimitHandler";

const { rateLimitError, checkResponseForRateLimit } = useRateLimitHandler();

const response = await fetch("/api/endpoint");
await checkResponseForRateLimit(response);
```

## Benefits

1. **Security**: Prevents brute-force attacks on login/registration
2. **Performance**: Reduces server load from excessive requests
3. **Fairness**: Ensures equal access for all users
4. **Stability**: Prevents system overload
5. **User Experience**: Clear error messages guide users

## Future Enhancements

1. **Redis Integration**: Replace in-memory store with Redis for distributed systems
2. **User-Based Limits**: Implement different limits for different user roles
3. **Adaptive Throttling**: Adjust limits based on system load
4. **Analytics Dashboard**: Visualize throttling metrics for admins
5. **Whitelist/Blacklist**: Add IP-based access control

## Testing

To test rate limiting:
1. Make rapid requests to protected endpoints
2. Verify 429 status code is returned
3. Check error messages are displayed
4. Verify retry-after headers are set
5. Confirm logging is working

## Notes

- Rate limiting is applied to all user roles (users, vendors, admins)
- In-memory store is suitable for single-instance deployments
- For production with multiple instances, use Redis or similar
- Rate limit headers are included in all responses for client awareness




