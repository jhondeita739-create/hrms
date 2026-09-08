"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EntityKey } from "@/types/resources";

export type MutationResult = { ok: true; message: string; id?: string; url?: string } | { ok: false; message: string; fieldErrors?: Record<string,string> };
const optionalText = z.string().trim().optional().transform((v)=>v || null);
const optionalNumber = z.preprocess((v)=>v===""||v==null?null:Number(v),z.number().nonnegative().nullable());

const schemas = {
  applicants: z.object({
    first_name:z.string().trim().min(1,"First name is required"), last_name:z.string().trim().min(1,"Last name is required"),
    email:z.email("Enter a valid email"), phone:z.string().trim().regex(/^\d{7,15}$/,"Use 7 to 15 numbers only"), alternative_phone:z.union([z.string().trim().regex(/^\d{7,15}$/,"Use 7 to 15 numbers only"),z.literal("")]).optional().transform((v)=>v||null),
    current_job_title:optionalText,current_employer:optionalText,years_experience:optionalNumber,expected_salary:optionalNumber,
    availability_date:optionalText,source:z.string().trim().min(1),status:z.enum(["active","hired","withdrawn","archived"]).default("active"),job_vacancy_id:optionalText,
  }),
  vacancies: z.object({
    title:z.string().trim().min(2,"Job title is required"),department_id:optionalText,employment_type:z.string().min(1),work_arrangement:z.string().min(1),
    number_of_openings:z.preprocess(Number,z.number().int().positive()),closing_date:optionalText,description:optionalText,salary_min:optionalNumber,salary_max:optionalNumber,
    currency:z.string().length(3).default("PHP"),status:z.enum(["draft","open","paused","closed","filled","cancelled"]).default("draft"),
  }).refine((v)=>v.salary_min==null||v.salary_max==null||v.salary_max>=v.salary_min,{message:"Maximum must be greater than minimum",path:["salary_max"]}),
  employees: z.object({
    first_name:z.string().trim().min(1),last_name:z.string().trim().min(1),work_email:z.email(),personal_email:z.union([z.email(),z.literal("")]).optional().transform(v=>v||null),
    phone:optionalText,hire_date:z.string().min(1,"Hire date is required"),employment_status:z.enum(["active","probation","on_leave","inactive","separated"]),
    department_id:z.string().uuid("Select a department"),position_id:z.string().uuid("Select a position"),employment_type:z.string().min(1),work_arrangement:z.string().min(1),source_applicant_id:optionalText,
  }),
  onboarding: z.object({employee_id:z.string().uuid("Select an employee"),start_date:z.string().min(1),owner_id:optionalText,status:z.enum(["not_started","in_progress","ready","completed","cancelled"])}),
  documents: z.object({employee_id:z.string().uuid("Select an employee"),document_type_id:optionalText,title:z.string().trim().min(2),document_number:optionalText,issued_date:optionalText,expiration_date:optionalText,verification_status:z.enum(["pending","under_review","verified","rejected","expired"]),confidentiality_level:z.enum(["standard","confidential","highly_confidential"]),status:z.enum(["active","expired","archived"])}),
  departments: z.object({name:z.string().trim().min(2,"Department name is required"),code:z.string().trim().min(2).max(12).transform((v)=>v.toUpperCase()),status:z.enum(["active","inactive"])}),
};

const tableByEntity: Record<EntityKey,string> = {applicants:"applicants",vacancies:"job_vacancies",employees:"employees",onboarding:"employee_onboarding",documents:"employee_documents",departments:"departments"};
const pathByEntity: Record<EntityKey,string> = {applicants:"/hr/recruitment/applicants",vacancies:"/hr/recruitment/vacancies",employees:"/hr/employees",onboarding:"/hr/onboarding",documents:"/hr/records",departments:"/hr/organization"};
const prefixByEntity: Partial<Record<EntityKey,string>> = {applicants:"APP",vacancies:"VAC",employees:"EMP"};
const permissions:Record<EntityKey,{create:string;update:string;archive:string}>={
  applicants:{create:"applicants.create",update:"applicants.edit",archive:"applicants.archive"},
  vacancies:{create:"vacancies.create",update:"vacancies.edit",archive:"vacancies.archive"},
  employees:{create:"employees.create",update:"employees.edit",archive:"employees.archive"},
  onboarding:{create:"onboarding.manage",update:"onboarding.manage",archive:"onboarding.manage"},
  documents:{create:"documents.manage",update:"documents.manage",archive:"documents.manage"},
  departments:{create:"organization.manage",update:"organization.manage",archive:"organization.manage"},
};

