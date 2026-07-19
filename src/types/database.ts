// טיפוסי בסיס הנתונים. מוגדרים ידנית לפי ה-migrations.
// בהמשך אפשר לייצר אוטומטית עם `supabase gen types typescript`.

export type UserRole = 'manager' | 'employee'
export type InvoiceStatus = 'pending' | 'confirmed'
export type StaffRole = 'waiter' | 'piccolo' | 'host' | 'bar' | 'shift_manager'
export type ShiftType = 'morning' | 'evening'

export interface Employee {
  id: string
  full_name: string
  phone: string | null
  hourly_rate: number | null
  active: boolean
  user_id: string | null
  avail_token: string
  created_at: string
}

export interface ShiftAvailability {
  id: string
  employee_id: string
  work_date: string
  shift: ShiftType
  available: boolean
  created_at: string
}

export interface EmployeeRole {
  employee_id: string
  role: StaffRole
}

export interface StaffingRequirement {
  id: string
  weekday: number | null
  shift: ShiftType
  role: StaffRole
  required_count: number
  created_at: string
}

export interface Availability {
  id: string
  employee_id: string
  weekday: number
  start_time: string | null
  end_time: string | null
  created_at: string
}

export interface AvailabilityException {
  id: string
  employee_id: string
  date: string
  type: 'off' | 'extra'
  start_time: string | null
  end_time: string | null
  created_at: string
}

export interface ShiftAssignment {
  id: string
  employee_id: string
  work_date: string
  shift: ShiftType
  role: StaffRole
  start_time: string | null
  end_time: string | null
  status: string
  created_at: string
}

export interface ProductCategory {
  id: string
  name: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  notes: string | null
  created_at: string
}

export interface Product {
  id: string
  canonical_name: string
  category_id: string | null
  default_unit: string | null
  created_at: string
}

export interface ProductAlias {
  id: string
  product_id: string
  alias_name: string
  supplier_id: string | null
  created_at: string
}

export interface Invoice {
  id: string
  supplier_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  image_path: string | null
  total_amount: number | null
  status: InvoiceStatus
  raw_extraction: unknown | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  product_id: string | null
  raw_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
  position: number
  created_at: string
}

export interface PricePoint {
  id: string
  product_id: string
  supplier_id: string | null
  invoice_id: string | null
  unit: string | null
  unit_price: number
  observed_at: string
  created_at: string
}

export interface PriceAlert {
  id: string
  product_id: string
  invoice_item_id: string | null
  previous_avg: number | null
  new_price: number | null
  pct_change: number | null
  acknowledged: boolean
  created_at: string
}

export interface Dish {
  id: string
  name: string
  category: string | null
  menu_price: number | null
  created_at: string
}

export interface RecipeItem {
  id: string
  dish_id: string
  product_id: string
  quantity: number
  unit: string | null
  created_at: string
}

// עזר לטיפוסי Supabase client (Row/Insert/Update/Relationships)
interface TableShape<T> {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; role: UserRole; created_at: string }
        Insert: {
          id: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
        Relationships: []
      }
      product_categories: TableShape<ProductCategory>
      suppliers: TableShape<Supplier>
      products: TableShape<Product>
      product_aliases: TableShape<ProductAlias>
      invoices: TableShape<Invoice>
      invoice_items: TableShape<InvoiceItem>
      price_points: TableShape<PricePoint>
      price_alerts: TableShape<PriceAlert>
      dishes: TableShape<Dish>
      recipe_items: TableShape<RecipeItem>
      employees: TableShape<Employee>
      employee_roles: TableShape<EmployeeRole>
      staffing_requirements: TableShape<StaffingRequirement>
      availability: TableShape<Availability>
      availability_exceptions: TableShape<AvailabilityException>
      shift_assignments: TableShape<ShiftAssignment>
    }
    Views: Record<string, never>
    Functions: {
      process_invoice_prices: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: UserRole
      invoice_status: InvoiceStatus
    }
  }
}
