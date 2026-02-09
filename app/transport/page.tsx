"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "../lib/supabaseclient";

type Mode = "FCL" | "LCL" | "DROP";

type SupplierRate = {
id: string;
supplier: string;
price: number;
note?: string;
};

type Customer = {
id: string;
name: string;
googleMapUrl?: string;
rates: SupplierRate[];
};

type DropRate = {
id: string;
supplier: string;
heavy: number;
light: number;
openCheck: number;
};

type DataShape = {
FCL: Customer[];
LCL: Customer[];
};

const initialData: DataShape = {
FCL: [],
LCL: [],
};

async function fetchCustomersWithRates(mode: Exclude<Mode, "DROP">) {
const { data, error } = await supabase
.from("customers")
.select(
`
id,
name,
google_map_url,
rates (
id,
supplier,
price,
note
)
`
)
.eq("mode", mode);

if (error) throw error;
return data ?? [];
}

function mapRowsToCustomers(rows: any[]): Customer[] {
return (rows ?? []).map((c: any) => ({
id: c.id,
name: c.name,
googleMapUrl: c.google_map_url || undefined,
rates: (c.rates ?? []).map((r: any) => ({
id: r.id,
supplier: r.supplier,
price: Number(r.price),
note: r.note ?? undefined,
})),
}));
}

// ---------- DROP helpers ----------
async function fetchDropRates(): Promise<DropRate[]> {
const { data, error } = await supabase
.from("drop_rates")
.select("id, supplier, heavy, light, open_check")
.order("supplier", { ascending: true });

if (error) throw error;

return (data ?? []).map((d: any) => ({
id: d.id,
supplier: d.supplier,
heavy: Number(d.heavy),
light: Number(d.light),
openCheck: d.open_check,
}));
}

