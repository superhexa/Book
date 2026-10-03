// Shared panel-screen kit for admin / owner / customer panels.
// Arabic-first, RTL-aware building blocks: headers, cards, form fields,
// a responsive data table, a confirm dialog hook, validators and
// Arabic (ar-JO) formatters.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";

import { makeStyles, spacing, useTheme } from "@/src/theme";
import { Button } from "@/src/ui";

/* ------------------------------------------------------------------ */
/* RTL helper                                                          */
/* ------------------------------------------------------------------ */

/** Ensures the app stays in RTL mode (Arabic-first). Returns { rtl }. */
export function useRtl() {
  useEffect(() => {
    I18nManager.allowRTL(true);
    if (!I18nManager.isRTL) I18nManager.forceRTL(true);
  }, []);
  return { rtl: I18nManager.isRTL !== false };
}

/* ------------------------------------------------------------------ */
/* Arabic (ar-JO) formatting                                           */
/* ------------------------------------------------------------------ */

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export function toArDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-10-04" -> "٤ أكتوبر ٢٠٢٦" */
export function arDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso || "—";
  try {
    return new Intl.DateTimeFormat("ar-JO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/** "2026-10-04" -> "٤/١٠/٢٠٢٦" */
export function arDateShort(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso || "—";
  try {
    return new Intl.DateTimeFormat("ar-JO", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

/** minutes since midnight -> "٣:٣٠ م" */
export function arTime(minutes: number | string): string {
  const m = typeof minutes === "string" ? parseInt(minutes, 10) : minutes;
  if (!Number.isFinite(m)) return "—";
  const h24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const period = h24 < 12 ? "ص" : "م";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${toArDigits(h12)}:${toArDigits(String(mm).padStart(2, "0"))} ${period}`;
}

const STATUS_AR: Record<string, string> = {
  PENDING: "بانتظار التأكيد",
  CONFIRMED: "مؤكدة",
  CANCELLED: "ملغاة",
  COMPLETED: "مكتملة",
  NO_SHOW: "لم يحضر",
  OPEN: "مفتوحة",
  IN_REVIEW: "قيد المراجعة",
  RESOLVED: "محلولة",
  REJECTED: "مرفوضة",
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  DRAFT: "مسودة",
  PUBLISHED: "منشور",
  PAID: "مدفوع",
  UNPAID: "غير مدفوع",
  REFUNDED: "مسترد",
};

/** Booking/entity status code -> Arabic label. */
export function arStatus(status: string): string {
  if (!status) return "—";
  return STATUS_AR[String(status).toUpperCase()] ?? String(status);
}

/** "2026-10-04T15:30:00" -> "٤ أكتوبر ٢٠٢٦، ٣:٣٠ م" */
export function arDateTime(iso: string): string {
  if (!iso) return "—";
  const [d, t] = iso.split("T");
  const time = t ? t.slice(0, 5) : "";
  const [h, m] = time.split(":").map(Number);
  const datePart = arDate(d);
  if (!Number.isFinite(h)) return datePart;
  return `${datePart}، ${arTime(h * 60 + (m || 0))}`;
}

/** "2026-10-04" + 3 -> "2026-10-07" */
export function addDaysISO(iso: string, days: number): string {
  const d = parseDate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** today as "YYYY-MM-DD" (local) */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 25 -> "٢٥ د.أ" */
export function jod(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  const formatted = n % 1 === 0 ? toArDigits(Math.round(n)) : toArDigits(n.toFixed(2));
  return `${formatted} د.أ`;
}

/* ------------------------------------------------------------------ */
/* Validators                                                          */
/* ------------------------------------------------------------------ */

type Validator = {
  required: (value: unknown, label: string) => string | undefined;
  minLen: (value: unknown, n: number, label: string) => string | undefined;
  positive: (value: unknown, label: string) => string | undefined;
  number: (value: unknown, label: string) => string | undefined;
  email: (value: unknown, label: string) => string | undefined;
  phone: (value: unknown, label: string) => string | undefined;
};

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

export const v: Validator = {
  required: (value, label) => (isEmpty(value) ? `${label} مطلوب` : undefined),
  minLen: (value, n, label) =>
    String(value ?? "").trim().length < n ? `${label} يجب أن يكون ${toArDigits(n)} أحرف على الأقل` : undefined,
  positive: (value, label) => {
    const n = typeof value === "string" ? parseFloat(value) : (value as number);
    return !Number.isFinite(n) || n <= 0 ? `${label} يجب أن يكون أكبر من صفر` : undefined;
  },
  number: (value, label) => {
    const n = typeof value === "string" ? parseFloat(value) : (value as number);
    return !Number.isFinite(n) ? `${label} يجب أن يكون رقماً` : undefined;
  },
  email: (value, label) =>
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim()) ? `${label} غير صالح` : undefined,
  phone: (value, label) =>
    String(value ?? "").replace(/\D/g, "").length < 7 ? `${label} غير صالح` : undefined,
};

/* ------------------------------------------------------------------ */
/* Layout primitives                                                   */
/* ------------------------------------------------------------------ */

export function PanelScreen({
  children,
  testID,
  scroll = true,
}: {
  children: React.ReactNode;
  testID?: string;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing["3xl"] }}>
      {children}
    </View>
  );
  if (!scroll) {
    return (
      <View testID={testID} style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
        {content}
      </View>
    );
  }
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
    >
      {content}
    </ScrollView>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const s = usePanelStyles();
  return (
    <View style={s.headerRow}>
      <View style={[s.headerWrap, { flex: 1 }]}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const s = usePanelStyles();
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const s = usePanelStyles();
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? <Text style={s.formTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

/** Placeholder card for features whose backend APIs are not live yet. */
export function PendingFeature({
  title,
  body,
  needed,
}: {
  title: string;
  body: string;
  needed?: string[];
}) {
  const s = usePanelStyles();
  return (
    <View style={s.card}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      <Text style={s.pendingBody}>{body}</Text>
      {needed && needed.length > 0 ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <Text style={s.pendingNeededTitle}>الواجهات المطلوبة:</Text>
          {needed.map((n) => (
            <Text key={n} style={s.pendingNeededItem}>
              • {n}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

type FieldProps = {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
};

function FieldLabel({ label, required }: { label?: string; required?: boolean }) {
  const s = usePanelStyles();
  if (!label) return null;
  return (
    <Text style={s.fieldLabel}>
      {label}
      {required ? <Text style={s.fieldRequired}> *</Text> : null}
    </Text>
  );
}

function FieldError({ error }: { error?: string }) {
  const s = usePanelStyles();
  if (!error) return null;
  return <Text style={s.fieldError}>{error}</Text>;
}

function FieldHint({ hint }: { hint?: string }) {
  const s = usePanelStyles();
  if (!hint) return null;
  return <Text style={s.fieldHint}>{hint}</Text>;
}

export function FInput({
  label,
  error,
  required,
  hint,
  ...props
}: TextInputProps & FieldProps) {
  const s = usePanelStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        placeholderTextColor={colors.muted}
        style={[s.input, focused && s.inputFocused, error && s.inputError]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <FieldError error={error} />
      <FieldHint hint={hint} />
    </View>
  );
}

export function FTextArea({
  label,
  error,
  required,
  hint,
  numberOfLines = 4,
  ...props
}: TextInputProps & FieldProps & { numberOfLines?: number }) {
  const s = usePanelStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        style={[s.input, s.textArea, focused && s.inputFocused, error && s.inputError]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <FieldError error={error} />
      <FieldHint hint={hint} />
    </View>
  );
}

export type SelectOption = { key: string; label: string };

export function FSelect({
  label,
  error,
  required,
  value,
  onChange,
  options,
  placeholder = "اختر...",
}: FieldProps & {
  value: string;
  onChange: (key: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const s = usePanelStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View style={s.fieldWrap}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={() => setOpen(true)}
        style={[s.input, s.selectBox, error && s.inputError]}
      >
        <Text style={[s.selectText, !selected && { color: colors.muted }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={s.selectChevron}>▾</Text>
      </Pressable>
      <FieldError error={error} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={s.modalCard}>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  style={[s.optionRow, o.key === value && s.optionRowActive]}
                >
                  <Text style={[s.optionText, o.key === value && s.optionTextActive]}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Numeric input + switch                                              */
/* ------------------------------------------------------------------ */

export function FNumber({
  label,
  error,
  required,
  hint,
  value,
  onChangeNumber,
  placeholder,
}: FieldProps & {
  value: number | string;
  onChangeNumber: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <FInput
      label={label}
      error={error}
      required={required}
      hint={hint}
      placeholder={placeholder}
      keyboardType="decimal-pad"
      value={String(value ?? "")}
      onChangeText={onChangeNumber}
    />
  );
}

export function FSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const s = usePanelStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={s.switchRow}>
      <Text style={s.switchLabel}>{label}</Text>
      <View style={[s.switchTrack, value && { backgroundColor: colors.brandPrimary }]}>
        <View style={[s.switchThumb, value ? s.switchThumbOn : s.switchThumbOff]} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Grids, stat cards, skeletons                                        */
/* ------------------------------------------------------------------ */

export function CardGrid({ children }: { children: React.ReactNode }) {
  const s = usePanelStyles();
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 2 : 1;
  const kids = React.Children.toArray(children);
  if (cols === 1) return <View style={{ gap: spacing.md }}>{kids}</View>;
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < kids.length; i += 2) rows.push(kids.slice(i, i + 2));
  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((r, i) => (
        <View key={i} style={s.gridRow}>
          {r.map((k, j) => (
            <View key={j} style={{ flex: 1 }}>
              {k}
            </View>
          ))}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  const s = usePanelStyles();
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 2 : 2;
  void cols;
  return <View style={s.statGrid}>{children}</View>;
}

export function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  const s = usePanelStyles();
  return (
    <View style={[s.statCard, accent && s.statCardAccent]}>
      <View style={s.statTop}>
        {icon}
        <Text style={[s.statLabel, accent && s.statLabelAccent]}>{label}</Text>
      </View>
      <Text style={[s.statValue, accent && s.statValueAccent]}>{value}</Text>
    </View>
  );
}

function SkeletonBlock({ w = "100%", h = 14 }: { w?: import("react-native").DimensionValue; h?: number }) {
  const s = usePanelStyles();
  return <View style={[s.skeleton, { width: w, height: h }]} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: spacing.xs }}>
          <SkeletonBlock w="60%" />
          <SkeletonBlock w="100%" h={44} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  const s = usePanelStyles();
  return (
    <View style={s.statGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.statCard}>
          <SkeletonBlock w="50%" h={12} />
          <SkeletonBlock w="70%" h={22} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Data table (responsive: table on desktop, cards on mobile)          */
/* ------------------------------------------------------------------ */

export type DataColumn<T> = {
  key: string;
  title: string;
  value?: (row: T) => string | number;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  hideOnMobile?: boolean;
};

export function DataTable<T>({
  data,
  loading,
  keyExtractor,
  columns,
  pageSize = 10,
  onRowPress,
  emptyTitle = "لا توجد بيانات",
}: {
  data: T[];
  loading?: boolean;
  keyExtractor: (row: T) => string;
  columns: DataColumn<T>[];
  pageSize?: number;
  onRowPress?: (row: T) => void;
  emptyTitle?: string;
}) {
  const s = usePanelStyles();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const visibleCols = useMemo(
    () => columns.filter((c) => !(isMobile && c.hideOnMobile)),
    [columns, isMobile]
  );

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const va = col.value!(a);
      const vb = col.value!(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * sortDir;
    });
    return arr;
  }, [data, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (col: DataColumn<T>) => {
    if (!col.sortable || !col.value) return;
    if (sortKey === col.key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(col.key);
      setSortDir(1);
    }
  };

  useEffect(() => setPage(0), [data.length]);

  if (loading) {
    return (
      <View style={s.card}>
        <Text style={s.mutedText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={s.card}>
        <Text style={s.mutedText}>{emptyTitle}</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      {/* header */}
      <View style={[s.tRow, s.tHead]}>
        {visibleCols.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => toggleSort(c)}
            style={[s.tCell, { flex: 1 }]}
            disabled={!c.sortable}
          >
            <Text style={s.tHeadText}>
              {c.title}
              {c.sortable && sortKey === c.key ? (sortDir === 1 ? " ▲" : " ▼") : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      {rows.map((row) => (
        <Pressable
          key={keyExtractor(row)}
          onPress={onRowPress ? () => onRowPress(row) : undefined}
          disabled={!onRowPress}
          style={s.tRow}
        >
          {visibleCols.map((c) => (
            <View key={c.key} style={[s.tCell, { flex: 1 }]}>
              {c.render ? (
                c.render(row)
              ) : (
                <Text style={s.tCellText}>{String(c.value ? c.value(row) ?? "—" : "—")}</Text>
              )}
            </View>
          ))}
        </Pressable>
      ))}
      {pageCount > 1 ? (
        <View style={s.pager}>
          <Button
            title="السابق"
            variant="ghost"
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Text style={s.mutedText}>
            {toArDigits(safePage + 1)} / {toArDigits(pageCount)}
          </Text>
          <Button
            title="التالي"
            variant="ghost"
            onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

type AskOpts = {
  title: string;
  message?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export function useConfirm() {
  const s = usePanelStyles();
  const [opts, setOpts] = useState<AskOpts | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback((o: AskOpts) => setOpts(o), []);
  const close = useCallback(() => {
    if (!busy) setOpts(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!opts) return;
    setBusy(true);
    try {
      await opts.onConfirm();
    } finally {
      setBusy(false);
      setOpts(null);
    }
  }, [opts]);

  const dialog = (
    <Modal visible={!!opts} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.modalBackdrop} onPress={close}>
        <View style={s.modalCard} onStartShouldSetResponder={() => true}>
          {opts ? (
            <View style={{ gap: spacing.md }}>
              <Text style={s.confirmTitle}>{opts.title}</Text>
              {opts.message ? <Text style={s.mutedText}>{opts.message}</Text> : null}
              <View style={s.confirmActions}>
                <Button
                  title={opts.cancelLabel ?? "إلغاء"}
                  variant="ghost"
                  onPress={close}
                />
                <Button
                  title={busy ? "..." : opts.confirmLabel ?? "تأكيد"}
                  variant={opts.danger ? "danger" : "primary"}
                  onPress={confirm}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );

  return { ask, dialog };
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const usePanelStyles = makeStyles((c) => ({
  headerWrap: { gap: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { fontSize: 22, fontWeight: "800", color: c.onSurface },
  headerSub: { fontSize: 13, color: c.muted },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
  formTitle: { fontSize: 14, fontWeight: "700", color: c.onSurface },
  pendingBody: { fontSize: 13, color: c.onSurfaceSecondary, lineHeight: 20 },
  pendingNeededTitle: { fontSize: 12, fontWeight: "700", color: c.onSurface },
  pendingNeededItem: {
    fontSize: 11,
    color: c.muted,
    fontFamily: "monospace",
    textAlign: "left",
  },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: c.onSurface },
  fieldRequired: { color: c.error },
  fieldError: { fontSize: 12, color: c.error },
  fieldHint: { fontSize: 12, color: c.muted },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.onSurface,
    minHeight: 44,
  },
  inputFocused: { borderColor: c.brandPrimary },
  inputError: { borderColor: c.error },
  textArea: { minHeight: 110 },
  selectBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { fontSize: 14, color: c.onSurface },
  selectChevron: { fontSize: 14, color: c.muted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 420,
  },
  optionRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  optionRowActive: { backgroundColor: c.brandSecondary },
  optionText: { fontSize: 14, color: c.onSurface },
  optionTextActive: { fontWeight: "700", color: c.onBrandSecondary },
  confirmTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  mutedText: { fontSize: 13, color: c.muted },
  tRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: c.divider,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tHead: { borderTopWidth: 0 },
  tHeadText: { fontSize: 12, fontWeight: "700", color: c.muted },
  tCell: { justifyContent: "center" },
  tCellText: { fontSize: 13, color: c.onSurface },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  gridRow: { flexDirection: "row", gap: spacing.md },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: c.border,
    minWidth: 140,
    flexGrow: 1,
    flexBasis: 140,
  },
  statCardAccent: { backgroundColor: c.surfaceInverse },
  statTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  statLabel: { fontSize: 12, color: c.muted },
  statLabelAccent: { color: c.onSurfaceInverse },
  statValue: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  statValueAccent: { color: c.onSurfaceInverse },
  skeleton: { backgroundColor: c.surfaceTertiary, borderRadius: 8 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 14, color: c.onSurface, flex: 1 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.borderStrong,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  switchThumbOn: { alignSelf: "flex-end" },
  switchThumbOff: { alignSelf: "flex-start" },
}));
