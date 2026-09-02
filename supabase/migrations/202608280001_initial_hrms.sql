-- HRMS: normalized PostgreSQL foundation
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name text not null default '',
  avatar_path text,
  job_title text,
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);
create table public.role_permissions (
  role_id uuid references public.roles(id) on delete cascade,
  permission_id uuid references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
create table public.user_roles (
  user_id uuid references public.profiles(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table public.business_units (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, code text not null, status text not null default 'active', created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  business_unit_id uuid references public.business_units(id), name text not null, code text not null,
  manager_id uuid references public.profiles(id), status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create table public.locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, city text, country text not null default 'Philippines', timezone text not null default 'Asia/Manila', status text not null default 'active'
);
create table public.positions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  department_id uuid references public.departments(id), title text not null, code text not null, level text,
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.recruitment_stages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, stage_order integer not null, stage_type text not null default 'active' check (stage_type in ('active','hired','rejected','withdrawn')),
  color text not null default 'slate', is_active boolean not null default true, unique (organization_id, name)
);

create table public.applicants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  applicant_number text not null, first_name text not null, middle_name text, last_name text not null, suffix text, preferred_name text,
  email text not null, phone text not null, alternative_phone text, city text, region text,
  linkedin_url text, privacy_consent_at timestamptz,
  current_job_title text, current_employer text, years_experience numeric(4,1), expected_salary numeric(14,2), availability_date date,
  source text not null default 'Direct', tags text[] not null default '{}', status text not null default 'active' check (status in ('active','hired','withdrawn','archived')),
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, applicant_number)
);
create unique index applicants_org_email_active on public.applicants(organization_id, lower(email)) where deleted_at is null;

create table public.applicant_education (
  id uuid primary key default gen_random_uuid(), applicant_id uuid not null references public.applicants(id) on delete cascade,
  school text not null, degree text, field_of_study text, start_date date, end_date date, graduation_date date, honors text, description text,
  created_at timestamptz not null default now()
);
create table public.applicant_experience (
  id uuid primary key default gen_random_uuid(), applicant_id uuid not null references public.applicants(id) on delete cascade,
  company text not null, position text not null, employment_type text, start_date date, end_date date, currently_employed boolean not null default false,
  responsibilities text, achievements text, created_at timestamptz not null default now()
);

