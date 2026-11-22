"use client";

import { DownloadIcon, FileJsonIcon, UploadIcon } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BACKUP_MAX_BYTES,
  BACKUP_TABLES,
  BACKUP_TABLE_LABEL,
  checkBackup,
  type BackupCounts,
  type RestoreReport,
} from "@/lib/backup/format";
import { THAI_MONTHS } from "@/lib/board/year";
import { cn } from "@/lib/utils";

type Picked = { name: string; text: string; counts: BackupCounts; createdAt: string };

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(d);
}

const monthName = (m: number | null) => (m ? THAI_MONTHS[m - 1] : "—");

/** BR-45 download / BR-46 restore with a report. */
export function BackupPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState<RestoreReport | null>(null);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    setError(undefined);
    setReport(null);
    setPicked(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) {
      setError("ไฟล์ใหญ่เกินไป");
      return;
    }
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      setError("อ่านไฟล์ไม่ได้ ไฟล์ต้องเป็น JSON ที่ได้จากปุ่มดาวน์โหลด backup");
      return;
    }
    const check = checkBackup(raw);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setPicked({ name: file.name, text, counts: check.counts, createdAt: check.backup.created_at });
  }

  async function onRestore() {
    if (!picked) return;
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: picked.text,
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "error" in body ? String(body.error) : "กู้คืนข้อมูลไม่สำเร็จ";
        setError(message);
        return;
      }
      setReport(body as RestoreReport);
      setPicked(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadIcon className="size-5 text-primary" aria-hidden />
            สำรองข้อมูล (backup)
          </CardTitle>
          <CardDescription>
            ได้ไฟล์ JSON ที่มีผู้ใช้ (ไม่มีรหัสผ่าน) งานทั้งหมดและประวัติการย้าย วันลา หมวดหมู่ และการตั้งค่าปีงบประมาณ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a href="/api/admin/backup" download className={cn(buttonVariants(), "w-fit gap-1.5")}>
            <DownloadIcon aria-hidden />
            ดาวน์โหลด backup
          </a>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            ไฟล์นี้มีข้อมูลงานของทุกคน ควรเก็บไว้ในที่ปลอดภัยและไม่ส่งต่อในช่องทางสาธารณะ
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadIcon className="size-5 text-primary" aria-hidden />
            กู้คืนข้อมูล (restore)
          </CardTitle>
          <CardDescription>
            เพิ่มเฉพาะข้อมูลที่ยังไม่มีในระบบ ข้อมูลที่ซ้ำจะถูกข้ามและไม่เขียนทับข้อมูลปัจจุบัน ผู้ใช้ที่ไม่มีในระบบจะได้บัญชีใหม่ด้วยรหัสผ่านเริ่มต้น
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            เลือกไฟล์ backup (.json)
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              onChange={onPick}
              className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary hover:file:bg-primary/15"
            />
          </label>

          <FormMessage error={error} />

          {picked && (
            <div className="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10" data-testid="restore-preview">
              <p className="flex items-center gap-2 text-sm">
                <FileJsonIcon className="size-4 text-primary" aria-hidden />
                <span className="font-medium">{picked.name}</span>
                <span className="text-muted-foreground">สำรองเมื่อ {formatDateTime(picked.createdAt)}</span>
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {BACKUP_TABLES.map((t) => (
                  <li key={t}>
                    {BACKUP_TABLE_LABEL[t]} <span className="font-semibold tabular-nums">{picked.counts[t]}</span>
                  </li>
                ))}
              </ul>
              <div>
                <Button onClick={onRestore} disabled={pending} className="gap-1.5">
                  <UploadIcon aria-hidden />
                  {pending ? "กำลังกู้คืน…" : "ยืนยันกู้คืนข้อมูล"}
                </Button>
              </div>
            </div>
          )}

          {report && <RestoreResult report={report} />}
        </CardContent>
      </Card>
    </div>
  );
}

function RestoreResult({ report }: { report: RestoreReport }) {
  const inserted = BACKUP_TABLES.reduce((n, t) => n + report[t].inserted, 0);
  const failed = BACKUP_TABLES.reduce((n, t) => n + report[t].failed, 0);
  return (
    <div className="flex flex-col gap-3" data-testid="restore-report" role="status">
      <FormMessage
        success={failed === 0 ? `กู้คืนเสร็จแล้ว เพิ่มข้อมูลใหม่ ${inserted} รายการ` : undefined}
        error={failed > 0 ? `กู้คืนเสร็จแล้ว เพิ่มข้อมูลใหม่ ${inserted} รายการ แต่มี ${failed} รายการที่ไม่สำเร็จ` : undefined}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ข้อมูล</TableHead>
            <TableHead className="text-right">เพิ่มใหม่</TableHead>
            <TableHead className="text-right">ข้าม (ซ้ำ)</TableHead>
            <TableHead className="text-right">ไม่สำเร็จ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {BACKUP_TABLES.map((t) => (
            <TableRow key={t} data-table={t}>
              <TableCell>{BACKUP_TABLE_LABEL[t]}</TableCell>
              <TableCell className="text-right tabular-nums" data-col="inserted">
                {report[t].inserted}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground" data-col="skipped">
                {report[t].skipped}
              </TableCell>
              <TableCell
                className={cn("text-right tabular-nums", report[t].failed > 0 && "font-semibold text-destructive")}
                data-col="failed"
              >
                {report[t].failed}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        <li data-testid="restore-settings">
          การตั้งค่าปีงบประมาณ:{" "}
          {report.settings.same
            ? "ตรงกับไฟล์ ไม่ต้องเปลี่ยน"
            : `ไม่ได้เขียนทับ (ปัจจุบันเริ่ม${monthName(report.settings.current_fiscal_start_month)} ในไฟล์เริ่ม${monthName(report.settings.backup_fiscal_start_month)}) แก้ได้ที่หน้าตั้งค่าปีงบประมาณ`}
        </li>
        {report.accountsCreated > 0 && (
          <li>สร้างบัญชีใหม่ {report.accountsCreated} บัญชี ใช้รหัสผ่านเริ่มต้นและจะเห็นแถบเตือนให้เปลี่ยนรหัสผ่าน</li>
        )}
      </ul>
      {report.errors.length > 0 && (
        <div className="rounded-lg bg-destructive/5 p-3 text-sm ring-1 ring-destructive/20">
          <p className="mb-1 font-medium text-destructive">รายการที่ไม่สำเร็จ</p>
          <ul className="list-disc space-y-0.5 pl-5" data-testid="restore-errors">
            {report.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
