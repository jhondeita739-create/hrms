-- Public careers portal additions. Safe to apply after an existing HRMS installation.
update public.organizations set name='HRMS Demo', slug='hrms-demo'
where id='00000000-0000-0000-0000-000000000001' and slug <> 'hrms-demo';

alter table public.applicants add column if not exists linkedin_url text;
alter table public.applicants add column if not exists privacy_consent_at timestamptz;
alter table public.job_applications add column if not exists cover_letter text;

create table if not exists public.applicant_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  job_application_id uuid references public.job_applications(id) on delete cascade,
  document_type text not null,
  title text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  verification_status text not null default 'submitted',
  notes text,
  uploaded_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.applicant_documents enable row level security;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='applicant_documents' and policyname='applicant_documents_read') then
    create policy applicant_documents_read on public.applicant_documents for select to authenticated
      using(organization_id=public.current_org_id() and public.has_permission('applicants.view'));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='applicant_documents' and policyname='applicant_documents_manage') then
    create policy applicant_documents_manage on public.applicant_documents for all to authenticated
      using(organization_id=public.current_org_id() and public.has_permission('applicants.edit'))
      with check(organization_id=public.current_org_id() and public.has_permission('applicants.edit'));
  end if;
end $$;

update storage.buckets
set file_size_limit=10485760,
    allowed_mime_types=array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id='applicant-documents';
