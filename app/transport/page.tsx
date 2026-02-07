"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type Mode = "FCL" | "LCL" | "DROP";

type SupplierRate = {
supplier: string;
price: number; // บาท
note?: string; // เช่น 4W / 6W / 10W หรือหมายเหตุ
};

type Customer = {
id: string;
name: string;
googleMapUrl?: string;
rates: SupplierRate[];
};

type DataShape = {
FCL: Customer[];
LCL: Customer[];
DROP: {
heavy: number;
light: number;
};
};

const STORAGE_KEY = "transport_index_data_v1";

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultData: DataShape = {
FCL: [
{
id: uid(),
name: "yahu",
googleMapUrl: "https://maps.google.com",
rates: [
{ supplier: "ppp", price: 4000 },
{ supplier: "urich", price: 4500 },
],
},
],
LCL: [
{
id: uid(),
name: "summer free zone",
googleMapUrl: "https://maps.google.com",
rates: [
{ supplier: "ทรัพย์ศิลา", note: "6W", price: 2000 },
{ supplier: "ทรัพย์ศิลา", note: "4W", price: 2000 },
{ supplier: "ทรัพย์ศิลา", note: "10W", price: 2300 },
],
},
],
DROP: { heavy: 2500, light: 1500 },
};

export default function TransportPage() {
const [mode, setMode] = useState<Mode>("FCL");
const [data, setData] = useState<DataShape>(defaultData);
const [search, setSearch] = useState("");
const customers = data[mode === "DROP" ? "FCL" : mode]; // กัน TS
const list: Customer[] = mode === "DROP" ? [] : (data[mode] as Customer[]);
const filteredList = list.filter(c =>
  c.name.toLowerCase().includes(search.toLowerCase())
);
const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

// ฟอร์มเพิ่มลูกค้า
const [newCustomerName, setNewCustomerName] = useState("");
const [newCustomerMap, setNewCustomerMap] = useState("");

// ฟอร์มเพิ่มราคา
const [supplier, setSupplier] = useState("");
const [note, setNote] = useState("");
const [price, setPrice] = useState<string>("");

// โหลดจาก localStorage
useEffect(() => {
const raw = localStorage.getItem(STORAGE_KEY);
if (raw) {
try {
const parsed = JSON.parse(raw) as DataShape;
setData(parsed);
} catch {
// ถ้า parse พัง ไม่ทำอะไร
}
}
}, []);

// เซฟลง localStorage ทุกครั้งที่ data เปลี่ยน
useEffect(() => {
localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}, [data]);

// ตั้งค่า selectedCustomer อัตโนมัติ
useEffect(() => {
if (mode === "DROP") return;
if (!selectedCustomerId && (data[mode] as Customer[]).length > 0) {
setSelectedCustomerId((data[mode] as Customer[])[0].id);
}
}, [mode, data, selectedCustomerId]);

const selectedCustomer = useMemo(() => {
if (mode === "DROP") return null;
return (data[mode] as Customer[]).find((c) => c.id === selectedCustomerId) ?? null;
}, [data, mode, selectedCustomerId]);

const sortedRates = useMemo(() => {
if (!selectedCustomer) return [];
return [...selectedCustomer.rates].sort((a, b) => a.price - b.price);
}, [selectedCustomer]);

function addCustomer() {
if (mode === "DROP") return;
const name = newCustomerName.trim();
if (!name) return;

const newC: Customer = {
id: uid(),
name,
googleMapUrl: newCustomerMap.trim() || undefined,
rates: [],
};

setData((prev) => ({
...prev,
[mode]: [newC, ...(prev[mode] as Customer[])],
}));

setNewCustomerName("");
setNewCustomerMap("");
setSelectedCustomerId(newC.id);
}

function deleteCustomer(customerId: string) {
if (mode === "DROP") return;
setData((prev) => {
const nextList = (prev[mode] as Customer[]).filter((c) => c.id !== customerId);
return { ...prev, [mode]: nextList };
});
if (selectedCustomerId === customerId) setSelectedCustomerId("");
}

function addRate() {
if (mode === "DROP") return;
if (!selectedCustomer) return;

const s = supplier.trim();
const p = Number(price);
if (!s || Number.isNaN(p)) return;

const r: SupplierRate = {
supplier: s,
note: note.trim() || undefined,
price: p,
};

setData((prev) => {
const next = (prev[mode] as Customer[]).map((c) =>
c.id === selectedCustomer.id ? { ...c, rates: [...c.rates, r] } : c
);
return { ...prev, [mode]: next };
});

setSupplier("");
setNote("");
setPrice("");
}

function deleteRate(index: number) {
if (mode === "DROP") return;
if (!selectedCustomer) return;

setData((prev) => {
const next = (prev[mode] as Customer[]).map((c) => {
if (c.id !== selectedCustomer.id) return c;
const copy = [...c.rates];
copy.splice(index, 1);
return { ...c, rates: copy };
});
return { ...prev, [mode]: next };
});
}

function updateDrop(kind: "heavy" | "light", value: string) {
const n = Number(value);
if (Number.isNaN(n)) return;
setData((prev) => ({ ...prev, DROP: { ...prev.DROP, [kind]: n } }));
}

function exportExcel() {
// ทำเป็น 3 sheets: FCL, LCL, DROP
const fclRows = (data.FCL ?? []).flatMap((c) =>
c.rates.map((r) => ({
Mode: "FCL",
Customer: c.name,
GoogleMap: c.googleMapUrl ?? "",
Supplier: r.supplier,
Note: r.note ?? "",
Price: r.price,
}))
);

const lclRows = (data.LCL ?? []).flatMap((c) =>
c.rates.map((r) => ({
Mode: "LCL",
Customer: c.name,
GoogleMap: c.googleMapUrl ?? "",
Supplier: r.supplier,
Note: r.note ?? "",
Price: r.price,
}))
);

const dropRows = [
{ Mode: "DROP", Type: "Heavy", Price: data.DROP.heavy },
{ Mode: "DROP", Type: "Light", Price: data.DROP.light },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fclRows), "FCL");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lclRows), "LCL");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dropRows), "DROP");

