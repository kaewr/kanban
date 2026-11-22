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
npm test             # Vitest unit test (src/**/*.test.ts) — รันใน PowerShell/cmd (Git Bash ทำให้ Vitest โหลดซ้ำ)
npm run test:e2e     # Playwright (build + start ให้เอง)

# Supabase local (dev) — ต้องเปิด Docker Desktop ก่อน / พอร์ต 553xx (Studio http://127.0.0.1:55323)
npm run db:start                    # เปิด stack local (ครั้งแรกรัน migrations ให้เอง)
npm run db:stop
npm run db:reset                    # ล้าง local + รัน migrations ใหม่ + สร้าง admin + ผู้ใช้งานวิชาการ 7 คน
npm run db:seed-users               # เพิ่มผู้ใช้งานวิชาการ (รันซ้ำได้) / :prod เมื่อผู้ใช้สั่งเท่านั้น
npm run db:types                    # gen types จาก local
npx supabase migration new <name>   # สร้างไฟล์ migration

# Production (Supabase cloud ที่ link ไว้)
npm run db:push:prod                # push migration ขึ้น prod — ทดสอบด้วย db:reset + test บน local ก่อนเสมอ
npm run db:create-admin:prod        # สร้าง admin บน prod (ใช้ .env.prod)
```

## Structure (เป้าหมาย)

```
src/app/                 # routes: /login, (app)/board, dashboard, admin, profile
src/proxy.ts             # auth gate (Next 16 "proxy" = middleware) → src/lib/supabase/proxy.ts
src/app/api/admin/       # API route ที่ใช้ service role key (server only) เริ่มด้วย requireAdminApi() จาก src/lib/admin/api.ts
src/components/          # UI components
src/lib/supabase/        # client.ts (browser), server.ts (server), admin.ts (service role, server only)
src/stores/              # Zustand stores (สร้างต่อ mount ผ่าน Provider ห้ามสร้างระดับ module — กัน state รั่วข้ามผู้ใช้ตอน SSR)
src/lib/board/           # กติกาบอร์ดแบบ pure function (BR-01..10, ปี, position) + unit test
src/types/               # types ของ DB และโดเมน
supabase/migrations/     # SQL migrations
docs/requirements.md     # สเปก
```

## Environment variables

ห้าม commit ไฟล์ `.env*` (ยกเว้น `.env.example`)

- `.env.local` → Supabase **local** (ค่าจาก `npx supabase status`) ใช้กับ `npm run dev`, e2e, test-rls
- `.env.prod` → Supabase **cloud (production)** ใช้กับสคริปต์ `*:prod` เท่านั้น / บน Vercel ตั้งค่าใน dashboard
- ห้ามตั้งชื่อ `.env.production.local` — `next build` จะโหลดเอง ทำให้ e2e ยิง prod
- e2e และ test-rls ไม่ยอมรันถ้า URL ไม่ใช่ local (`scripts/require-local.mts`, `playwright.config.ts`)

ตัวแปร:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key `sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` — server เท่านั้น (secret key `sb_secret_...` หรือ legacy service_role)
- `DEFAULT_PASSWORD=123456`

## Rules

### ความปลอดภัย
- ห้ามใช้ `SUPABASE_SERVICE_ROLE_KEY` หรือ import `src/lib/supabase/admin.ts` ในโค้ดฝั่ง client
- ทุก API route ใน `/api/admin` ตรวจ session ฝั่ง server ว่าเป็น admin และ `is_active` ก่อนทำงาน (`requireAdminApi()`)
- ปิดบัญชี = `profiles.is_active = false` + ban ใน Supabase Auth / เปิดคืน = ยกเลิก ban (ทำใน `PATCH /api/admin/users/[id]`)
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
- กติกา `started_at` / `completed_at` ตาม BR-01, BR-03, BR-04 (client ใช้ใน store, server บังคับซ้ำใน `save_board_changes`)
- เมื่อชน: ไม่เขียนอะไรเลย → ผู้ใช้โหลดเฉพาะงานที่ชนใหม่ การเปลี่ยนแปลงอื่นยังอยู่
- Admin เปิดบอร์ดคนอื่นที่ `/board?user=<username>` (FR-11) — server ตรวจ role ก่อนใช้ `?user=` (user ทั่วไปถูกเพิกเฉย) + แถบ `ForeignBoardBanner` (BR-28) / ลิงก์บอร์ดสร้างด้วย `boardHref()`
- หมวดหมู่ (FR-18) และตั้งค่าปี (FR-19) แก้ผ่าน Server Action ด้วย session ของ admin (RLS บังคับ) ไม่ใช้ service role / เรียงลำดับผ่าน `reorder_categories(p_ids)` / เปลี่ยนรูปแบบปีไม่คำนวณ `tasks.year` ของงานเดิมใหม่
- FR-13 ไฮไลต์: `dueState()` ใน `src/lib/board/rules.ts` (เกินกำหนด = แดง, วันนี้ถึง +3 วัน = ส้ม, งานเสร็จไม่ไฮไลต์) / FR-14 ตัวกรองบนบอร์ดอยู่ใน state ของ `BoardView` เท่านั้น (ไม่บันทึก ล้างเมื่อ refresh) ตำแหน่งตอนลากคำนวณจากคอลัมน์เต็ม
- FR-16 Dashboard คำนวณใน `dashboard_summary(p_year, p_unit_id, p_owner_id)` (security invoker → RLS) ขอบเขต = งานที่ `tasks.year` = ปีที่เลือก / กราฟใช้ token `--chart-bar` (ผ่าน dataviz validator ทั้ง light/dark) และมี "ดูเป็นตาราง"
- วันลา (FR-22, BR-40..44): ตาราง `leaves` RLS แบบเดียวกับ tasks / ห้ามซ้อนด้วย trigger `leaves_prevent_overlap` / นับวันทำการจันทร์–ศุกร์ (`src/lib/leave/rules.ts` ฝั่ง client, `leave_summary()` ฝั่ง SQL) / บันทึกทันทีผ่าน server action (ไม่ผูกกับปุ่มบันทึกของบอร์ด)
- Backup/restore (FR-23): `GET /api/admin/backup`, `POST /api/admin/restore` (requireAdminApi + service role) / รูปแบบไฟล์และการตรวจอยู่ที่ `src/lib/backup/format.ts` (เพิ่มตารางใหม่ต้องเพิ่มที่นี่ + backup route + `admin_restore()`) / `admin_restore(jsonb)` เรียกได้เฉพาะ service role, insert เฉพาะที่ไม่มี ไม่เขียนทับ
- คอลัมน์บอร์ด (BR-13): แบ่งหน้า 10 ใบด้วย `pageColumn()` + `COLUMN_PAGE_SIZE` / หัวคอลัมน์ sticky ที่ `lg:top-[6.5rem]` (= header 3.5rem + toolbar `lg:h-12`) ถ้าเปลี่ยนความสูง toolbar ต้องแก้คู่กัน / ล้างบอร์ดตัวเอง (BR-47) ผ่าน `clear_my_tasks(p_year)` เฉพาะ `auth.uid()`
- ร่างใน localStorage key `kanban:draft:<ownerId>:<year>` ลบเมื่อบันทึกสำเร็จ / ทิ้ง / ออกจากระบบ (`BoardDraft` โหลดแบบ client-only)

### Auth
- Login = เลือกชื่อจาก dropdown (BR-20) — รายชื่อโหลดด้วย service role ใน `src/lib/accounts.ts` (เฉพาะ id + ชื่อ + สังกัด ของบัญชีที่ใช้งานอยู่) / username สร้างอัตโนมัติ `generateUsername()` → `<username>@kanban.local` (BR-21) ไม่แสดงใน UI / ชื่อ-นามสกุลของบัญชีที่ใช้งานอยู่ห้ามซ้ำ (`isNameTaken`)
- สังกัดงาน `units` ตายตัว 4 งาน (BR-29) / ตำแหน่ง admin แก้เท่านั้น (BR-30) / ผู้ใช้แก้ชื่อ + `year_type` ของตัวเองผ่าน `updateOwnProfile` (BR-31) / บอร์ดใช้ `year_type` ของเจ้าของบอร์ด
- `must_change_password = true` → **ไม่บล็อก** แสดงแถบเตือน `DefaultPasswordBanner` ทุกหน้าจนกว่าจะเปลี่ยนรหัสที่ `/profile` (FR-02 แก้ไข 20 พ.ย. 2026)
- proxy (`src/proxy.ts`) ตรวจแค่ login แล้วหรือยัง และบัญชีถูกปิดหรือไม่
- หน้าและ Server Action ต้องเรียก `requireProfile()` / `requireAdmin()` จาก `src/lib/auth.ts` เสมอ ไม่พึ่ง proxy อย่างเดียว

### Code style
- TypeScript strict ห้าม `any` ถ้าเลี่ยงได้ สร้าง type ของ DB ด้วย `npx supabase gen types`
- ข้อความบน UI และ error ที่ผู้ใช้เห็นเป็นภาษาไทย / ชื่อตัวแปร ฟังก์ชัน คอมเมนต์ในโค้ด เป็นภาษาอังกฤษ
- ค่าสถานะใช้ตามสเปก: `long_term`, `short_term`, `in_progress`, `review`, `done`
- ธีม: สีแบรนด์อยู่ใน `src/app/globals.css` (ม่วง ม.พะเยา `#8D38C9` = primary, ทอง ICT `#996600` = `brand-gold`) ใช้ token (`bg-primary`, `text-brand-gold`) ไม่ hardcode hex / สีสถานะ pastel + ไอคอนอยู่ที่ `src/components/board/status-style.ts` (ไม่ใช้สีม่วงกับสถานะ) / ไอคอนใช้ `lucide-react` / ฟอนต์ Inter (ละติน+ตัวเลข) + IBM Plex Sans Thai
- component เล็กและแยกหน้าที่ชัดเจน ไม่สร้าง abstraction ที่ยังไม่จำเป็น

