export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0b1c2d] text-white">

      {/* ===== HEADER ===== */}
      <header className="w-full px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          {/* LOGO */}
          <img
            src="/logo.png"
            alt="Company Logo"
            className="h-10 w-auto"
          />

          {/* COMPANY NAME */}
          <div className="text-sm leading-tight">
            <div className="font-semibold">
              YUDONG INTERNATIONAL FREIGHT FORWARDING (THAILAND) CO., LTD.
            </div>
            <div className="text-white/70">
              บริษัท อวี๋ตง อินเตอร์เนชั่นแนล เฟรท ฟอร์เวิร์ดดิ้ง (ไทยแลนด์) จำกัด
            </div>
          </div>
        </div>

        {/* ===== MARQUEE TEXT ===== */}
        <div className="relative mt-3 w-full overflow-hidden whitespace-nowrap">
          <div className="flex w-max animate-marquee gap-12 text-white/80 text-sm">
            <span>TRANSPORT INDEX • Global Freight Rates, Simplified & Trusted</span>
            <span>TRANSPORT INDEX • Global Freight Rates, Simplified & Trusted</span>
            <span>TRANSPORT INDEX • Global Freight Rates, Simplified & Trusted</span>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section
        className="flex flex-col items-center justify-center text-center px-6 py-24"
        style={{
          backgroundImage: "url('/bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <h1 className="text-4xl font-bold mb-4">
          TRANSPORT INDEX
        </h1>

        <p className="text-white/80 mb-8">
          Global Freight Rates, Simplified & Trusted.
        </p>

        <a
          href="/transport"
          className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          Access the website<br />เข้าสู่เว็บไซต์
        </a>
      </section>

    </main>
  );
}