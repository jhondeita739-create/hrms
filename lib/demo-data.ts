import type { EntityKey, ResourceRecord } from "@/types/resources";

export const demoData: Record<EntityKey, ResourceRecord[]> = {
  applicants: [
    { id:"a1", applicant_number:"APP-260821", name:"Maria Santos", email:"maria.santos@email.com", phone:"+63 917 432 1180", current_job_title:"Senior Accountant", source:"LinkedIn", stage:"Technical Interview", rating:4.3, status:"in_progress", created_at:"2026-08-25" },
    { id:"a2", applicant_number:"APP-260817", name:"Liam Tan", email:"liam.tan@email.com", phone:"+63 905 221 7831", current_job_title:"Product Designer", source:"Employee referral", stage:"Portfolio Review", rating:4.6, status:"in_progress", created_at:"2026-08-24" },
    { id:"a3", applicant_number:"APP-260814", name:"Angela Cruz", email:"angela.cruz@email.com", phone:"+63 918 353 9011", current_job_title:"People Operations Partner", source:"Careers page", stage:"HR Interview", rating:4.1, status:"in_progress", created_at:"2026-08-23" },
    { id:"a4", applicant_number:"APP-260809", name:"Noah Garcia", email:"noah.g@email.com", phone:"+63 977 310 4402", current_job_title:"Backend Engineer", source:"LinkedIn", stage:"Assessment", rating:3.9, status:"in_progress", created_at:"2026-08-21" },
    { id:"a5", applicant_number:"APP-260806", name:"Sofia Reyes", email:"sofia.reyes@email.com", phone:"+63 915 672 0018", current_job_title:"Finance Analyst", source:"Job board", stage:"Offer", rating:4.7, status:"offer", created_at:"2026-08-19" },
  ],
  vacancies: [
    { id:"v1", vacancy_number:"VAC-260018", title:"Senior Accountant", department:"Finance", employment_type:"Full-time", work_arrangement:"Hybrid", number_of_openings:1, applicants:18, closing_date:"2026-09-15", status:"open" },
    { id:"v2", vacancy_number:"VAC-260017", title:"Backend Engineer", department:"Technology", employment_type:"Full-time", work_arrangement:"Remote", number_of_openings:2, applicants:32, closing_date:"2026-09-10", status:"open" },
    { id:"v3", vacancy_number:"VAC-260016", title:"Product Designer", department:"Technology", employment_type:"Full-time", work_arrangement:"Hybrid", number_of_openings:1, applicants:14, closing_date:"2026-09-05", status:"open" },
    { id:"v4", vacancy_number:"VAC-260013", title:"Operations Associate", department:"Operations", employment_type:"Contract", work_arrangement:"On-site", number_of_openings:3, applicants:41, closing_date:"2026-08-31", status:"paused" },
  ],
  employees: [
    { id:"e1", employee_number:"EMP-1042", name:"Juan Dela Cruz", work_email:"juan.delacruz@hrms.example", phone:"+63 917 100 4231", department:"Technology", position:"Software Engineer", hire_date:"2024-03-11", employment_status:"active" },
    { id:"e2", employee_number:"EMP-1038", name:"Camille Lim", work_email:"camille.lim@hrms.example", phone:"+63 917 233 8811", department:"Finance", position:"Finance Manager", hire_date:"2023-11-06", employment_status:"active" },
    { id:"e3", employee_number:"EMP-1031", name:"Paolo Mendoza", work_email:"paolo.m@hrms.example", phone:"+63 905 300 4199", department:"Operations", position:"Operations Lead", hire_date:"2023-06-19", employment_status:"active" },
    { id:"e4", employee_number:"EMP-1025", name:"Isabella Sy", work_email:"isabella.sy@hrms.example", phone:"+63 977 120 9382", department:"People & Culture", position:"HR Business Partner", hire_date:"2022-10-03", employment_status:"on_leave" },
  ],
  onboarding: [
    { id:"o1", employee_id:"e1", employee:"Miguel Alvarez", position:"Software Engineer", department:"Technology", start_date:"2026-09-01", progress:72, pending:3, owner:"Maria Reyes", status:"in_progress" },
    { id:"o2", employee_id:"e2", employee:"Bianca Flores", position:"Senior Accountant", department:"Finance", start_date:"2026-09-08", progress:45, pending:6, owner:"Ana Reyes", status:"in_progress" },
    { id:"o3", employee_id:"e3", employee:"Ethan Chua", position:"Operations Associate", department:"Operations", start_date:"2026-09-15", progress:18, pending:9, owner:"Maria Reyes", status:"not_started" },
  ],
  documents: [
    { id:"d1", employee_id:"e1", title:"Employment Contract", employee:"Juan Dela Cruz", document_type:"Contract", document_number:"CTR-1042-01", issued_date:"2024-03-01", expiration_date:null, verification_status:"verified", confidentiality_level:"confidential", status:"active" },
    { id:"d2", employee_id:"e2", title:"Certified Public Accountant License", employee:"Camille Lim", document_type:"Certification", document_number:"CPA-008817", issued_date:"2024-10-12", expiration_date:"2026-10-12", verification_status:"verified", confidentiality_level:"standard", status:"active" },
    { id:"d3", employee_id:"e4", title:"Data Privacy Training", employee:"Isabella Sy", document_type:"Training Certificate", document_number:"DPT-2025-164", issued_date:"2025-09-14", expiration_date:"2026-09-14", verification_status:"pending", confidentiality_level:"standard", status:"active" },
  ],
  departments: [
    {id:"10000000-0000-0000-0000-000000000003",name:"Technology",code:"TECH",manager:"Marco Villanueva",people:412,status:"active",created_at:"2022-01-04"},
    {id:"10000000-0000-0000-0000-000000000004",name:"Operations",code:"OPS",manager:"Paolo Mendoza",people:368,status:"active",created_at:"2022-01-04"},
    {id:"10000000-0000-0000-0000-000000000002",name:"Finance",code:"FIN",manager:"Camille Lim",people:146,status:"active",created_at:"2022-01-04"},
    {id:"10000000-0000-0000-0000-000000000001",name:"People & Culture",code:"P&C",manager:"Isabella Sy",people:52,status:"active",created_at:"2022-01-04"},
  ],
};
