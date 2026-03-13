"use client";

import PropTypes from "prop-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../supabase/client";

const GuestModeContext = createContext({
  isGuest: false,
  isGuestReady: false,
  activateGuestMode: async () => {},
  deactivateGuestMode: () => {},
});

export function GuestModeProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isGuestReady, setIsGuestReady] = useState(false);

  useEffect(() => {
    // Resolve initial session from localStorage (no network call)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsGuestReady(true);
    });

    // Keep state in sync with auth events (sign-in, sign-out, token refresh, upgrade)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsGuestReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // isGuest is true only for anonymous Supabase sessions
  const isGuest = user?.is_anonymous === true;

  // activateGuestMode: create a Supabase anonymous session
  const activateGuestMode = useCallback(async () => {
    // If already signed in (anonymous or real), nothing to do
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return;

    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }, []);

  // deactivateGuestMode: called after upgradeAnonymousAccount succeeds
  // The onAuthStateChange listener updates isGuest automatically
  const deactivateGuestMode = useCallback(() => {
    /* state updates happen via onAuthStateChange */
  }, []);

  const contextValue = useMemo(
    () => ({ isGuest, isGuestReady, activateGuestMode, deactivateGuestMode }),
    [isGuest, isGuestReady, activateGuestMode, deactivateGuestMode],
  );

  return (
    <GuestModeContext.Provider value={contextValue}>
      {children}
    </GuestModeContext.Provider>
  );
}

export function useGuestMode() {
  return useContext(GuestModeContext);
}

GuestModeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
