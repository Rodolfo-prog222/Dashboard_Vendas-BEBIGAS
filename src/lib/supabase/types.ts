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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          nascimento: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          nascimento?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          nascimento?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          valor?: number
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          id: number
          pontos_para_resgate: number
          pontos_por_real: number
          recompensa: string
          updated_at: string
          valor_desconto: number
        }
        Insert: {
          id?: number
          pontos_para_resgate?: number
          pontos_por_real?: number
          recompensa?: string
          updated_at?: string
          valor_desconto?: number
        }
        Update: {
          id?: number
          pontos_para_resgate?: number
          pontos_por_real?: number
          recompensa?: string
          updated_at?: string
          valor_desconto?: number
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_id: string
          descricao: string | null
          id: string
          pontos: number
          sale_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          descricao?: string | null
          id?: string
          pontos: number
          sale_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          descricao?: string | null
          id?: string
          pontos?: number
          sale_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      production: {
        Row: {
          created_at: string
          created_by: string | null
          data_producao: string
          id: string
          observacoes: string | null
          product_id: string | null
          produto_nome: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_producao?: string
          id?: string
          observacoes?: string | null
          product_id?: string | null
          produto_nome: string
          quantidade: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_producao?: string
          id?: string
          observacoes?: string | null
          product_id?: string | null
          produto_nome?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          preco_antigo: number | null
          preco_novo: number
          product_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          preco_antigo?: number | null
          preco_novo: number
          product_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          preco_antigo?: number | null
          preco_novo?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          custo: number
          disponivel_hoje: boolean
          id: string
          nome: string
          preco: number
          terceirizado: boolean
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo?: number
          disponivel_hoje?: boolean
          id?: string
          nome: string
          preco?: number
          terceirizado?: boolean
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo?: number
          disponivel_hoje?: boolean
          id?: string
          nome?: string
          preco?: number
          terceirizado?: boolean
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nome?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          data_compra: string
          fornecedor: string | null
          id: string
          observacoes: string | null
          preco_unitario: number
          quantidade: number
          raw_material_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_compra?: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          preco_unitario?: number
          quantidade: number
          raw_material_id: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_compra?: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          preco_unitario?: number
          quantidade?: number
          raw_material_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          ativo: boolean
          created_at: string
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          id: string
          product_id: string
          quantidade: number
          raw_material_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantidade?: number
          raw_material_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantidade?: number
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          custo_unitario: number
          id: string
          preco_unitario: number
          product_id: string | null
          produto_nome: string
          quantidade: number
          sale_id: string
          subtotal: number
        }
        Insert: {
          custo_unitario?: number
          id?: string
          preco_unitario?: number
          product_id?: string | null
          produto_nome: string
          quantidade?: number
          sale_id: string
          subtotal?: number
        }
        Update: {
          custo_unitario?: number
          id?: string
          preco_unitario?: number
          product_id?: string | null
          produto_nome?: string
          quantidade?: number
          sale_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          id: string
          metodo: string
          sale_id: string
          valor: number
        }
        Insert: {
          id?: string
          metodo: string
          sale_id: string
          valor?: number
        }
        Update: {
          id?: string
          metodo?: string
          sale_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          custo_total: number
          customer_id: string | null
          data_venda: string
          desconto: number
          id: string
          observacoes: string | null
          status: string
          subtotal: number
          total: number
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          custo_total?: number
          customer_id?: string | null
          data_venda?: string
          desconto?: number
          id?: string
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          custo_total?: number
          customer_id?: string | null
          data_venda?: string
          desconto?: number
          id?: string
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador"
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
  public: {
    Enums: {
      app_role: ["admin", "operador"],
    },
  },
} as const
