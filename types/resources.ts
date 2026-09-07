export type EntityKey = "applicants" | "vacancies" | "employees" | "onboarding" | "documents" | "departments";
export type FieldType = "text" | "email" | "tel" | "number" | "date" | "select" | "textarea" | "file";
export type FieldOption = { label: string; value: string };
export type FieldDefinition = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: FieldOption[];
  section?: string;
  colSpan?: 1 | 2;
};
export type ResourceRecord = Record<string, string | number | null | undefined> & { id: string };
export type ResourceColumn = { key: string; label: string; format?: "status" | "date" | "money" | "person" | "progress" };
export type ResourceConfig = {
  entity: EntityKey;
  title: string;
  description: string;
  singular: string;
  addLabel: string;
  searchPlaceholder: string;
  columns: ResourceColumn[];
  fields: FieldDefinition[];
  defaultSort?: { key: string; desc?: boolean };
};