create table public.job_vacancies (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  vacancy_number text not null, title text not null, department_id uuid references public.departments(id), position_id uuid references public.positions(id),
  hiring_manager_id uuid references public.profiles(id), assigned_recruiter_id uuid references public.profiles(id),
  employment_type text not null, work_arrangement text not null, location_id uuid references public.locations(id), number_of_openings integer not null default 1 check (number_of_openings > 0),
  description text, responsibilities text, qualifications text, required_skills text[] not null default '{}', preferred_skills text[] not null default '{}',
  salary_min numeric(14,2), salary_max numeric(14,2), currency char(3) not null default 'PHP', target_start_date date, closing_date date,
  publish_scope text not null default 'both', status text not null default 'draft' check (status in ('draft','open','paused','closed','filled','cancelled')),
  published_at timestamptz, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (organization_id, vacancy_number)
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  application_number text not null, applicant_id uuid not null references public.applicants(id), job_vacancy_id uuid not null references public.job_vacancies(id),
  current_stage_id uuid references public.recruitment_stages(id), assigned_recruiter_id uuid references public.profiles(id),
  application_status text not null default 'in_progress', applied_at timestamptz not null default now(), cover_letter text, rating numeric(2,1), final_result text,
  rejection_reason text, withdrawn_at timestamptz, hired_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, application_number), unique (applicant_id, job_vacancy_id)
);
create table public.applicant_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  applicant_id uuid not null references public.applicants(id) on delete cascade, job_application_id uuid references public.job_applications(id) on delete cascade,
  document_type text not null, title text not null, storage_path text not null, file_name text not null, file_size bigint, mime_type text,
  verification_status text not null default 'submitted', notes text, uploaded_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.application_stage_history (
  id uuid primary key default gen_random_uuid(), job_application_id uuid not null references public.job_applications(id) on delete cascade,
  from_stage_id uuid references public.recruitment_stages(id), to_stage_id uuid not null references public.recruitment_stages(id),
  changed_by uuid references public.profiles(id), reason text, changed_at timestamptz not null default now()
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  job_application_id uuid not null references public.job_applications(id), stage_id uuid references public.recruitment_stages(id), interview_type text not null,
  scheduled_start timestamptz not null, scheduled_end timestamptz not null, timezone text not null default 'Asia/Manila', location text, meeting_url text, instructions text,
  status text not null default 'scheduled', created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.interview_participants (
  interview_id uuid references public.interviews(id) on delete cascade, user_id uuid references public.profiles(id), role text not null default 'interviewer', primary key (interview_id,user_id)
);
create table public.interview_evaluations (
  id uuid primary key default gen_random_uuid(), interview_id uuid not null references public.interviews(id), evaluator_id uuid not null references public.profiles(id),
  recommendation text not null, comments text, submitted_at timestamptz, created_at timestamptz not null default now(), unique(interview_id,evaluator_id)
);

create table public.job_offers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), job_application_id uuid not null references public.job_applications(id),
  offer_number text not null, current_version integer not null default 1, status text not null default 'draft', proposed_start_date date, expires_at timestamptz,
  sent_at timestamptz, accepted_at timestamptz, declined_at timestamptz, created_by uuid references public.profiles(id), approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,offer_number)
);
create table public.job_offer_versions (
  id uuid primary key default gen_random_uuid(), job_offer_id uuid not null references public.job_offers(id) on delete cascade, version integer not null,
  position_title text not null, employment_type text not null, salary numeric(14,2) not null, currency char(3) not null default 'PHP', allowances jsonb not null default '{}',
  work_arrangement text, probation_months integer, terms text, storage_path text, created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  unique(job_offer_id,version)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), employee_number text not null, user_id uuid references public.profiles(id),
  source_applicant_id uuid references public.applicants(id), first_name text not null, middle_name text, last_name text not null, suffix text, preferred_name text,
  work_email text not null, personal_email text, phone text, hire_date date not null, employment_status text not null default 'active',
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique(organization_id,employee_number), unique(organization_id,work_email)
);
create table public.employment_records (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id), position_id uuid references public.positions(id),
  department_id uuid references public.departments(id), supervisor_id uuid references public.employees(id), employment_type text not null, work_arrangement text,
  salary numeric(14,2), currency char(3) default 'PHP', effective_from date not null, effective_to date, is_current boolean not null default true, created_at timestamptz not null default now()
);
create unique index one_current_employment_record on public.employment_records(employee_id) where is_current;
create table public.employee_movements (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), employee_id uuid not null references public.employees(id),
  movement_type text not null, effective_date date not null, previous_employment_record_id uuid references public.employment_records(id), new_employment_record_id uuid references public.employment_records(id),
  reason text not null, remarks text, status text not null default 'draft', requested_by uuid references public.profiles(id), approved_by uuid references public.profiles(id), approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, description text,
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.onboarding_template_tasks (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  title text not null, description text, category text not null, assigned_role text, due_offset_days integer not null default 0, required boolean not null default true, task_order integer not null default 0
);
create table public.employee_onboarding (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), employee_id uuid not null references public.employees(id),
  job_offer_id uuid references public.job_offers(id), template_id uuid references public.onboarding_templates(id), owner_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  start_date date not null, status text not null default 'not_started' check(status in ('not_started','in_progress','ready','completed','cancelled')),
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(), onboarding_id uuid not null references public.employee_onboarding(id) on delete cascade,
  title text not null, description text, category text not null, assigned_to uuid references public.profiles(id), due_date date, required boolean not null default true,
  status text not null default 'pending', completed_at timestamptz, completed_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.document_types (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, code text not null,
  applies_to text not null default 'employee', has_expiration boolean not null default false, default_confidentiality text not null default 'standard', status text not null default 'active',
  unique(organization_id,code)
);
create table public.employee_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), employee_id uuid not null references public.employees(id),
  document_type_id uuid references public.document_types(id), title text not null, document_number text, storage_path text, file_name text,
  issued_date date, expiration_date date, verification_status text not null default 'pending', verified_by uuid references public.profiles(id), verified_at timestamptz,
  confidentiality_level text not null default 'standard', status text not null default 'active', notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), employee_document_id uuid not null references public.employee_documents(id) on delete cascade,
  version integer not null, storage_path text not null, file_name text not null, file_size bigint, mime_type text, uploaded_by uuid references public.profiles(id), created_at timestamptz not null default now(),
  unique(employee_document_id,version)
);

