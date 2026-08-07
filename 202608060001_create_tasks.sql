create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 300),
  course text not null check (char_length(course) between 1 and 100),
  due_date date not null,
  effort smallint not null check (effort between 1 and 3),
  importance smallint not null check (importance between 1 and 3),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists tasks_user_due_idx
  on public.tasks (user_id, due_date, completed);

alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "Users can read their own tasks"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tasks"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  to authenticated
  using ((select auth.uid()) = user_id);
