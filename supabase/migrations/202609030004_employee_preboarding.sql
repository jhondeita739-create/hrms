-- Employee preboarding: temporary access, requirement submissions, training, and permanent access.

create table if not exists public.employee_account_lifecycle (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  job_application_id uuid unique references public.job_applications(id),
  access_status text not null default 'temporary'
    check (access_status in ('temporary','permanent','suspended')),
  requirements_due_date date not null,
  invited_at timestamptz,
  temporary_started_at timestamptz not null default now(),
  permanent_at timestamptz,
  suspended_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_requirement_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  onboarding_id uuid references public.employee_onboarding(id) on delete cascade,
  document_type_id uuid references public.document_types(id),
  employee_document_id uuid references public.employee_documents(id),
  title text not null,
  description text,
  due_date date not null,
  required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending','submitted','under_review','verified','rejected','waived')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.employee_training_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  employee_id uuid not null references public.employees(id) on delete cascade,
  onboarding_id uuid references public.employee_onboarding(id) on delete cascade,
  title text not null,
  description text,
  training_type text not null default 'orientation',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'Asia/Manila',
  location text,
  meeting_url text,
  status text not null default 'pending_requirements'
    check (status in ('pending_requirements','scheduled','completed','cancelled')),
  notified_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (scheduled_end > scheduled_start)
);

create index if not exists employee_account_lifecycle_org_status_idx
  on public.employee_account_lifecycle(organization_id, access_status);
create index if not exists employee_requirement_requests_employee_status_idx
  on public.employee_requirement_requests(employee_id, status, due_date)
  where deleted_at is null;
create index if not exists employee_training_schedules_employee_start_idx
  on public.employee_training_schedules(employee_id, scheduled_start)
  where deleted_at is null;

drop trigger if exists set_updated_at on public.employee_account_lifecycle;
create trigger set_updated_at before update on public.employee_account_lifecycle
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.employee_requirement_requests;
create trigger set_updated_at before update on public.employee_requirement_requests
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.employee_training_schedules;
create trigger set_updated_at before update on public.employee_training_schedules
  for each row execute function public.set_updated_at();

insert into public.roles(key,name,description) values
  ('preboarding_employee','Preboarding employee','Temporary access to onboarding requirements and training information'),
  ('employee','Employee','Permanent employee self-service access')
on conflict(key) do update set name=excluded.name, description=excluded.description;

insert into public.permissions(key,description) values
  ('self_service.view','View own employee and onboarding information'),
  ('self_service.documents.upload','Submit own requested onboarding documents')
