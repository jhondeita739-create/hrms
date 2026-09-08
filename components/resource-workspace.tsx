"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Archive,
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { z } from "zod";
import {
  archiveRecord,
  createRecord,
  getDocumentDownloadUrl,
  updateRecord,
  uploadEmployeeDocument,
} from "@/app/actions/resources";
import { cn, formatDate, formatMoney, initials } from "@/lib/utils";
import type {
  FieldDefinition,
  ResourceConfig,
  ResourceColumn,
  ResourceRecord,
} from "@/types/resources";

const statusTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  open: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  hired: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  strong_match: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  offer: "bg-orange-50 text-orange-700 ring-orange-600/15",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-600/15",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  under_review: "bg-amber-50 text-amber-700 ring-amber-600/15",
  manual_review: "bg-amber-50 text-amber-700 ring-amber-600/15",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/15",
  not_started: "bg-slate-100 text-slate-600 ring-slate-500/15",
  draft: "bg-slate-100 text-slate-600 ring-slate-500/15",
  confidential: "bg-violet-50 text-violet-700 ring-violet-600/15",
  potential_match: "bg-blue-50 text-blue-700 ring-blue-600/15",
  rejected: "bg-red-50 text-red-700 ring-red-600/15",
  withdrawn: "bg-red-50 text-red-700 ring-red-600/15",
  not_assessed: "bg-slate-100 text-slate-500 ring-slate-500/15",
  archived: "bg-slate-100 text-slate-500 ring-slate-500/15",
};
const label = (value: string | number | null | undefined) =>
  String(value ?? "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());

const recordStatus = (record: ResourceRecord) =>
  String(
    record.application_status ||
      record.employment_status ||
      record.verification_status ||
      record.status ||
      "",
  );

function displayValue(record: ResourceRecord, column: ResourceColumn) {
  const value = record[column.key];
  if (column.format === "date") return formatDate(String(value || ""));
  if (column.format === "money") return formatMoney(Number(value));
  if (column.format === "progress") return `${Number(value || 0)}%`;
  return label(value);
}

function schemaFor(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodType> = {};
  fields
    .filter((field) => field.type !== "file")
    .forEach((field) => {
      let rule: z.ZodType = z.string();
      if (field.type === "email")
        rule = z.string().email("Enter a valid email");
      else if (field.type === "number")
        rule = z
          .string()
          .refine(
            (v) => !v || !Number.isNaN(Number(v)),
            "Enter a valid number",
          );
      else rule = z.string();
      if (field.required)
        rule = rule.refine(
          (v) => String(v).trim().length > 0,
          `${field.label} is required`,
        );
      else rule = rule.optional();
      shape[field.name] = rule;
    });
  return z.object(shape);
}

export function ResourceWorkspace({
  config,
  records,
}: {
  config: ResourceConfig;
  records: ResourceRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [deleting, setDeleting] = useState<ResourceRecord | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sorting, setSorting] = useState<SortingState>(() =>
    config.defaultSort
      ? [{ id: config.defaultSort.key, desc: config.defaultSort.desc ?? false }]
      : [],
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showControls, setShowControls] = useState(false);
  const [pending, startTransition] = useTransition();
  const schema = useMemo(() => schemaFor(config.fields), [config.fields]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as never,
  });
  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map(recordStatus)
            .filter(Boolean),
        ),
      ),
    [records],
  );
  const filtered = useMemo(
    () =>
      records.filter(
        (row) =>
          status === "all" ||
          recordStatus(row) === status,
      ),
    [records, status],
  );

  function openCreate() {
    setEditing(null);
    setSelectedFile(null);
    reset(
      Object.fromEntries(
        config.fields
          .filter((f) => f.type !== "file")
          .map((f) => [
            f.name,
            f.type === "number" ? "" : f.options?.[0]?.value || "",
          ]),
      ),
    );
    setOpen(true);
  }
  function openEdit(row: ResourceRecord) {
    setEditing(row);
    setSelectedFile(null);
    reset(
      Object.fromEntries(
        config.fields
          .filter((f) => f.type !== "file")
          .map((f) => [f.name, String(row[f.name] ?? "")]),
      ),
    );
    setOpen(true);
  }
  function submit(values: Record<string, string>) {
    startTransition(async () => {
      const result = editing
        ? await updateRecord(config.entity, editing.id, values)
        : await createRecord(config.entity, values);
      if (!result.ok) {
        setNotice({ text: result.message, ok: false });
        Object.entries(result.fieldErrors || {}).forEach(([key, message]) =>
          setError(key, { message }),
        );
        return;
      }
      if (
        config.entity === "documents" &&
        selectedFile &&
        (result.id || editing?.id)
      ) {
        const formData = new FormData();
        formData.set("file", selectedFile);
        const upload = await uploadEmployeeDocument(
          String(result.id || editing?.id),
          formData,
        );
        if (!upload.ok) {
          setNotice({
            text: `Record saved, but file upload failed: ${upload.message}`,
            ok: false,
          });
          setOpen(false);
          return;
        }
        setNotice({ text: upload.message, ok: true });
      } else setNotice({ text: result.message, ok: true });
      setOpen(false);
    });
  }
  function download(row: ResourceRecord) {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(row.id);
      if (result.ok && result.url)
        window.open(result.url, "_blank", "noopener,noreferrer");
      else setNotice({ text: result.message, ok: false });
    });
  }
  function archive() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await archiveRecord(config.entity, deleting.id);
      setDeleting(null);
      setNotice({ text: result.message, ok: result.ok });
    });
  }
  async function exportXlsx() {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    workbook.creator = "HRMS";
    const sheet = workbook.addWorksheet(config.title.slice(0, 31));
    sheet.columns = config.columns.map((c) => ({
      header: c.label,
      key: c.key,
      width: Math.max(14, c.label.length + 4),
    }));
    records.forEach((record) =>
      sheet.addRow(
        Object.fromEntries(
          config.columns.map((c) => [c.key, record[c.key] ?? ""]),
        ),
      ),
    );
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF153E66" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: "A1",
      to: { row: 1, column: config.columns.length },
    };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${config.entity}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const columns = useMemo<ColumnDef<ResourceRecord>[]>(
    () => [
      ...config.columns.map((column): ColumnDef<ResourceRecord> => ({
        accessorKey: column.key,
        header: ({ column: col }) => (
          <button
            type="button"
            className="flex items-center gap-1.5 whitespace-nowrap"
            onClick={() => col.toggleSorting(col.getIsSorted() === "asc")}
          >
            {column.label}
            <ArrowDownUp className="h-3 w-3 text-slate-300" />
          </button>
        ),
        cell: ({ row }) => {
          const value = row.original[column.key];
          if (column.format === "person")
            return (
              <div className="flex items-center gap-3">
                <span
                  role="img"
                  aria-label={`${String(value)} profile image`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 bg-cover bg-center text-[11px] font-bold text-brand-700 ring-1 ring-slate-200"
                  style={row.original.avatar_url ? { backgroundImage: `url(${JSON.stringify(String(row.original.avatar_url))})` } : undefined}
                >
                  {!row.original.avatar_url && initials(String(value))}
                </span>
                <div>
                  <div className="font-medium text-slate-900">
                    {String(value)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {String(
                      row.original.applicant_number ||
                        row.original.employee_number ||
                        "",
                    )}
                  </div>
                </div>
              </div>
            );
          if (column.format === "status")
            return (
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                  statusTone[String(value)] ||
                    "bg-slate-100 text-slate-600 ring-slate-500/15",
                )}
              >
                {label(value)}
              </span>
            );
          if (column.format === "date")
            return (
              <span className="whitespace-nowrap">
                {formatDate(String(value || ""))}
              </span>
            );
          if (column.format === "money")
            return <span>{formatMoney(Number(value))}</span>;
          if (column.format === "progress") {
            const n = Number(value || 0);
            return (
              <div className="min-w-[110px]">
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="font-medium text-slate-700">{n}%</span>
                  <span className="text-slate-400">complete</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-brand-500"
                    style={{ width: `${n}%` }}
                  />
                </div>
              </div>
            );
          }
          return (
            <span className="whitespace-nowrap text-slate-600">
              {String(value ?? "—")}
            </span>
          );
        },
      })),
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {config.entity === "applicants" && (
              <Link
                href={`/hr/recruitment/applicants/${row.original.id}`}
                aria-label="Review applicant"
                title="Review application"
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
              >
                <Eye className="h-4 w-4" />
              </Link>
            )}
            <button
              type="button"
              aria-label={`Edit ${config.singular.toLowerCase()}`}
              title="Edit"
              onClick={() => openEdit(row.original)}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Archive ${config.singular.toLowerCase()}`}
              title="Archive"
              onClick={() => setDeleting(row.original)}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Archive className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={
                config.entity === "documents"
                  ? "Download document"
                  : "Copy record identifier"
              }
              onClick={() => {
                if (config.entity === "documents") {
                  download(row.original);
                  return;
                }
                void navigator.clipboard.writeText(row.original.id).then(() =>
                  setNotice({ text: "Record identifier copied.", ok: true }),
                );
              }}
              title={
                config.entity === "documents"
                  ? "Download securely"
                  : "Copy record ID"
              }
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {config.entity === "documents" ? (
                <Download className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        ),
      },
    ],
    [config],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const sections = Array.from(
    new Set(config.fields.map((f) => f.section || "Details")),
  );
  const primaryResourceColumn = config.columns[0];
  const mobileColumns = config.columns
    .slice(1)
    .filter((column) => column.format !== "status")
    .slice(0, 4);
  const mobileStatusColumn = config.columns.find(
    (column) => column.format === "status",
  );
  return (
    <>
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-600">
            HR workspace
          </p>
          <h1 className="text-3xl font-extrabold tracking-[-.04em] text-ink sm:text-4xl">
            {config.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            {config.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={exportXlsx}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md motion-reduce:transform-none"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgb(37,99,235,0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-brand-500 hover:shadow-[0_10px_24px_rgb(37,99,235,0.28)] motion-reduce:transform-none"
          >
            <Plus className="h-4 w-4" />
            {config.addLabel}
          </button>
        </div>
      </header>
      {notice && (
        <div
          className={cn(
            "mb-5 flex items-center justify-between rounded-2xl border px-4 py-3.5 text-sm shadow-sm",
            notice.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <span className="flex items-center gap-2">
            {notice.ok && <Check className="h-4 w-4" />}
            {notice.text}
          </span>
          <button onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgb(15,23,42,0.05)] ring-1 ring-slate-200/70">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-[380px]">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
              placeholder={config.searchPlaceholder}
            />
          </div>
          <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => setStatus("all")}
              className={cn(
                "h-9 whitespace-nowrap rounded-full px-3.5 text-xs font-bold transition-colors",
                status === "all"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              All <span className="ml-1 opacity-60">{records.length}</span>
            </button>
            {statuses.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "h-9 whitespace-nowrap rounded-full px-3.5 text-xs font-bold transition-colors",
                  status === s
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {label(s)}
              </button>
            ))}
            <button
              type="button"
              aria-label="Toggle table controls"
              aria-expanded={showControls}
              onClick={() => setShowControls((current) => !current)}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors",
                showControls
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
          </div>
          {showControls && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold text-slate-700">
                  Table preferences
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Adjust results per page or clear the active view.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-500" htmlFor={`${config.entity}-page-size`}>
                  Rows
                </label>
                <select
                  id={`${config.entity}-page-size`}
                  value={table.getState().pagination.pageSize}
                  onChange={(event) => table.setPageSize(Number(event.target.value))}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    table.resetSorting();
                  }}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Reset view
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[.06em] text-slate-500">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th className="h-11 px-4" key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  className="h-[66px] transition hover:bg-slate-50/70"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td className="px-4" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="h-48 text-center">
                    <div className="text-sm font-medium text-slate-700">
                      No records found
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Try changing your filters or add the first{" "}
                      {config.singular.toLowerCase()}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {table.getRowModel().rows.map((row) => (
            <article className="p-4" key={row.id}>
              <div className="flex items-start gap-3">
                <span
                  role="img"
                  aria-label={`${String(row.original[primaryResourceColumn.key] || config.singular)} profile image`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 bg-cover bg-center text-xs font-black text-brand-700 ring-1 ring-slate-200"
                  style={row.original.avatar_url ? { backgroundImage: `url(${JSON.stringify(String(row.original.avatar_url))})` } : undefined}
                >
                  {!row.original.avatar_url && initials(String(row.original[primaryResourceColumn.key] || config.singular))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {displayValue(row.original, primaryResourceColumn)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">
                    {String(
                      row.original.applicant_number ||
                        row.original.employee_number ||
                        row.original.vacancy_number ||
                        row.original.code ||
                        row.original.id,
                    )}
                  </div>
                </div>
                {mobileStatusColumn && (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
                      statusTone[String(row.original[mobileStatusColumn.key])] ||
                        "bg-slate-100 text-slate-600 ring-slate-500/15",
                    )}
                  >
                    {displayValue(row.original, mobileStatusColumn)}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-slate-50 p-4">
                {mobileColumns.map((column) => (
                  <div className="min-w-0" key={column.key}>
                    <dt className="text-[11px] font-semibold text-slate-400">
                      {column.label}
                    </dt>
                    <dd className="mt-1 truncate text-xs font-bold text-slate-700">
                      {displayValue(row.original, column)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center justify-end gap-1">
                {config.entity === "applicants" && (
                  <Link
                    href={`/hr/recruitment/applicants/${row.original.id}`}
                    aria-label="Review applicant"
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                )}
                <button
                  type="button"
                  aria-label={`Edit ${config.singular.toLowerCase()}`}
                  onClick={() => openEdit(row.original)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {config.entity === "documents" && (
                  <button
                    type="button"
                    aria-label="Download document"
                    onClick={() => download(row.original)}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Archive ${config.singular.toLowerCase()}`}
                  onClick={() => setDeleting(row.original)}
                  className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <div className="grid min-h-52 place-items-center px-6 text-center">
              <div>
                <div className="text-sm font-bold text-slate-700">No records found</div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Try changing your filters or add the first {config.singular.toLowerCase()}.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-4 text-xs text-slate-500 sm:px-5">
          <span>{table.getFilteredRowModel().rows.length} records</span>
          <div className="flex items-center gap-2">
            <span className="mr-2 hidden sm:inline">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-full w-full max-w-[680px] flex-col bg-white shadow-2xl sm:rounded-l-3xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[.14em] text-brand-600">
                  {config.entity}
                </p>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {editing ? `Edit ${config.singular}` : config.addLabel}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Required fields are marked with an asterisk.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close form"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit(submit)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
                {sections.map((section) => (
                  <section className="mb-8" key={section}>
                    <h3 className="mb-4 border-b border-slate-100 pb-3 text-xs font-bold uppercase tracking-[.12em] text-slate-500">
                      {section}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {config.fields
                        .filter((f) => (f.section || "Details") === section)
                        .map((field) => (
                          <div
                            className={
                              field.colSpan === 2 ? "sm:col-span-2" : ""
                            }
                            key={field.name}
                          >
                            <label className="field-label" htmlFor={field.name}>
                              {field.label}
                              {field.required && (
                                <span className="ml-0.5 text-red-500">*</span>
                              )}
                            </label>
                            {field.type === "select" ? (
                              <select
                                id={field.name}
                                className="field-control"
                                {...register(field.name)}
                              >
                                <option value="">
                                  Select {field.label.toLowerCase()}
                                </option>
                                {field.options?.map((o) => (
                                  <option value={o.value} key={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === "textarea" ? (
                              <textarea
                                id={field.name}
                                rows={4}
                                className="field-control h-auto py-2.5"
                                placeholder={field.placeholder}
                                {...register(field.name)}
                              />
                            ) : field.type === "file" ? (
                              <input
                                id={field.name}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(event) =>
                                  setSelectedFile(
                                    event.target.files?.[0] || null,
                                  )
                                }
                                className="block w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-bold file:text-brand-700"
                              />
                            ) : (
                              <input
                                id={field.name}
                                type={field.type}
                                inputMode={
                                  field.type === "tel" ? "numeric" : undefined
                                }
                                pattern={
                                  field.type === "tel" ? "[0-9]{7,15}" : undefined
                                }
                                step={
                                  field.type === "number" ? "any" : undefined
                                }
                                className="field-control"
                                placeholder={field.placeholder}
                                {...register(field.name)}
                              />
                            )}
                            {field.helper && (
                              <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
                                {field.helper}
                              </p>
                            )}
                            {errors[field.name]?.message && (
                              <p className="mt-1.5 text-xs text-red-600">
                                {String(errors[field.name]?.message)}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-8">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={pending}
                  className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {pending
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : `Create ${config.singular.toLowerCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleting && (
        <div className="fixed inset-0 z-[80] grid place-items-center px-4">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDeleting(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600">
              <Archive className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              Archive this {config.singular.toLowerCase()}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The record will leave active views, but its HR history and audit
              trail will be preserved.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={archive}
                className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                Archive record
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