create table public.hr_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), request_number text not null,
  employee_id uuid not null references public.employees(id), request_type text not null, subject text not null, details jsonb not null default '{}', status text not null default 'draft',
  submitted_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,request_number)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), recipient_id uuid not null references public.profiles(id),
  title text not null, body text not null, event_type text not null, entity_type text, entity_id uuid, href text, status text not null default 'unread', created_at timestamptz not null default now(), read_at timestamptz
);
create table public.audit_logs (
  id bigint generated always as identity primary key, organization_id uuid references public.organizations(id), actor_id uuid references public.profiles(id),
  action text not null, entity_type text not null, entity_id uuid, before_values jsonb, after_values jsonb, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['profiles','departments','positions','applicants','job_vacancies','job_applications','interviews','job_offers','employees','employee_movements','onboarding_templates','employee_onboarding','onboarding_tasks','employee_documents','hr_requests'] loop execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t); end loop; end $$;

create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path='' as $$
  select organization_id from public.profiles where id = auth.uid()
$$;
create or replace function public.has_permission(permission_key text) returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id
    where ur.user_id=auth.uid() and (p.key=permission_key or p.key='*')
  )
$$;
create or replace function public.is_interview_participant(interview_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.interview_participants where interview_id=interview_uuid and user_id=auth.uid())
$$;
create or replace function public.interview_in_current_org(interview_uuid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.interviews where id=interview_uuid and organization_id=public.current_org_id())
$$;

-- Auth bootstrap: the first account is an administrator; later accounts are employees until assigned.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid; admin_role uuid;
begin
  select id into org from public.organizations order by created_at limit 1;
  if org is null then insert into public.organizations(name,slug) values ('My Organization','my-organization') returning id into org; end if;
  insert into public.profiles(id,organization_id,full_name) values (new.id,org,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)));
  if (select count(*) from public.profiles)=1 then
    insert into public.roles(key,name) values ('super_admin','Super administrator') on conflict(key) do update set name=excluded.name returning id into admin_role;
    insert into public.permissions(key,description) values ('*','All permissions') on conflict(key) do nothing;
    insert into public.role_permissions(role_id,permission_id) select admin_role,id from public.permissions where key='*' on conflict do nothing;
    insert into public.user_roles(user_id,role_id) values(new.id,admin_role) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.roles(key,name) values