async function context(permission:string) {
  if (!isSupabaseConfigured()) return null;
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return null;
  const [{data:profile},{data:assurance},{data:allowed}]=await Promise.all([
    db.from("profiles").select("organization_id").eq("id",user.id).single(),
    db.auth.mfa.getAuthenticatorAssuranceLevel(),
    db.rpc("has_permission",{permission_key:permission}),
  ]);
  if(!profile?.organization_id||assurance?.currentLevel!=="aal2"||!allowed) return null;
  return {db,user,organizationId:profile.organization_id as string};
}
function numberFor(prefix:string) { return `${prefix}-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${randomUUID().slice(0,4).toUpperCase()}`; }
function fieldErrors(error:z.ZodError) { const output:Record<string,string>={}; for(const issue of error.issues) output[String(issue.path[0]||"form")]=issue.message; return output; }

export async function createRecord(entity:EntityKey,raw:Record<string,unknown>):Promise<MutationResult>{
  const ctx=await context(permissions[entity].create); if(!ctx) return {ok:false,message:"Sign in with MFA using an HR role allowed to create this record."};
  const parsed=schemas[entity].safeParse(raw); if(!parsed.success) return {ok:false,message:"Please correct the highlighted fields.",fieldErrors:fieldErrors(parsed.error)};
  const values:Record<string,unknown>={...parsed.data,organization_id:ctx.organizationId};
  if(entity!=="departments") values.created_by=ctx.user.id;
  if(prefixByEntity[entity]) values[entity==="vacancies"?"vacancy_number":entity==="employees"?"employee_number":"applicant_number"]=numberFor(prefixByEntity[entity]!);
  const applicationVacancy=entity==="applicants"?values.job_vacancy_id:null; delete values.job_vacancy_id;
  const employment={department_id:values.department_id,position_id:values.position_id,employment_type:values.employment_type,work_arrangement:values.work_arrangement,hire_date:values.hire_date};
  if(entity==="employees") {
    const {data:position}=await ctx.db.from("positions").select("id,department_id").eq("id",String(values.position_id)).eq("organization_id",ctx.organizationId).eq("status","active").maybeSingle();
    if(!position||position.department_id!==values.department_id)return {ok:false,message:"Select an active position in the chosen department.",fieldErrors:{position_id:"Position and department must match"}};
    delete values.department_id; delete values.position_id; delete values.employment_type; delete values.work_arrangement;
  }
  const {data,error}=await ctx.db.from(tableByEntity[entity]).insert(values).select("id").single();
  if(error) return {ok:false,message:error.code==="23505"?"A record with these details already exists.":error.message};
  if(entity==="employees") {
    const {error:employmentError}=await ctx.db.from("employment_records").insert({employee_id:data.id,department_id:employment.department_id,employment_type:employment.employment_type,work_arrangement:employment.work_arrangement,effective_from:employment.hire_date,is_current:true});
    if(employmentError){
      await ctx.db.from("employees").update({employment_status:"inactive",deleted_at:new Date().toISOString()}).eq("id",data.id).eq("organization_id",ctx.organizationId);
      return {ok:false,message:`Employee creation was rolled back: ${employmentError.message}`};
    }
  }
  if(entity==="applicants"&&applicationVacancy){
    const {data:stage}=await ctx.db.from("recruitment_stages").select("id").eq("organization_id",ctx.organizationId).eq("stage_type","active").order("stage_order").limit(1).maybeSingle();
    if(!stage){
      await ctx.db.from("applicants").update({status:"archived",deleted_at:new Date().toISOString()}).eq("id",data.id).eq("organization_id",ctx.organizationId);
      return {ok:false,message:"Applicant creation was rolled back because no active recruitment stage is configured."};
    }
    const {error:applicationError}=await ctx.db.from("job_applications").insert({organization_id:ctx.organizationId,application_number:numberFor("APL"),applicant_id:data.id,job_vacancy_id:applicationVacancy,current_stage_id:stage.id,application_status:"in_progress"});
    if(applicationError){
      await ctx.db.from("applicants").update({status:"archived",deleted_at:new Date().toISOString()}).eq("id",data.id).eq("organization_id",ctx.organizationId);
      return {ok:false,message:`Applicant creation was rolled back: ${applicationError.message}`};
    }
  }
  await ctx.db.from("audit_logs").insert({organization_id:ctx.organizationId,actor_id:ctx.user.id,action:"create",entity_type:entity,entity_id:data.id,after_values:values});
  revalidatePath(pathByEntity[entity]); revalidatePath("/hr/dashboard");
  if(entity==="onboarding"){
    const {data:template}=await ctx.db.from("onboarding_templates").select("id,onboarding_template_tasks(title,description,category,due_offset_days,required)").eq("organization_id",ctx.organizationId).eq("status","active").order("created_at").limit(1).maybeSingle();
    if(template){ await ctx.db.from("employee_onboarding").update({template_id:template.id,owner_id:ctx.user.id}).eq("id",data.id); const tasks=((template.onboarding_template_tasks||[]) as Array<{title:string;description:string|null;category:string;due_offset_days:number;required:boolean}>).map((task)=>{const due=new Date(String(values.start_date));due.setDate(due.getDate()+task.due_offset_days);return {onboarding_id:data.id,title:task.title,description:task.description,category:task.category,due_date:due.toISOString().slice(0,10),required:task.required,status:"pending"};});if(tasks.length)await ctx.db.from("onboarding_tasks").insert(tasks); }
  }
  return {ok:true,message:`${entity==="onboarding"?"Onboarding record":entity.slice(0,-1)} created.`,id:data.id};
}

