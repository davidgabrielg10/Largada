-- =====================================================================
-- LARGADA — migração 002: categorias configuráveis, ficha do atleta e kit
-- Rode UMA vez no SQL Editor do Supabase, depois do schema.sql.
-- É seguro rodar de novo (IF NOT EXISTS).
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
