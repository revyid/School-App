"use client";

import * as React from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  onClick: (ids: string[]) => void;
  danger?: boolean;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  rows: TData[];
  getRowId: (row: TData) => string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  bulkActions?: BulkAction[];
  emptyText?: string;
  initialSort?: SortingState;
}

/** Kolom checkbox pilih — taruh pertama di columns. */
export function selectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "pilih",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
        onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
        aria-label="Pilih semua"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Pilih baris"
      />
    ),
    enableSorting: false,
    size: 36,
  };
}

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/** Kolom aksi dropdown (...) — taruh terakhir di columns. */
export function actionsColumn<TData>(
  items: (row: TData) => RowAction[],
): ColumnDef<TData, unknown> {
  return {
    id: "aksi",
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Buka menu aksi">⋯</DropdownMenuTrigger>
        <DropdownMenuContent>
          {items(row.original).map((it) => (
            <DropdownMenuItem key={it.label} danger={it.danger} onClick={it.onClick}>
              {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    enableSorting: false,
    size: 56,
  };
}

export function DataTable<TData>({
  columns,
  rows,
  getRowId,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Cari...",
  filters,
  bulkActions,
  emptyText = "Tidak ada data yang cocok.",
  initialSort,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.id);

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-end gap-2.5">
        {onSearchChange !== undefined && (
          <label className="grid max-w-75 flex-1 basis-50 gap-1.5 text-[13px] text-ink/60">
            {searchPlaceholder}
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-h-11 rounded-xl border border-line bg-cream px-3 text-base text-ink outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        )}
        {filters}
        {bulkActions && bulkActions.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger disabled={selectedIds.length === 0}>
                Aksi massal ({selectedIds.length}) ▾
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {bulkActions.map((a) => (
                  <DropdownMenuItem
                    key={a.label}
                    danger={a.danger}
                    onClick={() => {
                      a.onClick(selectedIds);
                      setRowSelection({});
                    }}
                  >
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  style={h.column.getSize() !== 150 ? { width: h.column.getSize() } : undefined}
                  className={cn(h.column.getCanSort() && "cursor-pointer select-none")}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {h.column.getIsSorted() === "asc"
                    ? " Naik"
                    : h.column.getIsSorted() === "desc"
                      ? " Turun"
                      : null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-6 text-center text-ink/60">
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
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
  );
}
