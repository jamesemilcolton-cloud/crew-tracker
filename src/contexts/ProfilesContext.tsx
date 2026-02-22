import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SharedProfile {
  id: string;
  user_id: string;
  full_name: string;
  leader_id: string | null;
  crew_name: string;
}

interface ProfilesContextType {
  profiles: SharedProfile[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextType | undefined>(undefined);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<SharedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, leader_id, crew_name");
    setProfiles((data ?? []) as SharedProfile[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, [user]);

  return (
    <ProfilesContext.Provider value={{ profiles, loading, refetch: fetchProfiles }}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles() {
  const context = useContext(ProfilesContext);
  if (!context) throw new Error("useProfiles must be used within ProfilesProvider");
  return context;
}