const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
saveAs(new Blob([out], { type: "application/octet-stream" }), "transport_index.xlsx");
}

return (
<main style={{ padding: 24, maxWidth: 980, margin: "0 auto", fontFamily: "system-ui" }}>
<div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
<h1 style={{ fontSize: 28, margin: 0 }}>Transport Index</h1>

<div style={{ display: "flex", gap: 8 }}>
{(["FCL", "LCL", "DROP"] as Mode[]).map((m) => (
<button
key={m}
onClick={() => setMode(m)}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #ccc",
background: mode === m ? "#111" : "#fff",
color: mode === m ? "#fff" : "#111",
cursor: "pointer",
}}
>
{m}
</button>
))}

<button
onClick={exportExcel}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #0b5",
background: "#0b5",
color: "#fff",
cursor: "pointer",
}}
>
Export Excel
</button>
</div>
</div>

<div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
{/* LEFT */}
<section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
<h2 style={{ marginTop: 0 }}>{mode === "DROP" ? "ค่าลากดรอป" : "ลูกค้า"}</h2>

{mode === "DROP" ? (
<div style={{ display: "grid", gap: 12 }}>
<label>
Heavy (หนัก)
<input
value={data.DROP.heavy}
onChange={(e) => updateDrop("heavy", e.target.value)}
style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
</label>
<label>
Light (เบา)
<input
value={data.DROP.light}
onChange={(e) => updateDrop("light", e.target.value)}
style={{ width: "100%", marginTop: 6, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
</label>
<div style={{ color: "#666" }}>✅ แก้แล้วจะบันทึกอัตโนมัติ</div>
</div>
) : (
<>
{/* ค้นหาลูกค้า */}
<div style={{ marginTop: 10, marginBottom: 10 }}>
  <input
    placeholder="🔍 ค้นหาลูกค้า..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
  />

  {search.trim() !== "" && (
    <div
      style={{
        marginTop: 6,
        border: "1px solid #ddd",
        borderRadius: 10,
        overflow: "hidden",
        maxHeight: 200,
        overflowY: "auto",
        background: "#fff",
      }}
    >
      {filteredList.length === 0 ? (
        <div style={{ padding: 10, color: "#666" }}>ไม่พบลูกค้าที่ค้นหา</div>
      ) : (
        filteredList.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedCustomerId(c.id);
              setSearch(""); // เลือกแล้วล้างคำค้น (อยากให้ค้างไว้ก็ลบออกได้)
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              border: "none",
              borderBottom: "1px solid #eee",
              background: c.id === selectedCustomerId ? "#f2f2f2" : "#fff",
              cursor: "pointer",
            }}
          >
            {c.name}
          </button>
        ))
      )}
    </div>
  )}