export async function updateRecord(entity:EntityKey,id:string,raw:Record<string,unknown>):Promise<MutationResult>{
  const ctx=await context(permissions[entity].update); if(!ctx) return {ok:false,message:"Sign in with MFA using an HR role allowed to update this record."};
  if(!z.string().uuid().safeParse(id).success) return {ok:false,message:"Invalid record identifier."};
  const parsed=schemas[entity].safeParse(raw); if(!parsed.success) return {ok:false,message:"Please correct the highlighted fields.",fieldErrors:fieldErrors(parsed.error)};
  const values:Record<string,unknown>={...parsed.data}; delete values.job_vacancy_id;
  const assignment=entity==="employees"?{department_id:values.department_id,position_id:values.position_id,employment_type:values.employment_type,work_arrangement:values.work_arrangement,effective_from:new Date().toISOString().slice(0,10)}:null;
  if(entity==="employees"){
    const {data:position}=await ctx.db.from("positions").select("id,department_id").eq("id",String(values.position_id)).eq("organization_id",ctx.organizationId).eq("status","active").maybeSingle();
    if(!position||position.department_id!==values.department_id)return {ok:false,message:"Select an active position in the chosen department.",fieldErrors:{position_id:"Position and department must match"}};
    delete values.department_id; delete values.position_id; delete values.employment_type; delete values.work_arrangement; delete values.source_applicant_id;
  }
  const {data:before}=await ctx.db.from(tableByEntity[entity]).select("*").eq("id",id).eq("organization_id",ctx.organizationId).maybeSingle();
  if(!before)return {ok:false,message:"The record was not found or access is restricted."};
  const {error}=await ctx.db.from(tableByEntity[entity]).update(values).eq("id",id).eq("organization_id",ctx.organizationId);
  if(error) return {ok:false,message:error.message};
  if(entity==="employees"&&assignment?.department_id){
    const {data:current}=await ctx.db.from("employment_records").select("*").eq("employee_id",id).eq("is_current",true).maybeSingle();
    const changed=!current||current.department_id!==assignment.department_id||current.position_id!==assignment.position_id||current.employment_type!==assignment.employment_type||current.work_arrangement!==assignment.work_arrangement;
    if(changed){
      if(current) await ctx.db.from("employment_records").update({is_current:false,effective_to:new Date(Date.now()-86400000).toISOString().slice(0,10)}).eq("id",current.id);
      const {data:next}=await ctx.db.from("employment_records").insert({employee_id:id,...assignment,is_current:true}).select("id").single();
      await ctx.db.from("employee_movements").insert({organization_id:ctx.organizationId,employee_id:id,movement_type:"assignment_change",effective_date:assignment.effective_from,previous_employment_record_id:current?.id,new_employment_record_id:next?.id,reason:"Employee record updated",status:"approved",requested_by:ctx.user.id,approved_by:ctx.user.id,approved_at:new Date().toISOString()});
    }
  }
  await ctx.db.from("audit_logs").insert({organization_id:ctx.organizationId,actor_id:ctx.user.id,action:"update",entity_type:entity,entity_id:id,before_values:before,after_values:values});
  revalidatePath(pathByEntity[entity]); return {ok:true,message:"Changes saved.",id};
}