export default function TransportPage() {
const [mode, setMode] = useState<Mode>("FCL");
const [data, setData] = useState<DataShape>(initialData);
const [search, setSearch] = useState("");
const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

// ฟอร์มเพิ่มลูกค้า
const [newCustomerName, setNewCustomerName] = useState("");
const [newCustomerMap, setNewCustomerMap] = useState("");

// ฟอร์มเพิ่มราคา
const [supplier, setSupplier] = useState("");
const [note, setNote] = useState("");
const [price, setPrice] = useState<string>("");

// DROP state
const [dropRates, setDropRates] = useState<DropRate[]>([]);
const [dropSupplier, setDropSupplier] = useState("");
const [dropHeavy, setDropHeavy] = useState("");
const [dropLight, setDropLight] = useState("");
const [dropOpenCheck, setDropOpenCheck] = useState("");

// สถานะ
const [loading, setLoading] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

// ===== AUTH + ROLE =====
const [authLoading, setAuthLoading] = useState(true);
const [isAdmin, setIsAdmin] = useState(false);
const [currentEmail, setCurrentEmail] = useState<string>("");

// ฟอร์มล็อกอิน
const [loginEmail, setLoginEmail] = useState("");
const [loginPassword, setLoginPassword] = useState("");

// ✅ เวอร์ชันที่ "ชัวร์" : เช็ค Admin ผ่าน RPC is_admin()
async function checkAdmin() {
setAuthLoading(true);
setErrorMsg("");

try {
const { data: sessionRes } = await supabase.auth.getSession();
const session = sessionRes?.session;

if (!session?.user) {
setIsAdmin(false);
setCurrentEmail("");
return;
}

setCurrentEmail(session.user.email ?? "");

// เช็คด้วย RPC (ไม่โดน RLS ง่าย ๆ ถ้าคุณสร้าง function เป็น SECURITY DEFINER)
const { data: isAdminRes, error: rpcErr } = await supabase.rpc("is_admin");

if (rpcErr) {
// ถ้า function ยังไม่พร้อม จะเห็น error ตรงนี้
console.log("is_admin rpc error:", rpcErr);
setIsAdmin(false);
setErrorMsg("เช็ค Admin ไม่สำเร็จ: กรุณาตั้งค่า function is_admin() และ GRANT ให้เรียบร้อย");
return;
}

setIsAdmin(Boolean(isAdminRes));
} finally {
setAuthLoading(false);
}
}

useEffect(() => {
checkAdmin();

const { data: sub } = supabase.auth.onAuthStateChange(() => {
checkAdmin();
});

return () => {
sub?.subscription?.unsubscribe();
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ===== โหลดข้อมูลเมื่อเปลี่ยนโหมด =====
useEffect(() => {
setErrorMsg("");

// DROP: โหลด drop_rates
if (mode === "DROP") {
setLoading(true);
fetchDropRates()
.then((rows) => setDropRates(rows))
.catch((e) => {
console.log(e);
setErrorMsg("โหลด DROP ไม่สำเร็จ (เช็ค RLS / ตาราง drop_rates)");
})
.finally(() => setLoading(false));
return;
}

// FCL/LCL
setLoading(true);
fetchCustomersWithRates(mode)
.then((rows) => {
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));

if (mapped.length > 0) {
const stillExists = mapped.some((c) => c.id === selectedCustomerId);
if (!selectedCustomerId || !stillExists) setSelectedCustomerId(mapped[0].id);
} else {
setSelectedCustomerId("");
}
})
.catch((e) => {
console.log(e);
setErrorMsg("โหลดข้อมูลไม่สำเร็จ");
})
.finally(() => setLoading(false));
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [mode]);

const list: Customer[] = mode === "DROP" ? [] : (data[mode] as Customer[]);
const filteredList = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

const selectedCustomer = useMemo(() => {
if (mode === "DROP") return null;
return (data[mode] as Customer[]).find((c) => c.id === selectedCustomerId) ?? null;
}, [data, mode, selectedCustomerId]);

const sortedRates = useMemo(() => {
if (!selectedCustomer) return [];
return [...selectedCustomer.rates].sort((a, b) => a.price - b.price);
}, [selectedCustomer]);

// ===== AUTH ACTIONS =====
async function signIn() {
setErrorMsg("");
setLoading(true);
try {
const email = loginEmail.trim();
const password = loginPassword;

if (!email || !password) {
setErrorMsg("กรอก Email และ Password ก่อน");
return;
}

const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
setErrorMsg(error.message);
return;
}

setLoginEmail("");
setLoginPassword("");
// checkAdmin จะถูกเรียกจาก onAuthStateChange
} finally {
setLoading(false);
}
}

async function signOut() {
setErrorMsg("");
setLoading(true);
try {
const { error } = await supabase.auth.signOut();
if (error) {
setErrorMsg(error.message);
return;
}
setIsAdmin(false);
setCurrentEmail("");
setSelectedCustomerId("");
setDropRates([]);
} finally {
setLoading(false);
}
}

// ===== CRUD (Admin only) =====
async function addCustomer() {
if (mode === "DROP") return;
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่เพิ่มลูกค้าได้");

const name = newCustomerName.trim();
if (!name) return;

setLoading(true);
setErrorMsg("");

const { data: inserted, error } = await supabase
.from("customers")
.insert({
mode,
name,
google_map_url: newCustomerMap.trim() || null,
})
.select("id")
.single();

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

setNewCustomerName("");
setNewCustomerMap("");

const rows = await fetchCustomersWithRates(mode);
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));
setSelectedCustomerId(inserted?.id || "");

setLoading(false);
}

async function deleteCustomer(customerId: string) {
if (mode === "DROP") return;
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่ลบลูกค้าได้");
if (!customerId) return;

setLoading(true);
setErrorMsg("");

const { error } = await supabase.from("customers").delete().eq("id", customerId);
if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

const rows = await fetchCustomersWithRates(mode);
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));

if (mapped.length > 0) setSelectedCustomerId(mapped[0].id);
else setSelectedCustomerId("");

setLoading(false);
}

async function addRate() {
if (mode === "DROP") return;
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่เพิ่มเรทได้");
if (!selectedCustomer) return;

const s = supplier.trim();
const p = Number(price);
if (!s || Number.isNaN(p)) return;

setLoading(true);
setErrorMsg("");

const { error } = await supabase.from("rates").insert({
customer_id: selectedCustomer.id,
supplier: s,
price: p,
note: note.trim() || null,
});

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

setSupplier("");
setNote("");
setPrice("");

const rows = await fetchCustomersWithRates(mode);
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));

setLoading(false);
}

