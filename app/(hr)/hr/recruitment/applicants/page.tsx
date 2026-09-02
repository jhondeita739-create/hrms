import type { Metadata } from "next";
import { ResourceWorkspace } from "@/components/resource-workspace";
import { getOptions, getResource } from "@/lib/hr-data";
import type { ResourceConfig } from "@/types/resources";
export const metadata:Metadata={title:"Applicants"};
export default async function ApplicantsPage(){
  const [records,vacancies]=await Promise.all([getResource("applicants"),getOptions("vacancies")]);
  const config:ResourceConfig={entity:"applicants",title:"Applicants",description:"Manage candidates, qualifications, applications, and recruitment progress.",singular:"Applicant",addLabel:"Add applicant",searchPlaceholder:"Search by name, email, phone, or applicant ID…",columns:[
    {key:"name",label:"Applicant",format:"person"},{key:"current_job_title",label:"Current role"},{key:"stage",label:"Recruitment stage"},{key:"rating",label:"Rating"},{key:"source",label:"Source"},{key:"created_at",label:"Added",format:"date"},{key:"status",label:"Status",format:"status"}],fields:[
    {name:"first_name",label:"First name",type:"text",required:true,section:"Personal information"},{name:"last_name",label:"Last name",type:"text",required:true,section:"Personal information"},
    {name:"email",label:"Email",type:"email",required:true,section:"Contact information"},{name:"phone",label:"Phone",type:"tel",required:true,section:"Contact information"},{name:"alternative_phone",label:"Alternative phone",type:"tel",section:"Contact information"},
    {name:"current_job_title",label:"Current job title",type:"text",section:"Professional information"},{name:"current_employer",label:"Current employer",type:"text",section:"Professional information"},{name:"years_experience",label:"Years of experience",type:"number",section:"Professional information"},{name:"expected_salary",label:"Expected salary",type:"number",section:"Professional information"},{name:"availability_date",label:"Availability date",type:"date",section:"Professional information"},
    {name:"job_vacancy_id",label:"Vacancy",type:"select",options:vacancies,section:"Recruitment"},{name:"source",label:"Source",type:"select",required:true,options:["Direct","LinkedIn","Careers page","Employee referral","Job board","Agency"].map(x=>({label:x,value:x})),section:"Recruitment"},{name:"status",label:"Profile status",type:"select",required:true,options:[{label:"Active",value:"active"},{label:"Hired",value:"hired"},{label:"Withdrawn",value:"withdrawn"}],section:"Recruitment"}
  ]}; return <ResourceWorkspace config={config} records={records}/>;
}