## Workflow

1. ทำทีละ milestone (ดูตารางใน `docs/requirements.md` หัวข้อ 10) บน branch ของตัวเอง เช่น `m5-board`
2. วางแผนก่อนแก้ไฟล์: บอกไฟล์ที่จะสร้าง/แก้ และจุดที่สเปกไม่ชัด แล้วรออนุมัติ
3. ถ้าสเปกไม่ชัดหรือขัดกันเอง ให้ถาม อย่าเดา
4. ก่อนจบงาน: `npm run build`, `npm run lint`, `npm test` และ `npm run test:e2e` ต้องผ่าน เพิ่ม e2e test ของ FR ที่ทำใน `e2e/` และสรุปวิธีทดสอบด้วยมือ
5. ข้อความ commit: `feat(FR-08): drag and drop between columns`

## Progress

- [x] M1 ตั้งโปรเจกต์
- [x] M2 ฐานข้อมูล + RLS
- [x] M3 Login (FR-01–03)
- [x] M4 จัดการผู้ใช้ (FR-04–06)
- [x] M5 บอร์ด (FR-07, 08, 12)
- [x] M6 การบันทึก (FR-09, 10)
- [x] M7 ส่วน Admin (FR-11, 18–20)
- [x] M8 Dashboard (FR-13, 14, 16)
- [x] วันลา (FR-22)
- [x] สำรอง/กู้คืนข้อมูล (FR-23)
