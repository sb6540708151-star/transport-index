"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "../lib/supabaseclient";

type Mode = "FCL" | "LCL" | "DROP";

type SupplierRate = {
id: string;
supplier: string;
price: number;
note?: string; // ใช้เก็บหมายเหตุ / หรือ ประเภทรถในหน้า LCL
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

const initialData: DataShape = { FCL: [], LCL: [] };

// ============================
// Data fetch helpers
// ============================
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
openCheck: Number(d.open_check),
}));
}

// ============================
// UI helpers
// ============================
const modeLabel: Record<Mode, string> = {
FCL: "FCL",
LCL: "LCL",
DROP: "DROP",
};

const modeLabelFull: Record<Mode, string> = {
FCL: "Full Container Load (FCL)",
LCL: "Less than Container Load (LCL)",
DROP: "DROP",
};

const vehicleOptions = [
{ value: "4W", label: "4W (4 Wheel): รถกระบะหรือรถตู้ 4 ล้อ" },
{ value: "6W", label: "6W (6 Wheel): รถบรรทุก 6 ล้อ" },
{ value: "10W", label: "10W (10 Wheel): รถบรรทุก 10 ล้อ" },
] as const;

function pad2(n: number) {
return String(n).padStart(2, "0");
}

function formatDateYYYYMMDD(d: Date) {
const yyyy = d.getFullYear();
const mm = pad2(d.getMonth() + 1);
const dd = pad2(d.getDate());
return `${yyyy}-${mm}-${dd}`;
}

function makeExportFileName(d: Date) {
return `Transport Index ${formatDateYYYYMMDD(d)}.xlsx`;
}

// ============================
// Confirm Dialog
// ============================
type ConfirmState =
| {
open: true;
title: string;
message: string;
confirmText?: string;
cancelText?: string;
onConfirm: () => Promise<void> | void;
}
| { open: false };

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
if (!state.open) return null;

return (
<div style={ui.modalBackdrop}>
<div style={ui.modalCard}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<div style={ui.modalIcon}>!</div>
<div>
<div style={ui.modalTitle}>{state.title}</div>
<div style={ui.modalMsg}>{state.message}</div>
</div>
</div>

<div style={ui.modalActions}>
<button onClick={onClose} style={{ ...ui.btn, ...ui.btnGhost }} type="button">
{state.cancelText ?? "ยกเลิก"}
</button>
<button
onClick={async () => {
await state.onConfirm();
onClose();
}}
style={{ ...ui.btn, ...ui.btnDanger }}
type="button"
>
{state.confirmText ?? "ยืนยัน"}
</button>
</div>
</div>
</div>
);
}

// ============================
// Edit Dialogs
// ============================
type EditRateState =
| {
open: true;
title: string;
supplier: string;
note: string;
price: string;
isLclVehicleSelect: boolean;
onSave: (payload: { supplier: string; note: string; price: number }) => Promise<void>;
}
| { open: false };

function EditRateDialog({ state, onClose }: { state: EditRateState; onClose: () => void }) {
const [supplier, setSupplier] = useState("");
const [note, setNote] = useState("");
const [price, setPrice] = useState("");

useEffect(() => {
if (!state.open) return;
setSupplier(state.supplier);
setNote(state.note);
setPrice(state.price);
}, [state]);

if (!state.open) return null;

return (
<div style={ui.modalBackdrop}>
<div style={ui.modalCard}>
<div style={ui.modalTitle}>{state.title}</div>

<div style={{ display: "grid", gap: 10, marginTop: 12 }}>
<input value={supplier} onChange={(e) => setSupplier(e.target.value)} style={ui.input} placeholder="ระบุชื่อ Supplier" />

{state.isLclVehicleSelect ? (
<select value={note} onChange={(e) => setNote(e.target.value)} style={ui.select}>
<option value="">-- เลือกประเภทรถขนส่ง --</option>
{vehicleOptions.map((v) => (
<option key={v.value} value={v.value}>
{v.label}
</option>
))}
</select>
) : (
<input value={note} onChange={(e) => setNote(e.target.value)} style={ui.input} placeholder="หมายเหตุ" />
)}

<input value={price} onChange={(e) => setPrice(e.target.value)} style={ui.input} placeholder="ระบุอัตราค่าขนส่ง (บาท)" />
</div>

<div style={ui.modalActions}>
<button onClick={onClose} style={{ ...ui.btn, ...ui.btnGhost }} type="button">
ยกเลิก
</button>
<button
onClick={async () => {
const p = Number(price);
if (!supplier.trim() || Number.isNaN(p)) return;
if (state.isLclVehicleSelect && !note) return;
await state.onSave({ supplier: supplier.trim(), note: note ?? "", price: p });
onClose();
}}
style={{ ...ui.btn, ...ui.btnDark }}
type="button"
>
บันทึกการแก้ไข
</button>
</div>
</div>
</div>
);
}