('hr_admin','HR administrator'),('hr_manager','HR manager'),('recruiter','Recruiter'),('hiring_manager','Hiring manager'),('onboarding_specialist','Onboarding specialist'),('records_officer','Records officer'),('employee','Employee') on conflict do nothing;
insert into public.permissions(key,description) values
('dashboard.view','View HR dashboard'),('applicants.view','View applicants'),('applicants.create','Create applicants'),('applicants.edit','Edit applicants'),('applicants.archive','Archive applicants'),
('vacancies.view','View vacancies'),('vacancies.create','Create vacancies'),('vacancies.edit','Edit vacancies'),('vacancies.archive','Archive vacancies'),
('organization.manage','Manage organization structure'),
('employees.view','View employees'),('employees.create','Create employees'),('employees.edit','Edit employees'),('employees.archive','Archive employees'),
('onboarding.view','View onboarding'),('onboarding.manage','Manage onboarding'),('documents.view','View employee documents'),('documents.manage','Manage employee documents'),('confidential_documents.view','View confidential documents'),('audit.view','View audit events')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key='hr_admin' and p.key<>'*' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.key='recruiter' and p.key like 'applicants.%') or (r.key='recruiter' and p.key like 'vacancies.%')
   or (r.key='onboarding_specialist' and p.key like 'onboarding.%') or (r.key='records_officer' and p.key like 'documents.%')
on conflict do nothing;

-- RLS: organization isolation plus granular mutation permissions.
do $$ declare t text; begin foreach t in array array['business_units','departments','locations','positions','recruitment_stages'] loop execute format('alter table public.%I enable row level security',t); execute format('create policy org_read on public.%I for select to authenticated using (organization_id=public.current_org_id())',t); end loop; end $$;
create policy departments_insert on public.departments for insert to authenticated with check(organization_id=public.current_org_id() and public.has_permission('organization.manage'));
create policy departments_update on public.departments for update to authenticated using(organization_id=public.current_org_id() and public.has_permission('organization.manage')) with check(organization_id=public.current_org_id());
alter table public.organizations enable row level security;
create policy own_organization_read on public.organizations for select to authenticated using(id=public.current_org_id());
alter table public.applicants enable row level security;
create policy applicants_read on public.applicants for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('applicants.view'));
create policy applicants_insert on public.applicants for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('applicants.create'));
create policy applicants_update on public.applicants for update to authenticated using (organization_id=public.current_org_id() and public.has_permission('applicants.edit')) with check (organization_id=public.current_org_id());
alter table public.job_vacancies enable row level security;
create policy vacancies_read on public.job_vacancies for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('vacancies.view'));
create policy vacancies_insert on public.job_vacancies for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('vacancies.create'));
create policy vacancies_update on public.job_vacancies for update to authenticated using (organization_id=public.current_org_id() and public.has_permission('vacancies.edit')) with check (organization_id=public.current_org_id());
alter table public.employees enable row level security;
create policy employees_read on public.employees for select to authenticated using (organization_id=public.current_org_id() and (public.has_permission('employees.view') or user_id=auth.uid()));
create policy employees_insert on public.employees for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('employees.create'));
create policy employees_update on public.employees for update to authenticated using (organization_id=public.current_org_id() and public.has_permission('employees.edit')) with check (organization_id=public.current_org_id());
alter table public.onboarding_templates enable row level security;
create policy onboarding_templates_read on public.onboarding_templates for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('onboarding.view'));
alter table public.employee_onboarding enable row level security;
create policy onboarding_read on public.employee_onboarding for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('onboarding.view'));
create policy onboarding_insert on public.employee_onboarding for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'));
create policy onboarding_update on public.employee_onboarding for update to authenticated using (organization_id=public.current_org_id() and public.has_permission('onboarding.manage')) with check (organization_id=public.current_org_id());
alter table public.document_types enable row level security;
create policy document_types_read on public.document_types for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('documents.view'));
alter table public.employee_documents enable row level security;
create policy documents_read on public.employee_documents for select to authenticated using (organization_id=public.current_org_id() and ((public.has_permission('documents.view') and (confidentiality_level<>'highly_confidential' or public.has_permission('confidential_documents.view'))) or (confidentiality_level='standard' and exists(select 1 from public.employees e where e.id=employee_id and e.user_id=auth.uid()))));
create policy documents_insert on public.employee_documents for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('documents.manage'));
create policy documents_update on public.employee_documents for update to authenticated using (organization_id=public.current_org_id() and public.has_permission('documents.manage')) with check (organization_id=public.current_org_id());
alter table public.employee_movements enable row level security;
create policy movements_read on public.employee_movements for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('employees.view'));
create policy movements_insert on public.employee_movements for insert to authenticated with check (organization_id=public.current_org_id() and public.has_permission('employees.edit'));
alter table public.notifications enable row level security;
create policy own_notifications on public.notifications for select to authenticated using (organization_id=public.current_org_id() and recipient_id=auth.uid());
create policy own_notifications_update on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using (organization_id=public.current_org_id() and public.has_permission('audit.view'));
create policy audit_insert on public.audit_logs for insert to authenticated with check (organization_id=public.current_org_id() and actor_id=auth.uid());
alter table public.profiles enable row level security;
create policy profile_org_read on public.profiles for select to authenticated using (organization_id=public.current_org_id() or id=auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
create policy roles_read on public.roles for select to authenticated using(true);
create policy permissions_read on public.permissions for select to authenticated using(true);
create policy role_permissions_read on public.role_permissions for select to authenticated using(true);
create policy own_roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_permission('*'));
create policy admin_roles_manage on public.user_roles for all to authenticated using(public.has_permission('*')) with check(public.has_permission('*'));

