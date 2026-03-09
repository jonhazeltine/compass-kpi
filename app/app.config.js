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
const appVariant = process.env.EXPO_PUBLIC_APP_VARIANT || process.env.APP_VARIANT || 'default';
const defaultPersonaKey = process.env.EXPO_PUBLIC_DEFAULT_PERSONA_KEY || process.env.DEFAULT_PERSONA_KEY || '';
const enableDevToolsEnv = process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS || process.env.ENABLE_DEV_TOOLS || '';

const personaCredentialPrefix = 'EXPO_PUBLIC_TEST_PERSONA_';
const personaCredentialSuffix = '_EMAIL';
const personaCredentials = Object.keys(process.env).reduce((acc, key) => {
  if (!key.startsWith(personaCredentialPrefix) || !key.endsWith(personaCredentialSuffix)) return acc;
  const personaKey = key.slice(personaCredentialPrefix.length, -personaCredentialSuffix.length).toLowerCase();
  const email = process.env[key] || '';
  const passwordKey = `${personaCredentialPrefix}${personaKey.toUpperCase()}_PASSWORD`;
  const password = process.env[passwordKey] || '';
  if (personaKey && email && password) {
    acc[personaKey] = { email, password };
  }
  return acc;
}, {});

const variantProfileMap = {
  default: {
    appName: 'Compass KPI Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi',
    androidPackage: 'com.jonhazeltine.compasskpi',
  },
  solo: {
    appName: 'Compass Solo Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi.solo',
    androidPackage: 'com.jonhazeltine.compasskpi.solo',
  },
  member: {
    appName: 'Compass Member Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi.member',
    androidPackage: 'com.jonhazeltine.compasskpi.member',
  },
  leader: {
    appName: 'Compass Leader Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi.leader',
    androidPackage: 'com.jonhazeltine.compasskpi.leader',
  },
  coach: {
    appName: 'Compass Coach Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi.coach',
    androidPackage: 'com.jonhazeltine.compasskpi.coach',
  },
  sponsor: {
    appName: 'Compass Sponsor Dev',
    iosBundle: 'com.jonhazeltine.compass-kpi.sponsor',
    androidPackage: 'com.jonhazeltine.compasskpi.sponsor',
  },
};

const variantProfile = variantProfileMap[appVariant] || variantProfileMap.default;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase config in .env file');
  console.error(`   SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
  console.error(`   SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}`);
}

module.exports = ({ config }) => ({
  ...config,
  name: variantProfile.appName,
  slug: 'compass-kpi',
  plugins: Array.from(
    new Set([...(config.plugins || []), 'expo-audio', 'expo-secure-store', 'expo-image-picker', 'expo-video', '@react-native-community/datetimepicker'])
  ),
  ios: {
    ...(config.ios || {}),
    bundleIdentifier: variantProfile.iosBundle,
  },
  android: {
    ...(config.android || {}),
    package: variantProfile.androidPackage,
  },
  extra: {
    ...(config.extra || {}),
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
    appVariant,
    defaultPersonaKey,
    enableDevTools:
      enableDevToolsEnv === 'true' || process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_NODE_ENV === 'development',
    personaCredentials,
  },
});