type EditDropState =
| {
open: true;
title: string;
supplier: string;
heavy: string;
light: string;
openCheck: string;
onSave: (payload: { supplier: string; heavy: number; light: number; openCheck: number }) => Promise<void>;
}
| { open: false };

function EditDropDialog({ state, onClose }: { state: EditDropState; onClose: () => void }) {
const [supplier, setSupplier] = useState("");
const [heavy, setHeavy] = useState("");
const [light, setLight] = useState("");
const [openCheck, setOpenCheck] = useState("");

useEffect(() => {
if (!state.open) return;
setSupplier(state.supplier);
setHeavy(state.heavy);
setLight(state.light);
setOpenCheck(state.openCheck);
}, [state]);

if (!state.open) return null;

return (
<div style={ui.modalBackdrop}>
<div style={ui.modalCard}>
<div style={ui.modalTitle}>{state.title}</div>

<div style={{ display: "grid", gap: 10, marginTop: 12 }}>
<input value={supplier} onChange={(e) => setSupplier(e.target.value)} style={ui.input} placeholder="ระบุชื่อ Supplier" />

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
<input value={heavy} onChange={(e) => setHeavy(e.target.value)} style={ui.input} placeholder="Heavy DROP" />
<input value={light} onChange={(e) => setLight(e.target.value)} style={ui.input} placeholder="Light DROP" />
<input value={openCheck} onChange={(e) => setOpenCheck(e.target.value)} style={ui.input} placeholder="Open check" />
</div>
</div>

<div style={ui.modalActions}>
<button onClick={onClose} style={{ ...ui.btn, ...ui.btnGhost }} type="button">
ยกเลิก
</button>
<button
onClick={async () => {
const h = Number(heavy);
const l = Number(light);
const o = Number(openCheck);
if (!supplier.trim()) return;
if ([h, l, o].some((n) => Number.isNaN(n))) return;
await state.onSave({ supplier: supplier.trim(), heavy: h, light: l, openCheck: o });
onClose();
}}
style={{ ...ui.btn, ...ui.btnDark }}
type="button"
>
บันทึกการแก้ไข
</button>
</div>
</div>
</div>
);
}

