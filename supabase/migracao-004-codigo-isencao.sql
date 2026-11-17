-- Migração 004: código de isenção da organização, por evento.
-- Seguro rodar mais de uma vez.
alter table events add column if not exists exempt_code text;
