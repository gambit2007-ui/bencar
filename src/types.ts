export type FileRecord = {
  id: number;
  filename?: string;
  original_name: string;
  mime_type?: string;
  size?: number;
  url: string;
  created_at?: string;
};

export type Vehicle = {
  id: number;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate?: string;
  mileage: number;
  chassis?: string;
  purchase_date?: string;
  purchase_value: number;
  acquisition_source?: string;
  fipe_value?: number;
  sale_value: number;
  status: string;
  description?: string;
  image_url?: string;
  created_at?: string;
  has_checklist?: boolean;
  files?: FileRecord[];
};

export type Client = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  rg?: string;
  address?: string;
  created_at?: string;
  files?: FileRecord[];
};

export type Sale = {
  id: number;
  vehicle_id: number;
  client_id?: number | null;
  sale_date: string;
  sale_price: number;
  payment_method?: string;
  profit: number;
  notes?: string;
  created_at?: string;

  brand?: string;
  model?: string;
  plate?: string;
  client_name?: string;
};

export type Expense = {
  id: number;
  vehicle_id: number;
  description: string;
  amount: number;
  date: string;
  notes?: string;
  created_at?: string;

  brand?: string;
  model?: string;
  plate?: string;
};

export type Checklist = {
  id: number;
  vehicle_id: number;
  client_id?: number | null;
  observations?: string;
  media_urls?: string[];
  created_at?: string;
};

export type SaleChecklist = {
  id: number;
  vehicle_id: number;
  client_id: number;
  checklist_date: string;
  observations?: string;
  created_at?: string;

  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  client_name?: string;
  files?: FileRecord[];
};

export type DashboardStats = {
  stockCount: number;
  stockValue: number;
  stockSaleValue: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  cashValue: number;
  totalSales: number;
  totalPurchases: number;
  totalProfit: number;
};

export type MonthlyCashflowItem = {
  type: string;
  date: string;
  direction: "in" | "out";
  amount: number;
  description: string;
};

export type MonthlyReport = {
  month: string;
  revenue: number;
  expenses: number;
  purchases: number;
  grossProfit?: number;
  netProfit: number;
  cashBalance: number;
  salesDetails: Sale[];
  expenseDetails: Expense[];
  purchaseDetails: Vehicle[];
  cashflow: MonthlyCashflowItem[];
};
