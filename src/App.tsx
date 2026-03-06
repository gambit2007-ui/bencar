import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Car,
  ClipboardCheck,
  Users,
  Receipt,
  DollarSign,
  BarChart3,
  Menu,
  X,
  Plus,
  Search,
  TrendingUp,
  Calendar,
  ChevronRight,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  LogOut,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Login from './login';

/* =========================
   TYPES
========================= */

type FileRecord = {
  id: number;
  url: string;
  filename?: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  created_at?: string;
};

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate?: string | null;
  mileage?: number | null;
  purchase_date?: string | null;
  purchase_value: number;
  sale_value: number;
  status: string;
  description?: string | null;
  image_url?: string | null;
  has_checklist?: boolean;
};

type Client = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  rg?: string | null;
  address?: string | null;
};

type SaleRow = {
  id: number;
  vehicle_id: number;
  client_id?: number | null;
  sale_date: string;
  sale_price: number;
  payment_method?: string | null;
  profit?: number | null;
  notes?: string | null;
  brand?: string;
  model?: string;
  client_name?: string;
};

type ExpenseRow = {
  id: number;
  vehicle_id: number;
  description: string;
  amount: number;
  date: string;
  notes?: string | null;
  brand?: string;
  model?: string;
};

type ChecklistRow = {
  id: number;
  vehicle_id: number;
  observations?: string | null;
  media_urls?: string[] | null;
  created_at?: string;
};

type CashFlowItem = {
  type: string;
  date: string;
  direction: 'in' | 'out';
  amount: number;
  description: string;
};

type MonthlyReport = {
  month: string;
  revenue: number;
  expenses: number;
  purchases: number;
  grossProfit: number;
  netProfit: number;
  cashBalance: number;
  salesDetails: SaleRow[];
  expenseDetails: ExpenseRow[];
  purchaseDetails: Vehicle[];
  cashflow: CashFlowItem[];
};

type SaleChecklist = {
  id: number;
  vehicle_id: number;
  client_id: number;
  checklist_date: string;
  observations?: string | null;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_plate?: string | null;
  client_name?: string;
  files?: FileRecord[];
};

