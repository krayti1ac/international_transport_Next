/**
 * Trans Bodanon TMS — Fiscal Settlements & Trip P&L Types
 * Closed-Loop Month-End Financial Audit & Driver Expense Clearance
 */

export type SettlementStatus = 'draft' | 'audited' | 'approved' | 'settled' | 'cancelled';

export type ExpenseCategory =
  | 'fuel'
  | 'toll'
  | 'ferry'
  | 'port_customs'
  | 'fine'
  | 'advance'
  | 'other';

export interface ItemizedExpenseRecord {
  id: string | number;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  reference: string;
  description: string;
  receiptUrl?: string;
  tripId?: number;
  isAttributableToDriver?: boolean;
}

export interface DriverSettlementStatement {
  id: number;
  company_id?: number | null;
  statement_number: string;
  driver_id: number;
  period_start: string;
  period_end: string;
  status: SettlementStatus;

  // Earnings
  base_salary_mad: number;
  mission_bonuses_mad: number;
  safety_bonus_mad: number;
  gross_driver_earnings_mad: number;

  // Operational Expenses & Advances
  total_advances_mad: number;
  total_fuel_expenses_mad: number;
  total_toll_expenses_mad: number;
  total_ferry_expenses_mad: number;
  total_port_customs_mad: number;
  total_fines_mad: number;
  total_other_expenses_mad: number;
  total_driver_expenses_mad: number;

  // Reconciliation
  expenses_advances_balance_mad: number; // positive = company reimburses driver, negative = driver owes company
  net_payout_mad: number; // gross_driver_earnings + expenses_advances_balance - total_fines

  // Operational Metrics
  trips_count: number;
  total_distance_km: number;

  // Linkages
  trip_ids: number[];
  advance_ids: number[];
  toll_expense_ids: number[];
  fine_ids: number[];
  itemized_expenses: ItemizedExpenseRecord[];
  metadata?: Record<string, unknown>;

  // Audit trail
  audited_by?: string | null;
  audited_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  settled_at?: string | null;
  treasury_tx_id?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripFiscalClosing {
  id: number;
  company_id?: number | null;
  trip_id: number;
  fiscal_period: string; // e.g. '2026-10'

  revenue_mad: number;
  fuel_cost_mad: number;
  tolls_cost_mad: number;
  ferry_cost_mad: number;
  customs_ports_cost_mad: number;
  driver_cost_mad: number;
  other_costs_mad: number;
  total_costs_mad: number;
  gross_profit_mad: number;
  profit_margin_pct: number;

  is_closed: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalculateDriverSettlementInput {
  driverId: number;
  baseSalary: number;
  bonusPercentage?: number;
  safetyScore?: number;
  trips: Array<{
    id: number;
    price?: number;
    price_export?: number;
    price_import?: number;
    distance_km?: number;
  }>;
  advances: Array<{
    id: number;
    amount: number;
    date: string;
    reason?: string;
  }>;
  fuelExpenses: Array<{
    id: number;
    amount: number;
    date?: string;
    invoice_number?: string;
    description?: string;
  }>;
  tollExpenses: Array<{
    id: number;
    amount_mad?: number;
    amount_eur?: number;
    exit_time: string;
    highway_code?: string;
    toll_system: string;
  }>;
  ferryExpenses: Array<{
    id: number;
    amount: number;
    date?: string;
    ferry_company?: string;
  }>;
  portCustomsExpenses?: Array<{
    id: string | number;
    amount: number;
    description: string;
    date?: string;
  }>;
  fines: Array<{
    id: number;
    amount: number;
    fine_type: string;
    deducted_from_settlement?: boolean;
    date?: string;
  }>;
  otherExpenses?: Array<{
    id: string | number;
    amount: number;
    description: string;
    date?: string;
  }>;
}

export interface DriverSettlementCalculationResult {
  baseSalary: number;
  missionBonuses: number;
  safetyBonus: number;
  grossEarnings: number;

  totalAdvances: number;
  totalFuel: number;
  totalTolls: number;
  totalFerries: number;
  totalPortCustoms: number;
  totalOtherExpenses: number;
  totalDriverExpenses: number;

  expensesVsAdvancesBalance: number; // positive: owed to driver, negative: driver owes company
  totalFinesToDeduct: number;
  netPayout: number;

  tripsCount: number;
  totalDistanceKm: number;
  itemizedExpenses: ItemizedExpenseRecord[];
}

export interface CalculateTripPnlInput {
  tripId: number;
  revenue: number;
  fuelCost: number;
  tollsCost: number;
  ferryCost: number;
  customsPortsCost: number;
  driverCost: number;
  otherCosts?: number;
}

export interface TripPnlCalculationResult {
  tripId: number;
  revenue: number;
  fuelCost: number;
  tollsCost: number;
  ferryCost: number;
  customsPortsCost: number;
  driverCost: number;
  otherCosts: number;
  totalCosts: number;
  grossProfit: number;
  profitMarginPct: number;
  profitabilityTier: 'exceptional' | 'healthy' | 'tight' | 'loss';
}

export interface FiscalPeriodSummary {
  period: string; // e.g. '2026-10'
  totalRevenueMad: number;
  totalOperatingCostsMad: number;
  grossOperatingProfitMad: number;
  averageMarginPct: number;
  totalDriverPayoutsMad: number;
  totalReconciledTollsMad: number;
  totalReconciledFuelMad: number;
  unsettledAdvancesMad: number;
  settledStatementsCount: number;
  pendingStatementsCount: number;
  closedTripsCount: number;
}