async function deleteRate(rateId: string) {
if (mode === "DROP") return;
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่ลบเรทได้");
if (!rateId) return;

setLoading(true);
setErrorMsg("");

const { error } = await supabase.from("rates").delete().eq("id", rateId);
if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

const rows = await fetchCustomersWithRates(mode);
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));

setLoading(false);
}

// ===== DROP CRUD (Admin only) =====
async function addOrUpdateDropSupplier() {
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่เพิ่ม/แก้ DROP ได้");

const s = dropSupplier.trim();
const heavy = Number(dropHeavy);
const light = Number(dropLight);
const openCheck = Number(dropOpenCheck);

if (!s) return setErrorMsg("กรอกชื่อซัพพลายเออร์ก่อน");
if ([heavy, light, openCheck].some((n) => Number.isNaN(n))) {
return setErrorMsg("Heavy/Light/เปิดตรวจ ต้องเป็นตัวเลข");
}

setLoading(true);
setErrorMsg("");

// upsert: ต้องมี unique index ที่ supplier
const { error } = await supabase.from("drop_rates").upsert(
{
supplier: s,
heavy,
light,
open_check: openCheck,
},
{ onConflict: "supplier" }
);

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

setDropSupplier("");
setDropHeavy("");
setDropLight("");
setDropOpenCheck("");

const rows = await fetchDropRates();
setDropRates(rows);

setLoading(false);
}

async function deleteDropSupplier(id: string) {
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่ลบ DROP ได้");
if (!id) return;

setLoading(true);
setErrorMsg("");

const { error } = await supabase.from("drop_rates").delete().eq("id", id);
if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

const rows = await fetchDropRates();
setDropRates(rows);

setLoading(false);
}

function exportExcel() {
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

const dropRows = dropRates.map((d) => ({
Mode: "DROP",
Supplier: d.supplier,
Heavy: d.heavy,
Light: d.light,
OpenCheck: d.openCheck,
}));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fclRows), "FCL");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lclRows), "LCL");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dropRows), "DROP_SUPPLIERS");

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

