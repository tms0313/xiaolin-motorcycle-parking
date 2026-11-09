-- 小霖的摩拖車停放紀錄
-- 請在此專案專用的 Supabase SQL Editor 執行一次。

create table if not exists public.parking_records (
  id uuid primary key default gen_random_uuid(),
  parked_at date not null default current_date,
  location_type text not null check (location_type in ('fixed','custom')),
  location_name text not null check (char_length(location_name) between 1 and 80),
  latitude double precision,
  longitude double precision,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_location_requires_gps check (
    (location_type = 'custom' and latitude is not null and longitude is not null)
    or
    (location_type = 'fixed' and latitude is null and longitude is null)
  ),
  constraint valid_latitude check (latitude is null or latitude between -90 and 90),
  constraint valid_longitude check (longitude is null or longitude between -180 and 180)
);

create index if not exists parking_records_parked_at_idx
  on public.parking_records (parked_at desc, created_at desc);
create index if not exists parking_records_location_idx
  on public.parking_records (location_type, location_name);

alter table public.parking_records enable row level security;

drop policy if exists "Signed-in users can read shared parking records" on public.parking_records;
create policy "Signed-in users can read shared parking records"
on public.parking_records for select to authenticated
using (true);

drop policy if exists "Signed-in users can add parking records" on public.parking_records;
create policy "Signed-in users can add parking records"
on public.parking_records for insert to authenticated
with check (auth.uid() = created_by);

drop policy if exists "Signed-in users can update shared parking records" on public.parking_records;
create policy "Signed-in users can update shared parking records"
on public.parking_records for update to authenticated
using (true)
with check (true);

drop policy if exists "Signed-in users can delete shared parking records" on public.parking_records;
create policy "Signed-in users can delete shared parking records"
on public.parking_records for delete to authenticated
using (true);

grant select, insert, update, delete on public.parking_records to authenticated;

-- 注意：此版本設定為「所有已登入成員都能查看、新增、修改、刪除所有紀錄」。
-- 若日後需要只有管理員能刪除，或每人只能修改自己的資料，再調整 RLS。