export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          company: string
          compatibility_score: number | null
          created_at: string
          id: string
          job_description: string | null
          job_url: string | null
          role_title: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          compatibility_score?: number | null
          created_at?: string
          id?: string
          job_description?: string | null
          job_url?: string | null
          role_title: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          compatibility_score?: number | null
          created_at?: string
          id?: string
          job_description?: string | null
          job_url?: string | null
          role_title?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employment_roles: {
        Row: {
          created_at: string
          employer: string
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          start_date: string | null
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employer: string
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employer?: string
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence_items: {
        Row: {
          created_at: string
          evidence_type: string
          id: string
          knowledge_item_id: string | null
          notes: string | null
          source_reference: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          evidence_type: string
          id?: string
          knowledge_item_id?: string | null
          notes?: string | null
          source_reference?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          evidence_type?: string
          id?: string
          knowledge_item_id?: string | null
          notes?: string | null
          source_reference?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_knowledge_item_id_user_id_fkey"
            columns: ["knowledge_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          category: string
          content: string
          created_at: string
          employment_role_id: string | null
          id: string
          metrics: Json
          source_reference: string | null
          source_type: string
          star_action: string | null
          star_context: string | null
          star_result: string | null
          status: Database["public"]["Enums"]["knowledge_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          employment_role_id?: string | null
          id?: string
          metrics?: Json
          source_reference?: string | null
          source_type: string
          star_action?: string | null
          star_context?: string | null
          star_result?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          employment_role_id?: string | null
          id?: string
          metrics?: Json
          source_reference?: string | null
          source_type?: string
          star_action?: string | null
          star_context?: string | null
          star_result?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_employment_role_id_user_id_fkey"
            columns: ["employment_role_id", "user_id"]
            isOneToOne: false
            referencedRelation: "employment_roles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      knowledge_update_proposals: {
        Row: {
          created_at: string
          id: string
          knowledge_item_id: string | null
          proposed_change: Json
          reason: string
          resolved_at: string | null
          resume_version_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_item_id?: string | null
          proposed_change: Json
          reason: string
          resolved_at?: string | null
          resume_version_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_item_id?: string | null
          proposed_change?: Json
          reason?: string
          resolved_at?: string | null
          resume_version_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_update_proposals_knowledge_item_id_user_id_fkey"
            columns: ["knowledge_item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "knowledge_update_proposals_resume_version_id_user_id_fkey"
            columns: ["resume_version_id", "user_id"]
            isOneToOne: false
            referencedRelation: "resume_versions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          location: string | null
          professional_summary: string | null
          target_industries: string[]
          target_roles: string[]
          updated_at: string
          user_id: string
          writing_preferences: Json
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          location?: string | null
          professional_summary?: string | null
          target_industries?: string[]
          target_roles?: string[]
          updated_at?: string
          user_id: string
          writing_preferences?: Json
        }
        Update: {
          created_at?: string
          display_name?: string | null
          location?: string | null
          professional_summary?: string | null
          target_industries?: string[]
          target_roles?: string[]
          updated_at?: string
          user_id?: string
          writing_preferences?: Json
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          application_id: string | null
          content: Json
          created_at: string
          evidence_map: Json
          id: string
          status: string
          user_id: string
          version_number: number
        }
        Insert: {
          application_id?: string | null
          content: Json
          created_at?: string
          evidence_map?: Json
          id?: string
          status?: string
          user_id: string
          version_number: number
        }
        Update: {
          application_id?: string | null
          content?: Json
          created_at?: string
          evidence_map?: Json
          id?: string
          status?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_application_id_user_id_fkey"
            columns: ["application_id", "user_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      knowledge_status:
        | "verified"
        | "user_confirmed"
        | "imported_cv"
        | "imported_linkedin"
        | "needs_verification"
        | "archived"
        | "excluded"
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      knowledge_status: [
        "verified",
        "user_confirmed",
        "imported_cv",
        "imported_linkedin",
        "needs_verification",
        "archived",
        "excluded",
      ],
    },
  },
} as const
