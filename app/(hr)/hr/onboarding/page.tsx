import type { Metadata } from "next";
import { ResourceWorkspace } from "@/components/resource-workspace";
import { getOptions, getResource } from "@/lib/hr-data";
import type { ResourceConfig } from "@/types/resources";
export const metadata:Metadata={title:"New hire onboarding"};
export default async function OnboardingPage(){const [records,employees]=await Promise.all([getResource("onboarding"),getOptions("employees")]);const config:ResourceConfig={entity:"onboarding",title:"New hire onboarding",description:"Prepare every new hire for a confident, compliant first day.",singular:"Onboarding",addLabel:"Start onboarding",searchPlaceholder:"Search new hire, position, department, or owner…",columns:[
  {key:"employee",label:"New hire",format:"person"},{key:"position",label:"Position"},{key:"department",label:"Department"},{key:"start_date",label:"Start date",format:"date"},{key:"progress",label:"Progress",format:"progress"},{key:"pending",label:"Pending tasks"},{key:"owner",label:"Owner"},{key:"status",label:"Status",format:"status"}],fields:[
  {name:"employee_id",label:"Employee",type:"select",required:true,options:employees,section:"New hire"},{name:"start_date",label:"Start date",type:"date",required:true,section:"New hire"},{name:"status",label:"Status",type:"select",required:true,options:[{label:"Not started",value:"not_started"},{label:"In progress",value:"in_progress"},{label:"Ready for day one",value:"ready"},{label:"Completed",value:"completed"}],section:"Workflow"}
]};return <ResourceWorkspace config={config} records={records}/>;}