alter table public.applicant_education enable row level security;
alter table public.applicant_experience enable row level security;
create policy applicant_education_read on public.applicant_education for select to authenticated using(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.view')));
create policy applicant_education_manage on public.applicant_education for all to authenticated using(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.edit'))) with check(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.edit')));
create policy applicant_experience_read on public.applicant_experience for select to authenticated using(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.view')));
create policy applicant_experience_manage on public.applicant_experience for all to authenticated using(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.edit'))) with check(exists(select 1 from public.applicants a where a.id=applicant_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.edit')));

alter table public.job_applications enable row level security;
create policy applications_read on public.job_applications for select to authenticated using(organization_id=public.current_org_id() and (public.has_permission('applicants.view') or public.has_permission('vacancies.view')));
create policy applications_insert on public.job_applications for insert to authenticated with check(organization_id=public.current_org_id() and public.has_permission('applicants.edit'));
create policy applications_update on public.job_applications for update to authenticated using(organization_id=public.current_org_id() and public.has_permission('applicants.edit')) with check(organization_id=public.current_org_id());
alter table public.application_stage_history enable row level security;
create policy stage_history_read on public.application_stage_history for select to authenticated using(exists(select 1 from public.job_applications a where a.id=job_application_id and a.organization_id=public.current_org_id()));
create policy stage_history_insert on public.application_stage_history for insert to authenticated with check(exists(select 1 from public.job_applications a where a.id=job_application_id and a.organization_id=public.current_org_id() and public.has_permission('applicants.edit')));
alter table public.applicant_documents enable row level security;
create policy applicant_documents_read on public.applicant_documents for select to authenticated using(organization_id=public.current_org_id() and public.has_permission('applicants.view'));
create policy applicant_documents_manage on public.applicant_documents for all to authenticated using(organization_id=public.current_org_id() and public.has_permission('applicants.edit')) with check(organization_id=public.current_org_id() and public.has_permission('applicants.edit'));

alter table public.interviews enable row level security;
alter table public.interview_participants enable row level security;
alter table public.interview_evaluations enable row level security;
create policy interviews_read on public.interviews for select to authenticated using(organization_id=public.current_org_id() and (public.has_permission('applicants.view') or public.is_interview_participant(id)));
create policy interviews_manage on public.interviews for all to authenticated using(organization_id=public.current_org_id() and public.has_permission('applicants.edit')) with check(organization_id=public.current_org_id() and public.has_permission('applicants.edit'));
create policy participants_read on public.interview_participants for select to authenticated using(user_id=auth.uid() or (public.interview_in_current_org(interview_id) and public.has_permission('applicants.view')));
create policy evaluations_read on public.interview_evaluations for select to authenticated using(evaluator_id=auth.uid() or (submitted_at is not null and public.has_permission('applicants.view')));
create policy own_evaluation_manage on public.interview_evaluations for all to authenticated using(evaluator_id=auth.uid()) with check(evaluator_id=auth.uid());

