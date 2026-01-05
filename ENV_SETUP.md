# Environment Variables Setup Guide

## Paystack Secret Key Configuration

### Step 1: Create/Edit .env.local file

Create or edit the file named `.env.local` in the **project root** (same directory as `package.json`):

```
PAYSTACK_SECRET_KEY=sk_test_d20fa0d6708eb573d60545f180f0ccbdc5e8ac77
```

**⚠️ IMPORTANT**: Do NOT use placeholder values like `...` or `xxxxx`. Use your actual Paystack secret key!

### Step 2: Important Notes

1. **No quotes**: Do NOT wrap the value in quotes
   - ❌ Wrong: `PAYSTACK_SECRET_KEY="sk_test_..."`
   - ✅ Correct: `PAYSTACK_SECRET_KEY=sk_test_...`

2. **No spaces**: Do NOT include spaces around the `=` sign
   - ❌ Wrong: `PAYSTACK_SECRET_KEY = sk_test_...`
   - ✅ Correct: `PAYSTACK_SECRET_KEY=sk_test_...`

3. **Single line**: The entire value must be on a single line
   - ❌ Wrong: Multi-line values
   - ✅ Correct: Single line

4. **File location**: The `.env.local` file must be in the project root
   ```
   hospineil/
   ├── .env.local          ← Here (same level as package.json)
   ├── package.json
   ├── next.config.ts
   └── src/
   ```

### Step 3: Restart the Development Server

**IMPORTANT**: After creating or modifying `.env.local`, you MUST restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

Environment variables are only loaded when the server starts. Changes to `.env.local` require a server restart.

### Step 4: Verify Environment Variable

You can verify that the environment variable is loaded correctly by:

1. **Check the debug endpoint**: Visit `http://localhost:3000/api/debug-env` in your browser
   - This will show you detailed information about the PAYSTACK_SECRET_KEY
   - Look for `startsWithSkTest: true` or `startsWithSkLive: true`

2. **Check server logs**: When you try to create a subaccount, check your terminal/console for debug logs
   - You should see: `🔍 PAYSTACK_SECRET_KEY found. Length: XX Prefix: sk_test_...`

### Step 5: Common Issues and Solutions

#### Issue: "PAYSTACK_SECRET_KEY is not set"
- **Solution**: Make sure `.env.local` exists in the project root
- **Solution**: Restart your dev server after creating/modifying `.env.local`
- **Solution**: Check that the file is named exactly `.env.local` (not `.env.local.txt`)

#### Issue: "Invalid Paystack secret key format"
- **Solution**: Check that the key starts with `sk_test_` or `sk_live_`
- **Solution**: Remove any quotes or spaces around the value
- **Solution**: Ensure the entire key is on a single line
- **Solution**: Check for hidden characters (use the debug endpoint to see char codes)

#### Issue: Key appears to be set but validation fails
- **Solution**: Check the debug endpoint (`/api/debug-env`) to see what's actually being read
- **Solution**: Look at the `charCodes` in the debug output - they should be: `115, 107, 95, 116, 101, 115, 116, 95` for "sk_test_"
- **Solution**: Try recreating the `.env.local` file from scratch

### Step 6: Test the Configuration

1. Start your dev server: `npm run dev`
2. Visit: `http://localhost:3000/api/debug-env`
3. Verify the output shows:
   - `paystackKeyExists: true`
   - `startsWithSkTest: true` (or `startsWithSkLive: true`)
   - `keyLength: 51` (for test keys, length may vary)

### Production Deployment

For production (Vercel, etc.):
1. Add `PAYSTACK_SECRET_KEY` to your hosting platform's environment variables
2. Use your **live** key: `sk_live_...` (not the test key)
3. Restart/redeploy your application

## Troubleshooting

If you're still having issues:

1. **Check file encoding**: Make sure `.env.local` is saved as UTF-8 (not UTF-8 with BOM)
2. **Check for hidden characters**: Use the debug endpoint to inspect char codes
3. **Verify file location**: The file must be in the project root
4. **Restart server**: Always restart after modifying `.env.local`
5. **Check Next.js version**: Ensure you're using a recent version of Next.js (15.x)

## Debug Endpoint

Visit `http://localhost:3000/api/debug-env` to see detailed information about your environment variables. This endpoint is only available in development mode.

