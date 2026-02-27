const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn(`⚠️  .env file not found at ${envPath}`);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase config in .env file');
  console.error(`   SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
  console.error(`   SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}`);
}

module.exports = ({ config }) => ({
  ...config,
  name: 'Compass KPI Dev',
  slug: 'compass-kpi',
  plugins: Array.from(new Set([...(config.plugins || []), 'expo-audio'])),
  extra: {
    ...(config.extra || {}),
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
  },
});
