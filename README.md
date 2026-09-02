# HRMS

A workflow-centered HRMS built with Next.js, TypeScript, Supabase Auth, PostgreSQL, private Supabase Storage, Tailwind CSS, React Hook Form, Zod, TanStack Table, and Lucide icons.

## Included

- Attention-focused HR dashboard
- Applicant profiles linked to reusable job applications and configurable recruitment stages
- Job-vacancy CRUD
- Employee master-record CRUD with effective-dated assignment history
- New-hire onboarding CRUD with automatic task-template instantiation
- Employee document metadata, private uploads, signed downloads, and version history
- Department CRUD
- Search, filters, sorting, pagination, status views, and explicit `.xlsx` exports
- Soft deletion/archive behavior for historical HR records
- Permission-based PostgreSQL RLS and organization isolation
- Audit events for create, update, archive, upload, and download operations
- Preview data when Supabase environment variables are absent
- Public careers homepage, searchable roles, secure applications, resume uploads, and application tracking

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable/anon key, and server-only secret key. The secret key processes public applications and must never be exposed to the browser.
3. Apply [`supabase/migrations/202608280001_initial_hrms.sql`](./supabase/migrations/202608280001_initial_hrms.sql) in the Supabase SQL editor, or link the Supabase CLI and run `supabase db push`.
4. In Authentication settings, configure the site URL (for local development, `http://localhost:3000`).
5. Run `npm run dev`, open `/login`, and expand **Set up the first administrator**. The database trigger grants the first account the `super_admin` role; subsequent users start without elevated permissions.

Private buckets are created by the migration. Employee-document uploads accept PDF, JPG, and PNG files up to 10 MB. The UI requests 60-second signed download URLs only after the document row passes RLS.

The public candidate experience is available at `/`, `/careers`, and `/careers/track`. Applicant resumes accept PDF, DOC, or DOCX files up to 5 MB and are written to the private `applicant-documents` bucket through a server-only client.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Data behavior

Meaningful HR records are archived instead of physically deleted. Applicant-to-employee conversion is supported through `employees.source_applicant_id`; applications remain attached to the applicant. Assignment edits close the current `employment_records` row, create a new effective-dated row, and add an `employee_movements` audit record.

Exports use an explicit list of displayed business fields. Internal UUIDs, confidential notes, and storage paths are not exported.
