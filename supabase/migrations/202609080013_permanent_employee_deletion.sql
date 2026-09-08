-- Super-administrator-only employee and source-applicant purge.

create or replace function public.purge_employee_data(
  employee_uuid uuid,
  actor_user_uuid uuid,
  confirmation_text text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_organization uuid;
  target record;
  document_paths text[];
  applicant_document_paths text[];
  contract_paths text[];
  application_ids uuid[];
  purged_entity_ids uuid[];
begin
  select profile.organization_id
  into actor_organization
  from public.profiles profile
  where profile.id = actor_user_uuid
    and exists (
      select 1
      from public.user_roles assignment
      join public.role_permissions role_permission
        on role_permission.role_id = assignment.role_id
      join public.permissions permission
        on permission.id = role_permission.permission_id
      where assignment.user_id = actor_user_uuid
        and permission.key = '*'
    );

  if actor_organization is null then
    raise exception 'Super-administrator access is required.';
  end if;

  select
    employee.id,
    employee.organization_id,
    employee.employee_number,
    employee.user_id,
    coalesce(
      employee.source_applicant_id,
      (
        select application.applicant_id
        from public.employee_account_lifecycle lifecycle
        join public.job_applications application
          on application.id = lifecycle.job_application_id
        where lifecycle.employee_id = employee.id
        limit 1
      )
    ) as source_applicant_id,
    profile.avatar_path
  into target
  from public.employees employee
  left join public.profiles profile on profile.id = employee.user_id
  where employee.id = employee_uuid
    and employee.organization_id = actor_organization;

  if not found then
    raise exception 'Employee not found or access is restricted.';
  end if;
  if target.user_id = actor_user_uuid then
    raise exception 'You cannot permanently delete your own administrator account.';
  end if;
  if trim(coalesce(confirmation_text, '')) <> target.employee_number then
    raise exception 'Enter the employee number exactly to confirm permanent deletion.';
  end if;

  select coalesce(array_agg(distinct stored.path) filter (where stored.path is not null), '{}')
  into document_paths
  from (
    select document.storage_path as path
    from public.employee_documents document
    where document.employee_id = employee_uuid
    union all
    select version.storage_path as path
    from public.document_versions version
    join public.employee_documents document
      on document.id = version.employee_document_id
    where document.employee_id = employee_uuid
  ) stored;

  if target.source_applicant_id is not null then
    select coalesce(array_agg(application.id), '{}')
    into application_ids
    from public.job_applications application
    where application.applicant_id = target.source_applicant_id;

    select coalesce(array_agg(distinct document.storage_path) filter (where document.storage_path is not null), '{}')
    into applicant_document_paths
    from public.applicant_documents document
    where document.applicant_id = target.source_applicant_id;

    select coalesce(array_agg(distinct version.storage_path) filter (where version.storage_path is not null), '{}')
    into contract_paths
    from public.job_offer_versions version
    join public.job_offers offer on offer.id = version.job_offer_id
    where offer.job_application_id = any(application_ids);
  else
    application_ids := '{}';
    applicant_document_paths := '{}';
    contract_paths := '{}';
  end if;

  select coalesce(array_agg(distinct item.id) filter (where item.id is not null), '{}')
  into purged_entity_ids
  from (
    select employee_uuid as id
    union all select target.source_applicant_id
    union all select unnest(application_ids)
    union all select id from public.applicant_education where applicant_id = target.source_applicant_id
    union all select id from public.applicant_experience where applicant_id = target.source_applicant_id
    union all select id from public.applicant_documents where applicant_id = target.source_applicant_id
    union all select id from public.application_stage_history where job_application_id = any(application_ids)
    union all select id from public.interviews where job_application_id = any(application_ids)
    union all select evaluation.id from public.interview_evaluations evaluation join public.interviews interview on interview.id = evaluation.interview_id where interview.job_application_id = any(application_ids)
    union all select id from public.job_offers where job_application_id = any(application_ids)
    union all select version.id from public.job_offer_versions version join public.job_offers offer on offer.id = version.job_offer_id where offer.job_application_id = any(application_ids)
    union all select id from public.applicant_ai_assessments where job_application_id = any(application_ids)
    union all select id from public.applicant_notifications where applicant_id = target.source_applicant_id
    union all select id from public.employee_account_lifecycle where employee_id = employee_uuid
    union all select id from public.employee_requirement_requests where employee_id = employee_uuid
    union all select id from public.employee_training_schedules where employee_id = employee_uuid
    union all select id from public.employee_onboarding where employee_id = employee_uuid
    union all select task.id from public.onboarding_tasks task join public.employee_onboarding onboarding on onboarding.id = task.onboarding_id where onboarding.employee_id = employee_uuid
    union all select id from public.employee_documents where employee_id = employee_uuid
    union all select version.id from public.document_versions version join public.employee_documents document on document.id = version.employee_document_id where document.employee_id = employee_uuid
    union all select id from public.hr_requests where employee_id = employee_uuid
    union all select id from public.employee_movements where employee_id = employee_uuid
    union all select id from public.employment_records where employee_id = employee_uuid
    union all select id from public.notifications where recipient_id = target.user_id
  ) item;

  -- Remove profile references outside the purged person so Auth deletion is
  -- never blocked by activity in another HR record.
  if target.user_id is not null then
    update public.departments set manager_id = null where manager_id = target.user_id;
    update public.applicants set created_by = null where created_by = target.user_id;
    update public.job_vacancies
      set hiring_manager_id = case when hiring_manager_id = target.user_id then null else hiring_manager_id end,
          assigned_recruiter_id = case when assigned_recruiter_id = target.user_id then null else assigned_recruiter_id end,
          created_by = case when created_by = target.user_id then null else created_by end
      where hiring_manager_id = target.user_id
         or assigned_recruiter_id = target.user_id
         or created_by = target.user_id;
    update public.job_applications set assigned_recruiter_id = null where assigned_recruiter_id = target.user_id;
    update public.application_stage_history set changed_by = null where changed_by = target.user_id;
    update public.interviews set created_by = null where created_by = target.user_id;
    delete from public.interview_participants where user_id = target.user_id;
    delete from public.interview_evaluations where evaluator_id = target.user_id;
    update public.job_offers
      set created_by = case when created_by = target.user_id then null else created_by end,
          approved_by = case when approved_by = target.user_id then null else approved_by end
      where created_by = target.user_id or approved_by = target.user_id;
    update public.job_offer_versions set created_by = null where created_by = target.user_id;
    update public.applicant_ai_assessments
      set generated_by = case when generated_by = target.user_id then null else generated_by end,
          reviewed_by = case when reviewed_by = target.user_id then null else reviewed_by end
      where generated_by = target.user_id or reviewed_by = target.user_id;
    update public.applicant_notifications set created_by = null where created_by = target.user_id;
    update public.employees
      set user_id = case when user_id = target.user_id then null else user_id end,
          created_by = case when created_by = target.user_id then null else created_by end
      where id <> employee_uuid
        and (user_id = target.user_id or created_by = target.user_id);
    update public.employee_movements
      set requested_by = case when requested_by = target.user_id then null else requested_by end,
          approved_by = case when approved_by = target.user_id then null else approved_by end
      where employee_id <> employee_uuid
        and (requested_by = target.user_id or approved_by = target.user_id);
    update public.employee_onboarding
      set owner_id = case when owner_id = target.user_id then null else owner_id end,
          created_by = case when created_by = target.user_id then null else created_by end
      where employee_id <> employee_uuid
        and (owner_id = target.user_id or created_by = target.user_id);
    update public.onboarding_tasks
      set assigned_to = case when assigned_to = target.user_id then null else assigned_to end,
          completed_by = case when completed_by = target.user_id then null else completed_by end
      where assigned_to = target.user_id or completed_by = target.user_id;
    update public.employee_documents
      set verified_by = case when verified_by = target.user_id then null else verified_by end,
          created_by = case when created_by = target.user_id then null else created_by end
      where employee_id <> employee_uuid
        and (verified_by = target.user_id or created_by = target.user_id);
    update public.document_versions set uploaded_by = null where uploaded_by = target.user_id;
    update public.employee_account_lifecycle set created_by = null
      where employee_id <> employee_uuid and created_by = target.user_id;
    update public.employee_requirement_requests
      set reviewed_by = case when reviewed_by = target.user_id then null else reviewed_by end,
          created_by = case when created_by = target.user_id then null else created_by end
      where employee_id <> employee_uuid
        and (reviewed_by = target.user_id or created_by = target.user_id);
    update public.employee_training_schedules set created_by = null
      where employee_id <> employee_uuid and created_by = target.user_id;
    delete from public.audit_logs where actor_id = target.user_id;
    delete from public.notifications where recipient_id = target.user_id;
    delete from public.user_roles where user_id = target.user_id;
    update public.profiles
      set full_name = 'Deleted employee', avatar_path = null, job_title = null, status = 'suspended'
      where id = target.user_id;
  end if;

  -- Delete all employee-side operational records in dependency order.
  delete from public.employee_requirement_requests where employee_id = employee_uuid;
  delete from public.employee_training_schedules where employee_id = employee_uuid;
  delete from public.employee_account_lifecycle where employee_id = employee_uuid;
  delete from public.employee_onboarding where employee_id = employee_uuid;
  delete from public.employee_documents where employee_id = employee_uuid;
  delete from public.hr_requests where employee_id = employee_uuid;
  delete from public.employee_movements where employee_id = employee_uuid;
  update public.employment_records set supervisor_id = null where supervisor_id = employee_uuid;
  delete from public.employment_records where employee_id = employee_uuid;
  delete from public.employees where id = employee_uuid;

  -- Delete the original applicant and every application-side dependency.
  if target.source_applicant_id is not null then
    delete from public.interview_evaluations evaluation
    using public.interviews interview
    where evaluation.interview_id = interview.id
      and interview.job_application_id = any(application_ids);
    delete from public.interview_participants participant
    using public.interviews interview
    where participant.interview_id = interview.id
      and interview.job_application_id = any(application_ids);
    delete from public.interviews where job_application_id = any(application_ids);
    delete from public.job_offers where job_application_id = any(application_ids);
    delete from public.job_applications where id = any(application_ids);
    update public.employees set source_applicant_id = null
      where source_applicant_id = target.source_applicant_id;
    delete from public.applicants where id = target.source_applicant_id;
  end if;

  -- A full wipe removes historical audit entries created by or directly tied
  -- to the deleted employee/applicant/application identities.
  delete from public.audit_logs
  where actor_id = target.user_id
     or entity_id = any(purged_entity_ids);

  return jsonb_build_object(
    'auth_user_id', target.user_id,
    'avatar_path', target.avatar_path,
    'document_paths', to_jsonb(document_paths),
    'applicant_document_paths', to_jsonb(applicant_document_paths),
    'contract_paths', to_jsonb(contract_paths)
  );
end
$$;

revoke all on function public.purge_employee_data(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.purge_employee_data(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