</div>
{/* dropdown ลูกค้า */}
<div style={{ display: "flex", gap: 8 }}>
<select
value={selectedCustomerId}
onChange={(e) => setSelectedCustomerId(e.target.value)}
style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
>
{(data[mode] as Customer[]).map((c) => (
<option key={c.id} value={c.id}>
{c.name}
</option>
))}
</select>

<button
onClick={() => selectedCustomer && deleteCustomer(selectedCustomer.id)}
style={{
padding: "10px 12px",
borderRadius: 10,
border: "1px solid #e55",
background: "#fff",
color: "#e55",
cursor: "pointer",
}}
>
ลบลูกค้า
</button>
</div>

{/* เพิ่มลูกค้า */}
<div style={{ marginTop: 14, display: "grid", gap: 8 }}>
<input
placeholder="ชื่อลูกค้าใหม่ เช่น google / yahu"
value={newCustomerName}
onChange={(e) => setNewCustomerName(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="ลิงก์ Google Map (วางได้เลย)"
value={newCustomerMap}
onChange={(e) => setNewCustomerMap(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<button
onClick={addCustomer}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
}}
>
+ เพิ่มลูกค้า
</button>
<div style={{ color: "#666" }}>✅ เพิ่มแล้วจะบันทึกอัตโนมัติ</div>
</div>
</>
)}
</section>

{/* RIGHT */}
<section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
<h2 style={{ marginTop: 0 }}>
{mode === "DROP" ? "สรุปราคา DROP" : "ราคาซัพพลายเออร์ (เรียงถูก → แพง)"}
</h2>

{mode === "DROP" ? (
<div style={{ fontSize: 18, lineHeight: 1.8 }}>
Heavy (หนัก): <b>{data.DROP.heavy}</b> บาท <br />
Light (เบา): <b>{data.DROP.light}</b> บาท
</div>
) : !selectedCustomer ? (
<div style={{ color: "#666" }}>ยังไม่มีลูกค้าใน {mode} — เพิ่มลูกค้าก่อน</div>
) : (
<>
{selectedCustomer.googleMapUrl ? (
<a href={selectedCustomer.googleMapUrl} target="_blank" style={{ display: "inline-block", marginBottom: 10 }}>
📍 เปิด Google Map ของ {selectedCustomer.name}
</a>
) : (
<div style={{ color: "#666", marginBottom: 10 }}>ยังไม่ได้ใส่ Google Map</div>
)}

{/* เพิ่มราคา */}
<div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
<input
placeholder="Supplier เช่น ppp / urich"
value={supplier}
onChange={(e) => setSupplier(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="Note เช่น 4W / 6W / 10W (ใส่หรือไม่ใส่ก็ได้)"
value={note}
onChange={(e) => setNote(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
</div>

<div style={{ display: "flex", gap: 8 }}>
<input
placeholder="ราคา (ตัวเลข) เช่น 4000"
value={price}
onChange={(e) => setPrice(e.target.value)}
style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<button
onClick={addRate}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
}}
>
+ เพิ่มเรท
</button>
</div>
</div>

{/* ตารางเรท */}
<div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
{sortedRates.length === 0 ? (
<div style={{ color: "#666" }}>ยังไม่มีเรท — เพิ่มเรทด้านบนได้เลย</div>
) : (
<table style={{ width: "100%", borderCollapse: "collapse" }}>
<thead>
<tr style={{ textAlign: "left" }}>
<th style={{ padding: "8px 6px" }}>Supplier</th>
<th style={{ padding: "8px 6px" }}>Note</th>
<th style={{ padding: "8px 6px" }}>Price</th>
<th style={{ padding: "8px 6px" }}></th>
</tr>
</thead>
<tbody>
{sortedRates.map((r, i) => (
<tr key={i} style={{ borderTop: "1px solid #eee" }}>
<td style={{ padding: "8px 6px" }}>{r.supplier}</td>
<td style={{ padding: "8px 6px" }}>{r.note ?? "-"}</td>
<td style={{ padding: "8px 6px" }}>
<b>{r.price}</b>
</td>
<td style={{ padding: "8px 6px", textAlign: "right" }}>
<button
onClick={() => deleteRate(i)}
style={{
padding: "6px 10px",
borderRadius: 10,
border: "1px solid #e55",
background: "#fff",
color: "#e55",
cursor: "pointer",
}}
>
ลบ
</button>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</>
)}
</section>
</div>

<div style={{ marginTop: 14, color: "#666", fontSize: 13 }}>
💾 ข้อมูลบันทึกในเครื่องอัตโนมัติ (localStorage) — รีเฟรชแล้วไม่หาย
</div>
</main>
);
}