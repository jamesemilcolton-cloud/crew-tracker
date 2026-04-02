export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_linkedin_ads: {
        Row: {
          ad_number: number
          ad_type: string
          created_at: string
          id: string
          is_active: boolean
          title_number: number
          upload_date: string
          user_id: string
        }
        Insert: {
          ad_number: number
          ad_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title_number: number
          upload_date?: string
          user_id: string
        }
        Update: {
          ad_number?: number
          ad_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title_number?: number
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_uploads: {
        Row: {
          ad_number: number
          ad_type: string
          close_date: string | null
          created_at: string
          id: string
          title_number: number
          upload_date: string
          user_id: string
        }
        Insert: {
          ad_number?: number
          ad_type: string
          close_date?: string | null
          created_at?: string
          id?: string
          title_number?: number
          upload_date?: string
          user_id: string
        }
        Update: {
          ad_number?: number
          ad_type?: string
          close_date?: string | null
          created_at?: string
          id?: string
          title_number?: number
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      candidate_stage_history: {
        Row: {
          candidate_id: string
          changed_at: string
          from_stage: string
          id: string
          note: string | null
          to_stage: string
        }
        Insert: {
          candidate_id: string
          changed_at?: string
          from_stage: string
          id?: string
          note?: string | null
          to_stage: string
        }
        Update: {
          candidate_id?: string
          changed_at?: string
          from_stage?: string
          id?: string
          note?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_stage_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          archived_at: string | null
          candidate_id: string
          created_at: string
          drop_off_date: string | null
          drop_off_reason: string | null
          first_name: string
          has_evo_app_access: boolean
          has_sales_pitch_access: boolean
          id: string
          last_name: string
          name: string
          notes: string
          phone: string
          potential_start_date: string | null
          recruited_by: string | null
          source: string
          stage: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          candidate_id: string
          created_at?: string
          drop_off_date?: string | null
          drop_off_reason?: string | null
          first_name?: string
          has_evo_app_access?: boolean
          has_sales_pitch_access?: boolean
          id?: string
          last_name?: string
          name: string
          notes?: string
          phone?: string
          potential_start_date?: string | null
          recruited_by?: string | null
          source?: string
          stage?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          candidate_id?: string
          created_at?: string
          drop_off_date?: string | null
          drop_off_reason?: string | null
          first_name?: string
          has_evo_app_access?: boolean
          has_sales_pitch_access?: boolean
          id?: string
          last_name?: string
          name?: string
          notes?: string
          phone?: string
          potential_start_date?: string | null
          recruited_by?: string | null
          source?: string
          stage?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_recruited_by_fkey"
            columns: ["recruited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_downloads: {
        Row: {
          ad_upload_id: string
          count: number
          created_at: string
          download_date: string
          id: string
          user_id: string
        }
        Insert: {
          ad_upload_id: string
          count?: number
          created_at?: string
          download_date?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_upload_id?: string
          count?: number
          created_at?: string
          download_date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_downloads_ad_upload_id_fkey"
            columns: ["ad_upload_id"]
            isOneToOne: false
            referencedRelation: "ad_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string
          id: string
          token: string
          used: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by: string
          id?: string
          token?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string
          id?: string
          token?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_activity: {
        Row: {
          activity_date: string
          candidates_attending_2nd_round: number
          created_at: string
          cvs_downloaded: number
          free_ads_uploaded: number
          id: string
          paid_ads_uploaded: number
          user_id: string
        }
        Insert: {
          activity_date?: string
          candidates_attending_2nd_round?: number
          created_at?: string
          cvs_downloaded?: number
          free_ads_uploaded?: number
          id?: string
          paid_ads_uploaded?: number
          user_id: string
        }
        Update: {
          activity_date?: string
          candidates_attending_2nd_round?: number
          created_at?: string
          cvs_downloaded?: number
          free_ads_uploaded?: number
          id?: string
          paid_ads_uploaded?: number
          user_id?: string
        }
        Relationships: []
      }
      linkedin_ads_library: {
        Row: {
          content: string
          id: string
          slot_number: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          slot_number: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          slot_number?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      linkedin_titles: {
        Row: {
          content: string
          id: string
          slot_number: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          slot_number: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          slot_number?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      personal_best_log: {
        Row: {
          created_at: string
          displayed: boolean
          id: string
          profile_id: string
          rep_profit: number
          user_id: string
          week_start: string
          weekly_sales: number
        }
        Insert: {
          created_at?: string
          displayed?: boolean
          id?: string
          profile_id: string
          rep_profit?: number
          user_id: string
          week_start: string
          weekly_sales: number
        }
        Update: {
          created_at?: string
          displayed?: boolean
          id?: string
          profile_id?: string
          rep_profit?: number
          user_id?: string
          week_start?: string
          weekly_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_best_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_recruitment_activity: {
        Row: {
          activity_date: string
          attended_ob: number
          contact_type: string
          created_at: string
          id: string
          invited_to_ob: number
          people_spoken_to: number
          user_id: string
        }
        Insert: {
          activity_date?: string
          attended_ob?: number
          contact_type: string
          created_at?: string
          id?: string
          invited_to_ob?: number
          people_spoken_to?: number
          user_id: string
        }
        Update: {
          activity_date?: string
          attended_ob?: number
          contact_type?: string
          created_at?: string
          id?: string
          invited_to_ob?: number
          people_spoken_to?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          candidate_record_id: string | null
          created_at: string
          crew_name: string
          first_name: string
          full_name: string
          id: string
          last_name: string
          leader_id: string | null
          updated_at: string
          user_code: string
          user_id: string
          username: string
          weekly_email_enabled: boolean
        }
        Insert: {
          candidate_record_id?: string | null
          created_at?: string
          crew_name?: string
          first_name?: string
          full_name: string
          id?: string
          last_name?: string
          leader_id?: string | null
          updated_at?: string
          user_code: string
          user_id: string
          username: string
          weekly_email_enabled?: boolean
        }
        Update: {
          candidate_record_id?: string | null
          created_at?: string
          crew_name?: string
          first_name?: string
          full_name?: string
          id?: string
          last_name?: string
          leader_id?: string | null
          updated_at?: string
          user_code?: string
          user_id?: string
          username?: string
          weekly_email_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_queue: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          leader_profile_id: string | null
          profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          leader_profile_id?: string | null
          profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          leader_profile_id?: string | null
          profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_queue_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_queue_leader_profile_id_fkey"
            columns: ["leader_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_entries: {
        Row: {
          closes: number
          created_at: string
          doors: number
          entry_date: string
          id: string
          presentations: number
          sales: number
          spoken: number
          tablets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closes?: number
          created_at?: string
          doors?: number
          entry_date?: string
          id?: string
          presentations?: number
          sales?: number
          spoken?: number
          tablets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closes?: number
          created_at?: string
          doors?: number
          entry_date?: string
          id?: string
          presentations?: number
          sales?: number
          spoken?: number
          tablets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_transactions: {
        Row: {
          age_band: string
          ask_amount: number
          created_at: string
          date: string
          id: string
          isa_upfront: number
          owner_upfront: number
          quality_pending: number
          total_wire: number
          user_id: string
          week_start: string
        }
        Insert: {
          age_band: string
          ask_amount: number
          created_at?: string
          date: string
          id?: string
          isa_upfront?: number
          owner_upfront?: number
          quality_pending?: number
          total_wire?: number
          user_id: string
          week_start: string
        }
        Update: {
          age_band?: string
          ask_amount?: number
          created_at?: string
          date?: string
          id?: string
          isa_upfront?: number
          owner_upfront?: number
          quality_pending?: number
          total_wire?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          super_admin: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          super_admin?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          super_admin?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_candidate_id: { Args: never; Returns: string }
      generate_user_code: { Args: never; Returns: string }
      get_my_profile_id: { Args: never; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_leader_of: { Args: { profile_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      reassign_recruits_upward: {
        Args: { _deleted_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "brand_ambassador" | "leader" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["brand_ambassador", "leader", "manager"],
    },
  },
} as const
