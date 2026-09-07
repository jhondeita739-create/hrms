-- Complete the hiring decision and initialize employee preboarding in one
-- database transaction. The Auth invitation is provisioned by the server
-- before this service-role-only function is called and is deleted on failure.

create or replace function public.hire_and_initialize_employee_preboarding(
  application_uuid uuid,
  hired_stage_uuid uuid,
  decision_reason text,
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
set search_path = ''
as $$
declare
  application_record record;
  hired_stage record;
  lifecycle_uuid uuid;
begin
  select id, organization_id, applicant_id, current_stage_id, application_status
  into application_record
  from public.job_applications
  where id = application_uuid
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  select id, name
  into hired_stage
  from public.recruitment_stages
  where id = hired_stage_uuid
    and organization_id = application_record.organization_id
    and stage_type = 'hired'
    and is_active = true;

  if not found then
    raise exception 'Select an active hired stage.';
  end if;

  if not exists (
    select 1
    from public.interviews
    where job_application_id = application_uuid
      and status = 'completed'
  ) then
    raise exception 'Complete and evaluate an interview before hiring this applicant.';
  end if;

  if exists (
    select 1
    from public.employee_account_lifecycle
    where job_application_id = application_uuid
  ) then
    raise exception 'Employee preboarding has already started for this application.';
  end if;

  update public.job_applications
  set current_stage_id = hired_stage.id,
      application_status = 'hired',
      final_result = 'hired',
      rejection_reason = null,
      withdrawn_at = null,
      hired_at = now()
  where id = application_uuid;

  insert into public.application_stage_history(
    job_application_id,
    from_stage_id,
    to_stage_id,
    changed_by,
    reason
  ) values (
    application_uuid,
    application_record.current_stage_id,
    hired_stage.id,
    creator_uuid,
    coalesce(nullif(trim(decision_reason), ''), 'Hired and moved to employee preboarding')
  );

  update public.applicants
  set status = 'hired'
  where id = application_record.applicant_id;

  lifecycle_uuid := public.initialize_employee_preboarding(
    application_uuid,
    employee_user_uuid,
    start_on,
    requirements_due_on,
    training_starts_at,
    training_ends_at,
    training_timezone,
    training_location,
    training_meeting_url,
    creator_uuid
  );

  insert into public.audit_logs(
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    before_values,
    after_values
  ) values (
    application_record.organization_id,
    creator_uuid,
    'applicant_hired_and_preboarding_started',
    'job_applications',
    application_uuid,
    jsonb_build_object(
      'current_stage_id', application_record.current_stage_id,
      'application_status', application_record.application_status
    ),
    jsonb_build_object(
      'current_stage_id', hired_stage.id,
      'application_status', 'hired',
      'employee_account_lifecycle_id', lifecycle_uuid
    )
  );

  return lifecycle_uuid;
end
$$;

revoke all on function public.hire_and_initialize_employee_preboarding(
  uuid,uuid,text,uuid,date,date,timestamptz,timestamptz,text,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.hire_and_initialize_employee_preboarding(
  uuid,uuid,text,uuid,date,date,timestamptz,timestamptz,text,text,text,uuid
) to service_role;

