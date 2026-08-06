import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminListApplications } from "../api";
import {
  flexRender,
  createCoreRowModel,
  useTable,
} from "@tanstack/react-table";
import {
  FileText, Clock, CheckCircle2, XCircle, Loader2, Zap, Inbox, AlertCircle,
  ChevronRight, Building2, Search, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

const STATUS_FILTERS = [
  { label: "All", value: "all", icon: Inbox },
  { label: "Pending", value: "admin_pending", icon: Clock },
  { label: "AI Check", value: "ai_reviewing", icon: Zap },
  { label: "Awaiting", value: "sent_back_for_more_evidence", icon: AlertCircle },
  { label: "Approved", value: "approved", icon: CheckCircle2 },
  { label: "Denied", value: "denied", icon: XCircle },
];

const STATUS_STYLES = {
  submitted: { label: "Submitted", color: "var(--text-muted)", bg: "var(--bg-surface)" },
  ai_reviewing: { label: "AI Reviewing", color: "#f59e0b", bg: "#fef3c7" },
  admin_pending: { label: "Pending Review", color: "#3b82f6", bg: "#dbeafe" },
  approved: { label: "Approved", color: "var(--status-supported-text)", bg: "var(--status-supported-bg)" },
  denied: { label: "Denied", color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)" },
  sent_back_for_more_evidence: { label: "Awaiting Evidence", color: "#ec4899", bg: "#fce7f3" },
};

export default function AdminApplicationQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchQueue = async (currentFilter, currentPage) => {
    setLoading(true);
    setError("");
    try {
      const apiFilter = currentFilter === "all" ? "" : currentFilter;
      const res = await adminListApplications(apiFilter, currentPage, limit);
      setApplications(res.data?.data || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(filter, page);
  }, [filter, page]);

  const handleFilterChange = (val) => {
    if (!val) return; // Prevent deselecting
    setFilter(val);
    setPage(1); // Reset to first page on filter change
  };

  const columns = [
    {
      accessorKey: "reference_number",
      header: "Reference",
      cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.reference_number}</span>,
    },
    {
      accessorKey: "submitted_at",
      header: "Date Submitted",
      cell: ({ row }) => <span className="text-gray-600 dark:text-gray-400">{new Date(row.original.submitted_at || row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal capitalize bg-gray-50 dark:bg-gray-800">
          {row.original.category?.replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "tiers",
      header: () => <div className="text-center w-full">Tiers Passed</div>,
      cell: ({ row }) => {
        const app = row.original;
        let passedTiersCount = 0;
        const totalTiers = app.tier_results?.length || 0;
        if (app.tier_results) {
          passedTiersCount = app.tier_results.filter(t => t.passed).length;
        }
        return <div className="text-center text-sm font-medium">{passedTiersCount} / {totalTiers}</div>;
      }
    },
    {
      accessorKey: "claims_checked_count",
      header: () => <div className="text-center w-full">AI Checked</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {row.original.claims_checked_count} claims
          </Badge>
        </div>
      )
    },
    {
      accessorKey: "application_status",
      header: "Status",
      cell: ({ row }) => {
        const sStyle = STATUS_STYLES[row.original.application_status] || { label: row.original.application_status, color: "var(--text-normal)", bg: "var(--border)" };
        return (
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ color: sStyle.color, backgroundColor: sStyle.bg }}
          >
            {sStyle.label}
          </span>
        );
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right w-full">Action</div>,
      cell: () => (
        <div className="text-right">
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
            Review <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )
    }
  ];

  const table = useTable({
    data: applications,
    columns,
    getCoreRowModel: createCoreRowModel(),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">Application Queue</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">Review and process incoming insurance claims.</p>
        </div>
        <div className="bg-gray-100/80 dark:bg-gray-800/80 p-1.5 rounded-xl inline-flex shadow-inner border border-gray-200 dark:border-gray-700/50">
          <ToggleGroup type="single" value={filter} onValueChange={handleFilterChange} className="gap-1">
            {STATUS_FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <ToggleGroupItem
                  key={f.value}
                  value={f.value}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg transition-all data-[state=on]:bg-white data-[state=on]:text-indigo-700 data-[state=on]:shadow-sm dark:data-[state=on]:bg-gray-700 dark:data-[state=on]:text-indigo-400 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {f.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 flex-shrink-0">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-gray-50/80 dark:bg-gray-800/80 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="font-semibold text-gray-900 dark:text-gray-100">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 p-6 align-top">
                    <div className="space-y-4 w-full">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <CheckCircle2 className="w-12 h-12 mb-3 text-gray-300" />
                      <div className="text-lg font-medium text-gray-900 dark:text-white">All caught up!</div>
                      <p>No applications match the current filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => navigate(`/admin/applications/${row.original.case_id}`)}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Footer */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 rounded-b-xl flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900 dark:text-white">{applications.length > 0 ? (page - 1) * limit + 1 : 0}</span> to <span className="font-medium text-gray-900 dark:text-white">{Math.min(page * limit, total)}</span> of <span className="font-medium text-gray-900 dark:text-white">{total}</span> applications
          </div>
          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page === 1 || loading ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              <PaginationItem>
                <div className="text-sm font-medium px-4">
                  Page {page} of {totalPages}
                </div>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page === totalPages || loading || totalPages === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Card>
    </div>
  );
}
