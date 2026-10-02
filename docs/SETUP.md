# دليل الإعداد — Setup Guide

دليل تشغيل مشروع TurfBook (منصة كرة القدم الأردنية) محلياً: الخلفية (Backend) والواجهة (Frontend).

> This guide is Arabic-first. English summary follows each section briefly.

---

## ١. المتطلبات — Requirements

| الأداة | الإصدار |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| MongoDB | 6+ (محلي أو Atlas) |
| Git | أي إصدار حديث |

---

## ٢. إعداد الخلفية — Backend setup

```bash
cd backend

# بيئة افتراضية
python3 -m venv .venv
source .venv/bin/activate        # ويندوز: .venv\Scripts\activate

# الاعتماديات
pip install -r requirements.txt

# ملف البيئة
cp .env.example .env
# ثم عدّل .env: ضع MONGO_URL و DB_NAME و JWT_SECRET (قيمة عشوائية طويلة)
```

### قاعدة البيانات — MongoDB

خياران:

**أ) محلي عبر Docker:**
```bash
docker run -d --name turfbook-mongo -p 27017:27017 mongo:7
# MONGO_URL=mongodb://localhost:27017
```

**ب) MongoDB Atlas:** أنشئ Cluster مجاني وانسخ رابط الاتصال إلى `MONGO_URL`.

### تشغيل الخادم — Run the server

```bash
uvicorn server:app --reload --port 8001
# API: http://localhost:8001/api/health
```

للتحقق السريع: `python smoke_test.py` (يتطلب خادماً يعمل على المنفذ 8001).

---

## ٣. البيانات التجريبية — Seed data

الملف `backend/seed.py` يزرع بيانات تجريبية آمنة (لا يعمل تلقائياً في الإنتاج):

```bash
cd backend
SEED_DEMO=1 python seed.py
```

- بدون `SEED_DEMO=1` يزرع فقط البيانات الأساسية (مدن/مالك تجريبي) — آمن للتكرار.
- مع `SEED_DEMO=1` يضيف المحتوى الأردني: مالكان، ٣ منشآت (عمّان/إربد/العقبة)،
  ملاعب، ٤ فرق (٢٢ لاعباً)، دوري + موسم بمباريات وترتيب — كلها بالعربية.
- الزرع **متكرر بأمان** (idempotent): علامة `seeded_jo_v1` في `app_meta` تمنع التكرار.

> ⚠️ لا تفعّل `SEED_DEMO=1` في الإنتاج أبداً.

---

## ٤. الاختبارات — Tests

```bash
cd backend
python -m pytest tests/ -q
```

- الإعداد الافتراضي (`pytest.ini`: `-n 2 --dist loadscope`) يشغّل الاختبارات
  على عاملين بشكل متوازٍ.
- **بدون قاعدة بيانات**: معظم الاختبارات تعمل على قاعدة وهمية داخل الذاكرة
  (`tests/fakes.py`) — لا تحتاج MongoDB.
- **اختبارات تكامل حية** (إن وُجدت): عيّن `TEST_MONGO_URL` لرابط MongoDB حقيقي،
  وإلا تُتخطّى تلقائياً (`pytest.mark.skipif`).
- الاختبارات الحية القديمة (`tests/test_turfbook.py`) تتطلب خادماً يعمل —
  عيّن `EXPO_PUBLIC_BACKEND_URL` قبل تشغيلها.

للتشغيل التسلسلي (بدون xdist): `python -m pytest tests/ -q -n 0`

---

## ٥. إعداد الواجهة — Frontend setup

الواجهة مبنية بـ Expo (React Native للويب والجوال):

```bash
cd frontend
npm install

# ملف البيئة للواجهة (إن لزم)
# EXPO_PUBLIC_BACKEND_URL=http://localhost:8001

npx expo start
```

سكربتات `package.json` تشمل `start` و`android` و`ios` و`web`.

---

## ٦. النشر — Deployment

- **الخلفية**: تُنشر على Vercel عبر `backend/api/index.py`
  (راجع `backend/vercel.json` إن وُجد).
- **الواجهة**: `frontend/vercel.json` — نشر ويب.

تأكد من ضبط متغيرات البيئة في لوحة Vercel (نفس أسماء `.env.example`).

---

## ٧. استكشاف الأخطاء — Troubleshooting

| المشكلة | الحل |
|---|---|
| `KeyError: 'MONGO_URL'` | أنشئ `backend/.env` من `.env.example` |
| فشل الاتصال بـ MongoDB | تأكد أن `mongod` يعمل وأن الرابط صحيح |
| `401` عند تسجيل الدخول | تحقق من البريد/كلمة المرور؛ الحساب يُقفل ١٥ دقيقة بعد ٥ محاولات فاشلة |
| الاختبارات تطلب خادماً | شغّل ملفات `test_*.py` الجديدة فقط، أو عيّن `EXPO_PUBLIC_BACKEND_URL` |

---

*English summary: create venv, `pip install -r requirements.txt`, copy `.env.example` to `.env`, run MongoDB, `uvicorn server:app --reload --port 8001`, seed with `SEED_DEMO=1 python seed.py`, test with `pytest tests/ -q`, frontend via `npx expo start`.*
