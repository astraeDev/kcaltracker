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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      foods: {
        Row: {
          carbs_per_100g: number | null
          category_name: string | null
          created_at: string
          density_g_per_unit: number | null
          expected_kcal: number | null
          external_id: string | null
          fat_per_100g: number | null
          fiber_per_100g: number | null
          id: string
          is_public: boolean
          is_shared: boolean
          kcal_per_100g: number | null
          name: string
          owner_profile_id: string | null
          protein_per_100g: number | null
          source: Database["public"]["Enums"]["food_source_enum"]
          unit_type: Database["public"]["Enums"]["unit_type_enum"]
          updated_at: string
        }
        Insert: {
          carbs_per_100g?: number | null
          category_name?: string | null
          created_at?: string
          density_g_per_unit?: number | null
          expected_kcal?: number | null
          external_id?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          kcal_per_100g?: number | null
          name: string
          owner_profile_id?: string | null
          protein_per_100g?: number | null
          source?: Database["public"]["Enums"]["food_source_enum"]
          unit_type?: Database["public"]["Enums"]["unit_type_enum"]
          updated_at?: string
        }
        Update: {
          carbs_per_100g?: number | null
          category_name?: string | null
          created_at?: string
          density_g_per_unit?: number | null
          expected_kcal?: number | null
          external_id?: string | null
          fat_per_100g?: number | null
          fiber_per_100g?: number | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          kcal_per_100g?: number | null
          name?: string
          owner_profile_id?: string | null
          protein_per_100g?: number | null
          source?: Database["public"]["Enums"]["food_source_enum"]
          unit_type?: Database["public"]["Enums"]["unit_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_days: {
        Row: {
          created_at: string
          date: string
          id: string
          profile_id: string
          total_carbs: number
          total_fat: number
          total_kcal: number
          total_protein: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          profile_id: string
          total_carbs?: number
          total_fat?: number
          total_kcal?: number
          total_protein?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          profile_id?: string
          total_carbs?: number
          total_fat?: number
          total_kcal?: number
          total_protein?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_days_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          food_id: string | null
          id: string
          journal_day_id: string
          quantity: number
          recipe_id: string | null
          snapshot_carbs: number
          snapshot_fat: number
          snapshot_kcal: number
          snapshot_name: string
          snapshot_protein: number
        }
        Insert: {
          created_at?: string
          food_id?: string | null
          id?: string
          journal_day_id: string
          quantity: number
          recipe_id?: string | null
          snapshot_carbs: number
          snapshot_fat: number
          snapshot_kcal: number
          snapshot_name: string
          snapshot_protein: number
        }
        Update: {
          created_at?: string
          food_id?: string | null
          id?: string
          journal_day_id?: string
          quantity?: number
          recipe_id?: string | null
          snapshot_carbs?: number
          snapshot_fat?: number
          snapshot_kcal?: number
          snapshot_name?: string
          snapshot_protein?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_journal_day_id_fkey"
            columns: ["journal_day_id"]
            isOneToOne: false
            referencedRelation: "journal_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrients: {
        Row: {
          category: Database["public"]["Enums"]["nutrient_category_enum"]
          confidence_code:
            | Database["public"]["Enums"]["confidence_code_enum"]
            | null
          created_at: string
          external_id: string
          food_id: string
          id: string
          name_fr: string
          raw_value_text: string | null
          unit: string
          value: number | null
          value_type: Database["public"]["Enums"]["nutrient_value_type_enum"]
        }
        Insert: {
          category?: Database["public"]["Enums"]["nutrient_category_enum"]
          confidence_code?:
            | Database["public"]["Enums"]["confidence_code_enum"]
            | null
          created_at?: string
          external_id: string
          food_id: string
          id?: string
          name_fr: string
          raw_value_text?: string | null
          unit: string
          value?: number | null
          value_type?: Database["public"]["Enums"]["nutrient_value_type_enum"]
        }
        Update: {
          category?: Database["public"]["Enums"]["nutrient_category_enum"]
          confidence_code?:
            | Database["public"]["Enums"]["confidence_code_enum"]
            | null
          created_at?: string
          external_id?: string
          food_id?: string
          id?: string
          name_fr?: string
          raw_value_text?: string | null
          unit?: string
          value?: number | null
          value_type?: Database["public"]["Enums"]["nutrient_value_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "nutrients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level_enum"]
          avatar_url: string | null
          bio: string | null
          birth_date: string
          created_at: string
          daily_carbs_target_g: number
          daily_fat_target_g: number
          daily_kcal_target: number
          daily_protein_target_g: number
          gender: Database["public"]["Enums"]["gender_enum"]
          goal_type: Database["public"]["Enums"]["goal_type_enum"]
          health_data_consent_at: string
          height_cm: number
          id: string
          is_public: boolean
          name: string | null
          updated_at: string
          user_id: string
          weekly_rate_kg: number | null
          weight_change_kg: number | null
          weight_kg: number
        }
        Insert: {
          activity_level: Database["public"]["Enums"]["activity_level_enum"]
          avatar_url?: string | null
          bio?: string | null
          birth_date: string
          created_at?: string
          daily_carbs_target_g: number
          daily_fat_target_g: number
          daily_kcal_target: number
          daily_protein_target_g: number
          gender: Database["public"]["Enums"]["gender_enum"]
          goal_type?: Database["public"]["Enums"]["goal_type_enum"]
          health_data_consent_at: string
          height_cm: number
          id?: string
          is_public?: boolean
          name?: string | null
          updated_at?: string
          user_id: string
          weekly_rate_kg?: number | null
          weight_change_kg?: number | null
          weight_kg: number
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level_enum"]
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string
          created_at?: string
          daily_carbs_target_g?: number
          daily_fat_target_g?: number
          daily_kcal_target?: number
          daily_protein_target_g?: number
          gender?: Database["public"]["Enums"]["gender_enum"]
          goal_type?: Database["public"]["Enums"]["goal_type_enum"]
          health_data_consent_at?: string
          height_cm?: number
          id?: string
          is_public?: boolean
          name?: string | null
          updated_at?: string
          user_id?: string
          weekly_rate_kg?: number | null
          weight_change_kg?: number | null
          weight_kg?: number
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          created_at: string
          food_id: string
          id: string
          quantity: number
          recipe_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          quantity: number
          recipe_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          quantity?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_likes: {
        Row: {
          created_at: string
          profile_id: string
          recipe_id: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          recipe_id: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_likes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ratings: {
        Row: {
          created_at: string
          profile_id: string
          recipe_id: string
          score: number
        }
        Insert: {
          created_at?: string
          profile_id: string
          recipe_id: string
          score: number
        }
        Update: {
          created_at?: string
          profile_id?: string
          recipe_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ratings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          calculated_carbs: number
          calculated_fat: number
          calculated_kcal: number
          calculated_protein: number
          created_at: string
          id: string
          is_shared: boolean
          name: string
          owner_profile_id: string
          servings: number
          updated_at: string
        }
        Insert: {
          calculated_carbs?: number
          calculated_fat?: number
          calculated_kcal?: number
          calculated_protein?: number
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          owner_profile_id: string
          servings: number
          updated_at?: string
        }
        Update: {
          calculated_carbs?: number
          calculated_fat?: number
          calculated_kcal?: number
          calculated_protein?: number
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          owner_profile_id?: string
          servings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          profile_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          profile_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          profile_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_profile_id_fkey"
            columns: ["profile_id"]
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      uuid_generate_v7: { Args: never; Returns: string }
    }
    Enums: {
      activity_level_enum:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "extreme"
      confidence_code_enum: "A" | "B" | "C" | "D"
      food_source_enum: "ciqual" | "user" | "off"
      gender_enum: "male" | "female"
      goal_type_enum: "maintain" | "gain" | "lose"
      nutrient_category_enum:
        | "macro"
        | "fatty_acid"
        | "sugar"
        | "vitamin"
        | "mineral"
        | "other"
      nutrient_value_type_enum:
        | "measured"
        | "traces"
        | "less_than"
        | "not_measured"
      unit_type_enum: "grams" | "ml" | "unit"
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level_enum: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "extreme",
      ],
      confidence_code_enum: ["A", "B", "C", "D"],
      food_source_enum: ["ciqual", "user", "off"],
      gender_enum: ["male", "female"],
      goal_type_enum: ["maintain", "gain", "lose"],
      nutrient_category_enum: [
        "macro",
        "fatty_acid",
        "sugar",
        "vitamin",
        "mineral",
        "other",
      ],
      nutrient_value_type_enum: [
        "measured",
        "traces",
        "less_than",
        "not_measured",
      ],
      unit_type_enum: ["grams", "ml", "unit"],
    },
  },
} as const