alter table public.job_offers enable row level security;
alter table public.job_offer_versions enable row level security;
create policy offers_read on public.job_offers for select to authenticated using(organization_id=public.current_org_id() and public.has_permission('vacancies.view'));
create policy offers_manage on public.job_offers for all to authenticated using(organization_id=public.current_org_id() and public.has_permission('vacancies.edit')) with check(organization_id=public.current_org_id() and public.has_permission('vacancies.edit'));
create policy offer_versions_read on public.job_offer_versions for select to authenticated using(exists(select 1 from public.job_offers o where o.id=job_offer_id and o.organization_id=public.current_org_id() and public.has_permission('vacancies.view')));
create policy offer_versions_manage on public.job_offer_versions for all to authenticated using(exists(select 1 from public.job_offers o where o.id=job_offer_id and o.organization_id=public.current_org_id() and public.has_permission('vacancies.edit'))) with check(exists(select 1 from public.job_offers o where o.id=job_offer_id and o.organization_id=public.current_org_id() and public.has_permission('vacancies.edit')));

alter table public.employment_records enable row level security;
create policy employment_records_read on public.employment_records for select to authenticated using(exists(select 1 from public.employees e where e.id=employee_id and e.organization_id=public.current_org_id() and (public.has_permission('employees.view') or e.user_id=auth.uid())));
create policy employment_records_manage on public.employment_records for all to authenticated using(exists(select 1 from public.employees e where e.id=employee_id and e.organization_id=public.current_org_id() and public.has_permission('employees.edit'))) with check(exists(select 1 from public.employees e where e.id=employee_id and e.organization_id=public.current_org_id() and public.has_permission('employees.edit')));

alter table public.onboarding_template_tasks enable row level security;
alter table public.onboarding_tasks enable row level security;
create policy template_tasks_read on public.onboarding_template_tasks for select to authenticated using(exists(select 1 from public.onboarding_templates t where t.id=template_id and t.organization_id=public.current_org_id() and public.has_permission('onboarding.view')));
create policy onboarding_tasks_read on public.onboarding_tasks for select to authenticated using(exists(select 1 from public.employee_onboarding o where o.id=onboarding_id and o.organization_id=public.current_org_id() and public.has_permission('onboarding.view')));
create policy onboarding_tasks_manage on public.onboarding_tasks for all to authenticated using(exists(select 1 from public.employee_onboarding o where o.id=onboarding_id and o.organization_id=public.current_org_id() and public.has_permission('onboarding.manage'))) with check(exists(select 1 from public.employee_onboarding o where o.id=onboarding_id and o.organization_id=public.current_org_id() and public.has_permission('onboarding.manage')));

alter table public.document_versions enable row level security;
create policy document_versions_read on public.document_versions for select to authenticated using(exists(select 1 from public.employee_documents d where d.id=employee_document_id and d.organization_id=public.current_org_id()));
create policy document_versions_manage on public.document_versions for all to authenticated using(exists(select 1 from public.employee_documents d where d.id=employee_document_id and d.organization_id=public.current_org_id() and public.has_permission('documents.manage'))) with check(exists(select 1 from public.employee_documents d where d.id=employee_document_id and d.organization_id=public.current_org_id() and public.has_permission('documents.manage')));

alter table public.hr_requests enable row level security;
create policy requests_read on public.hr_requests for select to authenticated using(organization_id=public.current_org_id() and (public.has_permission('employees.view') or exists(select 1 from public.employees e where e.id=employee_id and e.user_id=auth.uid())));

