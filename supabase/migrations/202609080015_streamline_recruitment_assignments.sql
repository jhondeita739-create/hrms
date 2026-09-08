-- Streamline recruitment stages and guarantee that every vacancy can supply
-- a structured employee position when an applicant is hired.

create or replace function public.ensure_vacancy_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_position uuid;
begin
  if new.position_id is not null
    and exists (
      select 1
      from public.positions position
      where position.id = new.position_id
        and position.organization_id = new.organization_id
        and lower(position.title) = lower(trim(new.title))
        and position.department_id is not distinct from new.department_id
        and position.status = 'active'
    ) then
    return new;
  end if;

  new.position_id := null;

  select position.id
  into resolved_position
  from public.positions position
  where position.organization_id = new.organization_id
    and lower(position.title) = lower(trim(new.title))
    and position.department_id is not distinct from new.department_id
    and position.status = 'active'
  order by position.created_at
  limit 1;

  if resolved_position is null then
    insert into public.positions(
      organization_id, department_id, title, code, status
    ) values (
      new.organization_id,
      new.department_id,
      trim(new.title),
      'POS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'active'
    )
    returning id into resolved_position;
  end if;

  new.position_id := resolved_position;
  return new;
end
$$;

drop trigger if exists ensure_position on public.job_vacancies;
create trigger ensure_position
  before insert or update of title, department_id, position_id
  on public.job_vacancies
  for each row execute function public.ensure_vacancy_position();

-- Invoke the trigger for vacancies that predate structured position assignment.
update public.job_vacancies
set title = title
where position_id is null
  and deleted_at is null;

-- Backfill employee positions from their exact preboarding application first,
-- then from the newest hired application for the source applicant.
with resolved_employee_positions as (
  select distinct on (employee.id)
    employee.id as employee_id,
    vacancy.position_id
  from public.employees employee
  join public.job_applications application
    on application.applicant_id = employee.source_applicant_id
   and application.application_status = 'hired'
  join public.job_vacancies vacancy
    on vacancy.id = application.job_vacancy_id
  left join public.employee_account_lifecycle lifecycle
    on lifecycle.employee_id = employee.id
   and lifecycle.job_application_id = application.id
  where employee.deleted_at is null
    and vacancy.position_id is not null
  order by
    employee.id,
    (lifecycle.id is not null) desc,
    application.hired_at desc nulls last,
    application.applied_at desc
)
update public.employment_records employment
set position_id = resolved.position_id
from resolved_employee_positions resolved
where employment.employee_id = resolved.employee_id
  and employment.is_current = true
  and employment.position_id is null;

-- Move applications out of retired stages before hiding those stages. Their
-- rows remain for historical foreign-key references and audit integrity.
with stage_redirect as (
  select
    source.id as source_id,
    coalesce(final_interview.id, hr_interview.id) as target_id
  from public.recruitment_stages source
  left join public.recruitment_stages final_interview
    on final_interview.organization_id = source.organization_id
   and lower(final_interview.name) = 'final interview'
   and final_interview.is_active = true
  left join public.recruitment_stages hr_interview
    on hr_interview.organization_id = source.organization_id
   and lower(hr_interview.name) = 'hr interview'
   and hr_interview.is_active = true
  where lower(source.name) in ('assessment', 'offer')
), affected as (
  select application.id, application.current_stage_id, redirect.target_id
  from public.job_applications application
  join stage_redirect redirect on redirect.source_id = application.current_stage_id
  where redirect.target_id is not null
), history as (
  insert into public.application_stage_history(
    job_application_id, from_stage_id, to_stage_id, reason
  )
  select
    affected.id,
    affected.current_stage_id,
    affected.target_id,
    'Stage retired from the recruitment workflow'
  from affected
  returning job_application_id
)
update public.job_applications application
set current_stage_id = affected.target_id,
    updated_at = now()
from affected
where application.id = affected.id;

update public.recruitment_stages
set is_active = false
where lower(name) in ('assessment', 'offer');

notify pgrst, 'reload schema';
