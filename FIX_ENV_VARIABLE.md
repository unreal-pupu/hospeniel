# Fix for PAYSTACK_SECRET_KEY Environment Variable Issue

## Problem Identified

The `.env.local` file contained a placeholder value:
```
PAYSTACK_SECRET_KEY=...
```

This caused the environment variable to be read as literally three periods ("..."), which failed validation.

## Solution Applied

The `.env.local` file has been updated with the correct Paystack secret key:
```
PAYSTACK_SECRET_KEY=sk_test_d20fa0d6708eb573d60545f180f0ccbdc5e8ac77
```

## Verification

Run the check script to verify the fix:
```bash
npm run check-env
```

You should see:
```
✅ PAYSTACK_SECRET_KEY is valid!
   Format: Correct
   Length: 48
   Type: TEST
```

## Next Steps

### 1. Restart Your Dev Server

**CRITICAL**: You MUST restart your development server for the changes to take effect:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Verify the Fix

Visit the debug endpoint to verify the environment variable is loaded correctly:
```
http://localhost:3000/api/debug-env
```

You should see:
- `paystackKeyExists: true`
- `paystackKeyLength: 48`
- `startsWithSkTest: true`

### 3. Test Paystack Integration

1. Go to the vendor settings page
2. Try creating a Paystack subaccount
3. Check the server logs - you should see:
   ```
   ✅ Paystack secret key validation passed. Key type: TEST
   🔄 Making Paystack API call with cleaned key (length: 48)
   ```

## Manual Fix (If Needed)

If the automatic fix didn't work, manually edit `.env.local`:

1. Open `.env.local` in your text editor
2. Find the line: `PAYSTACK_SECRET_KEY=...`
3. Replace it with: `PAYSTACK_SECRET_KEY=sk_test_d20fa0d6708eb573d60545f180f0ccbdc5e8ac77`
4. Save the file
5. Restart your dev server

## Common Issues

### Issue: Key still shows as "..." after restart
- **Solution**: Make sure you saved the `.env.local` file
- **Solution**: Verify the file doesn't have quotes around the value
- **Solution**: Check for hidden characters or encoding issues

### Issue: Key validation still fails
- **Solution**: Run `npm run check-env` to verify the file content
- **Solution**: Check server logs for detailed debugging information
- **Solution**: Visit `/api/debug-env` to see what's actually being loaded

### Issue: Server won't restart
- **Solution**: Make sure no other process is using port 3000
- **Solution**: Kill any hanging Node processes
- **Solution**: Clear the `.next` directory: `npm run clean`

## Testing the Fix

After restarting the server, test the following:

1. **Bank List API**: Visit `http://localhost:3000/api/banks`
   - Should return banks from Paystack (not fallback)
   - Check server logs for: `✅ Loaded X banks from paystack`

2. **Debug Endpoint**: Visit `http://localhost:3000/api/debug-env`
   - Should show `paystackKeyExists: true`
   - Should show `startsWithSkTest: true`

3. **Subaccount Creation**: Try creating a subaccount from vendor settings
   - Should succeed without validation errors
   - Should create the subaccount in Paystack
   - Should save the `subaccount_code` to the database

## Files Modified

- `.env.local` - Updated with correct Paystack secret key
- `scripts/check-env.js` - Created diagnostic script
- `src/app/api/create-subaccount/route.ts` - Enhanced logging
- `src/app/api/banks/route.ts` - Enhanced logging
- `src/app/api/debug-env/route.ts` - Created debug endpoint
- `src/app/api/test-env-file/route.ts` - Created file checker endpoint

## Support

If you're still experiencing issues:

1. Run `npm run check-env` to verify the file
2. Check server logs for detailed debugging information
3. Visit `/api/debug-env` to see environment variable status
4. Visit `/api/test-env-file` to see file content analysis