export async function archiveRecord(entity:EntityKey,id:string):Promise<MutationResult>{
  const ctx=await context(permissions[entity].archive); if(!ctx) return {ok:false,message:"Sign in with MFA using an HR role allowed to archive this record."};
  if(!z.string().uuid().safeParse(id).success) return {ok:false,message:"Invalid record identifier."};
  const archivedAt=new Date().toISOString();
  const archive=entity==="departments"
    ?{status:"inactive"}
    :entity==="vacancies"
      ?{status:"cancelled",deleted_at:archivedAt}
      :entity==="onboarding"
        ?{status:"cancelled",deleted_at:archivedAt}
        :entity==="documents"
          ?{status:"archived",deleted_at:archivedAt}
          :entity==="employees"
            ?{employment_status:"inactive",deleted_at:archivedAt}
            :{status:"archived",deleted_at:archivedAt};
  const {data:target}=await ctx.db.from(tableByEntity[entity]).select("id").eq("id",id).eq("organization_id",ctx.organizationId).maybeSingle();
  if(!target)return {ok:false,message:"The record was not found or access is restricted."};
  const {error}=await ctx.db.from(tableByEntity[entity]).update(archive).eq("id",id).eq("organization_id",ctx.organizationId);
  if(error) return {ok:false,message:error.message};
  await ctx.db.from("audit_logs").insert({organization_id:ctx.organizationId,actor_id:ctx.user.id,action:"archive",entity_type:entity,entity_id:id,after_values:archive});
  revalidatePath(pathByEntity[entity]); revalidatePath("/hr/dashboard"); return {ok:true,message:"Record archived. Its history remains available in the audit log."};
}

type EmployeePurgePayload = {
  auth_user_id?: string | null;
  avatar_path?: string | null;
  document_paths?: string[] | null;
  applicant_document_paths?: string[] | null;
  contract_paths?: string[] | null;
};

