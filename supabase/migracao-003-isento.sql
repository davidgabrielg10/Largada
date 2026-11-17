-- Migração 003: inscrição isenta de pagamento (organização, convidados).
-- Seguro rodar mais de uma vez.
alter table registrations add column if not exists exempt boolean not null default false;
