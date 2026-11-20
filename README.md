# Kanban Board บันทึกงาน

เว็บ Kanban ส่วนตัวของพนักงาน (5 สถานะ) + ส่วน Admin + Dashboard วิเคราะห์ปริมาณงาน
สเปกอยู่ที่ [docs/requirements.md](docs/requirements.md)

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase (Auth + PostgreSQL + RLS) · Vercel

---

## 1. รันบนเครื่อง

### สิ่งที่ต้องมี
- Node.js 20.9 ขึ้นไป (ทดสอบกับ Node 24)
- โปรเจกต์ Supabase (สร้างที่ https://supabase.com/dashboard)

### ขั้นตอน

```bash
npm install
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
```

แก้ค่าใน `.env.local` (ดูค่าได้จาก Supabase Dashboard → **Project Settings → API Keys**)

| ตัวแปร | ค่า | ใช้ที่ |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) หรือ legacy `service_role` key | **server เท่านั้น** (API route `/api/admin`) |
| `DEFAULT_PASSWORD` | `123456` | รหัสผ่านเริ่มต้นตอน admin สร้าง/รีเซ็ตผู้ใช้ |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ข้าม RLS ได้ทั้งหมด ห้ามใส่ prefix `NEXT_PUBLIC_` และห้าม commit `.env.local`

```bash
npm run dev      # http://localhost:3000
```

หน้าแรกจะแสดง **"✅ เชื่อมต่อ Supabase สำเร็จ"** ถ้า URL และ key ถูกต้อง

คำสั่งอื่น:

```bash
npm run build    # ตรวจ build ก่อน push
npm run lint
```

---

## 2. เชื่อม Supabase CLI กับโปรเจกต์

ติดตั้ง CLI ไว้เป็น devDependency แล้ว เรียกผ่าน `npx supabase`

```bash
# 1) login (เปิด browser ให้ยืนยัน หรือใช้ access token)
npx supabase login

# 2) link กับโปรเจกต์ — project-ref คือส่วนหน้าของ URL เช่น https://<project-ref>.supabase.co
#    ระบบจะถามรหัสผ่านฐานข้อมูล (ตั้งตอนสร้างโปรเจกต์ / รีเซ็ตได้ที่ Project Settings → Database)
npx supabase link --project-ref <project-ref>
```

### ทำงานกับ migration

> ⚠️ CLI รุ่นนี้ใช้ฐานข้อมูล **local เป็นค่าเริ่มต้น** ต้องใส่ `--remote` ทุกครั้งที่จะทำกับโปรเจกต์ cloud (npm script `db:*` ใส่ไว้ให้แล้ว)

```bash
npx supabase migration new <name>    # สร้างไฟล์ใน supabase/migrations/
npx supabase db push --remote        # ส่ง migration ขึ้นโปรเจกต์ที่ link อยู่ (ใช้กับ dev ก่อนเสมอ)
npx supabase migration list --remote # ดูว่า migration ไหน push แล้ว
```

กติกา:
- แก้ schema ผ่านไฟล์ใน `supabase/migrations` เท่านั้น ห้ามแก้ผ่าน dashboard
- migration ที่ push แล้ว ห้ามแก้ไฟล์เดิม ให้สร้างไฟล์ใหม่

### สร้าง TypeScript types จาก schema

```bash
npm run db:types        # = supabase gen types typescript --remote > src/types/database.ts
```

### ตั้งค่าฐานข้อมูลครั้งแรก (M2)

```bash
npm run db:push           # สร้างตาราง + RLS + seed (หมวดหมู่ 4 รายการ, app_settings)
npm run db:create-admin   # สร้าง admin คนแรก: username "admin" รหัส = DEFAULT_PASSWORD (ต้องเปลี่ยนเมื่อ login)
npm run db:test-rls       # ทดสอบ RLS ด้วยผู้ใช้ชั่วคราว (สร้างแล้วลบทิ้งเอง) ต้องได้ "0 failed"
npm run db:types
```

`db:create-admin` และ `db:test-rls` ใช้ `SUPABASE_SERVICE_ROLE_KEY` จาก `.env.local`

หมายเหตุ schema:
- `tasks.year` เก็บเป็น **พ.ศ.** (เช่น 2569) ปีงบประมาณเรียกตามปีที่สิ้นสุด (ต.ค. 2569 = ปีงบ 2570)
- ไม่มีการลบจริง: งานใช้ `is_deleted`, ผู้ใช้ใช้ `is_active`, หมวดหมู่ใช้ `is_active`
- `task_history` เพิ่มได้อย่างเดียว แก้/ลบไม่ได้
- ผู้ใช้แก้ `profiles` เองไม่ได้ ทุกการแก้ผ่าน server route ที่ใช้ service role

### ตั้งค่า Supabase Auth (M3)

Dashboard → **Authentication → Sign In / Providers**:
- ปิด **Allow new users to sign up** (BR-20: บัญชีสร้างโดย admin เท่านั้น — admin API ยังสร้างได้ตามปกติ)
- **Email** provider ต้องเปิดอยู่ (ระบบแปลง username เป็น `<username>@kanban.local` ภายใน)

### ทดสอบระบบ login

```bash
npm run build && npm run start      # เทอร์มินัลที่ 1
npm run test:smoke-auth             # เทอร์มินัลที่ 2: ทดสอบ redirect ของ proxy ด้วยผู้ใช้ชั่วคราว smoke_*
```

---

## 3. Deploy บน Vercel

1. Push โค้ดขึ้น GitHub
2. ที่ https://vercel.com/new → **Import** repository นี้ (Framework Preset: Next.js ระบบตรวจให้อัตโนมัติ ไม่ต้องแก้ build command)
3. ก่อนกด Deploy เปิด **Environment Variables** แล้วเพิ่ม:

   | Key | Environments |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview (ติ๊ก **Sensitive**) |
   | `DEFAULT_PASSWORD` | Production, Preview |

   ถ้าต้องการให้ Preview ใช้ฐานข้อมูล dev แยกจาก Production ให้ตั้งค่าแยกตาม environment

4. กด **Deploy** แล้วเปิด URL ที่ได้ ควรถูกพาไปหน้า `/login`

หมายเหตุ:
- แก้ env ภายหลัง → ต้อง **Redeploy** ถึงจะมีผล (ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build)
- ใช้ Vercel CLI ก็ได้: `npx vercel link` แล้ว `npx vercel env add <KEY>` และ `npx vercel env pull .env.local` เพื่อดึงค่ามาใช้บนเครื่อง
- เมื่อทำระบบ login แล้ว (M3) ให้ตั้ง Supabase Dashboard → **Authentication → URL Configuration → Site URL** เป็น URL ของ Vercel

---

## หมายเหตุแพ็กเกจฟรี

โปรเจกต์ Supabase แพ็กเกจฟรีอาจถูกหยุดชั่วคราวเมื่อไม่มีการใช้งานราว 1 สัปดาห์ (ตรวจเงื่อนไขล่าสุดกับ Supabase) กด Restore ได้ที่ Dashboard
