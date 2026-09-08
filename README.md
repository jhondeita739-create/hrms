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
- Required TOTP multi-factor authentication for HR and employee workspaces
- Audit events for create, update, archive, upload, and download operations
- Preview data when Supabase environment variables are absent
- Public careers homepage, searchable roles, simplified applications, validated PDF resume uploads, and application tracking
- Resume-driven screening with applicant-visible verification, stage, interview, and notification updates
- Hired-applicant conversion with invited temporary accounts, due-dated document requirements, training release, and permanent-access promotion
- Private employee profile-image upload, replacement, removal, and signed display URLs
- Guided `Hire & onboard` decision that requires a completed interview and commits the hiring decision with preboarding records in one database transaction

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable/anon key, and server-only secret key. The secret key processes public applications and must never be exposed to the browser.
3. Apply every SQL file in [`supabase/migrations`](./supabase/migrations) in filename order, or link the Supabase CLI and run `supabase db push`.
4. In Authentication settings, configure the site URL (for local development, `http://localhost:3000`) and enable the **Authenticator (TOTP)** MFA factor.
5. Add `/auth/callback` to the Auth redirect allow list for both the local and deployed site URLs.
6. Run `npm run dev`, open `/login`, and expand **Set up the first administrator**. The database trigger grants the first account the `super_admin` role; subsequent users start without elevated permissions.
7. After the password is accepted, scan the enrollment QR code with an authenticator app and enter its six-digit code. HR and employee routes require an `aal2` session in both middleware and PostgreSQL RLS.

Private buckets are created by the migration. Employee-document uploads accept PDF, JPG, and PNG files up to 4 MB so the complete multipart request remains below the configured Server Action limit. The UI requests 60-second signed download URLs only after the document row passes RLS.

The public candidate experience is available at `/`, `/careers`, and `/careers/track`. The initial form asks only for contact details and a searchable PDF resume up to 4 MB. The server verifies the MIME type, `.pdf` extension, PDF signature, readable extracted text, and resume-like section structure before writing to the private `applicant-documents` bucket. The Server Action allows a 4.25 MB multipart request, keeping it below Vercel's 4.5 MB function payload limit. This automated check reduces mislabeled uploads but does not replace final HR verification.

The searchable PDF resume is the recruitment source for education and professional history, so applicants do not re-enter information after screening. When HR verifies the resume and advances the application, the applicant can use **Track application** to see the resume verification state, current stage, interview qualification and schedule, and HR notifications. Apply `202609080009_simplify_screened_profile.sql` and `202609080010_resume_driven_screening.sql` before using this workflow.

HR administrators manage hired-employee access at `/hr/preboarding`. Supabase sends the invited new hire to `/account/set-password`; their private checklist is at `/employee/onboarding`. Add `NEXT_PUBLIC_SITE_URL` for the deployed site and include `/auth/callback` in the Supabase Auth redirect allow list.

Hired employees can upload, replace, or remove their profile image from `/employee/onboarding`. Apply `202609080011_employee_profile_images.sql` to create the private `profile-images` bucket. The server accepts genuine JPG, PNG, and WebP files up to 2 MB and serves them through expiring signed URLs.

From an applicant profile, selecting the **Hired** stage opens the required employment start, document deadline, and training schedule form. The application cannot be moved to the dashboard's Hired column directly; successful setup creates the temporary employee account and preboarding lifecycle together. Apply `202609070006_hire_and_preboard.sql` before using this action.

Users manage or reset their authenticator at `/account/security`. Resetting a verified factor requires a currently verified `aal2` session; losing the authenticator therefore requires an administrator-assisted account recovery through Supabase Auth.

Apply `202609080008_admin_access_permissions.sql` and then `202609080010_resume_driven_screening.sql` before using the final administrator workflow. A super administrator can then open **Settings → Roles & permissions** to assign one HR role to each organization account. The migrations make application stage/history/audit updates transactional and enforce verified-resume and evaluated-interview gates in PostgreSQL.

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
