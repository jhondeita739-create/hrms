-- Simplify the post-screening form to education details only. Professional
-- and experience evidence is read from the applicant's searchable resume.

alter table public.applicant_documents
  add column if not exists extracted_text text;

comment on column public.applicant_documents.extracted_text is
  'Private searchable text extracted from the submitted resume for explainable job-fit matching.';

create or replace function public.complete_screened_applicant_profile(
  p_completion_token_hash text,
  p_profile_data jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record record;
  education_uuid uuid;
begin
  select id, organization_id, applicant_id
  into application_record
  from public.job_applications
  where job_applications.profile_completion_token_hash = p_completion_token_hash
    and profile_completion_status = 'requested'
    and profile_completion_token_expires_at > now()
  for update;

  if not found then
    raise exception 'This profile-completion link is invalid or has expired.';
  end if;

  select id into education_uuid
  from public.applicant_education
  where applicant_id = application_record.applicant_id
  order by created_at
  limit 1;

  if education_uuid is null then
    insert into public.applicant_education(
      applicant_id, school, degree, field_of_study, start_date, end_date, description
    ) values (
      application_record.applicant_id,
      p_profile_data ->> 'school',
      nullif(p_profile_data ->> 'degree', ''),
      nullif(p_profile_data ->> 'field_of_study', ''),
      nullif(p_profile_data ->> 'education_start', '')::date,
      nullif(p_profile_data ->> 'education_end', '')::date,
      nullif(p_profile_data ->> 'education_notes', '')
    );
  else
    update public.applicant_education
    set school = p_profile_data ->> 'school',
        degree = nullif(p_profile_data ->> 'degree', ''),
        field_of_study = nullif(p_profile_data ->> 'field_of_study', ''),
        start_date = nullif(p_profile_data ->> 'education_start', '')::date,
        end_date = nullif(p_profile_data ->> 'education_end', '')::date,
        description = nullif(p_profile_data ->> 'education_notes', '')
    where id = education_uuid;
  end if;

  update public.job_applications
  set profile_completion_status = 'completed',
      profile_completed_at = now(),
      profile_completion_token_hash = null,
      profile_completion_token_expires_at = null
  where id = application_record.id;

  insert into public.audit_logs(
    organization_id, action, entity_type, entity_id, metadata
  ) values (
    application_record.organization_id,
    'applicant_profile_completed',
    'job_applications',
    application_record.id,
    jsonb_build_object(
      'source', 'secure_post_screening_form',
      'sections', jsonb_build_array('education')
    )
  );

  return application_record.id;
end
$$;

revoke all on function public.complete_screened_applicant_profile(text,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_screened_applicant_profile(text,jsonb)
  to service_role;

notify pgrst, 'reload schema';