export default function TransportPage() {
const [mode, setMode] = useState<Mode>("FCL");
const [data, setData] = useState<DataShape>(initialData);
const [search, setSearch] = useState("");
const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

// add customer
const [newCustomerName, setNewCustomerName] = useState("");
const [newCustomerMap, setNewCustomerMap] = useState("");

// add rate
const [supplier, setSupplier] = useState("");
const [note, setNote] = useState("");
const [price, setPrice] = useState<string>("");

// LCL vehicle type
const [vehicleType, setVehicleType] = useState<string>("");

// DROP
const [dropRates, setDropRates] = useState<DropRate[]>([]);
const [dropSupplier, setDropSupplier] = useState("");
const [dropHeavy, setDropHeavy] = useState("");
const [dropLight, setDropLight] = useState("");
const [dropOpenCheck, setDropOpenCheck] = useState("");

// status
const [loading, setLoading] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

// auth
const [authLoading, setAuthLoading] = useState(true);
const [isAdmin, setIsAdmin] = useState(false);
const [currentEmail, setCurrentEmail] = useState<string>("");

// login
const [loginEmail, setLoginEmail] = useState("");
const [loginPassword, setLoginPassword] = useState("");

// dialogs
const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
const [editRate, setEditRate] = useState<EditRateState>({ open: false });
const [editDrop, setEditDrop] = useState<EditDropState>({ open: false });

// ============================
// ADMIN check
// ============================
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

const { data: isAdminRes, error: rpcErr } = await supabase.rpc("is_admin");
if (rpcErr) {
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
return () => sub?.subscription?.unsubscribe();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// ============================
// Load data on mode change
// ============================
useEffect(() => {
setErrorMsg("");

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

// ============================
// AUTH actions
// ============================
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

// ============================
// CRUD
// ============================
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

// ✅ หน้า LCL บังคับเลือกประเภทรถ (เก็บลง note)
const finalNote = mode === "LCL" ? vehicleType : note.trim();

if (!s || Number.isNaN(p)) return;
if (mode === "LCL" && !finalNote) return setErrorMsg("กรุณาเลือกประเภทรถขนส่งก่อน");

setLoading(true);
setErrorMsg("");

const { error } = await supabase.from("rates").insert({
customer_id: selectedCustomer.id,
supplier: s,
price: p,
note: finalNote || null,
});

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

setSupplier("");
setNote("");
setPrice("");
setVehicleType("");

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

async function updateRate(rateId: string, payload: { supplier: string; note: string; price: number }) {
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่แก้เรทได้");
if (!rateId) return;

// LCL ต้องมี vehicle type
if (mode === "LCL" && !payload.note) return setErrorMsg("กรุณาเลือกประเภทรถขนส่งก่อน");

setLoading(true);
setErrorMsg("");

const { error } = await supabase
.from("rates")
.update({
supplier: payload.supplier,
note: payload.note ? payload.note : null,
price: payload.price,
})
.eq("id", rateId);

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

if (mode === "DROP") return;

const rows = await fetchCustomersWithRates(mode);
const mapped = mapRowsToCustomers(rows as any[]);
setData((prev) => ({ ...prev, [mode]: mapped }));

setLoading(false);
}

async function addOrUpdateDropSupplier() {
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่เพิ่ม/แก้ DROP ได้");

const s = dropSupplier.trim();
const heavy = Number(dropHeavy);
const light = Number(dropLight);
const openCheck = Number(dropOpenCheck);

if (!s) return setErrorMsg("กรอกชื่อซัพพลายเออร์ก่อน");
if ([heavy, light, openCheck].some((n) => Number.isNaN(n))) {
return setErrorMsg("Heavy/Light/Open check ต้องเป็นตัวเลข");
}

setLoading(true);
setErrorMsg("");

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

async function updateDropSupplierById(
id: string,
payload: { supplier: string; heavy: number; light: number; openCheck: number }
) {
if (!isAdmin) return setErrorMsg("เฉพาะ Admin เท่านั้นที่แก้ DROP ได้");
if (!id) return;

setLoading(true);
setErrorMsg("");

const { error } = await supabase
.from("drop_rates")
.update({
supplier: payload.supplier,
heavy: payload.heavy,
light: payload.light,
open_check: payload.openCheck,
})
.eq("id", id);

if (error) {
setErrorMsg(error.message);
setLoading(false);
return;
}

const rows = await fetchDropRates();
setDropRates(rows);

setLoading(false);
}

// ============================
// Export Excel
// ============================
const canExport = useMemo(() => {
if (loading) return false;
if (mode === "DROP") return dropRates.length > 0;
return (data[mode]?.length ?? 0) > 0;
}, [loading, mode, dropRates.length, data]);

function exportExcel() {
const title = `ตารางค่าขนส่งหน้า${mode}`;
const wb = XLSX.utils.book_new();

if (mode === "DROP") {
const headers = ["Supplier", "Heavy", "Light", "Open check"];
const rows = dropRates.map((d) => [d.supplier, d.heavy, d.light, d.openCheck]);
const aoa: any[][] = [[title], [], headers, ...rows];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
XLSX.utils.book_append_sheet(wb, ws, "DROP");
} else {
const customers = data[mode] ?? [];
const flatRows = customers.flatMap((c) =>
(c.rates ?? []).map((r) => [c.name, c.googleMapUrl ?? "", r.supplier, r.note ?? "", r.price])
);
const headers = ["Customer", "GoogleMap", "Supplier", mode === "LCL" ? "Vehicle Type" : "Note", "Price(THB)"];
const aoa: any[][] = [[title], [], headers, ...flatRows];
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
XLSX.utils.book_append_sheet(wb, ws, mode);
}

const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
saveAs(new Blob([out], { type: "application/octet-stream" }), makeExportFileName(new Date()));
}

// ============================
// Identity display
// ============================
const displayIdentity = useMemo(() => {
if (!currentEmail) return "Guest";
if (isAdmin) return "Admin";
return "User";
}, [currentEmail, isAdmin]);

return (
<main style={ui.page}>
<ConfirmDialog state={confirm} onClose={() => setConfirm({ open: false })} />
<EditRateDialog state={editRate} onClose={() => setEditRate({ open: false })} />
<EditDropDialog state={editDrop} onClose={() => setEditDrop({ open: false })} />

{/* TOP TITLE */}
<div style={ui.topHeader}>
<div>
<h1 style={ui.title}>Transport Index</h1>
<div style={ui.subtitle}>ระบบบริหารจัดการข้อมูลอัตราค่าขนส่ง</div>
</div>
</div>

{/* AUTH CARD */}
<section style={ui.card}>
{authLoading ? (
<div style={ui.muted}>กำลังตรวจสอบผู้ใช้…</div>
) : currentEmail ? (
<div style={ui.authRow}>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
<div style={ui.avatar}>{displayIdentity.slice(0, 1).toUpperCase()}</div>
<div>
<div style={ui.authName}>
{displayIdentity}{" "}
{isAdmin ? <span style={ui.badgeOk}>Admin</span> : <span style={ui.badgeMuted}>Viewer</span>}
</div>
<div style={ui.mutedSmall}>{isAdmin ? "สิทธิ์: ผู้ดูแลระบบ" : "สิทธิ์: ผู้ใช้งานทั่วไป"}</div>
</div>
</div>

<button onClick={signOut} style={{ ...ui.btn, ...ui.btnGhost }} type="button">
ออกจากระบบ
</button>
</div>
) : (
<div style={ui.loginGrid}>
<input placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={ui.input} />
<input
placeholder="Password"
type="password"
value={loginPassword}
onChange={(e) => setLoginPassword(e.target.value)}
style={ui.input}
/>
<button onClick={signIn} style={{ ...ui.btn, ...ui.btnDark }} type="button">
เข้าสู่ระบบ
</button>

<div style={{ gridColumn: "1 / -1", ...ui.mutedSmall }}>
🔒 หากเปิด RLS เป็น authenticated ผู้ใช้ต้องล็อกอินเพื่ออ่านข้อมูล
</div>
</div>
)}

{/* ✅ MODE BAR แสดง “ตลอด” (แก้ปุ่ม FCL หาย) */}
<div style={ui.modeBar}>
<div style={ui.tabs}>
{(Object.keys(modeLabel) as Mode[]).map((m) => (
<button
key={m}
onClick={() => setMode(m)}
style={{ ...ui.tabBtn, ...(mode === m ? ui.tabBtnActive : {}) }}
type="button"
title={modeLabelFull[m]}
>
 <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
    <span style={{ fontWeight: 900 }}>{modeLabel[m]}</span>
    <span style={{ fontSize: 11, fontWeight: 700, opacity: mode === m ? 0.85 : 0.6 }}>
      {m === "FCL"
        ? "Full Container Load"
        : m === "LCL"
        ? "Less than Container Load"
        : "DROP"}
    </span>
  </div>
</button>
))}
</div>

<button
onClick={exportExcel}
style={{ ...ui.btn, ...(canExport ? ui.btnPrimary : ui.btnDisabled) }}
type="button"
disabled={!canExport}
title={!canExport ? "ยังไม่มีข้อมูลสำหรับ Export (หรือยังไม่ได้ล็อกอิน/โหลดข้อมูล)" : "Export Excel"}
>
นำออกเป็นไฟล์ Excel
</button>
</div>
</section>

{errorMsg && <div style={ui.error}>❌ {errorMsg}</div>}
{loading && <div style={ui.muted}>กำลังทำงานกับฐานข้อมูล…</div>}

{/* CONTENT */}
<div style={ui.grid}>
{/* LEFT */}
<section style={ui.card}>
<div style={ui.cardHeader}>
<h2 style={ui.h2}>{mode === "DROP" ? "DROP: ราคาตามซัพพลายเออร์" : "ลูกค้า"}</h2>
<div style={ui.mutedSmall}>
{mode === "DROP" ? "จัดการราคา DROP ตามซัพพลายเออร์" : "เลือก/ค้นหา และจัดการข้อมูลลูกค้า"}
</div>
</div>

{mode === "DROP" ? (
<>
{isAdmin ? (
<div style={{ display: "grid", gap: 10 }}>
<input placeholder="ระบุชื่อ Supplier" value={dropSupplier} onChange={(e) => setDropSupplier(e.target.value)} style={ui.input} />

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
<input placeholder="Heavy DROP" value={dropHeavy} onChange={(e) => setDropHeavy(e.target.value)} style={ui.input} />
<input placeholder="Light DROP" value={dropLight} onChange={(e) => setDropLight(e.target.value)} style={ui.input} />
<input placeholder="Open check" value={dropOpenCheck} onChange={(e) => setDropOpenCheck(e.target.value)} style={ui.input} />
</div>

<button onClick={addOrUpdateDropSupplier} style={{ ...ui.btn, ...ui.btnDark }} type="button">
บันทึกราคาค่า DROP
</button>

<div style={ui.mutedSmall}>* ถ้าชื่อซ้ำ ระบบจะอัปเดตแทนการเพิ่มใหม่</div>
</div>
) : (
<div style={ui.muted}>🔒 เพิ่ม/แก้/ลบ DROP ได้เฉพาะ Admin</div>
)}
</>
) : (
<>
{/* search */}
<div style={{ marginBottom: 10 }}>
<input placeholder="ค้นหารายชื่อลูกค้า…" value={search} onChange={(e) => setSearch(e.target.value)} style={ui.input} />

{search.trim() !== "" && (
<div style={ui.suggestBox}>
{filteredList.length === 0 ? (
<div style={ui.suggestItemMuted}>ไม่พบลูกค้าที่ค้นหา</div>
) : (
filteredList.map((c) => (
<button
key={c.id}
onClick={() => {
setSelectedCustomerId(c.id);
setSearch("");
}}
style={{ ...ui.suggestItem, ...(c.id === selectedCustomerId ? ui.suggestItemActive : {}) }}
type="button"
>
{c.name}
</button>
))
)}
</div>
)}
</div>

{/* select + delete */}
<div style={{ display: "flex", gap: 10 }}>
<select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} style={ui.select}>
<option value="">-- เลือกลูกค้า --</option>
{(data[mode] as Customer[]).map((c) => (
<option key={c.id} value={c.id}>
{c.name}
</option>
))}
</select>

{isAdmin && (
<button
onClick={() => {
if (!selectedCustomer) return;
setConfirm({
open: true,
title: "ยืนยันการลบลูกค้า",
message: `ต้องการลบลูกค้า “${selectedCustomer.name}” ใช่หรือไม่?`,
confirmText: "ลบ",
cancelText: "ยกเลิก",
onConfirm: async () => deleteCustomer(selectedCustomer.id),
});
}}
style={{ ...ui.btn, ...ui.btnDangerOutline }}
type="button"
>
ลบรายการลูกค้า
</button>
)}
</div>

{/* add customer */}
{isAdmin ? (
<div style={{ marginTop: 14, display: "grid", gap: 10 }}>
<input placeholder="ระบุชื่อลูกค้า" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} style={ui.input} />
<input placeholder="ระบุลิงก์ตำแหน่งที่ตั้ง (Google Maps)" value={newCustomerMap} onChange={(e) => setNewCustomerMap(e.target.value)} style={ui.input} />
<button onClick={addCustomer} style={{ ...ui.btn, ...ui.btnDark }} type="button">
บันทึกข้อมูลลูกค้า
</button>
</div>
) : (
<div style={{ marginTop: 14, ...ui.mutedSmall }}>🔒 เพิ่ม/ลบลูกค้าได้เฉพาะ Admin</div>
)}
</>
)}
</section>

{/* RIGHT */}
<section style={ui.card}>
<div style={ui.cardHeader}>
<h2 style={ui.h2}>{mode === "DROP" ? "ตารางราคา DROP (ตามซัพพลายเออร์)" : "ราคาค่าขนส่ง (เรียงถูก → แพง)"}</h2>
<div style={ui.mutedSmall}>{mode === "DROP" ? "แสดงรายการราคาของแต่ละซัพพลายเออร์" : "เพิ่ม/แก้ไข/ลบ ได้เฉพาะผู้ดูแลระบบ"}</div>
</div>

{mode === "DROP" ? (
dropRates.length === 0 ? (
<div style={ui.muted}>ยังไม่มี DROP supplier — เพิ่มจากฝั่งซ้าย</div>
) : (
<table style={ui.table}>
<thead>
<tr>
<th style={ui.th}>Supplier</th>
<th style={ui.th}>Heavy</th>
<th style={ui.th}>Light</th>
<th style={ui.th}>Open check</th>
<th style={{ ...ui.th, textAlign: "right" }}></th>
</tr>
</thead>
<tbody>
{dropRates.map((d) => (
<tr key={d.id}>
<td style={ui.tdStrong}>{d.supplier}</td>
<td style={ui.td}>{d.heavy}</td>
<td style={ui.td}>{d.light}</td>
<td style={ui.td}>{d.openCheck}</td>
<td style={{ ...ui.td, textAlign: "right" }}>
{isAdmin && (
<div style={{ display: "inline-flex", gap: 8 }}>
<button
onClick={() =>
setEditDrop({
open: true,
title: "แก้ไขรายการ DROP",
supplier: d.supplier,
heavy: String(d.heavy),
light: String(d.light),
openCheck: String(d.openCheck),
onSave: async (payload) =>
updateDropSupplierById(d.id, {
supplier: payload.supplier,
heavy: payload.heavy,
light: payload.light,
openCheck: payload.openCheck,
}),
})
}
style={{ ...ui.btnMini, ...ui.btnMiniGhost }}
type="button"
>
แก้ไข
</button>

<button
onClick={() =>
setConfirm({
open: true,
title: "ยืนยันการลบรายการ",
message: `ต้องการลบ “${d.supplier}” ใช่หรือไม่?`,
confirmText: "ลบ",
cancelText: "ยกเลิก",
onConfirm: async () => deleteDropSupplier(d.id),
})
}
style={{ ...ui.btnMini, ...ui.btnMiniDanger }}
type="button"
>
ลบ
</button>
</div>
)}
</td>
</tr>
))}
</tbody>
</table>
)
) : !selectedCustomer ? (
<div style={ui.muted}>ยังไม่มีลูกค้าใน {mode} — เพิ่ม/เลือก ลูกค้าก่อน</div>
) : (
<>
{selectedCustomer.googleMapUrl ? (
<a href={selectedCustomer.googleMapUrl} target="_blank" rel="noreferrer" style={ui.mapLink}>
📍 แสดงตำแหน่งที่ตั้งบริษัท
</a>
) : (
<div style={ui.mutedSmall}>ยังไม่ได้ใส่ Google Map</div>
)}

{/* add rate */}
{isAdmin ? (
<div style={{ display: "grid", gap: 10, marginTop: 12, marginBottom: 12 }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
<input placeholder="ระบุชื่อ Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={ui.input} />

{mode === "LCL" ? (
<select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={ui.select}>
<option value="">-- เลือกประเภทรถขนส่ง --</option>
{vehicleOptions.map((v) => (
<option key={v.value} value={v.value}>
{v.label}
</option>
))}
</select>
) : (
<input placeholder="หมายเหตุ" value={note} onChange={(e) => setNote(e.target.value)} style={ui.input} />
)}
</div>

<div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
<input placeholder="ระบุอัตราค่าขนส่ง (บาท)" value={price} onChange={(e) => setPrice(e.target.value)} style={ui.input} />
<button onClick={addRate} style={{ ...ui.btn, ...ui.btnDark }} type="button">
เพิ่มข้อมูลอัตราค่าขนส่ง
</button>
</div>
</div>
) : (
<div style={{ ...ui.mutedSmall, marginTop: 10 }}>🔒 เพิ่ม/แก้ไข/ลบ ได้เฉพาะ Admin</div>
)}

{/* rate table */}
<div style={{ borderTop: "1px solid #edf0f5", paddingTop: 12 }}>
{sortedRates.length === 0 ? (
<div style={ui.muted}>ยังไม่มีเรท — เพิ่มเรทด้านบนได้เลย</div>
) : (
<table style={ui.table}>
<thead>
<tr>
<th style={ui.th}>Supplier</th>
<th style={ui.th}>{mode === "LCL" ? "ประเภทรถ" : "หมายเหตุ"}</th>
<th style={ui.th}>ราคา (บาท)</th>
<th style={{ ...ui.th, textAlign: "right" }}></th>
</tr>
</thead>
<tbody>
{sortedRates.map((r) => (
<tr key={r.id}>
<td style={ui.td}>{r.supplier}</td>
<td style={ui.td}>{r.note ?? "-"}</td>
<td style={ui.tdStrong}>{r.price}</td>
<td style={{ ...ui.td, textAlign: "right" }}>
{isAdmin && (
<div style={{ display: "inline-flex", gap: 8 }}>
<button
onClick={() =>
setEditRate({
open: true,
title: "แก้ไขราคาค่าขนส่ง",
supplier: r.supplier,
note: r.note ?? "",
price: String(r.price),
isLclVehicleSelect: mode === "LCL",
onSave: async (payload) => updateRate(r.id, payload),
})
}
style={{ ...ui.btnMini, ...ui.btnMiniGhost }}
type="button"
>
แก้ไข
</button>

<button
onClick={() =>
setConfirm({
open: true,
title: "ยืนยันการลบรายการ",
message: `ต้องการลบเรทราคา “${r.supplier}” ใช่หรือไม่?`,
confirmText: "ลบ",
cancelText: "ยกเลิก",
onConfirm: async () => deleteRate(r.id),
})
}
style={{ ...ui.btnMini, ...ui.btnMiniDangerOutline }}
type="button"
>
ลบรายการ
</button>
</div>
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

<div style={ui.footerNote}>
✅ ข้อมูล FCL/LCL/DROP และข้อมูลผู้ให้บริการ สามารถแก้ไขได้เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น และบันทึกลงฐานข้อมูลแล้ว
</div>
</main>
);
}

// ============================
// Corporate UI Styles (inline)
// ============================
const ui: Record<string, CSSProperties> = {
page: {
padding: 24,
maxWidth: 1180,
margin: "0 auto",
fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
color: "#111827",
background: "#ffffff",
},
topHeader: {
display: "flex",
alignItems: "flex-end",
justifyContent: "space-between",
marginBottom: 14,
},
title: { fontSize: 28, margin: 0, letterSpacing: -0.3 },
subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },

card: {
border: "1px solid #e5e7eb",
borderRadius: 14,
padding: 16,
background: "#fff",
boxShadow: "0 8px 20px rgba(17, 24, 39, 0.06)",
},
cardHeader: { marginBottom: 12 },
h2: { margin: 0, fontSize: 18 },
muted: { marginTop: 10, color: "#6b7280" },
mutedSmall: { color: "#6b7280", fontSize: 12 },

grid: {
marginTop: 14,
display: "grid",
gridTemplateColumns: "1fr 1.25fr",
gap: 16,
},

modeBar: {
marginTop: 14,
paddingTop: 14,
borderTop: "1px solid #eef2f7",
display: "flex",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
flexWrap: "wrap",
},

tabs: {
display: "flex",
gap: 8,
flexWrap: "wrap",
},
tabBtn: {
padding: "8px 12px",
borderRadius: 12,
border: "1px solid #111827",
background: "#fff",
color: "#111827",
cursor: "pointer",
fontSize: 13,
lineHeight: 1.2,
whiteSpace: "nowrap",
fontWeight: 700,
},
tabBtnActive: {
background: "#111827",
color: "#fff",
},

input: {
padding: 12,
borderRadius: 12,
border: "1px solid #d1d5db",
outline: "none",
fontSize: 14,
width: "100%",
background: "#fff",
},
select: {
padding: 12,
borderRadius: 12,
border: "1px solid #d1d5db",
outline: "none",
fontSize: 14,
width: "100%",
background: "#fff",
},

btn: {
padding: "10px 14px",
borderRadius: 12,
border: "1px solid transparent",
cursor: "pointer",
fontSize: 14,
fontWeight: 800,
},
btnPrimary: {
background: "#0ea5e9",
color: "#fff",
},
btnDisabled: {
background: "#e5e7eb",
color: "#6b7280",
cursor: "not-allowed",
},
btnDark: {
background: "#111827",
color: "#fff",
},
btnGhost: {
background: "#fff",
color: "#111827",
border: "1px solid #d1d5db",
},
btnDanger: {
background: "#ef4444",
color: "#fff",
},
btnDangerOutline: {
background: "#fff",
color: "#ef4444",
border: "1px solid #ef4444",
},

btnMini: {
padding: "8px 12px",
borderRadius: 10,
border: "1px solid transparent",
cursor: "pointer",
fontSize: 13,
fontWeight: 800,
},
btnMiniGhost: { background: "#fff", color: "#111827", border: "1px solid #d1d5db" },
btnMiniDanger: { background: "#ef4444", color: "#fff" },
btnMiniDangerOutline: { background: "#fff", color: "#ef4444", border: "1px solid #ef4444" },

authRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
avatar: {
width: 36,
height: 36,
borderRadius: 12,
background: "#111827",
color: "#fff",
display: "grid",
placeItems: "center",
fontWeight: 900,
},
authName: { fontWeight: 900, display: "flex", alignItems: "center", gap: 8 },
badgeOk: {
fontSize: 12,
padding: "3px 8px",
borderRadius: 999,
background: "#dcfce7",
color: "#166534",
fontWeight: 900,
},
badgeMuted: {
fontSize: 12,
padding: "3px 8px",
borderRadius: 999,
background: "#f3f4f6",
color: "#374151",
fontWeight: 900,
},

loginGrid: {
display: "grid",
gridTemplateColumns: "1fr 1fr auto",
gap: 10,
alignItems: "center",
},

suggestBox: {
marginTop: 8,
border: "1px solid #e5e7eb",
borderRadius: 12,
overflow: "hidden",
maxHeight: 220,
overflowY: "auto",
background: "#fff",
},
suggestItem: {
width: "100%",
textAlign: "left",
padding: "10px 12px",
border: "none",
borderBottom: "1px solid #f3f4f6",
background: "#fff",
cursor: "pointer",
fontSize: 14,
},
suggestItemActive: { background: "#f3f4f6" },
suggestItemMuted: { padding: 12, color: "#6b7280" },

mapLink: {
display: "inline-block",
marginTop: 4,
marginBottom: 6,
color: "#0ea5e9",
fontWeight: 900,
textDecoration: "none",
},

table: { width: "100%", borderCollapse: "collapse" },
th: {
textAlign: "left",
padding: "10px 8px",
fontSize: 12,
color: "#6b7280",
borderBottom: "1px solid #e5e7eb",
},
td: { padding: "12px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 14 },
tdStrong: {
padding: "12px 8px",
borderBottom: "1px solid #f3f4f6",
fontSize: 14,
fontWeight: 900,
},

error: { marginTop: 10, color: "#dc2626", fontWeight: 900 },

footerNote: { marginTop: 16, color: "#374151", fontSize: 13 },

// modal
modalBackdrop: {
position: "fixed",
inset: 0,
background: "rgba(17, 24, 39, 0.45)",
display: "grid",
placeItems: "center",
padding: 16,
zIndex: 9999,
},
modalCard: {
width: "100%",
maxWidth: 520,
background: "#fff",
borderRadius: 16,
padding: 16,
border: "1px solid #e5e7eb",
boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
},
modalIcon: {
width: 34,
height: 34,
borderRadius: 12,
background: "#fff7ed",
border: "1px solid #fed7aa",
color: "#c2410c",
display: "grid",
placeItems: "center",
fontWeight: 900,
},
modalTitle: { fontWeight: 900, fontSize: 16, marginBottom: 2 },
modalMsg: { color: "#4b5563", fontSize: 13, lineHeight: 1.5 },
modalActions: {
display: "flex",
justifyContent: "flex-end",
gap: 10,
marginTop: 14,
},
};
