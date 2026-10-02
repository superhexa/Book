# مرجع الواجهة البرمجية — API Reference

نظرة عامة على وحدات الخلفية ونقاط النهاية. كل المسارات تحت البادئة `/api`.
*Module overview with endpoint list. All paths are prefixed with `/api`.*

> ملاحظة: وحدات الدوريات/الفرق/المباريات والمدفوعات قيد التطوير في مسارات
> عمل متوازية — العقود المذكورة أدناه هي المتفق عليها في المواصفة.

---

## المصادقة — `routes_auth` (`/api/auth`)

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل حساب (زبون/مالك) — حد: 10/دقيقة |
| POST | `/api/auth/login` | تسجيل الدخول — حد: 10/دقيقة، قفل بعد ٥ محاولات فاشلة |
| POST | `/api/auth/refresh` | تدوير رمز التحديث — حد: 60/دقيقة |
| POST | `/api/auth/logout` | تسجيل الخروج من الجلسة الحالية |
| POST | `/api/auth/logout-all` | إبطال كل الجلسات |
| POST | `/api/auth/forgot` | طلب إعادة تعيين كلمة المرور — حد: 5/ساعة |
| POST | `/api/auth/reset` | إعادة التعيين بالرمز — حد: 10/ساعة |
| GET | `/api/auth/me` | الملف الشخصي |
| PATCH | `/api/auth/me` | تحديث الملف الشخصي |

## الكتالوج والإعدادات — `routes_catalog`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET/POST | `/api/catalog` | المدن والمرافق (قراءة/إضافة) |
| DELETE | `/api/catalog/{cid}` | حذف عنصر |
| GET/PUT | `/api/settings` | إعدادات المنصة |

## المنشآت والملاعب — `routes_facilities`

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/api/facilities` | إنشاء منشأة (مالك) |
| GET | `/api/facilities/mine` | منشآتي |
| GET | `/api/facilities` | بحث المنشآت (عام) |
| GET | `/api/facilities/{fid}` | تفاصيل منشأة |
| PATCH | `/api/facilities/{fid}` | تحديث (المالك فقط — عزل المستأجرين) |
| POST | `/api/facilities/{fid}/submit` | تقديم للمراجعة |
| DELETE | `/api/facilities/{fid}` | حذف ناعم |
| POST | `/api/facilities/{fid}/pitches` | إضافة ملعب |
| GET/PATCH/DELETE | `/api/pitches/{pid}` | إدارة ملعب |
| GET/POST | `/api/pitches/{pid}/blocks` | حجب أوقات (صيانة) |
| DELETE | `/api/blocks/{bid}` | إزالة حجب |
| POST | `/api/uploads` | رفع صور (S3 أو محلي) |
| GET | `/api/files/{path}` | تقديم ملف مرفوع |

## الحجوزات — `routes_bookings`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/api/availability?pitch_id=&date=` | شبكة الأوقات المتاحة مع الأسعار |
| POST | `/api/bookings/quote` | عرض سعر (تسعير الخادم هو المرجع) |
| POST | `/api/bookings` | إنشاء حجز — 201، تعارض الوقت → 409 |
| GET | `/api/bookings?scope=` | حجوزاتي |
| GET | `/api/bookings/{bid}` | تفاصيل حجز |
| POST | `/api/bookings/{bid}/cancel` | إلغاء + حساب الاسترداد |
| POST | `/api/bookings/{bid}/approve` | قبول (المالك) |
| POST | `/api/bookings/{bid}/reject` | رفض (المالك) |
| POST | `/api/bookings/{bid}/complete` | إتمام |
| POST | `/api/bookings/{bid}/no-show` | عدم حضور |

حالات الحجز: `PENDING` → `CONFIRMED` → `COMPLETED`، مع `CANCELLED` / `REJECTED` / `NO_SHOW`.
حالات الدفع: `PENDING` / `PAID` / `REFUNDED` / `PARTIALLY_REFUNDED`.

## التفاعل — `routes_engagement`

كوبونات (`/api/coupons`)، تقييمات (`/api/reviews` + رد/إبلاغ)، مفضلة
(`/api/favorites`)، إشعارات (`/api/notifications` + تفضيلاتها).

## المالك — `routes_owner` (`/api/owner`)

حجوزات المنشأة، التحليلات، إدارة طاقم العمل (`/staff`) وصلاحياتهم.

## الإدارة — `routes_admin` (`/api/admin`)

نظرة عامة وتحليلات، إدارة المستخدمين والأدوار، توثيق/تعليق/إيقاف المنشآت،
تجاوز الحجوزات، المدفوعات والاسترداد (`POST /api/admin/payments/{pid}/refund`)،
إدارة التقييمات، وسجل التدقيق (`/api/admin/audit-logs`).

## الدوريات — `routes_leagues` (قيد التطوير)

العقد المتفق عليه — المجموعات: `leagues`، `seasons`، `teams`، `players`،
`matches`، `standings`.

| الطريقة | المسار | الوصف |
|---|---|---|
| GET/POST | `/api/leagues` | الدوريات |
| GET/POST | `/api/seasons` | المواسم |
| GET/POST | `/api/teams` | الفرق |
| GET/POST | `/api/matches` | المباريات والنتائج |
| GET | `/api/standings?season_id=` | جدول الترتيب |

محرك الدوري: توليد مباريات ذهاب/إياب بطريقة الدائرة (كل فريق يقابل الآخر
مرة واحدة)، واحتساب الترتيب (٣ نقاط للفوز) بطريقة حتمية قابلة لإعادة
الاحتساب (idempotent).

## المدفوعات — `routes_payments` (قيد التطوير)

العقد المتفق عليه:

- الحالات: `PENDING` → `PAID` / `FAILED` / `EXPIRED` / `CANCELLED`؛
  `PAID` → `REFUNDED` / `PARTIALLY_REFUNDED`؛ الحالات النهائية لا تتحول.
- الـ webhook **لا يثق بالواجهة أبداً**: يتحقق من توقيع HMAC، ويعيد حساب
  المبلغ من الحجز في الخادم، ويشتق الحالة الجديدة من نوع حدث المزوّد فقط.
- الاسترداد ينشئ سجلاً في مجموعة `refunds` + قيد تدقيق `payment_refunded`.

---

*English summary: full endpoint list per module under `/api`; booking states PENDING→CONFIRMED→COMPLETED; payment states PENDING→PAID→REFUNDED; leagues & payments modules follow the agreed contracts above.*
