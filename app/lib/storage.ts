// app/lib/storage.ts
import type { TransportData, Mode, Customer, SupplierRate } from "./types";

const KEY = "transport_index_data_v1";

const defaultData: TransportData = {
  FCL: [],
  LCL: [],
  DROP: { heavy: 2500, light: 1500 },
};

// ✅ อ่านข้อมูล
export function loadData(): TransportData {
  if (typeof window === "undefined") return defaultData; // กัน SSR
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData;
    return JSON.parse(raw) as TransportData;
  } catch {
    return defaultData;
  }
}

// ✅ บันทึกข้อมูล
export function saveData(data: TransportData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ✅ ล้างข้อมูลทั้งหมด (เผื่อใช้ตอนแก้พัง)
export function clearData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// ---------- HELPERS CRUD ----------

export function addCustomer(mode: Exclude<Mode, "DROP">, customer: Customer) {
  const data = loadData();
  data[mode] = [customer, ...data[mode]];
  saveData(data);
  return data;
}

export function deleteCustomer(mode: Exclude<Mode, "DROP">, customerId: string) {
  const data = loadData();
  data[mode] = data[mode].filter(c => c.id !== customerId);
  saveData(data);
  return data;
}

export function addRate(
  mode: Exclude<Mode, "DROP">,
  customerId: string,
  rate: SupplierRate
) {
  const data = loadData();
  const customer = data[mode].find(c => c.id === customerId);
  if (!customer) return data;

  customer.rates = [rate, ...customer.rates];
  saveData(data);
  return data;
}

export function deleteRate(
  mode: Exclude<Mode, "DROP">,
  customerId: string,
  rateId: string
) {
  const data = loadData();
  const customer = data[mode].find(c => c.id === customerId);
  if (!customer) return data;

  customer.rates = customer.rates.filter(r => r.id !== rateId);
  saveData(data);
  return data;
}

export function setDropRate(heavy: number, light: number) {
  const data = loadData();
  data.DROP = { heavy, light };
  saveData(data);
  return data;
}