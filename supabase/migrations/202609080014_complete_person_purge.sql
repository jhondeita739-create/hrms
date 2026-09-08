-- Upgrade already-deployed databases from the original employee-only purge.
-- The wrapper captures the recruitment link before the employee transaction
-- removes its lifecycle record, then removes any applicant data left behind.

create or replace function public.purge_employee_and_applicant_data(
  employee_uuid uuid,
  actor_user_uuid uuid,
  confirmation_text text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_applicant uuid;
  application_ids uuid[] := '{}';
  applicant_document_paths text[] := '{}';
  contract_paths text[] := '{}';
  employee_payload jsonb;
begin
  select coalesce(
    employee.source_applicant_id,
    (
      select application.applicant_id
      from public.employee_account_lifecycle lifecycle
      join public.job_applications application
        on application.id = lifecycle.job_application_id
      where lifecycle.employee_id = employee.id
      limit 1
    )
  )
  into source_applicant
  from public.employees employee
  where employee.id = employee_uuid;

  if source_applicant is not null then
    select coalesce(array_agg(application.id), '{}')
    into application_ids
    from public.job_applications application
    where application.applicant_id = source_applicant;

    select coalesce(
      array_agg(distinct document.storage_path)
        filter (where document.storage_path is not null),
      '{}'
    )
    into applicant_document_paths
    from public.applicant_documents document
    where document.applicant_id = source_applicant;

    select coalesce(
      array_agg(distinct version.storage_path)
        filter (where version.storage_path is not null),
      '{}'
    )
    into contract_paths
    from public.job_offer_versions version
    join public.job_offers offer on offer.id = version.job_offer_id
    where offer.job_application_id = any(application_ids);
  end if;

  employee_payload := public.purge_employee_data(
    employee_uuid,
    actor_user_uuid,
    confirmation_text
  );

  -- This is a no-op on fresh databases because migration 013 already removed
  -- the applicant. It completes the purge on databases that ran its old form.
  if source_applicant is not null
    and exists (select 1 from public.applicants where id = source_applicant) then
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
      where source_applicant_id = source_applicant;
    delete from public.applicants where id = source_applicant;
  end if;

  delete from public.audit_logs
  where entity_id = employee_uuid
     or entity_id = source_applicant
     or entity_id = any(application_ids);

  return employee_payload || jsonb_build_object(
    'applicant_document_paths',
      coalesce(employee_payload->'applicant_document_paths', '[]'::jsonb)
        || to_jsonb(applicant_document_paths),
    'contract_paths',
      coalesce(employee_payload->'contract_paths', '[]'::jsonb)
        || to_jsonb(contract_paths)
  );
end
$$;

revoke all on function public.purge_employee_and_applicant_data(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.purge_employee_and_applicant_data(uuid, uuid, text)
  to service_role;

-- Allows a super administrator to remove a recruitment-only applicant, such
-- as an orphan left by the original employee purge. Linked employees must be
-- deleted from Employee records so their Auth account is removed as well.
create or replace function public.purge_applicant_data(
  applicant_uuid uuid,
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
  application_ids uuid[] := '{}';
  applicant_document_paths text[] := '{}';
  contract_paths text[] := '{}';
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

  select applicant.id, applicant.organization_id, applicant.applicant_number
  into target
  from public.applicants applicant
  where applicant.id = applicant_uuid
    and applicant.organization_id = actor_organization;

  if not found then
    raise exception 'Applicant not found or access is restricted.';
  end if;
  if trim(coalesce(confirmation_text, '')) <> target.applicant_number then
    raise exception 'Enter the applicant number exactly to confirm permanent deletion.';
  end if;
  if exists (
    select 1 from public.employees employee
    where employee.source_applicant_id = applicant_uuid
  ) or exists (
    select 1
    from public.employee_account_lifecycle lifecycle
    join public.job_applications application
      on application.id = lifecycle.job_application_id
    where application.applicant_id = applicant_uuid
  ) then
    raise exception 'This applicant is linked to an employee. Permanently delete the Employee record instead.';
  end if;

  select coalesce(array_agg(application.id), '{}')
  into application_ids
  from public.job_applications application
  where application.applicant_id = applicant_uuid;

  select coalesce(
    array_agg(distinct document.storage_path)
      filter (where document.storage_path is not null),
    '{}'
  )
  into applicant_document_paths
  from public.applicant_documents document
  where document.applicant_id = applicant_uuid;

  select coalesce(
    array_agg(distinct version.storage_path)
      filter (where version.storage_path is not null),
    '{}'
  )
  into contract_paths
  from public.job_offer_versions version
  join public.job_offers offer on offer.id = version.job_offer_id
  where offer.job_application_id = any(application_ids);

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
  delete from public.applicants where id = applicant_uuid;

  delete from public.audit_logs
  where entity_id = applicant_uuid
     or entity_id = any(application_ids);

  return jsonb_build_object(
    'applicant_document_paths', to_jsonb(applicant_document_paths),
    'contract_paths', to_jsonb(contract_paths)
  );
end
$$;

revoke all on function public.purge_applicant_data(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.purge_applicant_data(uuid, uuid, text)
  to service_role;

notify pgrst, 'reload schema';
