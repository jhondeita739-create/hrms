-- Defer detailed applicant information until resume screening has passed.

alter table public.job_applications
  add column if not exists profile_completion_status text not null default 'not_requested'
    check (profile_completion_status in ('not_requested','requested','completed')),
  add column if not exists profile_completed_at timestamptz,
  add column if not exists profile_completion_token_hash text,
  add column if not exists profile_completion_token_expires_at timestamptz;

create unique index if not exists job_applications_profile_token_idx
  on public.job_applications(profile_completion_token_hash)
  where profile_completion_token_hash is not null;

create index if not exists job_applications_profile_completion_idx
  on public.job_applications(organization_id, profile_completion_status)
  where profile_completion_status <> 'completed';

-- Use the clearer stage label where it does not conflict with an existing
-- organization-specific Resume Screening stage.
update public.recruitment_stages screening
set name = 'Resume Screening'
where lower(screening.name) = 'screening'
  and not exists (
    select 1
    from public.recruitment_stages existing
    where existing.organization_id = screening.organization_id
      and lower(existing.name) = 'resume screening'
      and existing.id <> screening.id
  );

-- Apply the public post-screening form atomically. Only the server-side service
-- role can call this function; the browser receives a random, single-use token.
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
  experience_uuid uuid;
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

  update public.applicants
  set alternative_phone = nullif(p_profile_data ->> 'alternative_phone', ''),
      linkedin_url = nullif(p_profile_data ->> 'linkedin_url', ''),
      current_job_title = p_profile_data ->> 'current_job_title',
      current_employer = nullif(p_profile_data ->> 'current_employer', ''),
      years_experience = (p_profile_data ->> 'years_experience')::numeric,
      expected_salary = nullif(p_profile_data ->> 'expected_salary', '')::numeric,
      availability_date = nullif(p_profile_data ->> 'availability_date', '')::date,
      updated_at = now()
  where id = application_record.applicant_id;

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

  if nullif(p_profile_data ->> 'experience_company', '') is not null
     and nullif(p_profile_data ->> 'experience_position', '') is not null then
    select id into experience_uuid
    from public.applicant_experience
    where applicant_id = application_record.applicant_id
    order by created_at
    limit 1;

    if experience_uuid is null then
      insert into public.applicant_experience(
        applicant_id, company, position, employment_type, start_date, end_date,
        currently_employed, responsibilities, achievements
      ) values (
        application_record.applicant_id,
        p_profile_data ->> 'experience_company',
        p_profile_data ->> 'experience_position',
        nullif(p_profile_data ->> 'employment_type', ''),
        nullif(p_profile_data ->> 'experience_start', '')::date,
        nullif(p_profile_data ->> 'experience_end', '')::date,
        coalesce((p_profile_data ->> 'currently_employed')::boolean, false),
        nullif(p_profile_data ->> 'responsibilities', ''),
        nullif(p_profile_data ->> 'achievements', '')
      );
    else
      update public.applicant_experience
      set company = p_profile_data ->> 'experience_company',
          position = p_profile_data ->> 'experience_position',
          employment_type = nullif(p_profile_data ->> 'employment_type', ''),
          start_date = nullif(p_profile_data ->> 'experience_start', '')::date,
          end_date = nullif(p_profile_data ->> 'experience_end', '')::date,
          currently_employed = coalesce((p_profile_data ->> 'currently_employed')::boolean, false),
          responsibilities = nullif(p_profile_data ->> 'responsibilities', ''),
          achievements = nullif(p_profile_data ->> 'achievements', '')
      where id = experience_uuid;
    end if;
  end if;

  update public.job_applications
  set cover_letter = nullif(p_profile_data ->> 'about', ''),
      profile_completion_status = 'completed',
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
    jsonb_build_object('source', 'secure_post_screening_form')
  );

  return application_record.id;
end
$$;

revoke all on function public.complete_screened_applicant_profile(text,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_screened_applicant_profile(text,jsonb)
  to service_role;
