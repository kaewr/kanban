-- M2: reference data (kept in a migration so `db push` applies it to cloud)

insert into public.categories (name, sort_order) values
  ('พัฒนาตนเอง', 1),
  ('พัฒนาระบบงาน', 2),
  ('งานประจำ', 3),
  ('อื่น ๆ', 4)
on conflict (name) do nothing;

insert into public.app_settings (id, year_type, fiscal_start_month)
values (true, 'calendar', 10)
on conflict (id) do nothing;