on conflict(key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('preboarding_employee','employee')
  and p.key in ('self_service.view','self_service.documents.upload')
on conflict do nothing;

alter table public.employee_account_lifecycle enable row level security;
alter table public.employee_requirement_requests enable row level security;
alter table public.employee_training_schedules enable row level security;

create policy employee_account_self_read on public.employee_account_lifecycle
  for select to authenticated
  using (user_id=auth.uid());
create policy employee_account_hr_read on public.employee_account_lifecycle
  for select to authenticated
  using (organization_id=public.current_org_id() and public.has_permission('onboarding.view'));
create policy employee_account_hr_manage on public.employee_account_lifecycle
  for all to authenticated
  using (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'))
  with check (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'));

create policy employee_requirements_self_read on public.employee_requirement_requests
  for select to authenticated
  using (
    deleted_at is null and exists(
      select 1 from public.employees e
      where e.id=employee_id and e.user_id=auth.uid()
    )
  );
create policy employee_requirements_hr_manage on public.employee_requirement_requests
  for all to authenticated
  using (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'))
  with check (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'));

create policy employee_training_self_read on public.employee_training_schedules
  for select to authenticated
  using (
    deleted_at is null and status <> 'pending_requirements' and exists(
      select 1 from public.employees e
      where e.id=employee_id and e.user_id=auth.uid()
    )
  );
create policy employee_training_hr_manage on public.employee_training_schedules
  for all to authenticated
  using (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'))
  with check (organization_id=public.current_org_id() and public.has_permission('onboarding.manage'));

create policy onboarding_self_read on public.employee_onboarding
  for select to authenticated
  using (
    deleted_at is null and exists(
      select 1 from public.employees e
      where e.id=employee_id and e.user_id=auth.uid()
    )
  );
create policy onboarding_tasks_self_read on public.onboarding_tasks
  for select to authenticated
  using (
    exists(
      select 1
      from public.employee_onboarding o
      join public.employees e on e.id=o.employee_id
      where o.id=onboarding_id and e.user_id=auth.uid()
    )
  );

-- Tighten document-version and object reads so employee self-service only exposes owned files.
drop policy if exists document_versions_read on public.document_versions;
create policy document_versions_read on public.document_versions
  for select to authenticated
  using (
    exists(
      select 1 from public.employee_documents d
      join public.employees e on e.id=d.employee_id
      where d.id=employee_document_id
        and d.organization_id=public.current_org_id()
        and (
          public.has_permission('documents.view')
          or (e.user_id=auth.uid() and d.confidentiality_level='standard')
        )
    )
  );

drop policy if exists hr_document_read on storage.objects;
create policy hr_document_read on storage.objects for select to authenticated using (
  (bucket_id='applicant-documents' and public.has_permission('applicants.view'))
  or (
    bucket_id in ('employee-documents','contracts')
    and exists(
      select 1 from public.employee_documents d
      join public.employees e on e.id=d.employee_id
      where d.storage_path=name
        and d.organization_id=public.current_org_id()
        and (
          public.has_permission('documents.view')
          or (e.user_id=auth.uid() and d.confidentiality_level='standard')
        )
    )
  )
  or (bucket_id='assessment-files' and public.has_permission('applicants.view'))
  or (
    bucket_id='hr-exports'
    and (public.has_permission('employees.view') or public.has_permission('applicants.view'))
  )
);

-- Called only by the server-side service role after Supabase Auth creates/invites the user.
-- All related HR records are created in one database transaction.
create or replace function public.initialize_employee_preboarding(
  application_uuid uuid,
  employee_user_uuid uuid,
  start_on date,
  requirements_due_on date,
  training_starts_at timestamptz,
  training_ends_at timestamptz,
  training_timezone text,
  training_location text,
  training_meeting_url text,
  creator_uuid uuid
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  app record;
  employee_uuid uuid;
  onboarding_uuid uuid;
  template_uuid uuid;
  lifecycle_uuid uuid;
  preboarding_role_uuid uuid;
begin
  select
    a.organization_id,
    a.applicant_id,
    a.application_status,
    p.first_name,
    p.middle_name,
    p.last_name,
    p.email,
    p.phone,
    v.title,
    v.position_id,
    v.department_id,
    v.employment_type,
    v.work_arrangement
  into app
  from public.job_applications a
  join public.applicants p on p.id=a.applicant_id
  join public.job_vacancies v on v.id=a.job_vacancy_id
  where a.id=application_uuid;

  if not found or app.application_status <> 'hired' then
    raise exception 'Only a hired application can begin preboarding.';
  end if;
  if requirements_due_on < current_date then
    raise exception 'The requirements deadline cannot be in the past.';
  end if;
  if training_ends_at <= training_starts_at then
    raise exception 'Training must end after it starts.';
  end if;
  if exists(select 1 from public.employee_account_lifecycle where job_application_id=application_uuid) then
    raise exception 'Preboarding has already started for this application.';
  end if;

  update public.profiles
  set organization_id=app.organization_id,
      full_name=trim(concat_ws(' ',app.first_name,app.middle_name,app.last_name)),
      job_title=app.title,
      status='invited'
  where id=employee_user_uuid;

  select id into employee_uuid
  from public.employees
  where organization_id=app.organization_id
    and (source_applicant_id=app.applicant_id or lower(work_email)=lower(app.email))
    and deleted_at is null
  order by created_at
  limit 1;

  if employee_uuid is null then
    insert into public.employees(
      organization_id,employee_number,user_id,source_applicant_id,first_name,middle_name,last_name,
      work_email,personal_email,phone,hire_date,employment_status,created_by
    ) values (
      app.organization_id,
      'EMP-' || to_char(current_date,'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text,1,4)),
      employee_user_uuid,app.applicant_id,app.first_name,app.middle_name,app.last_name,
      app.email,app.email,app.phone,start_on,'probation',creator_uuid
    ) returning id into employee_uuid;

    insert into public.employment_records(
      employee_id,position_id,department_id,employment_type,work_arrangement,effective_from,is_current
    ) values (
      employee_uuid,app.position_id,app.department_id,coalesce(app.employment_type,'Full-time'),
      app.work_arrangement,start_on,true
    );
  else
    update public.employees
    set user_id=employee_user_uuid,
        source_applicant_id=coalesce(source_applicant_id,app.applicant_id),
        employment_status='probation'
    where id=employee_uuid;
  end if;

  select id into template_uuid
  from public.onboarding_templates
  where organization_id=app.organization_id and status='active'
  order by created_at limit 1;

  insert into public.employee_onboarding(
    organization_id,employee_id,template_id,owner_id,created_by,start_date,status
  ) values (
    app.organization_id,employee_uuid,template_uuid,creator_uuid,creator_uuid,start_on,'in_progress'
  ) returning id into onboarding_uuid;

  if template_uuid is not null then
    insert into public.onboarding_tasks(
      onboarding_id,title,description,category,due_date,required,status
    )
    select
      onboarding_uuid,title,description,category,start_on + due_offset_days,required,'pending'
    from public.onboarding_template_tasks
    where template_id=template_uuid
    order by task_order;
  end if;

  insert into public.employee_account_lifecycle(
    organization_id,employee_id,user_id,job_application_id,access_status,
    requirements_due_date,invited_at,created_by
  ) values (
    app.organization_id,employee_uuid,employee_user_uuid,application_uuid,'temporary',
    requirements_due_on,now(),creator_uuid
  ) returning id into lifecycle_uuid;

  insert into public.employee_requirement_requests(
    organization_id,employee_id,onboarding_id,document_type_id,title,description,due_date,required,created_by
  )
  select
    app.organization_id,employee_uuid,onboarding_uuid,dt.id,defaults.title,defaults.description,
    requirements_due_on,true,creator_uuid
  from (values
    ('GOV_ID','Government-issued ID','Upload a clear copy of one valid government-issued ID.'),
    ('CONTRACT','Signed employment contract','Upload the signed employment contract provided by HR.'),
    ('CERT','Relevant certification','Upload the certification or qualification required for your role.')
  ) as defaults(code,title,description)
  left join public.document_types dt
    on dt.organization_id=app.organization_id and dt.code=defaults.code;

  insert into public.employee_training_schedules(
    organization_id,employee_id,onboarding_id,title,description,training_type,
    scheduled_start,scheduled_end,timezone,location,meeting_url,status,created_by
  ) values (
    app.organization_id,employee_uuid,onboarding_uuid,'New hire orientation',
    'Company orientation and role-specific onboarding training.','orientation',
    training_starts_at,training_ends_at,coalesce(nullif(training_timezone,''),'Asia/Manila'),
    nullif(training_location,''),nullif(training_meeting_url,''),'pending_requirements',creator_uuid
  );

  select id into preboarding_role_uuid from public.roles where key='preboarding_employee';
  delete from public.user_roles
  where user_id=employee_user_uuid
    and role_id in (select id from public.roles where key in ('employee','preboarding_employee'));
  insert into public.user_roles(user_id,role_id)
  values(employee_user_uuid,preboarding_role_uuid)
  on conflict do nothing;

  insert into public.notifications(
    organization_id,recipient_id,title,body,event_type,entity_type,entity_id,href,status
  ) values (
    app.organization_id,employee_user_uuid,'Temporary employee account created',
    'Complete your required documents by ' || to_char(requirements_due_on,'Mon DD, YYYY') ||
      ' to unlock your training schedule and permanent employee access.',
    'preboarding_started','employee_account_lifecycle',lifecycle_uuid,'/employee/onboarding','unread'
  );

  insert into public.audit_logs(
    organization_id,actor_id,action,entity_type,entity_id,after_values
  ) values (
    app.organization_id,creator_uuid,'preboarding_started','employee_account_lifecycle',lifecycle_uuid,
    jsonb_build_object('employee_id',employee_uuid,'user_id',employee_user_uuid,
      'requirements_due_date',requirements_due_on,'access_status','temporary')
  );

  return lifecycle_uuid;
end
$$;

revoke all on function public.initialize_employee_preboarding(
  uuid,uuid,date,date,timestamptz,timestamptz,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.initialize_employee_preboarding(
  uuid,uuid,date,date,timestamptz,timestamptz,text,text,text,uuid
) to service_role;
