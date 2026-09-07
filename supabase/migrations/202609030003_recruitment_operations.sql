-- Recruitment operations: explainable candidate matching and applicant communications.

create table if not exists public.applicant_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_application_id uuid not null references public.job_applications(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  recommendation text not null check (recommendation in ('strong_match','potential_match','manual_review')),
  summary text not null,
  strengths text[] not null default '{}',
  concerns text[] not null default '{}',
  model_name text not null default 'hrms-job-fit-engine',
  model_version text not null default '1.0',
  input_snapshot jsonb not null default '{}',
  generated_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  review_decision text check (review_decision in ('accepted','overridden')),
  review_notes text,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(job_application_id)
);

create table if not exists public.applicant_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  job_application_id uuid references public.job_applications(id) on delete cascade,
  event_type text not null,
  channel text not null default 'portal' check (channel in ('portal','email')),
  recipient text not null,
  subject text not null,
  body text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','read')),
  provider_message_id text,
  error_message text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  created_by uuid references public.profiles(id)
);

create index if not exists applicant_ai_assessments_org_score_idx
  on public.applicant_ai_assessments(organization_id, score desc);
create index if not exists applicant_notifications_application_idx
  on public.applicant_notifications(job_application_id, queued_at desc);

drop trigger if exists set_updated_at on public.applicant_ai_assessments;
create trigger set_updated_at before update on public.applicant_ai_assessments
  for each row execute function public.set_updated_at();

alter table public.applicant_ai_assessments enable row level security;
alter table public.applicant_notifications enable row level security;

create policy ai_assessments_read on public.applicant_ai_assessments
  for select to authenticated
  using (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.view')
  );
create policy ai_assessments_manage on public.applicant_ai_assessments
  for all to authenticated
  using (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.edit')
  )
  with check (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.edit')
  );

create policy applicant_notifications_read on public.applicant_notifications
  for select to authenticated
  using (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.view')
  );
create policy applicant_notifications_manage on public.applicant_notifications
  for all to authenticated
  using (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.edit')
  )
  with check (
    organization_id=public.current_org_id()
    and public.has_permission('applicants.edit')
  );

update storage.buckets
set allowed_mime_types=array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]
where id='applicant-documents';
