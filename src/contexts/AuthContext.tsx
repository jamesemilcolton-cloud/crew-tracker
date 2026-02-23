import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  leader_id: string | null;
  crew_name: string;
  created_at: string;
  phone: string;
}

export type AppRole = "brand_ambassador" | "leader" | "manager";

interface UserRole {
  role: AppRole;
  super_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string, leaderId: string | null, crewName: string, phone: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refetchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  const fetchRole = async (userId: string) => {
    const { data } = await supabase.rpc("get_user_role", { _user_id: userId });
    if (data) {
      setUserRole(data as unknown as UserRole);
    }
  };

  const refetchRole = async () => {
    if (user) await fetchRole(user.id);
  };

  useEffect(() => {
    let initialised = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === "INITIAL_SESSION") {
          // Handled by the initial getSession call below
          return;
        }

        // Only react to real auth changes (login, logout, token refresh)
        if (session?.user) {
          fetchProfile(session.user.id);
          fetchRole(session.user.id);
        } else {
          setProfile(null);
          setUserRole(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialised) return;
      initialised = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string, leaderId: string | null, crewName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error };

    if (data.user) {
      // Use upsert to handle cases where profile might partially exist
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        leader_id: leaderId || null,
        crew_name: crewName,
        phone: phone,
      }, { onConflict: "user_id" });
      if (profileError) {
        console.error("Profile creation failed:", profileError);
        return { error: profileError };
      }

      // Link matching candidate record by phone number
      const { data: matchingCandidates } = await supabase
        .from("candidates")
        .select("id")
        .eq("phone", phone.trim())
        .is("archived_at", null);

      if (matchingCandidates && matchingCandidates.length > 0) {
        // Update candidate(s) with matching phone: set names to account values
        const fullName = `${firstName} ${lastName}`.trim();
        for (const candidate of matchingCandidates) {
          await supabase.from("candidates").update({
            name: fullName,
            first_name: firstName,
            last_name: lastName,
          }).eq("id", candidate.id);
        }
      }

      await fetchProfile(data.user.id);
      await fetchRole(data.user.id);
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, userRole, loading, signUp, signIn, signOut, refetchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
