# البنية المعمارية — Architecture

كيف تعمل الأنظمة الأساسية في TurfBook. *How the core systems work.*

---

## ١. التعريب — i18n

- اللغة الافتراضية: `ar-JO` (متغير `DEFAULT_LOCALE`) — كل النصوص الظاهرة
  للمستخدم بالعربية أولاً، والواجهة RTL.
- العملة الافتراضية للمنشآت الأردنية: `JOD` (دينار أردني)؛ أيام العطلة
  الافتراضية `[4, 5]` (الجمعة/السبت) — تُضبط لكل منشأة في `weekend_days`.
- أسماء المدن والفرق والمرافق في البيانات التجريبية عربية بالكامل.
- رسائل الخطأ للمستخدم النهائي يجب أن تكون عربية؛ رسائل السجلات (logs)
  الداخلية بالإنجليزية.

## ٢. الصلاحيات — RBAC

- **الأدوار الافتراضية** (`rbac.py`): `super_admin` (wildcard `*`)، `admin`
  (قابل للتخصيص)، `owner`، `customer`. تُخزن في مجموعة `roles`.
- **الصلاحيات** سلاسل نصية صريحة (`fields.update`، `bookings.approve`، …).
  `effective_permissions()` تجمع صلاحيات الأدوار + المنح المباشرة.
- **عزل المستأجرين (tenant isolation)**: `assert_facility_access()` — امتلاك
  صلاحية عامة (مثل `fields.update` لدور المالك) **لا** يمنح الوصول لمنشأة
  مالك آخر. يتجاوز العزل فقط `super_admin`.
- **صلاحيات الطاقم**: عضوية `organization_members` بصلاحيات على مستوى
  المنشأة (`manage_field`، `view_bookings`، …) مع خريطة تحويل من صلاحيات
  المنصة (`_PLATFORM_TO_ORG`).

## ٣. تزامن الحجوزات — Booking concurrency

مشكلة "الحجز المزدوج" تُحل على مستوى قاعدة البيانات، لا بالفحص المسبق:

1. يُدرج الحجز أولاً (`bookings`).
2. تُدرج حجوزات الأجزاء الزمنية (`slot_reservations`: جزء واحد لكل ٣٠ دقيقة)
   عبر `insert_many` **ذرّي**.
3. فهرس فريد على `(pitch_id, date, slot_min)` يجعل الإدراج المتزامن لنفس
   الجزء يفشل بـ `DuplicateKeyError`/`BulkWriteError` → يُحذف الحجز اليتيم
   ويُرجع `409 Conflict`.

النتيجة: مهما بلغ عدد الطلبات المتزامنة، حجز واحد فقط يصل إلى `CONFIRMED`.

## ٤. محرك الدوري — League engine

- **توليد المباريات**: طريقة الدائرة (circle method) — `n-1` جولة، كل فريق
  يقابل كل فريق **مرة واحدة**؛ خيار الذهاب والإياب يعكس المباريات.
  توزيع الذهاب/الإياب متوازن (greedy) فلا يظل فريق غالباً مستضيفاً أو ضيفاً.
- **الترتيب**: ٣ نقاط للفوز / ١ للتعادل، مرتبة بالنقاط ثم فارق الأهداف ثم
  الأهداف المسجلة.
- **إعادة الاحتساب حتمية (idempotent)**: الترتيب يُعاد بناؤه من قائمة
  النتائج ويُستبدل — لا تراكم أبداً. المجموعات: `leagues`، `seasons`،
  `teams`، `players`، `matches`، `standings`.

## ٥. الإشعارات الفورية — Push

- Web Push ببروتوكول VAPID (مفاتيح `VAPID_*` في البيئة).
- إشعارات داخل التطبيق في مجموعة `notifications` + تفضيلات الكتم في
  `notification_prefs` (تُحترم قبل كل إرسال).
- أحداث: إنشاء/قبول/رفض/إلغاء الحجز، نتائج المباريات (عند اكتمال وحدة الدوري).

## ٦. المهام المجدولة — Jobs

مهام دورية (cron/worker) مخططة:

| المهمة | الوظيفة |
|---|---|
| انتهاء الحجوزات المعلقة | حجوزات `PENDING` التي تجاوزت مهلة الدفع → `EXPIRED` + تحرير الأجزاء |
| تذكير قبل المباراة | إشعار قبل ٢٤ ساعة و٢ ساعة من موعد الحجز |
| إغلاق المباريات | مباريات `CONFIRMED` المنتهية → `COMPLETED` |
| تنظيف الرموز | رموز `one_time_tokens` والجلسات المنتهية (TTL indexes موجودة) |

## ٧. التدقيق — Audit

كل عملية حساسة (تسجيل، حجز، إلغاء، استرداد، تعديل منشأة/دور) تكتب قيداً
غير قابل للتعديل في `audit_logs` عبر `write_audit()` مع `before`/`after`.

---

*English summary: Arabic-first i18n (ar-JO, JOD, Fri/Sat weekends); RBAC with wildcard super_admin and strict tenant isolation; booking concurrency via unique index + atomic insert_many; round-robin league engine with idempotent standings; VAPID web push + in-app notifications; scheduled jobs for expiry/reminders; append-only audit logs.*
