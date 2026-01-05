// Script to check .env.local file and verify PAYSTACK_SECRET_KEY
// Run with: node scripts/check-env.js

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const envLocalPath = path.join(projectRoot, '.env.local');

console.log('🔍 Checking .env.local file...');
console.log('📍 Project root:', projectRoot);
console.log('📍 .env.local path:', envLocalPath);
console.log('');

// Check if file exists
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ .env.local file does NOT exist!');
  console.log('📝 Please create .env.local in the project root with:');
  console.log('   PAYSTACK_SECRET_KEY=sk_test_d20fa0d6708eb573d60545f180f0ccbdc5e8ac77');
  process.exit(1);
}

console.log('✅ .env.local file exists');
console.log('');

// Read file content
try {
  const fileContent = fs.readFileSync(envLocalPath, 'utf-8');
  console.log('📄 File content (first 500 chars):');
  console.log('─'.repeat(50));
  console.log(fileContent.substring(0, 500));
  console.log('─'.repeat(50));
  console.log('');

  // Find PAYSTACK_SECRET_KEY line
  const lines = fileContent.split('\n');
  const paystackLine = lines.find(line => 
    line.trim().startsWith('PAYSTACK_SECRET_KEY=') || 
    line.trim().startsWith('PAYSTACK_SECRET_KEY =')
  );

  if (!paystackLine) {
    console.error('❌ PAYSTACK_SECRET_KEY not found in .env.local!');
    console.log('📝 Please add this line to .env.local:');
    console.log('   PAYSTACK_SECRET_KEY=sk_test_d20fa0d6708eb573d60545f180f0ccbdc5e8ac77');
    process.exit(1);
  }

  console.log('✅ PAYSTACK_SECRET_KEY line found:');
  console.log('   ', paystackLine);
  console.log('');

  // Extract the value
  const match = paystackLine.match(/PAYSTACK_SECRET_KEY\s*=\s*(.+)/);
  if (!match || !match[1]) {
    console.error('❌ Could not extract PAYSTACK_SECRET_KEY value from line!');
    console.log('📝 Line format should be: PAYSTACK_SECRET_KEY=sk_test_xxxxx');
    process.exit(1);
  }

  let keyValue = match[1].trim();
  
  // Remove quotes if present
  if ((keyValue.startsWith('"') && keyValue.endsWith('"')) ||
      (keyValue.startsWith("'") && keyValue.endsWith("'"))) {
    keyValue = keyValue.slice(1, -1);
    console.warn('⚠️  Key value has quotes - removing them');
  }

  console.log('🔑 Extracted key value:');
  console.log('   Length:', keyValue.length);
  console.log('   First 15 chars:', JSON.stringify(keyValue.substring(0, Math.min(15, keyValue.length))));
  console.log('   Last 4 chars:', keyValue.length > 4 ? JSON.stringify(keyValue.substring(keyValue.length - 4)) : JSON.stringify(keyValue));
  console.log('   Char codes (first 10):', keyValue.substring(0, Math.min(10, keyValue.length)).split('').map(c => c.charCodeAt(0)));
  console.log('');

  // Validate format
  if (keyValue.length < 20) {
    console.error('❌ Key value is too short! Expected at least 20 characters.');
    console.error('   Current length:', keyValue.length);
    console.error('   Value:', JSON.stringify(keyValue));
    process.exit(1);
  }

  if (!keyValue.startsWith('sk_test_') && !keyValue.startsWith('sk_live_')) {
    console.error('❌ Key value does not start with "sk_test_" or "sk_live_"!');
    console.error('   Prefix:', JSON.stringify(keyValue.substring(0, Math.min(10, keyValue.length))));
    console.error('   Full value:', JSON.stringify(keyValue));
    process.exit(1);
  }

  if (keyValue.includes(' ')) {
    console.error('❌ Key value contains spaces!');
    console.error('   Value:', JSON.stringify(keyValue));
    process.exit(1);
  }

  console.log('✅ PAYSTACK_SECRET_KEY is valid!');
  console.log('   Format: Correct');
  console.log('   Length:', keyValue.length);
  console.log('   Type:', keyValue.startsWith('sk_test_') ? 'TEST' : 'LIVE');
  console.log('');
  console.log('✅ All checks passed!');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Make sure your dev server is restarted');
  console.log('   2. Visit http://localhost:3000/api/debug-env to verify');
  console.log('   3. Try creating a subaccount again');

} catch (error) {
  console.error('❌ Error reading .env.local:', error.message);
  process.exit(1);
}