{/* ===== AUTH BAR ===== */}
<section style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
{authLoading ? (
<div style={{ color: "#666" }}>กำลังตรวจสอบผู้ใช้…</div>
) : currentEmail ? (
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
<div>
👤 <b>{currentEmail}</b>{" "}
{isAdmin ? <span style={{ color: "#0a7" }}>✅ Admin</span> : <span style={{ color: "#666" }}>👀 Viewer</span>}
</div>
<button
onClick={signOut}
style={{
padding: "8px 12px",
borderRadius: 10,
border: "1px solid #ccc",
background: "#fff",
cursor: "pointer",
}}
>
ออกจากระบบ
</button>
</div>
) : (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
<input
placeholder="Email"
value={loginEmail}
onChange={(e) => setLoginEmail(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="Password"
type="password"
value={loginPassword}
onChange={(e) => setLoginPassword(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<button
onClick={signIn}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
}}
>
เข้าสู่ระบบ
</button>

<div style={{ gridColumn: "1 / -1", color: "#666", marginTop: 6 }}>
🔒 ไม่ล็อกอิน → จะอ่านข้อมูลไม่ได้ถ้า RLS ตั้งเป็น authenticated
</div>
</div>
)}
</section>

{errorMsg && <div style={{ marginTop: 10, color: "red" }}>❌ {errorMsg}</div>}
{loading && <div style={{ marginTop: 10, color: "#666" }}>กำลังทำงานกับฐานข้อมูล…</div>}

<div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
{/* LEFT */}
<section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
<h2 style={{ marginTop: 0 }}>{mode === "DROP" ? "DROP: ราคาตามซัพพลายเออร์" : "ลูกค้า"}</h2>

{mode === "DROP" ? (
<>
{isAdmin ? (
<div style={{ display: "grid", gap: 8 }}>
<input
placeholder="ซัพพลายเออร์ เช่น เข็มทิศ / MGY"
value={dropSupplier}
onChange={(e) => setDropSupplier(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
<input
placeholder="Heavy"
value={dropHeavy}
onChange={(e) => setDropHeavy(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="Light"
value={dropLight}
onChange={(e) => setDropLight(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="เปิดตรวจ"
value={dropOpenCheck}
onChange={(e) => setDropOpenCheck(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
</div>

<button
onClick={addOrUpdateDropSupplier}
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid #111",
background: "#111",
color: "#fff",
cursor: "pointer",
}}
>
+ บันทึก DROP ซัพพลายเออร์ (Admin)
</button>

<div style={{ color: "#666", fontSize: 13 }}>* ถ้าชื่อซ้ำ ระบบจะ “อัปเดต” แทนการเพิ่มใหม่ (upsert)</div>
</div>
) : (
<div style={{ color: "#666" }}>🔒 เพิ่ม/แก้/ลบ DROP ได้เฉพาะ Admin</div>
)}
</>
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
setSearch("");
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
<option value="">-- เลือกลูกค้า --</option>
{(data[mode] as Customer[]).map((c) => (
<option key={c.id} value={c.id}>
{c.name}
</option>
))}
</select>

{isAdmin && (
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
)}
</div>

{/* เพิ่มลูกค้า */}
{isAdmin ? (
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
+ เพิ่มลูกค้า (Admin)
</button>
</div>
) : (
<div style={{ marginTop: 14, color: "#666" }}>🔒 เพิ่ม/ลบลูกค้าได้เฉพาะ Admin</div>
)}
</>
)}
</section>

{/* RIGHT */}
<section style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16 }}>
<h2 style={{ marginTop: 0 }}>
{mode === "DROP" ? "ตารางราคา DROP (ตามซัพพลายเออร์)" : "ราคาซัพพลายเออร์ (เรียงถูก → แพง)"}
</h2>

{mode === "DROP" ? (
dropRates.length === 0 ? (
<div style={{ color: "#666" }}>ยังไม่มี DROP supplier — เพิ่มจากฝั่งซ้าย (Admin)</div>
) : (
<table style={{ width: "100%", borderCollapse: "collapse" }}>
<thead>
<tr style={{ textAlign: "left" }}>
<th style={{ padding: "8px 6px" }}>Supplier</th>
<th style={{ padding: "8px 6px" }}>Heavy</th>
<th style={{ padding: "8px 6px" }}>Light</th>
<th style={{ padding: "8px 6px" }}>เปิดตรวจ</th>
<th style={{ padding: "8px 6px" }}></th>
</tr>
</thead>
<tbody>
{dropRates.map((d) => (
<tr key={d.id} style={{ borderTop: "1px solid #eee" }}>
<td style={{ padding: "8px 6px" }}>
<b>{d.supplier}</b>
</td>
<td style={{ padding: "8px 6px" }}>{d.heavy}</td>
<td style={{ padding: "8px 6px" }}>{d.light}</td>
<td style={{ padding: "8px 6px" }}>{d.openCheck}</td>
<td style={{ padding: "8px 6px", textAlign: "right" }}>
{isAdmin && (
<button
onClick={() => deleteDropSupplier(d.id)}
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
)}
</td>
</tr>
))}
</tbody>
</table>
)
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

{/* เพิ่มราคา (Admin only) */}
{isAdmin ? (
<div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
<input
placeholder="Supplier เช่น ppp / urich"
value={supplier}
onChange={(e) => setSupplier(e.target.value)}
style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
/>
<input
placeholder="Note เช่น 4W / 6W / 10W"
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
+ เพิ่มเรท (Admin)
</button>
</div>
</div>
) : (
<div style={{ marginBottom: 12, color: "#666" }}>🔒 เพิ่ม/ลบราคาได้เฉพาะ Admin</div>
)}

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
{sortedRates.map((r) => (
<tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
<td style={{ padding: "8px 6px" }}>{r.supplier}</td>
<td style={{ padding: "8px 6px" }}>{r.note ?? "-"}</td>
<td style={{ padding: "8px 6px" }}>
<b>{r.price}</b>
</td>
<td style={{ padding: "8px 6px", textAlign: "right" }}>
{isAdmin && (
<button
onClick={() => deleteRate(r.id)}
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
)}
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
✅ FCL/LCL เขียนได้เฉพาะ Admin, DROP ซัพพลายเออร์ก็เขียนได้เฉพาะ Admin และบันทึกลง Supabase แล้ว
</div>
</main>
);
}