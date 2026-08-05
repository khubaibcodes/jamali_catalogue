/**
 * Database shape, mirroring supabase/migrations.
 *
 * Regenerate after any migration:
 *   npx supabase gen types typescript --project-id ngnlmlrevtyqdbkalvjn
 *
 * `__InternalSupabase` is not decoration — supabase-js uses it to resolve the
 * Postgrest version, and without it every table's Row/Insert type collapses to
 * `never` and each query silently loses its typing.
 */

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          code: string;
          name: string;
          fabric: string;
          category: string;
          collection: string;
          colours: string;
          notes: string;
          published: boolean;
          retail_price: number | null;
          pieces: Database["public"]["Enums"]["piece_count"];
          status: Database["public"]["Enums"]["article_status"];
          stitch: Database["public"]["Enums"]["stitch_state"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name?: string;
          fabric?: string;
          category?: string;
          collection?: string;
          colours?: string;
          notes?: string;
          published?: boolean;
          retail_price?: number | null;
          pieces?: Database["public"]["Enums"]["piece_count"];
          status?: Database["public"]["Enums"]["article_status"];
          stitch?: Database["public"]["Enums"]["stitch_state"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Owner-only. A staff session reads zero rows here — not an error, just
       * an empty result — so callers must read "missing" as "not permitted to
       * see" rather than "not set".
       */
      product_trade_rates: {
        Row: {
          product_id: string;
          reseller: number | null;
          wholesale: number | null;
          moq: number | null;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          reseller?: number | null;
          wholesale?: number | null;
          moq?: number | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_trade_rates"]["Insert"]>;
        Relationships: [];
      };
      product_photos: {
        Row: {
          id: string;
          product_id: string;
          storage_path: string;
          width: number | null;
          height: number | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          storage_path: string;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_photos"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["staff_role"];
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_staff_role: { Args: never; Returns: Database["public"]["Enums"]["staff_role"] };
      is_owner: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
    };
    Enums: {
      article_status: "Available" | "New" | "Low stock" | "Sold out";
      piece_count: "1-Piece" | "2-Piece" | "3-Piece" | "4-Piece";
      staff_role: "owner" | "staff";
      stitch_state: "Unstitched" | "Stitched";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/* Readable aliases, derived so there is only one source of truth. */
type Tables = Database["public"]["Tables"];
export type ProductRow = Tables["products"]["Row"];
export type TradeRateRow = Tables["product_trade_rates"]["Row"];
export type PhotoRow = Tables["product_photos"]["Row"];
export type ProfileRow = Tables["profiles"]["Row"];

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type StitchState = Database["public"]["Enums"]["stitch_state"];
export type PieceCount = Database["public"]["Enums"]["piece_count"];
export type ArticleStatus = Database["public"]["Enums"]["article_status"];

export const PHOTO_BUCKET = "product-photos";
