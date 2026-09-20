/**
 * Database shape, mirroring supabase/migrations/0001_form_schema.sql.
 *
 * Note what has no column anywhere: images. The privacy promise is structural,
 * and this type is where a future change would have to break it visibly.
 *
 * The Views/Functions/Enums/CompositeTypes keys are required by supabase-js's
 * generic — without them the client resolves every row to `never`.
 */

import type { Category, Confidence, Recommendation, Strength } from '@/lib/analysis/types';

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; preferences: Json; created_at: string; updated_at: string };
        Insert: { id: string; preferences?: Json };
        Update: { preferences?: Json };
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          taken_at: string;
          quality: Confidence;
          observations: Json;
          strengths: Json;
          opportunities: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          taken_at: string;
          quality: Confidence;
          observations?: Json;
          strengths?: Json;
          opportunities?: Json;
        };
        Update: { quality?: Confidence };
        Relationships: [];
      };
      recommendation_state: {
        Row: {
          user_id: string;
          recommendation_id: string;
          category: Category;
          state: RecommendationState;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          recommendation_id: string;
          category: Category;
          state: RecommendationState;
        };
        Update: { state?: RecommendationState };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type RecommendationState = 'saved' | 'tried' | 'dismissed';

/** What an analysis row looks like once parsed back out. */
export interface StoredAnalysis {
  readonly takenAt: number;
  readonly quality: Confidence;
  readonly strengths: readonly Strength[];
  readonly opportunities: readonly Recommendation[];
}