export async function permanentlyDeleteEmployee(
  employeeId: string,
  confirmation: string,
): Promise<MutationResult> {
  const ctx = await context("*");
  if (!ctx || !isAdminConfigured())
    return { ok: false, message: "Sign in with MFA as a super administrator to permanently delete an employee." };
  if (!z.string().uuid().safeParse(employeeId).success)
    return { ok: false, message: "Invalid employee identifier." };
  const employeeNumber = confirmation.trim();
  if (!employeeNumber)
    return { ok: false, message: "Enter the employee number to confirm permanent deletion." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("purge_employee_and_applicant_data", {
    employee_uuid: employeeId,
    actor_user_uuid: ctx.user.id,
    confirmation_text: employeeNumber,
  });
  if (error) return { ok: false, message: error.message };

  const payload = (data || {}) as EmployeePurgePayload;
  const cleanupWarnings: string[] = [];
  const documentPaths = Array.from(new Set(payload.document_paths || [])).filter(Boolean);
  for (let index = 0; index < documentPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("employee-documents")
      .remove(documentPaths.slice(index, index + 100));
    if (storageError) cleanupWarnings.push(`document files: ${storageError.message}`);
  }
  const applicantDocumentPaths = Array.from(
    new Set(payload.applicant_document_paths || []),
  ).filter(Boolean);
  for (let index = 0; index < applicantDocumentPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("applicant-documents")
      .remove(applicantDocumentPaths.slice(index, index + 100));
    if (storageError) cleanupWarnings.push(`applicant files: ${storageError.message}`);
  }
  const contractPaths = Array.from(new Set(payload.contract_paths || [])).filter(Boolean);
  for (let index = 0; index < contractPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("contracts")
      .remove(contractPaths.slice(index, index + 100));
    if (storageError) cleanupWarnings.push(`contract files: ${storageError.message}`);
  }
  if (payload.avatar_path) {
    const { error: avatarError } = await admin.storage
      .from("profile-images")
      .remove([payload.avatar_path]);
    if (avatarError) cleanupWarnings.push(`profile image: ${avatarError.message}`);
  }
  if (payload.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(payload.auth_user_id);
    if (authError) cleanupWarnings.push(`Auth account: ${authError.message}`);
  }

  revalidatePath("/hr/employees");
  revalidatePath("/hr/preboarding");
  revalidatePath("/hr/onboarding");
  revalidatePath("/hr/records");
  revalidatePath("/hr/dashboard");
  revalidatePath("/hr/recruitment/applicants");
  return {
    ok: true,
    message: cleanupWarnings.length
      ? `Employee database data was deleted and access was revoked. Cleanup warning: ${cleanupWarnings.join("; ")}`
      : "Employee, applicant, Auth, Storage, recruitment, and related audit data were permanently deleted.",
  };
}

type ApplicantPurgePayload = {
  applicant_document_paths?: string[] | null;
  contract_paths?: string[] | null;
};

export async function permanentlyDeleteApplicant(
  applicantId: string,
  confirmation: string,
): Promise<MutationResult> {
  const ctx = await context("*");
  if (!ctx || !isAdminConfigured())
    return { ok: false, message: "Sign in with MFA as a super administrator to permanently delete an applicant." };
  if (!z.string().uuid().safeParse(applicantId).success)
    return { ok: false, message: "Invalid applicant identifier." };
  const applicantNumber = confirmation.trim();
  if (!applicantNumber)
    return { ok: false, message: "Enter the applicant number to confirm permanent deletion." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("purge_applicant_data", {
    applicant_uuid: applicantId,
    actor_user_uuid: ctx.user.id,
    confirmation_text: applicantNumber,
  });
  if (error) return { ok: false, message: error.message };

  const payload = (data || {}) as ApplicantPurgePayload;
  const cleanupWarnings: string[] = [];
  const applicantDocumentPaths = Array.from(
    new Set(payload.applicant_document_paths || []),
  ).filter(Boolean);
  for (let index = 0; index < applicantDocumentPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("applicant-documents")
      .remove(applicantDocumentPaths.slice(index, index + 100));
    if (storageError) cleanupWarnings.push(`applicant files: ${storageError.message}`);
  }
  const contractPaths = Array.from(new Set(payload.contract_paths || [])).filter(Boolean);
  for (let index = 0; index < contractPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("contracts")
      .remove(contractPaths.slice(index, index + 100));
    if (storageError) cleanupWarnings.push(`contract files: ${storageError.message}`);
  }

  revalidatePath("/hr/recruitment/applicants");
  revalidatePath("/hr/dashboard");
  return {
    ok: true,
    message: cleanupWarnings.length
      ? `Applicant database data was permanently deleted. Cleanup warning: ${cleanupWarnings.join("; ")}`
      : "Applicant, applications, resume, interviews, offers, notifications, Storage, and related audit data were permanently deleted.",
  };
}

export async function uploadEmployeeDocument(documentId:string,formData:FormData):Promise<MutationResult>{
  const ctx=await context("documents.manage");if(!ctx)return {ok:false,message:"Sign in with MFA using an HR role allowed to manage documents."};
  const file=formData.get("file");if(!(file instanceof File)||file.size===0)return {ok:false,message:"Choose a file to upload."};
  const allowed=new Set(["application/pdf","image/jpeg","image/png"]);if(!allowed.has(file.type))return {ok:false,message:"Only PDF, JPG, and PNG files are accepted."};
  if(file.size>4*1024*1024)return {ok:false,message:"The file must be 4 MB or smaller."};
  const {data:document,error:readError}=await ctx.db.from("employee_documents").select("id,employee_id,storage_path").eq("id",documentId).single();
  if(readError||!document)return {ok:false,message:"You are not authorized to update this document."};
  const extension=file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";const path=`${document.employee_id}/${document.id}/${randomUUID()}.${extension}`;
  const {error:uploadError}=await ctx.db.storage.from("employee-documents").upload(path,file,{contentType:file.type,upsert:false});if(uploadError)return {ok:false,message:uploadError.message};
  const {data:last}=await ctx.db.from("document_versions").select("version").eq("employee_document_id",documentId).order("version",{ascending:false}).limit(1).maybeSingle();
  await ctx.db.from("document_versions").insert({employee_document_id:documentId,version:(last?.version||0)+1,storage_path:path,file_name:file.name,file_size:file.size,mime_type:file.type,uploaded_by:ctx.user.id});
  await ctx.db.from("employee_documents").update({storage_path:path,file_name:file.name}).eq("id",documentId);
  await ctx.db.from("audit_logs").insert({organization_id:ctx.organizationId,actor_id:ctx.user.id,action:"document_upload",entity_type:"documents",entity_id:documentId,metadata:{file_name:file.name,mime_type:file.type,file_size:file.size}});
  revalidatePath("/hr/records");return {ok:true,message:"Document and version history saved.",id:documentId};
}

export async function getDocumentDownloadUrl(documentId:string):Promise<MutationResult>{
  const ctx=await context("documents.view");if(!ctx)return {ok:false,message:"Sign in with MFA using an HR role allowed to view documents."};
  const {data:document,error}=await ctx.db.from("employee_documents").select("storage_path,file_name").eq("id",documentId).single();if(error||!document?.storage_path)return {ok:false,message:"No file is attached or access is restricted."};
  const {data,error:signedError}=await ctx.db.storage.from("employee-documents").createSignedUrl(document.storage_path,60,{download:document.file_name||true});if(signedError)return {ok:false,message:signedError.message};
  await ctx.db.from("audit_logs").insert({organization_id:ctx.organizationId,actor_id:ctx.user.id,action:"document_download",entity_type:"documents",entity_id:documentId});return {ok:true,message:"Secure download prepared.",url:data.signedUrl};
}
