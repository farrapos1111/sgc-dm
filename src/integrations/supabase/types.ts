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
      attendance_records: {
        Row: {
          calendar_event_id: string
          chapter_id: string
          created_at: string
          id: string
          justification: string | null
          member_id: string
          recorded_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          calendar_event_id: string
          chapter_id: string
          created_at?: string
          id?: string
          justification?: string | null
          member_id: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string
          chapter_id?: string
          created_at?: string
          id?: string
          justification?: string | null
          member_id?: string
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          chapter_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          chapter_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          chapter_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          address: string | null
          chapter_id: string
          created_at: string
          created_by: string | null
          description: string | null
          dress_code: string | null
          end_at: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id: string
          location: string | null
          lodge_id: string | null
          mandatory: boolean
          public_open: boolean
          related_event_id: string | null
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          chapter_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dress_code?: string | null
          end_at?: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          location?: string | null
          lodge_id?: string | null
          mandatory?: boolean
          public_open?: boolean
          related_event_id?: string | null
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dress_code?: string | null
          end_at?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          id?: string
          location?: string | null
          lodge_id?: string | null
          mandatory?: boolean
          public_open?: boolean
          related_event_id?: string | null
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lodge_id_fkey"
            columns: ["lodge_id"]
            isOneToOne: false
            referencedRelation: "chapter_lodges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_categories: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_categories_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_entries: {
        Row: {
          amount: number
          calendar_event_id: string | null
          category: string
          chapter_id: string
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          event_finance_item_id: string | null
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["cash_entry_kind"]
          receipt_url: string | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          calendar_event_id?: string | null
          category?: string
          chapter_id: string
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          event_finance_item_id?: string | null
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["cash_entry_kind"]
          receipt_url?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          calendar_event_id?: string | null
          category?: string
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          event_finance_item_id?: string | null
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["cash_entry_kind"]
          receipt_url?: string | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_event_finance_item_id_fkey"
            columns: ["event_finance_item_id"]
            isOneToOne: false
            referencedRelation: "event_finance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_subcategories: {
        Row: {
          active: boolean
          calendar_event_id: string | null
          chapter_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          calendar_event_id?: string | null
          chapter_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scope: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          calendar_event_id?: string | null
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_subcategories_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_subcategories_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_lodges: {
        Row: {
          address: string | null
          chapter_id: string
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          chapter_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_lodges_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_members: {
        Row: {
          active: boolean
          chapter_id: string
          created_at: string
          id: string
          role_id: number
          user_id: string
        }
        Insert: {
          active?: boolean
          chapter_id: string
          created_at?: string
          id?: string
          role_id: number
          user_id: string
        }
        Update: {
          active?: boolean
          chapter_id?: string
          created_at?: string
          id?: string
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_members_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          lgpd_officer_contact: string | null
          lgpd_officer_name: string | null
          logo_url: string | null
          name: string
          number: string
          primary_color: string
          region_id: string | null
          settings: Json
          state_id: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          lgpd_officer_contact?: string | null
          lgpd_officer_name?: string | null
          logo_url?: string | null
          name: string
          number: string
          primary_color?: string
          region_id?: string | null
          settings?: Json
          state_id?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          lgpd_officer_contact?: string | null
          lgpd_officer_name?: string | null
          logo_url?: string | null
          name?: string
          number?: string
          primary_color?: string
          region_id?: string | null
          settings?: Json
          state_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          checked_in_at: string
          checked_in_by: string | null
          event_id: string
          id: string
          method: Database["public"]["Enums"]["checkin_method"]
          ticket_id: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id: string
          id?: string
          method?: Database["public"]["Enums"]["checkin_method"]
          ticket_id: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by?: string | null
          event_id?: string
          id?: string
          method?: Database["public"]["Enums"]["checkin_method"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_members: {
        Row: {
          chapter_id: string
          commission_id: number
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          role: Database["public"]["Enums"]["commission_role"]
          term_semester: number
          term_year: number
          updated_at: string
        }
        Insert: {
          chapter_id: string
          commission_id: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          role?: Database["public"]["Enums"]["commission_role"]
          term_semester: number
          term_year: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          commission_id?: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          role?: Database["public"]["Enums"]["commission_role"]
          term_semester?: number
          term_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_members_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_members_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          chapter_id: string | null
          code: string
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          chapter_id?: string | null
          code: string
          id?: number
          label: string
          sort_order?: number
        }
        Update: {
          chapter_id?: string | null
          code?: string
          id?: number
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      event_finance_categories: {
        Row: {
          chapter_id: string
          created_at: string
          event_id: string
          id: string
          name: string
          name_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          name_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          name_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_finance_categories_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_finance_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_finance_items: {
        Row: {
          active: boolean
          category_id: string
          chapter_id: string
          created_at: string
          event_id: string
          id: string
          name: string
          name_key: string
          stock_qty: number | null
          track_stock: boolean
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          chapter_id: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          name_key: string
          stock_qty?: number | null
          track_stock?: boolean
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          chapter_id?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          name_key?: string
          stock_qty?: number | null
          track_stock?: boolean
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_finance_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_finance_items_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_finance_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          capacity: number
          created_at: string
          event_id: string
          id: string
          label: string
          pos_x: number
          pos_y: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          event_id: string
          id?: string
          label: string
          pos_x?: number
          pos_y?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          pos_x?: number
          pos_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_items: {
        Row: {
          amount: number
          cash_entry_id: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          item_id: string
          qty: number
          ticket_id: string
          unit_price: number
        }
        Insert: {
          amount: number
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          item_id: string
          qty?: number
          ticket_id: string
          unit_price: number
        }
        Update: {
          amount?: number
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          item_id?: string
          qty?: number
          ticket_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_items_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ticket_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ticket_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_finance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          goal_amount: number
          id: string
          location: string | null
          name: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          ticket_artwork_url: string | null
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_amount?: number
          id?: string
          location?: string | null
          name: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_artwork_url?: string | null
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal_amount?: number
          id?: string
          location?: string | null
          name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_artwork_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          cpf_encrypted: string | null
          cpf_last2: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          member_id: string
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          cpf_encrypted?: string | null
          cpf_last2?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          member_id: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          cpf_encrypted?: string | null
          cpf_last2?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          member_id?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitality_duties: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          duty_date: string
          id: string
          member_id: string
          notes: string | null
          role_label: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          duty_date?: string
          id?: string
          member_id: string
          notes?: string | null
          role_label?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          duty_date?: string
          id?: string
          member_id?: string
          notes?: string | null
          role_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitality_duties_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospitality_duties_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitality_menus: {
        Row: {
          calendar_event_id: string | null
          chapter_id: string
          created_at: string
          created_by: string | null
          estimated_cost: number
          id: string
          items: string | null
          menu_date: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          chapter_id: string
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          items?: string | null
          menu_date?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          estimated_cost?: number
          id?: string
          items?: string | null
          menu_date?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitality_menus_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospitality_menus_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_files: {
        Row: {
          address: Json
          candidate_birth_date: string | null
          candidate_email: string | null
          candidate_name: string
          candidate_phone: string | null
          celular: string | null
          chapter_id: string
          cpf: string | null
          cpf_encrypted: string | null
          cpf_hash: string | null
          cpf_last2: string | null
          created_at: string
          created_by: string | null
          demolay_relative_chapter: string | null
          demolay_relative_name: string | null
          doc_cpf_back_path: string | null
          doc_cpf_front_path: string | null
          doc_rg_back_path: string | null
          doc_rg_front_path: string | null
          guardian_name: string | null
          guardians: Json
          has_demolay_relative: boolean
          has_mason_relative: boolean
          id: string
          lgpd_consent_text_version: string | null
          lgpd_consented_at: string | null
          mason_relative_lodge: string | null
          mason_relative_name: string | null
          notes: string | null
          opinion: string | null
          referred_by: string | null
          rg: string | null
          rg_encrypted: string | null
          rg_last2: string | null
          signup_source: string
          sponsor_member_id: string | null
          sponsor_meta: Json
          sponsor_text: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          updated_at: string
        }
        Insert: {
          address?: Json
          candidate_birth_date?: string | null
          candidate_email?: string | null
          candidate_name: string
          candidate_phone?: string | null
          celular?: string | null
          chapter_id: string
          cpf?: string | null
          cpf_encrypted?: string | null
          cpf_hash?: string | null
          cpf_last2?: string | null
          created_at?: string
          created_by?: string | null
          demolay_relative_chapter?: string | null
          demolay_relative_name?: string | null
          doc_cpf_back_path?: string | null
          doc_cpf_front_path?: string | null
          doc_rg_back_path?: string | null
          doc_rg_front_path?: string | null
          guardian_name?: string | null
          guardians?: Json
          has_demolay_relative?: boolean
          has_mason_relative?: boolean
          id?: string
          lgpd_consent_text_version?: string | null
          lgpd_consented_at?: string | null
          mason_relative_lodge?: string | null
          mason_relative_name?: string | null
          notes?: string | null
          opinion?: string | null
          referred_by?: string | null
          rg?: string | null
          rg_encrypted?: string | null
          rg_last2?: string | null
          signup_source?: string
          sponsor_member_id?: string | null
          sponsor_meta?: Json
          sponsor_text?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Update: {
          address?: Json
          candidate_birth_date?: string | null
          candidate_email?: string | null
          candidate_name?: string
          candidate_phone?: string | null
          celular?: string | null
          chapter_id?: string
          cpf?: string | null
          cpf_encrypted?: string | null
          cpf_hash?: string | null
          cpf_last2?: string | null
          created_at?: string
          created_by?: string | null
          demolay_relative_chapter?: string | null
          demolay_relative_name?: string | null
          doc_cpf_back_path?: string | null
          doc_cpf_front_path?: string | null
          doc_rg_back_path?: string | null
          doc_rg_front_path?: string | null
          guardian_name?: string | null
          guardians?: Json
          has_demolay_relative?: boolean
          has_mason_relative?: boolean
          id?: string
          lgpd_consent_text_version?: string | null
          lgpd_consented_at?: string | null
          mason_relative_lodge?: string | null
          mason_relative_name?: string | null
          notes?: string | null
          opinion?: string | null
          referred_by?: string | null
          rg?: string | null
          rg_encrypted?: string | null
          rg_last2?: string | null
          signup_source?: string
          sponsor_member_id?: string | null
          sponsor_meta?: Json
          sponsor_text?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_files_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_files_sponsor_member_id_fkey"
            columns: ["sponsor_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_processes: {
        Row: {
          chapter_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          file_id: string | null
          id: string
          opened_at: string
          opinion: string | null
          responsible_member_id: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          opened_at?: string
          opinion?: string | null
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          opened_at?: string
          opinion?: string | null
          responsible_member_id?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_processes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_processes_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "investigation_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_processes_responsible_member_id_fkey"
            columns: ["responsible_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_public_attempts: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          kind: string
          sender_key: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          kind: string
          sender_key: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          kind?: string
          sender_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_public_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consents: {
        Row: {
          consent_text_version: string
          created_at: string
          guardian_id: string | null
          id: string
          ip: unknown
          member_id: string
          signed_at: string
          signed_by_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          consent_text_version: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          ip?: unknown
          member_id: string
          signed_at?: string
          signed_by_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_text_version?: string
          created_at?: string
          guardian_id?: string | null
          id?: string
          ip?: unknown
          member_id?: string
          signed_at?: string
          signed_by_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consents_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_consents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_affiliation_requests: {
        Row: {
          created_at: string
          id: string
          member_id: string
          origin_chapter_id: string
          requested_by: string
          requesting_chapter_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["member_change_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          origin_chapter_id: string
          requested_by: string
          requesting_chapter_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["member_change_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          origin_chapter_id?: string
          requested_by?: string
          requesting_chapter_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["member_change_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_affiliation_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_affiliation_requests_origin_chapter_id_fkey"
            columns: ["origin_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_affiliation_requests_requesting_chapter_id_fkey"
            columns: ["requesting_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      member_away_periods: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          ended_on: string | null
          id: string
          member_id: string
          started_on: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          id?: string
          member_id: string
          started_on: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          id?: string
          member_id?: string
          started_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_away_periods_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_away_periods_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_change_requests: {
        Row: {
          changes: Json
          created_at: string
          id: string
          member_id: string
          origin_chapter_id: string
          requested_by: string
          requesting_chapter_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["member_change_request_status"]
          updated_at: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          id?: string
          member_id: string
          origin_chapter_id: string
          requested_by: string
          requesting_chapter_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["member_change_request_status"]
          updated_at?: string
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          member_id?: string
          origin_chapter_id?: string
          requested_by?: string
          requesting_chapter_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["member_change_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_change_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_change_requests_origin_chapter_id_fkey"
            columns: ["origin_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_change_requests_requesting_chapter_id_fkey"
            columns: ["requesting_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      member_chapter_affiliations: {
        Row: {
          active: boolean
          chapter_id: string
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          left_at: string | null
          member_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          chapter_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          member_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_chapter_affiliations_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_chapter_affiliations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_charge_payments: {
        Row: {
          amount: number
          cash_entry_id: string | null
          chapter_id: string
          charge_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          cash_entry_id?: string | null
          chapter_id: string
          charge_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string | null
          chapter_id?: string
          charge_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_charge_payments_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_charge_payments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_charge_payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "member_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      member_charges: {
        Row: {
          amount: number
          cash_entry_id: string | null
          category: string
          chapter_id: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          kind: Database["public"]["Enums"]["cash_entry_kind"]
          member_id: string
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["due_status"]
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          cash_entry_id?: string | null
          category?: string
          chapter_id: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["cash_entry_kind"]
          member_id: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["due_status"]
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string | null
          category?: string
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["cash_entry_kind"]
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["due_status"]
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_charges_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_charges_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_charges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dues: {
        Row: {
          amount: number
          cash_entry_id: string | null
          chapter_id: string
          competence_month: number
          competence_year: number
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["due_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          cash_entry_id?: string | null
          chapter_id: string
          competence_month: number
          competence_year: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["due_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string | null
          chapter_id?: string
          competence_month?: number
          competence_year?: number
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["due_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_dues_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dues_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dues_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dues_manual_inclusions: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          year: number
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          year: number
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_dues_manual_inclusions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dues_manual_inclusions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_positions: {
        Row: {
          chapter_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          ends_on: string | null
          id: string
          member_id: string
          notes: string | null
          position_id: number
          region_id: string | null
          starts_on: string | null
          term_semester: number
          term_year: number
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          ends_on?: string | null
          id?: string
          member_id: string
          notes?: string | null
          position_id: number
          region_id?: string | null
          starts_on?: string | null
          term_semester: number
          term_year: number
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          ends_on?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          position_id?: number
          region_id?: string | null
          starts_on?: string | null
          term_semester?: number
          term_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_positions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_positions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_positions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: Json
          birth_date: string | null
          chapter_id: string
          cpf_encrypted: string | null
          cpf_last2: string | null
          created_at: string
          created_by: string | null
          demolay_id: string | null
          doc_cpf_back_path: string | null
          doc_cpf_front_path: string | null
          doc_rg_back_path: string | null
          doc_rg_front_path: string | null
          email: string | null
          exam_grau_demolay: string | null
          exam_grau_iniciatico: string | null
          full_name: string
          id: string
          iniciacao_grau_demolay: string | null
          iniciacao_ordem: string | null
          initiation_chapter_id: string | null
          kind: Database["public"]["Enums"]["member_kind"]
          masonic_id: string | null
          phone: string | null
          rg_encrypted: string | null
          rg_last2: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: Json
          birth_date?: string | null
          chapter_id: string
          cpf_encrypted?: string | null
          cpf_last2?: string | null
          created_at?: string
          created_by?: string | null
          demolay_id?: string | null
          doc_cpf_back_path?: string | null
          doc_cpf_front_path?: string | null
          doc_rg_back_path?: string | null
          doc_rg_front_path?: string | null
          email?: string | null
          exam_grau_demolay?: string | null
          exam_grau_iniciatico?: string | null
          full_name: string
          id?: string
          iniciacao_grau_demolay?: string | null
          iniciacao_ordem?: string | null
          initiation_chapter_id?: string | null
          kind?: Database["public"]["Enums"]["member_kind"]
          masonic_id?: string | null
          phone?: string | null
          rg_encrypted?: string | null
          rg_last2?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: Json
          birth_date?: string | null
          chapter_id?: string
          cpf_encrypted?: string | null
          cpf_last2?: string | null
          created_at?: string
          created_by?: string | null
          demolay_id?: string | null
          doc_cpf_back_path?: string | null
          doc_cpf_front_path?: string | null
          doc_rg_back_path?: string | null
          doc_rg_front_path?: string | null
          email?: string | null
          exam_grau_demolay?: string | null
          exam_grau_iniciatico?: string | null
          full_name?: string
          id?: string
          iniciacao_grau_demolay?: string | null
          iniciacao_ordem?: string | null
          initiation_chapter_id?: string | null
          kind?: Database["public"]["Enums"]["member_kind"]
          masonic_id?: string | null
          phone?: string | null
          rg_encrypted?: string | null
          rg_last2?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_initiation_chapter_id_fkey"
            columns: ["initiation_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_approvals: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          minute_id: string
          signed_at: string
          signer_role: Database["public"]["Enums"]["minute_signer_role"]
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          minute_id: string
          signed_at?: string
          signer_role: Database["public"]["Enums"]["minute_signer_role"]
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          minute_id?: string
          signed_at?: string
          signer_role?: Database["public"]["Enums"]["minute_signer_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minute_approvals_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minute_approvals_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "session_minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_public_votes: {
        Row: {
          chapter_id: string
          created_at: string
          decision: Database["public"]["Enums"]["minute_public_vote_decision"]
          email: string
          id: string
          justification: string | null
          minute_id: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["minute_public_vote_decision"]
          email: string
          id?: string
          justification?: string | null
          minute_id: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["minute_public_vote_decision"]
          email?: string
          id?: string
          justification?: string | null
          minute_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minute_public_votes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minute_public_votes_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "session_minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      minute_templates: {
        Row: {
          body: string
          chapter_id: string
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          chapter_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          chapter_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minute_templates_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      org_leaderships: {
        Row: {
          active: boolean
          created_at: string
          ends_on: string | null
          id: string
          org_role: Database["public"]["Enums"]["org_role"]
          region_id: string | null
          starts_on: string | null
          state_id: string | null
          term_semester: number | null
          term_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_on?: string | null
          id?: string
          org_role: Database["public"]["Enums"]["org_role"]
          region_id?: string | null
          starts_on?: string | null
          state_id?: string | null
          term_semester?: number | null
          term_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_on?: string | null
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          region_id?: string | null
          starts_on?: string | null
          state_id?: string | null
          term_semester?: number | null
          term_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_leaderships_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_leaderships_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_leaderships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          code: string
          id: number
          label: string
          scope: string
          sort_order: number
        }
        Insert: {
          code: string
          id: number
          label: string
          scope?: string
          sort_order?: number
        }
        Update: {
          code?: string
          id?: number
          label?: string
          scope?: string
          sort_order?: number
        }
        Relationships: []
      }
      proficiency_cards: {
        Row: {
          chapter_id: string
          consultor_signature_url: string | null
          created_at: string
          id: string
          issued_at: string
          issued_by: string
          member_id: string
          member_signature_url: string | null
          note: string | null
          photo_url: string | null
          prof_demolay: string | null
          prof_iniciatico: string | null
          qr_url: string | null
          registro_scdb: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          updated_at: string
          valid_until: string | null
          verification_code: string
        }
        Insert: {
          chapter_id: string
          consultor_signature_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by: string
          member_id: string
          member_signature_url?: string | null
          note?: string | null
          photo_url?: string | null
          prof_demolay?: string | null
          prof_iniciatico?: string | null
          qr_url?: string | null
          registro_scdb?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          verification_code: string
        }
        Update: {
          chapter_id?: string
          consultor_signature_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string
          member_id?: string
          member_signature_url?: string | null
          note?: string | null
          photo_url?: string | null
          prof_demolay?: string | null
          prof_iniciatico?: string | null
          qr_url?: string | null
          registro_scdb?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "proficiency_cards_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_cards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proficiency_cards_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_chapter_id: string | null
          created_at: string
          full_name: string | null
          id: string
          must_change_password: boolean
          phone: string | null
        }
        Insert: {
          active_chapter_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          must_change_password?: boolean
          phone?: string | null
        }
        Update: {
          active_chapter_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_chapter_id_fkey"
            columns: ["active_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string
          settings: Json
          state_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          settings?: Json
          state_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          settings?: Json
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: number
          label: string
          name: string
        }
        Insert: {
          id: number
          label: string
          name: string
        }
        Update: {
          id?: number
          label?: string
          name?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          created_at: string
          id: string
          seat_number: number
          table_id: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          seat_number: number
          table_id: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          seat_number?: number
          table_id?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      session_minutes: {
        Row: {
          calendar_event_id: string
          chapter_id: string
          content: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["minute_kind"]
          opened_at: string
          opened_by: string | null
          public_share_token: string | null
          status: Database["public"]["Enums"]["minute_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          calendar_event_id: string
          chapter_id: string
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["minute_kind"]
          opened_at?: string
          opened_by?: string | null
          public_share_token?: string | null
          status?: Database["public"]["Enums"]["minute_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string
          chapter_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["minute_kind"]
          opened_at?: string
          opened_by?: string | null
          public_share_token?: string | null
          status?: Database["public"]["Enums"]["minute_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_minutes_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_minutes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_details: {
        Row: {
          calendar_event_id: string
          chapter_id: string
          clerk_member_id: string | null
          clerk_text: string | null
          created_at: string
          file_id: string | null
          investigator_member_id: string | null
          investigator_text: string | null
          nominee_name: string
          opinion: string | null
          senior_member_id: string | null
          senior_text: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          updated_at: string
        }
        Insert: {
          calendar_event_id: string
          chapter_id: string
          clerk_member_id?: string | null
          clerk_text?: string | null
          created_at?: string
          file_id?: string | null
          investigator_member_id?: string | null
          investigator_text?: string | null
          nominee_name?: string
          opinion?: string | null
          senior_member_id?: string | null
          senior_text?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string
          chapter_id?: string
          clerk_member_id?: string | null
          clerk_text?: string | null
          created_at?: string
          file_id?: string | null
          investigator_member_id?: string | null
          investigator_text?: string | null
          nominee_name?: string
          opinion?: string | null
          senior_member_id?: string | null
          senior_text?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_details_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_details_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_details_clerk_member_id_fkey"
            columns: ["clerk_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_details_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "investigation_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_details_investigator_member_id_fkey"
            columns: ["investigator_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_details_senior_member_id_fkey"
            columns: ["senior_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_minutes: {
        Row: {
          age_band: string
          answers: Json
          calendar_event_id: string
          chapter_id: string
          completed_at: string | null
          created_at: string
          signatures: Json
          updated_at: string
        }
        Insert: {
          age_band: string
          answers?: Json
          calendar_event_id: string
          chapter_id: string
          completed_at?: string | null
          created_at?: string
          signatures?: Json
          updated_at?: string
        }
        Update: {
          age_band?: string
          answers?: Json
          calendar_event_id?: string
          chapter_id?: string
          completed_at?: string | null
          created_at?: string
          signatures?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_minutes_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: true
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_minutes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      sindicancia_votes: {
        Row: {
          calendar_event_id: string
          chapter_id: string
          created_at: string
          id: string
          member_id: string
          updated_at: string
          vote: string
        }
        Insert: {
          calendar_event_id: string
          chapter_id: string
          created_at?: string
          id?: string
          member_id: string
          updated_at?: string
          vote: string
        }
        Update: {
          calendar_event_id?: string
          chapter_id?: string
          created_at?: string
          id?: string
          member_id?: string
          updated_at?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "sindicancia_votes_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "sindicancia_details"
            referencedColumns: ["calendar_event_id"]
          },
          {
            foreignKeyName: "sindicancia_votes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicancia_votes_event_chapter_fkey"
            columns: ["calendar_event_id", "chapter_id"]
            isOneToOne: false
            referencedRelation: "sindicancia_details"
            referencedColumns: ["calendar_event_id", "chapter_id"]
          },
          {
            foreignKeyName: "sindicancia_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          created_at: string
          id: string
          name: string
          uf: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          uf: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity_total: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          quantity_total?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity_total?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          buyer_email: string | null
          buyer_member_id: string | null
          buyer_name: string
          created_at: string
          event_id: string
          id: string
          price_paid: number
          qr_code: string
          seller_charge_id: string | null
          seller_member_id: string | null
          sold_at: string
          sold_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_member_id?: string | null
          buyer_name: string
          created_at?: string
          event_id: string
          id?: string
          price_paid?: number
          qr_code?: string
          seller_charge_id?: string | null
          seller_member_id?: string | null
          sold_at?: string
          sold_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_email?: string | null
          buyer_member_id?: string | null
          buyer_name?: string
          created_at?: string
          event_id?: string
          id?: string
          price_paid?: number
          qr_code?: string
          seller_charge_id?: string | null
          seller_member_id?: string | null
          sold_at?: string
          sold_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_buyer_member_id_fkey"
            columns: ["buyer_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_seller_charge_id_fkey"
            columns: ["seller_charge_id"]
            isOneToOne: false
            referencedRelation: "member_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_seller_member_id_fkey"
            columns: ["seller_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_event_ticket_item: {
        Args: {
          _description?: string
          _item_id: string
          _qty?: number
          _ticket_id: string
          _unit_price?: number
        }
        Returns: Json
      }
      add_member_guardian: {
        Args: { _guardian: Json; _member_id: string }
        Returns: string
      }
      affiliate_member_to_chapter: {
        Args: { _chapter_id: string; _member_id: string }
        Returns: string
      }
      auth_member_id_in_chapter: {
        Args: { _chapter_id: string }
        Returns: string
      }
      can_cast_sindicancia_vote: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_lead_chapter: { Args: { _chapter_id: string }; Returns: boolean }
      can_manage_cash_share: { Args: { _chapter_id: string }; Returns: boolean }
      can_manage_commission: {
        Args: { _chapter_id: string; _commission_code: string }
        Returns: boolean
      }
      can_manage_dues_share: { Args: { _chapter_id: string }; Returns: boolean }
      can_manage_investigation_signup: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_manage_minute_public_share: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_manage_public_lobby: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_manage_region_chapter: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_read_chapter: { Args: { _chapter_id: string }; Returns: boolean }
      can_read_member: { Args: { _member_id: string }; Returns: boolean }
      can_read_sindicancia_votes: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_reveal_id_documents: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      can_write_chapter_in_scope: {
        Args: { _region_id: string; _state_id: string }
        Returns: boolean
      }
      can_write_member_documents: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      checkout_event_ticket_comanda: {
        Args: {
          _event_id: string
          _paid_at?: string
          _ticket_id: string
          _amount?: number
        }
        Returns: Json
      }
      pay_event_ticket_item: {
        Args: { _line_id: string; _paid_at?: string }
        Returns: Json
      }
      cleanup_investigation_public_attempts: { Args: never; Returns: undefined }
      create_event_table_with_seats: {
        Args: { _capacity: number; _event_id: string; _label: string }
        Returns: string
      }
      create_member_with_pii: {
        Args: {
          _address: Json
          _birth_date: string
          _chapter_id: string
          _consent_text_version: string
          _cpf: string
          _demolay_id?: string
          _email: string
          _exam_grau_demolay?: string
          _exam_grau_iniciatico?: string
          _full_name: string
          _guardian: Json
          _iniciacao_grau_demolay?: string
          _iniciacao_ordem?: string
          _initiation_chapter_id?: string
          _kind: Database["public"]["Enums"]["member_kind"]
          _masonic_id?: string
          _phone: string
          _rg: string
          _status: Database["public"]["Enums"]["member_status"]
        }
        Returns: string
      }
      current_term_semester: { Args: never; Returns: number }
      current_term_year: { Args: never; Returns: number }
      decrypt_pii: { Args: { _cipher: string }; Returns: string }
      delete_event_ticket: { Args: { _ticket_id: string }; Returns: Json }
      delete_event_ticket_item: { Args: { _line_id: string }; Returns: Json }
      desligar_open_dues_from: {
        Args: { _from: string; _member_id: string }
        Returns: number
      }
      encrypt_pii: { Args: { _plain: string }; Returns: string }
      ensure_cash_share_token: {
        Args: { _chapter_id: string; _regenerate?: boolean }
        Returns: string
      }
      ensure_dues_share_token: {
        Args: { _chapter_id: string; _regenerate?: boolean }
        Returns: string
      }
      ensure_investigation_signup_token: {
        Args: { _chapter_id: string; _rotate?: boolean }
        Returns: string
      }
      ensure_minute_public_share_token: {
        Args: { _minute_id: string; _regenerate?: boolean }
        Returns: string
      }
      ensure_public_lobby_token: {
        Args: { _chapter_id: string; _regenerate?: boolean }
        Returns: string
      }
      finance_name_key: { Args: { p_name: string }; Returns: string }
      get_cash_share_token: { Args: { _chapter_id: string }; Returns: string }
      get_dues_share_token: { Args: { _chapter_id: string }; Returns: string }
      get_id_document_path: {
        Args: { _doc_kind: string; _entity: string; _id: string }
        Returns: string
      }
      get_investigation_signup_token: {
        Args: { _chapter_id: string }
        Returns: string
      }
      get_minute_public_share_token: {
        Args: { _minute_id: string }
        Returns: string
      }
      get_public_attendance_overview: {
        Args: { _token: string; _year: number }
        Returns: Json
      }
      get_public_cash_flow: {
        Args: { _month?: number; _token: string; _year: number }
        Returns: Json
      }
      get_public_lobby: { Args: { _token: string }; Returns: Json }
      get_public_lobby_token: { Args: { _chapter_id: string }; Returns: string }
      get_public_member_portal: {
        Args: { _demolay_id: string; _token: string; _year: number }
        Returns: Json
      }
      get_public_minute: {
        Args: { _password: string; _token: string }
        Returns: Json
      }
      get_public_minute_by_member: {
        Args: { _demolay_id: string; _token: string }
        Returns: Json
      }
      get_public_year_dues: {
        Args: { _token: string; _year: number }
        Returns: Json
      }
      has_any_role: {
        Args: { _chapter_id: string; _role_names: string[] }
        Returns: boolean
      }
      has_commission_role: {
        Args: {
          _chapter_id: string
          _commission_code: string
          _roles?: string[]
        }
        Returns: boolean
      }
      has_current_position: {
        Args: { _chapter_id: string; _codes: string[] }
        Returns: boolean
      }
      has_permission: {
        Args: { _chapter_id: string; _perm: string }
        Returns: boolean
      }
      has_role: {
        Args: { _chapter_id: string; _role_name: string }
        Returns: boolean
      }
      is_active_region_office: {
        Args: {
          _region_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_chapter_member: { Args: { _chapter_id: string }; Returns: boolean }
      is_commission_member: {
        Args: { _chapter_id: string; _commission_code: string }
        Returns: boolean
      }
      is_commission_president: {
        Args: { _chapter_id: string; _commission_code: string }
        Returns: boolean
      }
      is_gme: { Args: { _state_id: string }; Returns: boolean }
      is_linked_member: { Args: { _member_id: string }; Returns: boolean }
      is_region_leader: { Args: { _chapter_id: string }; Returns: boolean }
      is_state_leader: { Args: { _chapter_id: string }; Returns: boolean }
      list_chapters_for_select: {
        Args: never
        Returns: {
          city: string
          id: string
          name: string
          number: string
        }[]
      }
      list_investigation_signup_members: {
        Args: { _search?: string; _token: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      lookup_lobby_member_cadastro: {
        Args: { _demolay_id: string; _token: string }
        Returns: Json
      }
      lookup_member_by_demolay_id: {
        Args: { _demolay_id: string; _for_chapter_id: string }
        Returns: Json
      }
      lookup_member_cadastro_by_demolay_id: {
        Args: { _demolay_id: string }
        Returns: Json
      }
      member_can_access_minute_kind: {
        Args: {
          _exam_grau_demolay: string
          _exam_grau_iniciatico: string
          _iniciacao_grau_demolay: string
          _iniciacao_ordem: string
          _kind: Database["public"]["Enums"]["member_kind"]
          _minute_kind: Database["public"]["Enums"]["minute_kind"]
        }
        Returns: boolean
      }
      member_visible_in_chapter: {
        Args: { _chapter_id: string; _member_id: string }
        Returns: boolean
      }
      migrate_investigation_docs_to_member: {
        Args: { _file_id: string; _member_id: string }
        Returns: undefined
      }
      minute_expected_public_password: {
        Args: {
          _kind: Database["public"]["Enums"]["minute_kind"]
          _settings: Json
        }
        Returns: string
      }
      my_org_state_ids: { Args: never; Returns: string[] }
      patch_chapter_settings: {
        Args: { _chapter_id: string; _patch: Json }
        Returns: Json
      }
      peek_public_minute: { Args: { _token: string }; Returns: Json }
      recalc_member_status: { Args: { _chapter_id?: string }; Returns: number }
      record_investigation_public_attempt: {
        Args: {
          _chapter_limit?: number
          _client_ip?: string
          _cpf?: string
          _kind: string
          _sender_limit?: number
          _token: string
          _window_minutes?: number
        }
        Returns: undefined
      }
      resolve_investigation_signup_chapter: {
        Args: { _token: string }
        Returns: {
          city: string
          id: string
          logo_url: string
          name: string
          number: string
          primary_color: string
        }[]
      }
      resolve_lobby_chapter_by_token: {
        Args: { _token: string }
        Returns: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          lgpd_officer_contact: string | null
          lgpd_officer_name: string | null
          logo_url: string | null
          name: string
          number: string
          primary_color: string
          region_id: string | null
          settings: Json
          state_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chapters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_public_chapter_by_token: {
        Args: { _token: string }
        Returns: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          lgpd_officer_contact: string | null
          lgpd_officer_name: string | null
          logo_url: string | null
          name: string
          number: string
          primary_color: string
          region_id: string | null
          settings: Json
          state_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "chapters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reveal_investigation_pii: {
        Args: { _field: string; _file_id: string }
        Returns: string
      }
      reveal_member_pii: {
        Args: { _field: string; _member_id: string }
        Returns: string
      }
      review_member_affiliation_request: {
        Args: { _decision: string; _request_id: string; _review_note?: string }
        Returns: string
      }
      revoke_cash_share_token: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      revoke_dues_share_token: {
        Args: { _chapter_id: string }
        Returns: boolean
      }
      revoke_investigation_signup_token: {
        Args: { _chapter_id: string }
        Returns: undefined
      }
      revoke_minute_public_share_token: {
        Args: { _minute_id: string }
        Returns: boolean
      }
      revoke_public_lobby_token: {
        Args: { _chapter_id: string }
        Returns: undefined
      }
      save_default_dues_amount: {
        Args: { _amount: number; _chapter_id: string }
        Returns: number
      }
      sell_event_tickets_with_charges: {
        Args: {
          _buyer_email: string
          _buyer_name: string
          _event_id: string
          _price_paid: number
          _quantity: number
          _seller_member_id: string
          _ticket_type_id: string
        }
        Returns: Json
      }
      shares_chapter_with: { Args: { _other_user: string }; Returns: boolean }
      sindicancia_vote_totals: {
        Args: { _calendar_event_id: string }
        Returns: {
          aprovada: number
          reprovada: number
          total: number
        }[]
      }
      storage_chapter_uuid: { Args: { object_name: string }; Returns: string }
      submit_investigation_signup: {
        Args: {
          _address: Json
          _candidate_birth_date: string
          _candidate_email: string
          _candidate_name: string
          _candidate_phone: string
          _celular: string
          _cpf: string
          _demolay_relative_chapter: string
          _demolay_relative_name: string
          _doc_cpf_back_path?: string
          _doc_cpf_front_path?: string
          _doc_rg_back_path: string
          _doc_rg_front_path: string
          _guardians: Json
          _has_demolay_relative: boolean
          _has_mason_relative: boolean
          _lgpd_consent_text_version?: string
          _mason_relative_lodge: string
          _mason_relative_name: string
          _notes: string
          _rg: string
          _sponsor_member_id: string
          _sponsor_meta?: Json
          _sponsor_text: string
          _temp_id?: string
          _token: string
        }
        Returns: string
      }
      submit_lobby_member_cadastro: {
        Args: {
          _address?: Json
          _cpf?: string
          _demolay_id: string
          _email?: string
          _guardians?: Json
          _phone?: string
          _rg?: string
          _token: string
        }
        Returns: Json
      }
      submit_member_cadastro_update: {
        Args: {
          _address?: Json
          _cpf?: string
          _demolay_id: string
          _email?: string
          _guardians?: Json
          _phone?: string
          _rg?: string
        }
        Returns: Json
      }
      submit_public_minute_vote: {
        Args: {
          _decision: string
          _demolay_id?: string
          _email: string
          _justification?: string
          _password: string
          _token: string
        }
        Returns: Json
      }
      transfer_region_office:
        | {
            Args: {
              _org_role: Database["public"]["Enums"]["org_role"]
              _region_id: string
              _target_member_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _org_role: Database["public"]["Enums"]["org_role"]
              _region_id: string
              _starts_on?: string
              _target_member_id: string
            }
            Returns: Json
          }
      update_event_ticket_item: {
        Args: { _line_id: string; _qty?: number; _unit_price?: number }
        Returns: Json
      }
      update_member_with_pii: {
        Args: {
          _address: Json
          _birth_date: string
          _cpf: string
          _demolay_id?: string
          _email: string
          _exam_grau_demolay?: string
          _exam_grau_iniciatico?: string
          _full_name: string
          _guardians?: Json
          _iniciacao_grau_demolay?: string
          _iniciacao_ordem?: string
          _initiation_chapter_id?: string
          _kind: Database["public"]["Enums"]["member_kind"]
          _masonic_id?: string
          _member_id: string
          _phone: string
          _rg: string
          _status: Database["public"]["Enums"]["member_status"]
        }
        Returns: string
      }
    }
    Enums: {
      attendance_status: "presente" | "ausente"
      calendar_event_type:
        | "sessao_ritualistica"
        | "evento"
        | "filantropia"
        | "entretenimento"
        | "sessao_administrativa"
        | "sindicancia"
      cash_entry_kind: "entrada" | "saida"
      checkin_method: "qr" | "nome"
      commission_role: "presidente" | "vice" | "membro" | "auxiliar_senior"
      due_status: "em_aberto" | "pago" | "isento" | "desligado"
      event_status: "rascunho" | "publicado" | "encerrado"
      investigation_status:
        | "aberta"
        | "em_andamento"
        | "aprovada"
        | "reprovada"
        | "arquivada"
        | "votacao_comissao"
      member_change_request_status: "pending" | "approved" | "rejected"
      member_kind: "demolay_ativo" | "senior" | "macom"
      member_status: "regular" | "irregular"
      minute_kind: "publica" | "grau_iniciatico" | "grau_demolay"
      minute_public_vote_decision: "aprovada" | "reprovada"
      minute_signer_role:
        | "presidente_conselho"
        | "mestre_conselheiro"
        | "escrivao"
      minute_status: "rascunho" | "em_revisao" | "aprovada"
      org_role: "gme" | "mce" | "mcr" | "oe"
      ticket_status: "valido" | "cancelado" | "usado"
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
      attendance_status: ["presente", "ausente"],
      calendar_event_type: [
        "sessao_ritualistica",
        "evento",
        "filantropia",
        "entretenimento",
        "sessao_administrativa",
        "sindicancia",
      ],
      cash_entry_kind: ["entrada", "saida"],
      checkin_method: ["qr", "nome"],
      commission_role: ["presidente", "vice", "membro", "auxiliar_senior"],
      due_status: ["em_aberto", "pago", "isento", "desligado"],
      event_status: ["rascunho", "publicado", "encerrado"],
      investigation_status: [
        "aberta",
        "em_andamento",
        "aprovada",
        "reprovada",
        "arquivada",
        "votacao_comissao",
      ],
      member_change_request_status: ["pending", "approved", "rejected"],
      member_kind: ["demolay_ativo", "senior", "macom"],
      member_status: ["regular", "irregular"],
      minute_kind: ["publica", "grau_iniciatico", "grau_demolay"],
      minute_public_vote_decision: ["aprovada", "reprovada"],
      minute_signer_role: [
        "presidente_conselho",
        "mestre_conselheiro",
        "escrivao",
      ],
      minute_status: ["rascunho", "em_revisao", "aprovada"],
      org_role: ["gme", "mce", "mcr", "oe"],
      ticket_status: ["valido", "cancelado", "usado"],
    },
  },
} as const
