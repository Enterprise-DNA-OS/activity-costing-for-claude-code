create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'Append-only evidence cannot be changed'; end $$;
create table workspace(id integer primary key check(id=1), name text not null, demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table periods(id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, currency text not null check(currency in ('NZD','AUD','USD','GBP','EUR')), end_date date not null, retention_until date not null, status text not null default 'open' check(status in ('open','closed')), revision integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table objects(id uuid primary key default gen_random_uuid(), period_id uuid not null references periods, code text not null, name text not null, segment text not null, revenue_cents bigint not null check(revenue_cents between 0 and 9000000000000), direct_cents bigint not null check(direct_cents between 0 and 9000000000000), evidence text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(period_id,code), unique(period_id,id));
create table pools(id uuid primary key default gen_random_uuid(), period_id uuid not null references periods, code text not null, name text not null, cost_cents bigint not null check(cost_cents between 0 and 9000000000000), unit text not null, owner text not null, review_due date not null, evidence text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(period_id,code), unique(period_id,id));
create table drivers(id uuid primary key default gen_random_uuid(), period_id uuid not null references periods, pool_id uuid not null, object_id uuid not null, quantity numeric(18,4) not null check(quantity>=0 and quantity<=900000000), evidence text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key(period_id,pool_id) references pools(period_id,id), foreign key(period_id,object_id) references objects(period_id,id), unique(pool_id,object_id));
create table runs(id uuid primary key default gen_random_uuid(), period_id uuid not null references periods, revision integer not null, snapshot jsonb not null, operator text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table signatures(id uuid primary key default gen_random_uuid(), run_id uuid not null unique references runs, operator text not null, reason text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table history(id uuid primary key default gen_random_uuid(), period_id uuid references periods, action text not null, operator text not null, detail jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table imports(id uuid primary key default gen_random_uuid(), period_id uuid not null references periods, kind text not null, digest text not null, row_count integer not null, mapping jsonb not null, operator text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(period_id,kind,digest));
do $$ declare t text; begin
 foreach t in array array['workspace','periods','objects','pools','drivers'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated()',t);
 end loop;
 foreach t in array array['runs','signatures','history','imports'] loop
 execute format('create trigger immutable before update or delete on %I for each row execute function immutable_record()',t);
 end loop;
 foreach t in array array['workspace','periods','objects','pools','drivers','runs','signatures','history','imports'] loop
 execute format('alter table %I enable row level security',t); execute format('revoke all on %I from public',t);
 end loop;
end $$;
-- Largest remainder allocates whole cents, with stable object-code tie breaking.
create view v_allocations as
with weights as (
 select d.period_id,d.pool_id,d.object_id,p.code pool,o.code object,o.name,p.cost_cents,d.quantity,
 sum(d.quantity) over(partition by d.pool_id) total
 from drivers d join pools p on p.id=d.pool_id join objects o on o.id=d.object_id
), shares as (
 select *,case when total>0 then cost_cents::numeric*quantity/total else 0 end exact from weights
), ranked as (
 select *,floor(exact) base, row_number() over(partition by pool_id order by exact-floor(exact) desc,object) rank,
 sum(floor(exact)) over(partition by pool_id) base_total from shares
)
select period_id,pool_id,object_id,pool,object,name,quantity,
(case when total=0 then 0 else base+case when rank<=cost_cents-base_total then 1 else 0 end end)::bigint allocated_cents
from ranked;
create view v_pool_review as
select p.*,coalesce(d.quantity,0) quantity,coalesce(a.allocated_cents,0)::bigint allocated_cents,
p.cost_cents-coalesce(a.allocated_cents,0)::bigint unallocated_cents,
(p.review_due<current_date) overdue
from pools p
left join (select pool_id,sum(quantity) quantity from drivers group by pool_id) d on d.pool_id=p.id
left join (select pool_id,sum(allocated_cents) allocated_cents from v_allocations group by pool_id) a on a.pool_id=p.id;
create view v_margins as
select o.*,coalesce(a.allocated_cents,0)::bigint overhead_cents,
(o.revenue_cents-o.direct_cents-coalesce(a.allocated_cents,0))::bigint contribution_cents
from objects o left join (select object_id,sum(allocated_cents) allocated_cents from v_allocations group by object_id) a on a.object_id=o.id;
revoke all on v_allocations,v_pool_review,v_margins from public;
