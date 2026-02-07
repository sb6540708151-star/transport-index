import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // ตอนนี้ยังไม่บล็อกอะไร แค่ให้ระบบผ่านไปก่อน
  return NextResponse.next();
}