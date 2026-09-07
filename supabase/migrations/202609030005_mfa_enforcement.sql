-- Require an Authenticator Assurance Level 2 session for all authenticated
-- access to private HRMS records. Public/anonymous careers policies continue
-- to work because this restrictive policy applies only to `authenticated`.

create or replace function public.has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

revoke all on function public.has_aal2() from public;
grant execute on function public.has_aal2() to authenticated;

do $$
declare
  table_name text;
  protected_tables text[] := array[
    'organizations',
    'profiles',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'business_units',
    'departments',
    'locations',
    'positions',
    'recruitment_stages',
    'applicants',
    'applicant_education',
    'applicant_experience',
    'job_vacancies',
    'job_applications',
    'application_stage_history',
    'applicant_documents',
    'interviews',
    'interview_participants',
    'interview_evaluations',
    'job_offers',
    'job_offer_versions',
    'employees',
    'employment_records',
    'employee_movements',
    'onboarding_templates',
    'onboarding_template_tasks',
    'employee_onboarding',
    'onboarding_tasks',
    'document_types',
    'employee_documents',
    'document_versions',
    'hr_requests',
    'notifications',
    'audit_logs',
    'applicant_ai_assessments',
    'applicant_notifications',
    'employee_account_lifecycle',
    'employee_requirement_requests',
    'employee_training_schedules'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists require_mfa_aal2 on public.%I', table_name);
      execute format(
        'create policy require_mfa_aal2 on public.%I as restrictive for all to authenticated using ((select public.has_aal2())) with check ((select public.has_aal2()))',
        table_name
      );
    end if;
  end loop;
end;
$$;

drop policy if exists require_mfa_aal2 on storage.objects;
create policy require_mfa_aal2
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select public.has_aal2()))
  with check ((select public.has_aal2()));

