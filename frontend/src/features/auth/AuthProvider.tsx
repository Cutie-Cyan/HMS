import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabase";
import type { StaffProfile, StaffRole } from "../../lib/roles";

interface AuthState {
  session: Session | null;
  profile: StaffProfile | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

function validRole(value: string): value is StaffRole {
  return [
    "admin",
    "info_officer",
    "emergency_nurse",
    "cashier",
    "pharmacy",
    "lab",
    "nurse_station",
  ].includes(value);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileRequestId = useRef(0);

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestId.current;
    try {
      const { data, error: profileError } = await getSupabaseClient()
        .from("staff_profiles")
        .select("user_id,email,display_name,role,ward_id,is_active")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (requestId !== profileRequestId.current) return;
      if (!data || !data.is_active || !validRole(data.role)) {
        setProfile(null);
        setError(
          "This account has no active staff profile. Contact the HMS administrator.",
        );
        return;
      }
      setProfile({
        userId: data.user_id,
        email: data.email,
        displayName: data.display_name,
        role: data.role,
        wardId: data.ward_id,
        isActive: data.is_active,
      });
      setError(null);
    } catch (cause) {
      if (requestId !== profileRequestId.current) return;
      setProfile(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to verify staff access.",
      );
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      setSession(currentSession);
      if (!currentSession?.user) {
        setProfile(null);
        setError(null);
        return;
      }
      await loadProfile(currentSession.user.id);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to verify staff access.";
      if (message.includes("VITE_SUPABASE_")) setConfigured(false);
      setProfile(null);
      setError(message);
    }
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      await refreshProfile();
      if (mounted) setLoading(false);
    };
    void initialize();
    let unsubscribe = () => {};
    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange(
        (_event, nextSession) => {
          setSession(nextSession);
          if (!nextSession?.user) {
            profileRequestId.current += 1;
            setProfile(null);
            setError(null);
            return;
          }
          // Do not call another Supabase auth method inside this callback; fetch the profile only.
          void loadProfile(nextSession.user.id);
        },
      );
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      setConfigured(false);
    }
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [loadProfile, refreshProfile]);

  const signOut = useCallback(async () => {
    try {
      await getSupabaseClient().auth.signOut();
      profileRequestId.current += 1;
      setSession(null);
      setProfile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign out failed.");
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      configured,
      error,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, configured, error, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
