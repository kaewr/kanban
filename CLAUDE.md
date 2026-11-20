# Kanban Board บันทึกงาน

เว็บ Kanban ส่วนตัวของพนักงาน (5 สถานะ) + ส่วน Admin + Dashboard วิเคราะห์ปริมาณงาน
สเปกทั้งหมดอยู่ที่ `docs/requirements.md` — อ่านส่วนที่เกี่ยวข้องก่อนเริ่มงานทุกครั้ง และอ้างอิงรหัส FR-xx / BR-xx

## Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- dnd-kit (drag & drop), Zustand (board state), Recharts (dashboard)
- Supabase: Auth + PostgreSQL + RLS ผ่าน `@supabase/supabase-js` และ `@supabase/ssr`
- Deploy: Vercel

## Commands

```bash
npm run dev          # รันบนเครื่อง
npm run build        # ตรวจ build ก่อน push
npm run lint
npx supabase migration new <name>   # สร้างไฟล์ migration
npx supabase db push                # ใช้กับ dev ก่อนเสมอ
```

## Structure (เป้าหมาย)

```
src/app/                 # routes: /login, /change-password, /board, /dashboard, /admin/*
src/app/api/admin/       # API route ที่ใช้ service role key (server only)
src/components/          # UI components
src/lib/supabase/        # client.ts (browser), server.ts (server), admin.ts (service role, server only)
src/stores/              # Zustand stores
src/types/               # types ของ DB และโดเมน
supabase/migrations/     # SQL migrations
docs/requirements.md     # สเปก
```

## Environment variables

`.env.local` (ห้าม commit) — ดูตัวอย่างใน `.env.example`

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key `sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` — server เท่านั้น (secret key `sb_secret_...` หรือ legacy service_role)
- `DEFAULT_PASSWORD=123456`

## Rules

### ความปลอดภัย
- ห้ามใช้ `SUPABASE_SERVICE_ROLE_KEY` หรือ import `src/lib/supabase/admin.ts` ในโค้ดฝั่ง client
- ทุก API route ใน `/api/admin` ตรวจ session ฝั่ง server ว่าเป็น admin และ `is_active` ก่อนทำงาน
- เปิด RLS ทุกตาราง สิทธิ์ต้องถูกบังคับที่ database ไม่ใช่แค่ซ่อนปุ่มใน UI
- ห้าม log รหัสผ่านหรือ token

### ฐานข้อมูล
- เปลี่ยน schema ผ่านไฟล์ใน `supabase/migrations` เท่านั้น ห้ามแก้ผ่าน dashboard
- migration ที่เขียนแล้วและ push แล้ว ห้ามแก้ไฟล์เดิม ให้สร้างไฟล์ใหม่
- ฟังก์ชันที่ผู้ใช้เรียกใช้ `security invoker` เพื่อให้ RLS ทำงาน
- ข้อยกเว้น: helper ที่ใช้ใน policy (`is_admin()`, `is_active_user()`) เป็น `security definer` + `set search_path = ''` เพื่อเลี่ยง RLS วนซ้ำบน `profiles`
- `tasks.year` เก็บเป็น พ.ศ. / ปีงบเรียกตามปีที่สิ้นสุด (ต.ค. 2569 = ปีงบ 2570)
- ผู้ใช้ไม่มีสิทธิ์ UPDATE `profiles` แก้ผ่าน server route + service role เท่านั้น / ไม่มี hard DELETE (soft delete)

### Board / การบันทึก
- การสร้าง/แก้/ลาก/ลบงาน เปลี่ยนแค่ Zustand state จนกว่าผู้ใช้กด "บันทึก" (FR-09)
- บันทึกผ่าน `save_board_changes(p_changes jsonb)` ครั้งเดียว แบบ transaction ตรวจ `version` ทุกงาน
- เก็บ `moved_at` ทุกครั้งที่งานเปลี่ยนคอลัมน์ และใช้ค่านี้ใน `task_history.changed_at`
- กติกา `started_at` / `completed_at` ตาม BR-01, BR-03, BR-04

### Auth
- username → `<username>@kanban.local` ก่อนเรียก Supabase Auth (BR-21) ไม่แสดงอีเมลนี้ใน UI
- `must_change_password = true` → พาไป `/change-password` ทุกหน้า

### Code style
- TypeScript strict ห้าม `any` ถ้าเลี่ยงได้ สร้าง type ของ DB ด้วย `npx supabase gen types`
- ข้อความบน UI และ error ที่ผู้ใช้เห็นเป็นภาษาไทย / ชื่อตัวแปร ฟังก์ชัน คอมเมนต์ในโค้ด เป็นภาษาอังกฤษ
- ค่าสถานะใช้ตามสเปก: `long_term`, `short_term`, `in_progress`, `review`, `done`
- component เล็กและแยกหน้าที่ชัดเจน ไม่สร้าง abstraction ที่ยังไม่จำเป็น

## Workflow

1. ทำทีละ milestone (ดูตารางใน `docs/requirements.md` หัวข้อ 10) บน branch ของตัวเอง เช่น `m5-board`
2. วางแผนก่อนแก้ไฟล์: บอกไฟล์ที่จะสร้าง/แก้ และจุดที่สเปกไม่ชัด แล้วรออนุมัติ
3. ถ้าสเปกไม่ชัดหรือขัดกันเอง ให้ถาม อย่าเดา
4. ก่อนจบงาน: `npm run build` และ `npm run lint` ต้องผ่าน และสรุปวิธีทดสอบด้วยมือ
5. ข้อความ commit: `feat(FR-08): drag and drop between columns`

## Progress

- [x] M1 ตั้งโปรเจกต์
- [x] M2 ฐานข้อมูล + RLS
- [ ] M3 Login (FR-01–03)
- [ ] M4 จัดการผู้ใช้ (FR-04–06)
- [ ] M5 บอร์ด (FR-07, 08, 12)
- [ ] M6 การบันทึก (FR-09, 10)
- [ ] M7 ส่วน Admin (FR-11, 18–20)
- [ ] M8 Dashboard (FR-13, 14, 16)
