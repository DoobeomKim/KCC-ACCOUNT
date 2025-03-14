import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          email: string
          role: 'admin' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
        }
      },
      company_profiles: {
        Row: {
          email: string
          company_name: string | null
          city: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          company_name?: string | null
          city?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          company_name?: string | null
          city?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 