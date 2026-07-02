import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createSociety, linkProfileToSociety } from '../services/dataService';

const AuthContext = createContext(null);

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Profile not found. If your previous registration failed, please delete your account in the Supabase Dashboard (Authentication -> Users) and try registering again.');
  }
  return data;
}

function buildUser(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile.name,
    phone: profile.phone,
    role: profile.role,
    societyId: profile.society_id,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let lastUserId = null;

    const handleAuthChange = async (session) => {
      if (!session?.user) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const userId = session.user.id;
      if (userId === lastUserId) {
        return;
      }
      lastUserId = userId;

      if (mounted) setLoading(true);

      try {
        const profile = await fetchProfile(userId);
        if (mounted) {
          setUser(buildUser(session.user, profile));
        }
      } catch (err) {
        console.error('Error loading user profile:', err.message);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) {
          handleAuthChange(session);
        } else {
          setLoading(false);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT') {
          lastUserId = null;
          setUser(null);
          setLoading(false);
        } else if (session) {
          handleAuthChange(session);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error.message;

    const profile = await fetchProfile(data.user.id);
    const userData = buildUser(data.user, profile);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, phone, password, role, societyDetails = null) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone, role },
      },
    });
    if (error) throw error.message;
    if (!data.user) throw new Error('Registration failed — check email confirmation settings.');

    if (!data.session) {
      throw new Error('Registration successful! Please check your email to verify your account before logging in.');
    }

    await new Promise((r) => setTimeout(r, 1000));

    let profile;
    try {
      profile = await fetchProfile(data.user.id);
    } catch (err) {
      console.error("Profile fetch error during registration:", err);
      throw new Error('Registration successful but profile could not be loaded. Please try logging in.');
    }

    if (role === 'super_admin' && societyDetails?.name) {
      const society = await createSociety({
        name: societyDetails.name,
        address: societyDetails.address || '',
      });
      await linkProfileToSociety(society.id);
      profile = await fetchProfile(data.user.id);
    }

    const userData = buildUser(data.user, profile);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const refreshProfile = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      try {
        const profile = await fetchProfile(authUser.id);
        setUser(buildUser(authUser, profile));
      } catch (err) {
        console.error('Error refreshing profile:', err.message);
      }
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshProfile,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'super_admin',
    isResident: user?.role === 'resident',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be consumed inside an AuthProvider');
  }
  return context;
};
