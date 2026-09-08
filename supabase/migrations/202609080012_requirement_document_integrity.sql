-- Keep requirement review status consistent with its employee document.

create or replace function public.enforce_employee_requirement_document_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_changed boolean;
begin
  if tg_op = 'INSERT' then
    status_changed := true;
  else
    status_changed := new.status is distinct from old.status;
  end if;

  if status_changed
    and new.status in ('submitted', 'under_review', 'verified', 'rejected')
    and new.employee_document_id is null then
    raise exception 'A document must be submitted before this requirement can be marked %.', replace(new.status, '_', ' ');
  end if;

  if new.employee_document_id is not null
    and status_changed
    and new.status in ('submitted', 'under_review', 'verified', 'rejected') then
    update public.employee_documents
    set verification_status = case
      when new.status = 'submitted' then 'pending'
      else new.status
    end
    where id = new.employee_document_id
      and employee_id = new.employee_id
      and organization_id = new.organization_id;
  end if;

  return new;
end
$$;

drop trigger if exists enforce_document_integrity on public.employee_requirement_requests;
create trigger enforce_document_integrity
  before insert or update on public.employee_requirement_requests
  for each row execute function public.enforce_employee_requirement_document_integrity();

-- Synchronize valid existing submissions. Historical requirements that were
-- reviewed without an uploaded file remain unchanged in the requirement log.
update public.employee_documents document
set verification_status = case
  when requirement.status = 'submitted' then 'pending'
  else requirement.status
end
from public.employee_requirement_requests requirement
where requirement.employee_document_id = document.id
  and requirement.status in ('submitted', 'under_review', 'verified', 'rejected')
  and requirement.deleted_at is null;

notify pgrst, 'reload schema';