type DashboardStats = {
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

/* =========================
   HELPERS
========================= */

const STORAGE_BUCKET = 'uploads';

const num = (v: unknown) => Number(v || 0);

const formatYMD = (ymd?: string | null) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const toMonthLabel = (month: string) => {
  const [year, m] = month.split('-');
  const idx = Number(m) - 1;
  return `${monthNames[idx] || month} de ${year}`;
};

const monthKey = (date?: string | null) => (date || '').slice(0, 7);

const getPublicUrl = (path: string) => {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

async function uploadFilesToSupabase(
  entity: 'clients' | 'vehicles' | 'sale-checklists',
  id: number,
  files: File[],
): Promise<FileRecord[]> {
  if (!files.length) return [];

  const tableMap = {
    clients: 'client_files',
    vehicles: 'vehicle_files',
    'sale-checklists': 'sale_checklist_files',
  } as const;

  const fkField = {
    clients: 'client_id',
    vehicles: 'vehicle_id',
    'sale-checklists': 'checklist_id',
  } as const;

  const uploaded: FileRecord[] = [];

  for (const file of files) {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const filePath = `${entity}/${id}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const url = getPublicUrl(filePath);

    const insertPayload = {
      [fkField[entity]]: id,
      filename: filePath,
      original_name: file.name,
      mime_type: file.type,
      size: file.size,
      url,
    };

    const { data: inserted, error: insertError } = await supabase
      .from(tableMap[entity])
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) throw insertError;
    uploaded.push(inserted as FileRecord);
  }

  return uploaded;
}

/* =========================
   UI BITS
========================= */

const StatCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
}) => (
  <div className="bg-zinc-950 p-6 rounded-2xl shadow-lg border border-zinc-800 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${colorClass} shadow-lg shadow-black/20`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-zinc-400 font-medium">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const QuickAction = ({
  title,
  subtitle,
  icon: Icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="bg-zinc-950 p-6 rounded-2xl shadow-lg border border-zinc-800 flex flex-col items-center text-center gap-2 hover:bg-zinc-900 transition-colors group"
  >
    <div className="p-4 rounded-full bg-orange-600/15 group-hover:bg-orange-600/25 transition-colors">
      <Icon className="w-6 h-6 text-orange-400" />
    </div>
    <p className="font-semibold text-white">{title}</p>
    <p className="text-xs text-zinc-400">{subtitle}</p>
  </button>
);

const VehicleCard = ({
  vehicle,
  onEdit,
  onDelete,
  onChecklist,
}: {
  vehicle: Vehicle;
  onEdit: (v: Vehicle) => void;
  onDelete: (id: number) => void;
  onChecklist?: (v: Vehicle) => void;
}) => (
  <div className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
    <div className="relative h-48 bg-zinc-900">
      {vehicle.image_url ? (
        <img
          src={vehicle.image_url}
          alt={vehicle.model}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-300">
          <Car className="w-12 h-12" />
        </div>
      )}
      <div className="absolute top-4 right-4 bg-orange-600/15 text-orange-300 text-xs font-bold px-2 py-1 rounded-lg border border-orange-500/20">
        {vehicle.status}
      </div>
    </div>

    <div className="p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            {vehicle.brand} {vehicle.model}
          </h3>
          <p className="text-sm text-zinc-400">
            {vehicle.year} • {vehicle.color}
          </p>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => onEdit(vehicle)}
            className="p-2 text-zinc-400 hover:text-orange-300 hover:bg-zinc-900 rounded-lg transition-all"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDelete(vehicle.id)}
            className="p-2 text-red-500 hover:text-white hover:bg-red-600 rounded-lg transition-all border border-red-100 flex items-center gap-1"
            title="Excluir Veículo"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Excluir</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
            Compra
          </p>
          <p className="font-semibold">
            R$ {num(vehicle.purchase_value).toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
            Venda Pret.
          </p>
          <p className="font-semibold text-orange-400">
            R$ {num(vehicle.sale_value).toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatYMD(vehicle.purchase_date)}
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {num(vehicle.mileage).toLocaleString('pt-BR')} KM
          </div>
        </div>

        {onChecklist && (
          <button
            onClick={() => onChecklist(vehicle)}
            className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
          >
            <ClipboardCheck className="w-3 h-3" />
            Checklist
          </button>
        )}
      </div>
    </div>
  </div>
);

/* =========================
   APP
========================= */

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('Início');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [isSaleChecklistModalOpen, setIsSaleChecklistModalOpen] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [saleChecklists, setSaleChecklists] = useState<SaleChecklist[]>([]);
  const [currentChecklist, setCurrentChecklist] = useState<ChecklistRow | null>(
    null,
  );

  const [vehicleUploadFiles, setVehicleUploadFiles] = useState<File[]>([]);
  const [clientUploadFiles, setClientUploadFiles] = useState<File[]>([]);
  const [saleChecklistUploadFiles, setSaleChecklistUploadFiles] = useState<
    File[]
  >([]);

  const [vehicleSearch, setVehicleSearch] = useState('');
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    stockCount: 0,
    stockValue: 0,
    stockSaleValue: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    monthlyProfit: 0,
    cashValue: 0,
    totalSales: 0,
    totalPurchases: 0,
    totalProfit: 0,
  });

  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  const darkInputClass =
    'w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30';

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshAllData();
  }, [session]);

  useEffect(() => {
    recomputeReportsAndStats();
  }, [vehicles, sales, expenses]);

  async function refreshAllData() {
    await Promise.all([
      fetchClients(),
      fetchVehicles(),
      fetchSales(),
      fetchExpenses(),
      fetchSaleChecklists(),
    ]);
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(`Erro ao sair: ${error.message}`);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients((data || []) as Client[]);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setClients([]);
    }
  };

  const fetchVehicles = async () => {
    try {
      const [
        { data: vehiclesData, error: vehiclesError },
        { data: checklistData, error: checklistError },
      ] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('checklists').select('vehicle_id'),
      ]);

      if (vehiclesError) throw vehiclesError;
      if (checklistError) throw checklistError;

      const withChecklist = new Set(
        (checklistData || []).map((row: any) => Number(row.vehicle_id)),
      );

      const mapped = (vehiclesData || []).map((v: any) => ({
        ...v,
        has_checklist: withChecklist.has(Number(v.id)),
      }));

      setVehicles(mapped as Vehicle[]);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      setVehicles([]);
    }
  };

  const fetchSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, vehicles(brand, model), clients(name)')
        .order('sale_date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((s: any) => ({
        ...s,
        brand: s.vehicles?.brand || '',
        model: s.vehicles?.model || '',
        client_name: s.clients?.name || 'N/A',
      }));

      setSales(mapped);
    } catch (err) {
      console.error('Error fetching sales:', err);
      setSales([]);
    }
  };

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, vehicles(brand, model)')
        .order('date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((e: any) => ({
        ...e,
        brand: e.vehicles?.brand || '',
        model: e.vehicles?.model || '',
      }));

      setExpenses(mapped);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setExpenses([]);
    }
  };

  const fetchSaleChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('sale_checklists')
        .select('*, vehicles(brand, model, plate), clients(name)')
        .order('checklist_date', { ascending: false });

      if (error) throw error;

      const ids = (data || []).map((row: any) => Number(row.id));
      const filesMap = new Map<number, FileRecord[]>();

      if (ids.length) {
        const { data: filesData, error: filesError } = await supabase
          .from('sale_checklist_files')
          .select('*')
          .in('checklist_id', ids);

        if (filesError) throw filesError;

        for (const file of filesData || []) {
          const key = Number((file as any).checklist_id);
          if (!filesMap.has(key)) filesMap.set(key, []);
          filesMap.get(key)!.push(file as FileRecord);
        }
      }

      const mapped = (data || []).map((sc: any) => ({
        ...sc,
        vehicle_brand: sc.vehicles?.brand || '',
        vehicle_model: sc.vehicles?.model || '',
        vehicle_plate: sc.vehicles?.plate || '',
        client_name: sc.clients?.name || '',
        files: filesMap.get(Number(sc.id)) || [],
      }));

      setSaleChecklists(mapped as SaleChecklist[]);
    } catch (err) {
      console.error('Error fetching sale checklists:', err);
      setSaleChecklists([]);
    }
  };

  const recomputeReportsAndStats = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const stockVehicles = vehicles.filter((v) => v.status !== 'Vendido');
    const stockCount = stockVehicles.length;
    const stockValue = stockVehicles.reduce(
      (sum, v) => sum + num(v.purchase_value),
      0,
    );
    const stockSaleValue = stockVehicles.reduce(
      (sum, v) => sum + num(v.sale_value),
      0,
    );

    const totalSales = sales.reduce((sum, s) => sum + num(s.sale_price), 0);
    const totalPurchases = vehicles.reduce(
      (sum, v) => sum + num(v.purchase_value),
      0,
    );
    const overallExpenses = expenses.reduce((sum, e) => sum + num(e.amount), 0);
    const totalProfit =
      sales.reduce((sum, s) => sum + num(s.profit), 0) - overallExpenses;
    const cashValue = totalSales - totalPurchases - overallExpenses;

    const monthlyRevenue = sales
      .filter((s) => monthKey(s.sale_date) === currentMonth)
      .reduce((sum, s) => sum + num(s.sale_price), 0);

    const monthlyExpenses = expenses
      .filter((e) => monthKey(e.date) === currentMonth)
      .reduce((sum, e) => sum + num(e.amount), 0);

    const monthlyProfit = sales
      .filter((s) => monthKey(s.sale_date) === currentMonth)
      .reduce((sum, s) => sum + num(s.profit), 0);

    setStats({
      stockCount,
      stockValue,
      stockSaleValue,
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit,
      cashValue,
      totalSales,
      totalPurchases,
      totalProfit,
    });

    const months = new Set<string>();
    sales.forEach((s) => monthKey(s.sale_date) && months.add(monthKey(s.sale_date)));
    expenses.forEach((e) => monthKey(e.date) && months.add(monthKey(e.date)));
    vehicles.forEach(
      (v) => monthKey(v.purchase_date) && months.add(monthKey(v.purchase_date)),
    );

    const reports = Array.from(months)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 12)
      .map((month) => {
        const salesDetails = sales.filter((s) => monthKey(s.sale_date) === month);
        const expenseDetails = expenses.filter((e) => monthKey(e.date) === month);
        const purchaseDetails = vehicles.filter(
          (v) => monthKey(v.purchase_date) === month,
        );

        const revenue = salesDetails.reduce((sum, s) => sum + num(s.sale_price), 0);
        const grossProfit = salesDetails.reduce((sum, s) => sum + num(s.profit), 0);
        const expensesTotal = expenseDetails.reduce(
          (sum, e) => sum + num(e.amount),
          0,
        );
        const purchases = purchaseDetails.reduce(
          (sum, v) => sum + num(v.purchase_value),
          0,
        );
        const netProfit = grossProfit - expensesTotal;
        const cashBalance = revenue - expensesTotal - purchases;

        const cashflow: CashFlowItem[] = [
          ...salesDetails.map((s) => ({
            type: 'Venda',
            date: s.sale_date,
            direction: 'in' as const,
            amount: num(s.sale_price),
            description: `${s.brand} ${s.model} - ${s.client_name || 'Cliente'}`,
          })),
          ...expenseDetails.map((e) => ({
            type: 'Despesa',
            date: e.date,
            direction: 'out' as const,
            amount: num(e.amount),
            description: `${e.description} (${e.brand} ${e.model})`,
          })),
          ...purchaseDetails.map((v) => ({
            type: 'Compra',
            date: String(v.purchase_date || ''),
            direction: 'out' as const,
            amount: num(v.purchase_value),
            description: `${v.brand} ${v.model} (${v.plate || 's/placa'})`,
          })),
        ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        return {
          month,
          revenue,
          expenses: expensesTotal,
          purchases,
          grossProfit,
          netProfit,
          cashBalance,
          salesDetails,
          expenseDetails,
          purchaseDetails,
          cashflow,
        };
      });

    setMonthlyReports(reports);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setVehicleUploadFiles([]);
    setIsAddModalOpen(true);
  };

  const handleDeleteVehicle = async (id: number) => {
    if (
      !confirm(
        'Tem certeza que deseja excluir este veículo? Todos os dados vinculados também serão removidos.',
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      await Promise.all([
        fetchVehicles(),
        fetchSales(),
        fetchExpenses(),
        fetchSaleChecklists(),
      ]);
    } catch (err: any) {
      console.error('Error deleting vehicle:', err);
      alert(`Erro ao excluir veículo: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      await Promise.all([fetchClients(), fetchSales(), fetchSaleChecklists()]);
    } catch (err: any) {
      console.error('Error deleting client:', err);
      alert(`Erro ao excluir cliente: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await fetchExpenses();
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      alert(`Erro ao excluir despesa: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDeleteSale = async (id: number) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este registro de venda? O veículo voltará para o status 'Em Estoque'.",
      )
    ) {
      return;
    }

    try {
      const sale = sales.find((s) => s.id === id);
      const vehicleId = Number(sale?.vehicle_id || 0);

      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;

      if (vehicleId) {
        await supabase
          .from('vehicles')
          .update({ status: 'Em Estoque' })
          .eq('id', vehicleId);
      }

      await Promise.all([fetchSales(), fetchVehicles()]);
    } catch (err: any) {
      console.error('Error deleting sale:', err);
      alert(`Erro ao excluir venda: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleDeleteChecklist = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este checklist?')) return;

    try {
      const { error } = await supabase.from('checklists').delete().eq('id', id);
      if (error) throw error;

      setIsChecklistModalOpen(false);
      setCurrentChecklist(null);
      await fetchVehicles();
    } catch (err: any) {
      console.error('Error deleting checklist:', err);
      alert(`Erro ao excluir checklist: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleChecklist = async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setCurrentChecklist(null);

    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentChecklist((data as ChecklistRow | null) || null);
    } catch (err) {
      console.error('Error fetching checklist:', err);
    }

    setIsChecklistModalOpen(true);
  };

  const filteredVehicles = vehicles.filter((v) => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return true;

    return (
      String(v.brand || '').toLowerCase().includes(q) ||
      String(v.model || '').toLowerCase().includes(q) ||
      String(v.plate || '').toLowerCase().includes(q)
    );
  });

  const menuItems = [
    { name: 'Início', icon: LayoutDashboard },
    { name: 'Carros/Motos', icon: Car },
    { name: 'Checklist', icon: ClipboardCheck },
    { name: 'Clientes', icon: Users },
    { name: 'Despesas', icon: Receipt },
    { name: 'Vendas', icon: DollarSign },
    { name: 'Relatórios', icon: BarChart3 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Início':
        return (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickAction
                  title="Cadastrar Carro"
                  subtitle="Novo veículo"
                  icon={Car}
                  onClick={() => {
                    setSelectedVehicle(null);
                    setVehicleUploadFiles([]);
                    setIsAddModalOpen(true);
                  }}
                />
                <QuickAction
                  title="Novo Cliente"
                  subtitle="Cadastrar"
                  icon={Users}
                  onClick={() => {
                    setSelectedClient(null);
                    setClientUploadFiles([]);
                    setIsClientModalOpen(true);
                  }}
                />
                <QuickAction
                  title="Registrar Venda"
                  subtitle="Nova venda"
                  icon={DollarSign}
                  onClick={() => setIsSaleModalOpen(true)}
                />
                <QuickAction
                  title="Adicionar Despesa"
                  subtitle="Novo gasto"
                  icon={Receipt}
                  onClick={() => setIsExpenseModalOpen(true)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Resumo do Mês</h2>
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 text-sm font-medium text-zinc-600 capitalize">
                  <Calendar className="w-4 h-4" />
                  {monthLabel}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Faturamento do Mês"
                  value={`R$ ${num(stats.monthlyRevenue).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}`}
                  icon={DollarSign}
                  colorClass="bg-orange-600"
                />
                <StatCard
                  title="Despesas do Mês"
                  value={`R$ ${num(stats.monthlyExpenses).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}`}
                  icon={Receipt}
                  colorClass="bg-red-600"
                />
                <StatCard
                  title="Lucro do Mês"
                  value={`R$ ${num(stats.monthlyProfit).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}`}
                  icon={TrendingUp}
                  colorClass="bg-emerald-600"
                />
              </div>
            </section>
          </div>
        );

      case 'Carros/Motos':
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Carros/Motos</h2>
                <p className="text-zinc-400">
                  {filteredVehicles.length} veículos (de {vehicles.length})
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedVehicle(null);
                  setVehicleUploadFiles([]);
                  setIsAddModalOpen(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Plus className="w-5 h-5" />
                Novo Veículo
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Buscar por marca, modelo ou placa..."
                className="w-full pl-12 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((v) => (
                <div key={v.id}>
                  <VehicleCard
                    vehicle={v}
                    onEdit={handleEditVehicle}
                    onDelete={handleDeleteVehicle}
                    onChecklist={handleChecklist}
                  />
                </div>
              ))}

              {filteredVehicles.length === 0 && (
                <div className="col-span-full py-20 text-center text-zinc-400">
                  <Car className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>
                    {vehicles.length === 0
                      ? 'Nenhum veículo cadastrado.'
                      : 'Nenhum veículo encontrado para essa busca.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'Checklist':
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Checklist de Venda</h2>
                <p className="text-zinc-400">Carro + Cliente + Fotos + Observações</p>
              </div>

              <button
                onClick={() => {
                  setSaleChecklistUploadFiles([]);
                  setIsSaleChecklistModalOpen(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Plus className="w-5 h-5" />
                Novo Checklist
              </button>
            </div>

            <div className="space-y-3">
              {saleChecklists.map((sc) => (
                <div
                  key={sc.id}
                  className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden"
                >
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">
                        {formatYMD(sc.checklist_date)} • {sc.vehicle_brand}{' '}
                        {sc.vehicle_model} ({sc.vehicle_plate || 's/placa'})
                      </p>
                      <p className="text-sm text-zinc-400">
                        Cliente: {sc.client_name}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {(sc.files || []).length} anexo(s)
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        if (!confirm('Excluir este checklist?')) return;
                        try {
                          const { error } = await supabase
                            .from('sale_checklists')
                            .delete()
                            .eq('id', sc.id);
                          if (error) throw error;
                          await fetchSaleChecklists();
                        } catch (err: any) {
                          alert(
                            `Erro ao excluir checklist: ${
                              err.message || 'Erro desconhecido'
                            }`,
                          );
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {(sc.observations || (sc.files && sc.files.length > 0)) && (
                    <div className="border-t border-zinc-800 p-5 space-y-3">
                      {sc.observations && (
                        <div>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                            Observações
                          </p>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                            {sc.observations}
                          </p>
                        </div>
                      )}

                      {sc.files && sc.files.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Anexos
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {sc.files.map((f) => {
                              const isImg = String(f.mime_type || '').startsWith(
                                'image/',
                              );

                              return (
                                <a
                                  key={f.id}
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 hover:bg-zinc-800 transition-colors"
                                  title={f.original_name}
                                >
                                  <div className="aspect-square flex items-center justify-center">
                                    {isImg ? (
                                      <img
                                        src={f.url}
                                        alt={f.original_name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs text-zinc-400 p-3 text-center">
                                        📄 {f.original_name}
                                      </span>
                                    )}
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {saleChecklists.length === 0 && (
                <div className="py-16 text-center text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800 border-dashed">
                  Nenhum checklist de venda cadastrado.
                </div>
              )}
            </div>
          </div>
        );

      case 'Clientes':
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Clientes</h2>
                <p className="text-zinc-400">{clients.length} clientes cadastrados</p>
              </div>

              <button
                onClick={() => {
                  setSelectedClient(null);
                  setClientUploadFiles([]);
                  setIsClientModalOpen(true);
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Plus className="w-5 h-5" />
                Novo Cliente
              </button>
            </div>

            <div className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Documento</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-900 transition-colors">
                      <td className="px-6 py-4 font-medium">{c.name}</td>
                      <td className="px-6 py-4 text-zinc-400">
                        <p>{c.phone}</p>
                        <p className="text-xs">{c.email}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">{c.document}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedClient(c);
                              setClientUploadFiles([]);
                              setIsClientModalOpen(true);
                            }}
                            className="text-zinc-400 hover:text-orange-400 p-1"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClient(c.id)}
                            className="text-zinc-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {clients.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-20 text-center text-zinc-400"
                      >
                        Nenhum cliente cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Despesas':
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Despesas</h2>
                <p className="text-zinc-400">Controle de gastos por veículo</p>
              </div>

              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Plus className="w-5 h-5" />
                Nova Despesa
              </button>
            </div>

            <div className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-900 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {e.brand} {e.model}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        <p>{e.description}</p>
                        <p className="text-xs italic">{e.notes}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {formatYMD(e.date)}
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        R$ {num(e.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="text-zinc-400 hover:text-red-600 p-1 transition-colors"
                          title="Excluir Despesa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {expenses.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-20 text-center text-zinc-400"
                      >
                        Nenhuma despesa registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Vendas':
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Vendas</h2>
                <p className="text-zinc-400">Histórico de negociações concluídas</p>
              </div>

              <button
                onClick={() => setIsSaleModalOpen(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
              >
                <Plus className="w-5 h-5" />
                Nova Venda
              </button>
            </div>

            <div className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Lucro</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-900 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {s.brand} {s.model}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {s.client_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {formatYMD(s.sale_date)}
                      </td>
                      <td className="px-6 py-4 font-bold text-orange-400">
                        R$ {num(s.sale_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        R$ {num(s.profit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteSale(s.id)}
                          className="text-zinc-400 hover:text-red-600 p-1 transition-colors"
                          title="Excluir Venda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {sales.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-20 text-center text-zinc-400"
                      >
                        Nenhuma venda registrada recentemente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'Relatórios':
        return (
          <div className="space-y-6 pb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Relatórios Financeiros</h2>
              <div className="text-sm text-zinc-400 bg-zinc-950 px-3 py-1 rounded-lg border border-zinc-800">
                Últimos 12 meses
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatCard
                title="Caixa Geral"
                value={`R$ ${num(stats.cashValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                colorClass="bg-orange-600"
              />
              <StatCard
                title="Valor da Frota"
                value={`R$ ${num(stats.stockValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={Car}
                colorClass="bg-orange-500"
              />
              <StatCard
                title="Projeção de Venda"
                value={`R$ ${num(stats.stockSaleValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={TrendingUp}
                colorClass="bg-amber-500"
              />
              <StatCard
                title="Total de Lucro"
                value={`R$ ${num(stats.totalProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={BarChart3}
                colorClass="bg-emerald-600"
              />
              <StatCard
                title="Total de Compras"
                value={`R$ ${num(stats.totalPurchases).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={Receipt}
                colorClass="bg-red-600"
              />
              <StatCard
                title="Total de Vendas"
                value={`R$ ${num(stats.totalSales).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                colorClass="bg-orange-700"
              />
            </div>

            <div className="space-y-3">
              {monthlyReports.map((report) => (
                <div
                  key={report.month}
                  className="bg-zinc-950 rounded-2xl shadow-lg border border-zinc-800 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedMonth(
                        expandedMonth === report.month ? null : report.month,
                      )
                    }
                    className="w-full p-5 flex items-center justify-between hover:bg-zinc-900 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-zinc-100 p-2 rounded-lg">
                        <Calendar className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">
                          {toMonthLabel(report.month)}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Entradas: R$ {num(report.revenue).toLocaleString('pt-BR')} •
                          Saídas: R$ {(num(report.expenses) + num(report.purchases)).toLocaleString(
                            'pt-BR',
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                          Lucro (vendas - despesas)
                        </p>
                        <p
                          className={`font-bold ${
                            num(report.netProfit) >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          R$ {num(report.netProfit).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Caixa: R$ {num(report.cashBalance).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      {expandedMonth === report.month ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedMonth === report.month && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-zinc-800 overflow-hidden"
                      >
                        <div className="p-5 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                              <p className="text-xs font-bold text-zinc-400 uppercase">
                                Vendas
                              </p>
                              <p className="text-lg font-bold text-orange-400">
                                R$ {num(report.revenue).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                              <p className="text-xs font-bold text-zinc-400 uppercase">
                                Despesas
                              </p>
                              <p className="text-lg font-bold text-red-600">
                                R$ {num(report.expenses).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                              <p className="text-xs font-bold text-zinc-400 uppercase">
                                Compras
                              </p>
                              <p className="text-lg font-bold text-zinc-700">
                                R$ {num(report.purchases).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                              <p className="text-xs font-bold text-zinc-400 uppercase">
                                Lucro
                              </p>
                              <p
                                className={`text-lg font-bold ${
                                  num(report.netProfit) >= 0
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                                }`}
                              >
                                R$ {num(report.netProfit).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[
                                  {
                                    name: 'Vendas',
                                    value: num(report.revenue),
                                    color: '#f97316',
                                  },
                                  {
                                    name: 'Despesas',
                                    value: num(report.expenses),
                                    color: '#ef4444',
                                  },
                                  {
                                    name: 'Compras',
                                    value: num(report.purchases),
                                    color: '#fb923c',
                                  },
                                  {
                                    name: 'Lucro',
                                    value: num(report.netProfit),
                                    color:
                                      num(report.netProfit) >= 0
                                        ? '#10b981'
                                        : '#ef4444',
                                  },
                                ]}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  stroke="#2f2f2f"
                                />
                                <XAxis
                                  dataKey="name"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                                />
                                <YAxis
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                                />
                                <Tooltip
                                  formatter={(value: number) => [
                                    `R$ ${Number(value).toLocaleString('pt-BR')}`,
                                    '',
                                  ]}
                                />
                                <Bar
                                  dataKey="value"
                                  radius={[6, 6, 0, 0]}
                                  barSize={14}
                                >
                                  {[
                                    { color: '#f97316' },
                                    { color: '#ef4444' },
                                    { color: '#fb923c' },
                                    {
                                      color:
                                        num(report.netProfit) >= 0
                                          ? '#10b981'
                                          : '#ef4444',
                                    },
                                  ].map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                              Movimentações do mês
                            </p>

                            {report.cashflow.length === 0 ? (
                              <p className="text-sm text-zinc-400 italic">
                                Nenhuma movimentação registrada.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {report.cashflow.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800"
                                  >
                                    <div>
                                      <p className="font-bold text-sm text-white">
                                        {it.type} • {formatYMD(it.date)}
                                      </p>
                                      <p className="text-xs text-zinc-400">
                                        {it.description}
                                      </p>
                                    </div>
                                    <p
                                      className={`font-bold ${
                                        it.direction === 'in'
                                          ? 'text-orange-400'
                                          : 'text-red-600'
                                      }`}
                                    >
                                      {it.direction === 'in' ? '+' : '-'} R${' '}
                                      {num(it.amount).toLocaleString('pt-BR', {
                                        minimumFractionDigits: 2,
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {monthlyReports.length === 0 && (
                <div className="py-16 text-center text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800 border-dashed">
                  Nenhum dado disponível.
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <p>Em desenvolvimento...</p>
          </div>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex items-center gap-3 text-zinc-300">
          <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
          <span>Carregando sistema...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-black font-sans text-white">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-zinc-950 border-r border-zinc-800 z-50 transition-transform duration-300 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/bencar-logo.jpeg"
              alt="Bencar Automóveis"
              className="h-10 w-auto object-contain"
            />
            <div className="leading-tight">
              <h1 className="text-base font-black text-white tracking-tight">
                BENCAR
              </h1>
              <p className="text-[10px] font-extrabold text-orange-400 tracking-widest">
                AUTOMÓVEIS
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === item.name
                  ? 'bg-orange-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              }`}
            >
              <item.icon
                className={`w-5 h-5 ${
                  activeTab === item.name ? 'text-white' : 'text-zinc-400'
                }`}
              />
              {item.name}
              {activeTab === item.name && (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:ml-72 min-h-screen">
        <header className="sticky top-0 bg-black/80 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-zinc-600"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <div className="hidden md:flex items-center text-sm text-zinc-400">
              {session.user.email}
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 flex items-center gap-2 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sair</span>
            </button>

            <div className="w-10 h-10 rounded-full bg-orange-600/15 flex items-center justify-center text-orange-400 border border-orange-500/20 font-bold">
              G
            </div>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>

      {/* MODAL VEÍCULO */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <h2 className="text-xl font-bold text-white">
                  {selectedVehicle ? 'Editar Veículo' : 'Novo Veículo'}
                </h2>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                className="p-6 overflow-y-auto space-y-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData.entries());

                  try {
                    const payload = {
                      brand: String(data.brand || ''),
                      model: String(data.model || ''),
                      year: Number(data.year || 0),
                      color: String(data.color || ''),
                      plate: String(data.plate || ''),
                      mileage: Number(data.mileage || 0),
                      purchase_value: Number(data.purchase_value || 0),
                      sale_value: Number(data.sale_value || 0),
                      purchase_date: String(data.purchase_date || '') || null,
                      status: String(data.status || 'Em Estoque'),
                      description: String(data.description || ''),
                    };

                    let vehicleId = Number(selectedVehicle?.id || 0);

                    if (selectedVehicle) {
                      const { error } = await supabase
                        .from('vehicles')
                        .update(payload)
                        .eq('id', vehicleId);
                      if (error) throw error;
                    } else {
                      const { data: inserted, error } = await supabase
                        .from('vehicles')
                        .insert(payload)
                        .select('*')
                        .single();

                      if (error) throw error;
                      vehicleId = Number((inserted as any).id);
                    }

                    if (vehicleId && vehicleUploadFiles.length > 0) {
                      const uploaded = await uploadFilesToSupabase(
                        'vehicles',
                        vehicleId,
                        vehicleUploadFiles,
                      );

                      const firstImage = uploaded.find((f) =>
                        String(f.mime_type || '').startsWith('image/'),
                      );

                      if (firstImage) {
                        await supabase
                          .from('vehicles')
                          .update({ image_url: firstImage.url })
                          .eq('id', vehicleId);
                      }

                      setVehicleUploadFiles([]);
                    }

                    setIsAddModalOpen(false);
                    setSelectedVehicle(null);
                    await fetchVehicles();
                  } catch (err: any) {
                    console.error('Error saving vehicle:', err);
                    alert(
                      `Erro ao salvar veículo: ${err.message || 'Erro desconhecido'}`,
                    );
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Marca *
                    </label>
                    <input
                      name="brand"
                      defaultValue={selectedVehicle?.brand || ''}
                      required
                      className={darkInputClass}
                      placeholder="Ex: Ford, Fiat..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Modelo *
                    </label>
                    <input
                      name="model"
                      defaultValue={selectedVehicle?.model || ''}
                      required
                      className={darkInputClass}
                      placeholder="Ex: Fiesta, Punto..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Ano *
                    </label>
                    <input
                      name="year"
                      type="number"
                      defaultValue={selectedVehicle?.year || ''}
                      required
                      className={darkInputClass}
                      placeholder="2020"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Cor *
                    </label>
                    <input
                      name="color"
                      defaultValue={selectedVehicle?.color || ''}
                      required
                      className={darkInputClass}
                      placeholder="Prata, Preto..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Placa
                    </label>
                    <input
                      name="plate"
                      defaultValue={selectedVehicle?.plate || ''}
                      className={darkInputClass}
                      placeholder="ABC-1234"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Quilometragem
                    </label>
                    <input
                      name="mileage"
                      type="number"
                      defaultValue={selectedVehicle?.mileage || ''}
                      className={darkInputClass}
                      placeholder="50000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Valor Compra *
                    </label>
                    <input
                      name="purchase_value"
                      type="number"
                      step="0.01"
                      defaultValue={selectedVehicle?.purchase_value || ''}
                      required
                      className={darkInputClass}
                      placeholder="15000.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Valor Venda *
                    </label>
                    <input
                      name="sale_value"
                      type="number"
                      step="0.01"
                      defaultValue={selectedVehicle?.sale_value || ''}
                      required
                      className={darkInputClass}
                      placeholder="22000.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Data Compra
                    </label>
                    <input
                      name="purchase_date"
                      type="date"
                      defaultValue={selectedVehicle?.purchase_date || ''}
                      className={darkInputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      name="status"
                      defaultValue={selectedVehicle?.status || 'Em Estoque'}
                      className={darkInputClass}
                    >
                      <option value="Em Preparação">Em Preparação</option>
                      <option value="Em Estoque">Em Estoque</option>
                      <option value="Vendido">Vendido</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    defaultValue={selectedVehicle?.description || ''}
                    rows={3}
                    className={darkInputClass}
                    placeholder="Observações sobre o veículo..."
                  />

                  <div className="space-y-2 mt-4">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Anexos do Veículo (PDF/JPG/PNG)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={(e) =>
                        setVehicleUploadFiles(Array.from(e.target.files || []))
                      }
                      className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl"
                    />
                    {vehicleUploadFiles.length > 0 && (
                      <p className="text-xs text-zinc-400">
                        {vehicleUploadFiles.length} arquivo(s) selecionado(s)
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">
                      No celular, você pode abrir a câmera e tirar a foto na hora.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  {selectedVehicle && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        handleDeleteVehicle(selectedVehicle.id);
                      }}
                      className="px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-red-600/20"
                  >
                    {selectedVehicle ? 'Atualizar' : 'Salvar'} Veículo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CLIENTE */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClientModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <h2 className="text-xl font-bold text-white">
                  {selectedClient ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <button
                  onClick={() => setIsClientModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData.entries());

                  try {
                    const payload = {
                      name: String(data.name || ''),
                      email: String(data.email || ''),
                      phone: String(data.phone || ''),
                      document: String(data.document || ''),
                      rg: String(data.rg || ''),
                      address: String(data.address || ''),
                    };

                    let clientId = Number(selectedClient?.id || 0);

                    if (selectedClient) {
                      const { error } = await supabase
                        .from('clients')
                        .update(payload)
                        .eq('id', clientId);
                      if (error) throw error;
                    } else {
                      const { data: inserted, error } = await supabase
                        .from('clients')
                        .insert(payload)
                        .select('*')
                        .single();

                      if (error) throw error;
                      clientId = Number((inserted as any).id);
                    }

                    if (clientId && clientUploadFiles.length > 0) {
                      await uploadFilesToSupabase(
                        'clients',
                        clientId,
                        clientUploadFiles,
                      );
                      setClientUploadFiles([]);
                    }

                    setIsClientModalOpen(false);
                    setSelectedClient(null);
                    await fetchClients();
                  } catch (err: any) {
                    console.error(err);
                    alert(
                      `Erro ao salvar cliente: ${err.message || 'Erro desconhecido'}`,
                    );
                  }
                }}
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    name="name"
                    defaultValue={selectedClient?.name || ''}
                    required
                    className={darkInputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      E-mail
                    </label>
                    <input
                      name="email"
                      type="email"
                      defaultValue={selectedClient?.email || ''}
                      className={darkInputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Telefone *
                    </label>
                    <input
                      name="phone"
                      defaultValue={selectedClient?.phone || ''}
                      required
                      className={darkInputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Documento (CPF/CNPJ)
                  </label>
                  <input
                    name="document"
                    defaultValue={selectedClient?.document || ''}
                    className={darkInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    RG
                  </label>
                  <input
                    name="rg"
                    defaultValue={selectedClient?.rg || ''}
                    className={darkInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Endereço
                  </label>
                  <textarea
                    name="address"
                    defaultValue={selectedClient?.address || ''}
                    rows={2}
                    className={darkInputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Documentos / Fotos
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) =>
                      setClientUploadFiles(Array.from(e.target.files || []))
                    }
                    className={darkInputClass}
                  />
                  <p className="text-xs text-zinc-500">
                    No celular, você pode abrir a câmera e tirar a foto na hora.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  {selectedClient && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsClientModalOpen(false);
                        handleDeleteClient(selectedClient.id);
                      }}
                      className="px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                  >
                    {selectedClient ? 'Atualizar' : 'Salvar'} Cliente
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL VENDA */}
      <AnimatePresence>
        {isSaleModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaleModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <h2 className="text-xl font-bold text-white">Registrar Venda</h2>
                <button
                  onClick={() => setIsSaleModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData.entries());

                  try {
                    const vehicleId = Number(data.vehicle_id || 0);
                    const salePrice = Number(data.sale_price || 0);

                    const vehicle = vehicles.find((v) => v.id === vehicleId);
                    if (!vehicle) throw new Error('Veículo não encontrado');

                    const vehicleExpenses = expenses
                      .filter((ex) => Number(ex.vehicle_id) === vehicleId)
                      .reduce((sum, ex) => sum + num(ex.amount), 0);

                    const profit =
                      salePrice - (num(vehicle.purchase_value) + vehicleExpenses);

                    const { error } = await supabase.from('sales').insert({
                      vehicle_id: vehicleId,
                      client_id: Number(data.client_id || 0),
                      sale_date: String(data.sale_date || ''),
                      sale_price: salePrice,
                      payment_method: String(data.payment_method || ''),
                      notes: String(data.notes || ''),
                      profit,
                    });

                    if (error) throw error;

                    await supabase
                      .from('vehicles')
                      .update({ status: 'Vendido' })
                      .eq('id', vehicleId);

                    setIsSaleModalOpen(false);
                    await Promise.all([fetchSales(), fetchVehicles()]);
                  } catch (err: any) {
                    console.error(err);
                    alert(
                      `Erro ao registrar venda: ${err.message || 'Erro desconhecido'}`,
                    );
                  }
                }}
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Veículo *
                  </label>
                  <select name="vehicle_id" required className={darkInputClass}>
                    <option value="">Selecione um veículo</option>
                    {vehicles
                      .filter((v) => v.status !== 'Vendido')
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.brand} {v.model} ({v.plate})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Cliente *
                  </label>
                  <select name="client_id" required className={darkInputClass}>
                    <option value="">Selecione um cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Data da Venda *
                    </label>
                    <input
                      name="sale_date"
                      type="date"
                      required
                      className={darkInputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Valor da Venda *
                    </label>
                    <input
                      name="sale_price"
                      type="number"
                      step="0.01"
                      required
                      className={darkInputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Forma de Pagamento
                  </label>
                  <input
                    name="payment_method"
                    className={darkInputClass}
                    placeholder="Ex: À vista, Financiamento..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Observações
                  </label>
                  <textarea name="notes" rows={2} className={darkInputClass} />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSaleModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                  >
                    Confirmar Venda
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DESPESA */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <h2 className="text-xl font-bold text-white">Nova Despesa</h2>
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                className="p-6 space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData.entries());

                  try {
                    const { error } = await supabase.from('expenses').insert({
                      vehicle_id: Number(data.vehicle_id || 0),
                      description: String(data.description || ''),
                      date: String(data.date || ''),
                      amount: Number(data.amount || 0),
                      notes: String(data.notes || ''),
                    });

                    if (error) throw error;

                    setIsExpenseModalOpen(false);
                    await fetchExpenses();
                  } catch (err: any) {
                    console.error(err);
                    alert(
                      `Erro ao salvar despesa: ${err.message || 'Erro desconhecido'}`,
                    );
                  }
                }}
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Veículo *
                  </label>
                  <select name="vehicle_id" required className={darkInputClass}>
                    <option value="">Selecione um veículo</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.brand} {v.model} ({v.plate})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Descrição *
                  </label>
                  <input
                    name="description"
                    required
                    className={darkInputClass}
                    placeholder="Ex: Pintura, Mecânica..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Data *
                    </label>
                    <input
                      name="date"
                      type="date"
                      required
                      className={darkInputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Valor *
                    </label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      required
                      className={darkInputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Observações
                  </label>
                  <textarea name="notes" rows={2} className={darkInputClass} />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                  >
                    Salvar Despesa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CHECKLIST VENDA */}
      <AnimatePresence>
        {isSaleChecklistModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaleChecklistModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <h2 className="text-xl font-bold text-white">
                  Novo Checklist de Venda
                </h2>
                <button
                  onClick={() => setIsSaleChecklistModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form
                className="p-6 overflow-y-auto space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData.entries());

                  try {
                    const { data: inserted, error } = await supabase
                      .from('sale_checklists')
                      .insert({
                        vehicle_id: Number(data.vehicle_id || 0),
                        client_id: Number(data.client_id || 0),
                        checklist_date: String(data.checklist_date || ''),
                        observations: String(data.observations || ''),
                      })
                      .select('*')
                      .single();

                    if (error) throw error;

                    const checklistId = Number((inserted as any).id);
                    if (checklistId && saleChecklistUploadFiles.length > 0) {
                      await uploadFilesToSupabase(
                        'sale-checklists',
                        checklistId,
                        saleChecklistUploadFiles,
                      );
                      setSaleChecklistUploadFiles([]);
                    }

                    setIsSaleChecklistModalOpen(false);
                    await fetchSaleChecklists();
                  } catch (err: any) {
                    console.error(err);
                    alert(
                      `Erro ao salvar checklist: ${
                        err.message || 'Erro desconhecido'
                      }`,
                    );
                  }
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Veículo *
                    </label>
                    <select name="vehicle_id" required className={darkInputClass}>
                      <option value="">Selecione um veículo</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.brand} {v.model} ({v.plate || 's/placa'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Cliente *
                    </label>
                    <select name="client_id" required className={darkInputClass}>
                      <option value="">Selecione um cliente</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Data *
                    </label>
                    <input
                      name="checklist_date"
                      type="date"
                      required
                      className={darkInputClass}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Observações
                  </label>
                  <textarea
                    name="observations"
                    rows={5}
                    className={darkInputClass}
                    placeholder="Fotos, detalhes do carro, condições, combinado com o cliente..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Fotos / Documentos (PDF/JPG/PNG)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={(e) =>
                      setSaleChecklistUploadFiles(Array.from(e.target.files || []))
                    }
                    className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl"
                  />
                  {saleChecklistUploadFiles.length > 0 && (
                    <p className="text-xs text-zinc-400">
                      {saleChecklistUploadFiles.length} arquivo(s) selecionado(s)
                    </p>
                  )}
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSaleChecklistModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                  >
                    Salvar Checklist
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CHECKLIST VEÍCULO */}
      <AnimatePresence>
        {isChecklistModalOpen && selectedVehicle && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChecklistModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Checklist do Veículo
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {selectedVehicle.brand} {selectedVehicle.model} -{' '}
                    {selectedVehicle.plate}
                  </p>
                </div>

                <button
                  onClick={() => setIsChecklistModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {currentChecklist && (
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-sm font-bold text-white">
                          Checklist Existente
                        </p>
                        <p className="text-xs text-zinc-400">
                          Última atualização:{' '}
                          {new Date(currentChecklist.created_at || '').toLocaleString(
                            'pt-BR',
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteChecklist(currentChecklist.id)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                      title="Excluir Checklist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const data = Object.fromEntries(formData.entries());

                    try {
                      const payload = {
                        vehicle_id: selectedVehicle.id,
                        observations: String(data.observations || ''),
                        media_urls: [],
                      };

                      if (currentChecklist) {
                        const { error } = await supabase
                          .from('checklists')
                          .update(payload)
                          .eq('id', currentChecklist.id);

                        if (error) throw error;
                      } else {
                        const { error } = await supabase
                          .from('checklists')
                          .insert(payload);

                        if (error) throw error;
                      }

                      setIsChecklistModalOpen(false);
                      setCurrentChecklist(null);
                      await fetchVehicles();
                    } catch (err: any) {
                      console.error(err);
                      alert(
                        `Erro ao salvar checklist: ${
                          err.message || 'Erro desconhecido'
                        }`,
                      );
                    }
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Observações Gerais
                    </label>
                    <textarea
                      name="observations"
                      defaultValue={currentChecklist?.observations || ''}
                      rows={4}
                      className={darkInputClass}
                      placeholder="Descreva o estado do veículo, avarias, etc..."
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsChecklistModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-600 hover:bg-zinc-900 transition-colors"
                    >
                      Fechar
                    </button>

                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
                    >
                      {currentChecklist ? 'Atualizar Checklist' : 'Salvar Checklist'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}