-- Private storage buckets. Signed URLs are created only after an authorized database lookup.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('applicant-documents','applicant-documents',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
('employee-documents','employee-documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
('contracts','contracts',false,10485760,array['application/pdf']),
('assessment-files','assessment-files',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
('hr-exports','hr-exports',false,52428800,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
create policy hr_document_upload on storage.objects for insert to authenticated with check (
  bucket_id in ('applicant-documents','employee-documents','contracts','assessment-files') and
  (public.has_permission('documents.manage') or public.has_permission('applicants.edit'))
);
create policy hr_document_read on storage.objects for select to authenticated using (
  (bucket_id='applicant-documents' and public.has_permission('applicants.view')) or
  (bucket_id in ('employee-documents','contracts') and exists(select 1 from public.employee_documents d where d.storage_path=name)) or
  (bucket_id='assessment-files' and public.has_permission('applicants.view')) or
  (bucket_id='hr-exports' and (public.has_permission('employees.view') or public.has_permission('applicants.view')))
);

-- Seed organization references only. Operational records are created through the application.
insert into public.organizations(id,name,slug) values ('00000000-0000-0000-0000-000000000001','HRMS Demo','hrms-demo') on conflict do nothing;
insert into public.departments(id,organization_id,name,code) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','People & Culture','P&C'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Finance','FIN'),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Technology','TECH'),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Operations','OPS') on conflict do nothing;
insert into public.recruitment_stages(organization_id,name,stage_order,stage_type,color) values
('00000000-0000-0000-0000-000000000001','Applied',10,'active','slate'),('00000000-0000-0000-0000-000000000001','Screening',20,'active','blue'),
('00000000-0000-0000-0000-000000000001','HR Interview',30,'active','violet'),('00000000-0000-0000-0000-000000000001','Assessment',40,'active','amber'),
('00000000-0000-0000-0000-000000000001','Final Interview',50,'active','indigo'),('00000000-0000-0000-0000-000000000001','Offer',60,'active','orange'),
('00000000-0000-0000-0000-000000000001','Hired',70,'hired','green'),('00000000-0000-0000-0000-000000000001','Rejected',80,'rejected','red')
on conflict do nothing;
insert into public.document_types(organization_id,name,code,applies_to,has_expiration,default_confidentiality) values
('00000000-0000-0000-0000-000000000001','Employment Contract','CONTRACT','employee',true,'confidential'),
('00000000-0000-0000-0000-000000000001','Government ID','GOV_ID','employee',true,'confidential'),
('00000000-0000-0000-0000-000000000001','Certification','CERT','employee',true,'standard'),
('00000000-0000-0000-0000-000000000001','Training Certificate','TRAINING','employee',true,'standard'),
('00000000-0000-0000-0000-000000000001','Other','OTHER','employee',false,'standard') on conflict do nothing;
insert into public.onboarding_templates(id,organization_id,name,description) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Standard new hire','Default cross-functional preparation for new employees') on conflict do nothing;
insert into public.onboarding_template_tasks(template_id,title,category,assigned_role,due_offset_days,required,task_order) values
('20000000-0000-0000-0000-000000000001','Review personal information','Pre-employment','onboarding_specialist',-10,true,10),
('20000000-0000-0000-0000-000000000001','Verify government ID','Pre-employment','records_officer',-7,true,20),
('20000000-0000-0000-0000-000000000001','Prepare employment contract','HR setup','hr_admin',-5,true,30),
('20000000-0000-0000-0000-000000000001','Create company email','IT setup','onboarding_specialist',-3,true,40),
('20000000-0000-0000-0000-000000000001','Assign equipment','IT setup','onboarding_specialist',-1,true,50),
('20000000-0000-0000-0000-000000000001','Company orientation','Orientation','onboarding_specialist',0,true,60),
('20000000-0000-0000-0000-000000000001','Department orientation','Orientation','department_manager',1,true,70);
