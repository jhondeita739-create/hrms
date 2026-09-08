-- Make the submitted searchable resume the single source for an applicant's
-- education and professional history during recruitment. Post-screening no
-- longer creates a duplicate profile-completion form.

update public.job_applications
set profile_completion_status = 'not_requested',
    profile_completion_token_hash = null,
    profile_completion_token_expires_at = null
where profile_completion_status = 'requested';

comment on column public.job_applications.profile_completion_status is
  'Legacy compatibility field. Recruitment qualification data is read from the submitted resume.';

drop function if exists public.complete_screened_applicant_profile(text,jsonb);

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

-- Keep the established RPC signature so deployed clients can upgrade without
-- a breaking API change. The legacy token parameters are intentionally ignored.
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
  next_status text;
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
      profile_completion_status = case
        when profile_completion_status = 'requested' then 'not_requested'
        else profile_completion_status
      end,
      profile_completion_token_hash = null,
      profile_completion_token_expires_at = null
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
      'qualification_source', 'verified_resume'
    )
  );

  return jsonb_build_object(
    'stage_name', target_stage.name,
    'stage_type', target_stage.stage_type,
    'application_status', next_status,
    'profile_completion_requested', false
  );
end
$$;

revoke all on function public.transition_job_application(uuid,uuid,text,text,timestamptz)
  from public, anon;
grant execute on function public.transition_job_application(uuid,uuid,text,text,timestamptz)
  to authenticated;

notify pgrst, 'reload schema';
