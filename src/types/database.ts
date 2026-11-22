export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          fiscal_start_month: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          fiscal_start_month?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fiscal_start_month?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          position: string | null
          role: string
          unit_id: string | null
          username: string
          year_type: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          position?: string | null
          role?: string
          unit_id?: string | null
          username: string
          year_type?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          position?: string | null
          role?: string
          unit_id?: string | null
          username?: string
          year_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          changed_at: string
          changed_by: string
          from_status: string | null
          id: number
          task_id: string
          to_status: string
        }
        ComputedFields: never
        Insert: {
          changed_at?: string
          changed_by: string
          from_status?: string | null
          id?: never
          task_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          from_status?: string | null
          id?: never
          task_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          carried_from_year: number | null
          category_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_deleted: boolean
          owner_id: string
          position: number
          priority: number
          progress: number | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          version: number
          year: number
        }
        ComputedFields: never
        Insert: {
          carried_from_year?: number | null
          category_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          owner_id: string
          position?: number
          priority?: number
          progress?: number | null
          started_at?: string | null
          status: string
          title: string
          updated_at?: string
          version?: number
          year: number
        }
        Update: {
          carried_from_year?: number | null
          category_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          owner_id?: string
          position?: number
          priority?: number
          progress?: number | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          id: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dashboard_summary: {
        Args: { p_owner_id?: string; p_unit_id?: string; p_year: number }
        Returns: Json
      }
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      reorder_categories: { Args: { p_ids: string[] }; Returns: undefined }
      save_board_changes: { Args: { p_changes: Json }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
