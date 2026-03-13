"use client";

import { supabase } from "../../lib/supabase/client";

export const authService = {
  // Sign up with email and password
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  // Sign in with email and password
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  // Get current session
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  },

  // Get current user
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      return user;
    } catch (error) {
      if (error?.name === "AuthSessionMissingError") {
        return null;
      }
      throw error;
    }
  },

  // Sign in anonymously (creates a guest session in Supabase)
  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      throw error;
    }

    return data;
  },

  // Upgrade an anonymous account to a permanent account (same user_id retained)
  async upgradeAnonymousAccount(email, password) {
    const { data, error } = await supabase.auth.updateUser({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  // Subscribe to auth state changes
  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return subscription;
  },
};
