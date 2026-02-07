"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [key, setKey] = useState("");

  // ถ้าเคยล็อกอินแล้ว ให้เด้งไปหน้า /transport ทันที
  useEffect(() => {
    const ok = localStorage.getItem("ti_auth_ok");
    if (ok === "1") router.replace("/transport");
  }, [router]);

  function onLogin() {
    // ✅ ตั้งรหัสผ่านที่อยากใช้ตรงนี้ (เปลี่ยนได้)
    const SECRET = "yudong123";

    if (key.trim() === SECRET) {
      localStorage.setItem("ti_auth_ok", "1");
      router.replace("/transport");
    } else {
      alert("รหัสไม่ถูกต้อง");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: 360, border: "1px solid #ddd", borderRadius: 14, padding: 18 }}>
        <h1 style={{ marginTop: 0 }}>Login</h1>
        <p style={{ marginTop: 0, color: "#666" }}>ใส่รหัสเพื่อเข้าดู Transport Index</p>

        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="รหัสผ่าน"
          type="password"
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #ccc" }}
        />

        <button
          onClick={onLogin}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          เข้าสู่ระบบ
        </button>

        <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>
          * ถ้าอยากเปลี่ยนรหัส ไปแก้ค่า <b>SECRET</b> ในไฟล์นี้
        </div>
      </div>
    </main>
  );
}