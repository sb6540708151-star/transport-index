// app/lib/types.ts

export type Mode = "FCL" | "LCL" | "DROP";

export type SupplierRate = {
  id: string;          // ไอดีเรท (unique)
  supplier: string;    // ชื่อซัพพลายเออร์ เช่น PPP / URICH
  price: number;       // ราคา
  note?: string;       // หมายเหตุ (ถ้ามี)
};

// ข้อมูลลูกค้า
export type Customer = {
  id: string;          // unique
  name: string;        // ชื่อลูกค้า เช่น Yahoo
  googleMapUrl: string;// ลิงก์ Google Map (ที่อยู่ลูกค้า)
  rates: SupplierRate[]; // รายการราคาซัพพลายเออร์ (หลายเจ้า)
};

// DROP (ค่าลากดรอป)
export type DropRate = {
  heavy: number; // หนัก 2500
  light: number; // เบา 1500
};

export type TransportData = {
  FCL: Customer[];
  LCL: Customer[];
  DROP: DropRate;
};