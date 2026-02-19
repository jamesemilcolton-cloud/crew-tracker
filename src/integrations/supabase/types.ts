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
      ad_uploads: {
        Row: {
          ad_type: string
          created_at: string
          id: string
          upload_date: string
          user_id: string
        }
        Insert: {
          ad_type: string
          created_at?: string
          id?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          ad_type?: string
          created_at?: string
          id?: string
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
          created_at: string
          has_evo_app_access: boolean
          has_sales_pitch_access: boolean
          id: string
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
          created_at?: string
          has_evo_app_access?: boolean
          has_sales_pitch_access?: boolean
          id?: string
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
          created_at?: string
          has_evo_app_access?: boolean
          has_sales_pitch_access?: boolean
          id?: string
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
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          leader_id: string | null
          updated_at: string
          user_id: string
          weekly_email_enabled: boolean
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          leader_id?: string | null
          updated_at?: string
          user_id: string
          weekly_email_enabled?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          leader_id?: string | null
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_profile_id: { Args: never; Returns: string }
      is_leader_of: { Args: { profile_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
