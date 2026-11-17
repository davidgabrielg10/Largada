-- =====================================================================
-- LARGADA — schema do banco (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
-- É seguro rodar mais de uma vez (usa IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- EVENTOS
-- next_bib é o contador da numeração de 3 dígitos (001, 002, ...).
-- ---------------------------------------------------------------------
create table if not exists events (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  event_date        date not null,
  city              text,
  description       text,
  pix_key           text,
  base_price        numeric(10,2) not null check (base_price >= 0),
  registration_open boolean not null default true,
  next_bib          integer not null default 1,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CATEGORIAS (regras de cada categoria do evento)
-- min_age/max_age: validação de idade (gera alerta, não bloqueia).
-- min_weight_kg: usado pelo "Peso Pesado 95+".
-- min_athletes: abaixo disso a categoria é sinalizada para unificação.
-- ---------------------------------------------------------------------
create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  name          text not null,
  price         numeric(10,2) not null check (price >= 0),
  min_age       integer check (min_age is null or min_age >= 0),
  max_age       integer check (max_age is null or max_age >= 0),
  min_weight_kg numeric(5,1),
  min_athletes  integer not null default 10,
  sort_order    integer not null default 0,
  unique (event_id, name),
  check (min_age is null or max_age is null or min_age <= max_age)
);

-- ---------------------------------------------------------------------
-- PREMIAÇÃO (para o relatório de patrocinador)
-- amount nulo + is_trophy = troféu
-- ---------------------------------------------------------------------
create table if not exists prizes (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  place       integer not null check (place between 1 and 20),
  amount      numeric(10,2) check (amount is null or amount >= 0),
  is_trophy   boolean not null default false,
  unique (category_id, place)
);

-- ---------------------------------------------------------------------
-- INSCRIÇÕES
-- bib_number: número do atleta, gerado pelo banco, nunca reaproveitado.
-- bib_label : o mesmo número com 3 dígitos ("001"); passa de 999 sozinho.
-- ---------------------------------------------------------------------
create table if not exists registrations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events(id) on delete cascade,
  category_id        uuid not null references categories(id),
  bib_number         integer,
  bib_label          text generated always as (
                       case when bib_number < 1000
                            then lpad(bib_number::text, 3, '0')
                            else bib_number::text
                       end) stored,
  full_name          text not null check (length(trim(full_name)) >= 3),
  email              text,
  city               text,
  team               text,
  whatsapp           text not null,
  birth_date         date not null,
  weight_kg          numeric(5,1),
  emergency_contact  text,
  terms_accepted     boolean not null default false,
  terms_accepted_at  timestamptz,
  source             text not null default 'link'
                     check (source in ('link', 'assisted', 'import')),
  status             text not null default 'active'
                     check (status in ('active', 'cancelled')),
  payment_status     text not null default 'pending'
                     check (payment_status in ('pending', 'verified', 'review', 'mismatch')),
  flags              jsonb not null default '[]'::jsonb,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (event_id, bib_number)
);

create index if not exists registrations_event_idx    on registrations (event_id);
create index if not exists registrations_category_idx on registrations (category_id);

-- ---------------------------------------------------------------------
-- COMPROVANTES (o arquivo fica no Storage; aqui ficam os dados lidos)
-- sha256 e transaction_id servem para detectar comprovante repetido.
-- ---------------------------------------------------------------------
create table if not exists receipts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  storage_path    text not null,
  sha256          text,
  ai_status       text not null default 'pending'
                  check (ai_status in ('pending', 'done', 'failed')),
  amount          numeric(10,2),
  payer_name      text,
  paid_at         timestamptz,
  transaction_id  text,
  ai_raw          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists receipts_registration_idx on receipts (registration_id);
create index if not exists receipts_sha_idx          on receipts (event_id, sha256);
create index if not exists receipts_tx_idx           on receipts (event_id, transaction_id);

-- ---------------------------------------------------------------------
-- SORTEIOS
-- ---------------------------------------------------------------------
create table if not exists raffles (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  prize_label     text,
  drawn_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NUMERAÇÃO ATÔMICA + validações de segurança
-- O UPDATE trava a linha do evento, então duas inscrições simultâneas
-- nunca recebem o mesmo número.
-- ---------------------------------------------------------------------
create or replace function registrations_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date > (current_date - interval '5 years')
     or new.birth_date < date '1920-01-01' then
    raise exception 'data_nascimento_invalida: %', new.birth_date
      using errcode = '22007';
  end if;

  if new.bib_number is null then
    update events
       set next_bib = next_bib + 1
     where id = new.event_id
    returning next_bib - 1 into new.bib_number;

    if new.bib_number is null then
      raise exception 'evento_nao_encontrado' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_before_insert_trg on registrations;
create trigger registrations_before_insert_trg
  before insert on registrations
  for each row execute function registrations_before_insert();

-- ---------------------------------------------------------------------
-- VISÃO: situação de cada categoria (alerta de "menos de 10 atletas")
-- Conta inscrições ativas. security_invoker respeita o RLS.
-- ---------------------------------------------------------------------
create or replace view category_status
with (security_invoker = true) as
select
  c.id                                                       as category_id,
  c.event_id,
  c.name                                                     as category_name,
  c.min_athletes,
  count(r.id) filter (where r.status = 'active')             as athletes,
  count(r.id) filter (where r.status = 'active'
                        and r.payment_status = 'verified')   as athletes_paid,
  (count(r.id) filter (where r.status = 'active')
     < c.min_athletes)                                       as below_minimum
from categories c
left join registrations r on r.category_id = c.id
group by c.id;

-- ---------------------------------------------------------------------
-- SEGURANÇA
-- Todo acesso passa pelo servidor do app (chave de serviço). Nenhuma
-- tabela fica aberta para o navegador: RLS ligado e sem políticas.
-- ---------------------------------------------------------------------
alter table events        enable row level security;
alter table categories    enable row level security;
alter table prizes        enable row level security;
alter table registrations enable row level security;
alter table receipts      enable row level security;
alter table raffles       enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on events, categories, prizes, registrations, receipts, raffles, category_status from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on events, categories, prizes, registrations, receipts, raffles, category_status from authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- STORAGE: bucket privado para os comprovantes (máx. 5 MB, só imagem/PDF)
-- Só roda no Supabase (onde o schema "storage" existe).
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('comprovantes', 'comprovantes', false, 5242880,
            array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- DADOS INICIAIS: 2º Rachão Ritmo & Giro — Etapa Nazaré da Mata
-- Valores e premiação conforme o flyer do evento.
-- ATENÇÃO: as faixas de idade abaixo são uma SUPOSIÇÃO (+20 = 20 a 29,
-- +30 = 30 a 39 ...). Confirme com a organização e ajuste se preciso:
--   update categories set min_age = .., max_age = .. where name = '+20';
-- Sem dados de participantes: a demo usa gente fictícia (is_demo = true).
-- ---------------------------------------------------------------------
insert into events (slug, name, event_date, city, description, base_price)
values ('rachao-nazare',
        '2º Rachão Ritmo & Giro — Etapa Nazaré da Mata',
        date '2026-12-20',
        'Nazaré da Mata - PE',
        'Categorias com menos de 10 atletas serão unificadas. A premiação só vale com 10 atletas em cada categoria.',
        80.00)
on conflict (slug) do nothing;

insert into categories (event_id, name, price, min_age, max_age, min_weight_kg, sort_order)
select e.id, v.name, v.price, v.min_age, v.max_age, v.min_weight, v.sort_order
from events e
cross join (values
  ('+20',          80.00, 20,   29,   null::numeric, 1),
  ('+30',          80.00, 30,   39,   null,          2),
  ('+40',          80.00, 40,   49,   null,          3),
  ('+50',          80.00, 50,   59,   null,          4),
  ('+60',          80.00, 60,   null::int, null,     5),
  ('Peso Pesado 95+', 80.00, null::int, null::int, 95.0, 6),
  ('Feminino',     80.00, null, null, null,          7),
  ('E-Bike',       80.00, null, null, null,          8),
  ('Iniciante',    50.00, null, null, null,          9)
) as v(name, price, min_age, max_age, min_weight, sort_order)
where e.slug = 'rachao-nazare'
on conflict (event_id, name) do nothing;

-- Premiação: 1º 200 / 2º 150 / 3º 100 / 4º e 5º troféu (Iniciante: 150/100/50)
insert into prizes (category_id, place, amount, is_trophy)
select c.id, p.place,
       case when c.name = 'Iniciante' then p.amount_ini else p.amount end,
       p.is_trophy
from categories c
join events e on e.id = c.event_id and e.slug = 'rachao-nazare'
cross join (values
  (1, 200.00, 150.00, false),
  (2, 150.00, 100.00, false),
  (3, 100.00,  50.00, false),
  (4, null::numeric, null::numeric, true),
  (5, null::numeric, null::numeric, true)
) as p(place, amount, amount_ini, is_trophy)
where not (c.name = 'Iniciante' and p.place > 3)
on conflict (category_id, place) do nothing;

-- =====================================================================
-- MIGRAÇÃO 002 (incluída aqui para instalações novas)
-- =====================================================================
-- Como a idade é calculada no evento:
--   event_date = idade no dia da prova;  year_end = idade que completa no ano (comum no ciclismo)
alter table events add column if not exists age_rule text not null default 'event_date';
do $$ begin
  alter table events add constraint events_age_rule_chk check (age_rule in ('event_date', 'year_end'));
exception when duplicate_object then null; end $$;

-- Restrição de sexo da categoria (null = aberta a todos)
alter table categories add column if not exists gender text;
do $$ begin
  alter table categories add constraint categories_gender_chk check (gender in ('M', 'F'));
exception when duplicate_object then null; end $$;

-- Sexo do atleta, link secreto da ficha e entrega do kit
alter table registrations add column if not exists gender text;
do $$ begin
  alter table registrations add constraint registrations_gender_chk check (gender in ('M', 'F'));
exception when duplicate_object then null; end $$;

alter table registrations add column if not exists access_token text;
update registrations set access_token = replace(gen_random_uuid()::text, '-', '') where access_token is null;
alter table registrations alter column access_token set default replace(gen_random_uuid()::text, '-', '');
alter table registrations alter column access_token set not null;
create unique index if not exists registrations_access_token_idx on registrations (access_token);

alter table registrations add column if not exists kit_delivered_at timestamptz;

-- A categoria Feminino do Rachão passa a validar o sexo
update categories set gender = 'F'
 where name = 'Feminino' and gender is null
   and event_id in (select id from events where slug = 'rachao-nazare');

-- Kit é opcional: cada evento diz se entrega (muitos não entregam)
alter table events add column if not exists has_kit boolean not null default false;

-- Presença registrada pelo QR da ficha ou pela lista de largada (só o primeiro horário vale)
alter table registrations add column if not exists checked_in_at timestamptz;

-- ---------------------------------------------------------------------
-- Migração 003 (cópia para instalações novas): inscrição isenta
-- ---------------------------------------------------------------------
alter table registrations add column if not exists exempt boolean not null default false;

-- ---------------------------------------------------------------------
-- Migração 004 (cópia para instalações novas): código de isenção
-- ---------------------------------------------------------------------
alter table events add column if not exists exempt_code text;
