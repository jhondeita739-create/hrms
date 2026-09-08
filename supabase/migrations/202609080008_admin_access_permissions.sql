-- Complete the permission sets used by real HR administrator accounts.
-- User-to-role assignment remains an explicit super-administrator action.

insert into public.role_permissions(role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.key = 'hr_manager'
  and permission.key in (
    'dashboard.view',
    'applicants.view', 'applicants.create', 'applicants.edit', 'applicants.archive',
    'vacancies.view', 'vacancies.create', 'vacancies.edit', 'vacancies.archive',
    'organization.manage',
    'employees.view', 'employees.create', 'employees.edit', 'employees.archive',
    'onboarding.view', 'onboarding.manage',
    'documents.view', 'documents.manage', 'confidential_documents.view',
    'audit.view'
  )
on conflict do nothing;

-- Apply one HR role change atomically. Only the service-role server action can
-- call this function, and the supplied actor must be a super administrator in
-- the same organization as the target user.
create or replace function public.assign_hr_user_role(
  target_user_uuid uuid,
  selected_role_uuid uuid,
  actor_user_uuid uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_org uuid;
  target_org uuid;
  selected_role_key text;
  selected_role_name text;
  assignable_role_ids uuid[];
begin
  select p.organization_id into actor_org
  from public.profiles p
  where p.id = actor_user_uuid
    and exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions permission on permission.id = rp.permission_id
      where ur.user_id = actor_user_uuid and permission.key = '*'
    );

  if actor_org is null then
    raise exception 'Super-administrator access is required.';
  end if;

  select organization_id into target_org
  from public.profiles
  where id = target_user_uuid;

  if target_org is null or target_org <> actor_org then
    raise exception 'The selected organization user was not found.';
  end if;
  if target_user_uuid = actor_user_uuid then
    raise exception 'You cannot change your own super-administrator role.';
  end if;

  select coalesce(array_agg(id), '{}') into assignable_role_ids
  from public.roles
  where key in (
    'hr_admin', 'hr_manager', 'recruiter', 'hiring_manager',
    'onboarding_specialist', 'records_officer'
  );

  if selected_role_uuid is not null then
    select key, name into selected_role_key, selected_role_name
    from public.roles
    where id = selected_role_uuid
      and id = any(assignable_role_ids);
    if not found then
      raise exception 'That role cannot be assigned from this screen.';
    end if;
  end if;

  delete from public.user_roles
  where user_id = target_user_uuid
    and role_id = any(assignable_role_ids);

  if selected_role_uuid is not null then
    insert into public.user_roles(user_id, role_id)
    values (target_user_uuid, selected_role_uuid)
    on conflict do nothing;
  end if;

  insert into public.audit_logs(
    organization_id, actor_id, action, entity_type, entity_id, after_values
  ) values (
    actor_org,
    actor_user_uuid,
    case when selected_role_uuid is null then 'hr_role_removed' else 'hr_role_assigned' end,
    'profiles',
    target_user_uuid,
    jsonb_build_object(
      'role_id', selected_role_uuid,
      'role_key', selected_role_key
    )
  );

  return coalesce(selected_role_name, 'No HR access');
end
$$;

revoke all on function public.assign_hr_user_role(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.assign_hr_user_role(uuid,uuid,uuid)
  to service_role;

-- Guard the recruitment workflow even when a client attempts to update a job
-- application outside the application UI.
create or replace function public.enforce_job_application_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage record;
  screening_order integer;
begin
  if new.current_stage_id is not distinct from old.current_stage_id then
    return new;
  end if;

  select id, stage_type, stage_order into target_stage
  from public.recruitment_stages
  where id = new.current_stage_id
    and organization_id = new.organization_id
    and is_active = true;
  if not found then
    raise exception 'Select an active recruitment stage in this organization.';
  end if;

  select min(stage_order) into screening_order
  from public.recruitment_stages
  where organization_id = new.organization_id
    and is_active = true
    and name ilike '%screen%';

  if target_stage.stage_type = 'active'
     and target_stage.stage_order > coalesce(screening_order, 20)
     and not exists (
       select 1 from public.applicant_documents document
       where document.job_application_id = new.id
         and document.document_type = 'resume'
         and document.verification_status = 'verified'
         and document.deleted_at is null
     ) then
    raise exception 'Verify the applicant resume before moving beyond Resume Screening.';
  end if;

  if target_stage.stage_type = 'hired' then
    if new.profile_completion_status <> 'completed' then
      raise exception 'The applicant must complete the screened profile before hiring.';
    end if;
    if not exists (
      select 1 from public.applicant_documents document
      where document.job_application_id = new.id
        and document.document_type = 'resume'
        and document.verification_status = 'verified'
        and document.deleted_at is null
    ) then
      raise exception 'Verify the applicant resume before hiring.';
    end if;
    if not exists (
      select 1
      from public.interviews interview
      join public.interview_evaluations evaluation
        on evaluation.interview_id = interview.id
      where interview.job_application_id = new.id
        and interview.status = 'completed'
        and evaluation.submitted_at is not null
    ) then
      raise exception 'Complete and evaluate an interview before hiring.';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists enforce_job_application_workflow
  on public.job_applications;
create trigger enforce_job_application_workflow
before update of current_stage_id on public.job_applications
for each row execute function public.enforce_job_application_workflow();

-- Change an application stage, write its history, and write its audit event in
-- one database transaction. Notification delivery remains outside this
-- transaction so an email-provider failure never loses the HR decision.
create or replace function public.transition_job_application(
  application_uuid uuid,
  target_stage_uuid uuid,
  reason_text text,
  profile_token_hash_value text,
  profile_token_expires_value timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  application_record record;
  target_stage record;
  screening_order integer;
  next_status text;
  should_request_profile boolean;
begin
  if auth.uid() is null
     or not public.has_aal2()
     or not public.has_permission('applicants.edit') then
    raise exception 'Applicant management access with MFA is required.';
  end if;

  select * into application_record
  from public.job_applications
  where id = application_uuid
    and organization_id = public.current_org_id()
  for update;
  if not found then raise exception 'Application not found.'; end if;

  select id, name, stage_type, stage_order into target_stage
  from public.recruitment_stages
  where id = target_stage_uuid
    and organization_id = application_record.organization_id
    and is_active = true;
  if not found then raise exception 'Recruitment stage is unavailable.'; end if;
  if target_stage.id = application_record.current_stage_id then
    raise exception 'The application is already in this stage.';
  end if;
  if target_stage.stage_type = 'hired' then
    raise exception 'Use Hire and onboard to complete the hiring transaction.';
  end if;
  if application_record.application_status = 'hired' then
    raise exception 'A hired employee application cannot be reopened.';
  end if;
  if (
    target_stage.stage_type in ('rejected', 'withdrawn')
    or application_record.application_status <> 'in_progress'
  ) and length(trim(coalesce(reason_text, ''))) < 3 then
    raise exception 'Add a decision reason before closing or reopening an application.';
  end if;

  select min(stage_order) into screening_order
  from public.recruitment_stages
  where organization_id = application_record.organization_id
    and is_active = true
    and name ilike '%screen%';
  should_request_profile :=
    target_stage.stage_type = 'active'
    and target_stage.stage_order > coalesce(screening_order, 20)
    and application_record.profile_completion_status = 'not_requested';
  if should_request_profile and (
    profile_token_hash_value is null or profile_token_expires_value is null
  ) then
    raise exception 'A secure applicant profile token is required.';
  end if;

  next_status := case
    when target_stage.stage_type = 'rejected' then 'rejected'
    when target_stage.stage_type = 'withdrawn' then 'withdrawn'
    else 'in_progress'
  end;

  update public.job_applications
  set current_stage_id = target_stage.id,
      application_status = next_status,
      final_result = case when target_stage.stage_type = 'rejected' then 'rejected' else null end,
      rejection_reason = case when target_stage.stage_type = 'rejected' then reason_text else null end,
      hired_at = null,
      withdrawn_at = case when target_stage.stage_type = 'withdrawn' then now() else null end,
      profile_completion_status = case when should_request_profile then 'requested' else profile_completion_status end,
      profile_completion_token_hash = case when should_request_profile then profile_token_hash_value else profile_completion_token_hash end,
      profile_completion_token_expires_at = case when should_request_profile then profile_token_expires_value else profile_completion_token_expires_at end
  where id = application_record.id;

  insert into public.application_stage_history(
    job_application_id, from_stage_id, to_stage_id, changed_by, reason
  ) values (
    application_record.id,
    application_record.current_stage_id,
    target_stage.id,
    auth.uid(),
    coalesce(nullif(trim(reason_text), ''), 'Moved to ' || target_stage.name)
  );

  insert into public.audit_logs(
    organization_id, actor_id, action, entity_type, entity_id,
    before_values, after_values
  ) values (
    application_record.organization_id,
    auth.uid(),
    'application_stage_update',
    'job_applications',
    application_record.id,
    jsonb_build_object(
      'current_stage_id', application_record.current_stage_id,
      'application_status', application_record.application_status
    ),
    jsonb_build_object(
      'current_stage_id', target_stage.id,
      'application_status', next_status,
      'profile_completion_requested', should_request_profile
    )
  );

  return jsonb_build_object(
    'stage_name', target_stage.name,
    'stage_type', target_stage.stage_type,
    'application_status', next_status,
    'profile_completion_requested', should_request_profile
  );
end
$$;

revoke all on function public.transition_job_application(uuid,uuid,text,text,timestamptz)
  from public, anon;
grant execute on function public.transition_job_application(uuid,uuid,text,text,timestamptz)
  to authenticated;

insert into public.role_permissions(role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where
  (role.key = 'recruiter' and permission.key = 'dashboard.view')
  or (
    role.key = 'hiring_manager'
    and permission.key in (
      'dashboard.view', 'applicants.view', 'applicants.edit', 'vacancies.view'
    )
  )
  or (
    role.key = 'onboarding_specialist'
    and permission.key in (
      'dashboard.view', 'employees.view', 'onboarding.view', 'onboarding.manage',
      'documents.view', 'documents.manage'
    )
  )
  or (
    role.key = 'records_officer'
    and permission.key in (
      'dashboard.view', 'employees.view', 'documents.view', 'documents.manage'
    )
  )
on conflict do nothing;

notify pgrst, 'reload schema';
