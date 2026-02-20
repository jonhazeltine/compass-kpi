import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase, API_URL } from '../lib/supabase';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [meData, setMeData] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      const token = session?.access_token;
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Request failed');
        setMeData(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to fetch /me');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [session?.access_token]);

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CompassKPI</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : meData ? (
        <View style={styles.card}>
          <Text style={styles.label}>Logged in via backend /me</Text>
          <Text style={styles.value}>{meData.email}</Text>
        </View>
      ) : null}
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  card: {
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c00',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
