"""Test doubles for TurfBook backend tests (Phase 6).

- Sets up ``sys.path``/env so backend modules import without a live server.
- ``FakeDb``: async in-memory Mongo replacement implementing the motor API
  subset used by the backend (find_one/find/insert_one/insert_many/
  update_one/update_many/delete_one/delete_many/find_one_and_update/
  count_documents/create_index). Enforces unique indexes and raises the real
  ``pymongo.errors`` exceptions so conflict paths behave like production.
- Helpers: ``make_request`` (starlette Request for direct route calls),
  ``patch_modules`` (swap the ``db`` global of backend modules),
  ``seed_roles``, ``make_user``, ``requires_mongo`` skip marker.

These doubles run anywhere (no DB needed). Tests that truly need a live
MongoDB use ``TEST_MONGO_URL`` + ``requires_mongo`` and skip gracefully.
"""
import copy
import os
import sys

import pytest

# --- import setup: backend modules importable without a live server ---------
_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "turfbook_test")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")

from pymongo.errors import BulkWriteError, DuplicateKeyError  # noqa: E402

# Tests that need a real MongoDB skip gracefully when TEST_MONGO_URL is unset.
requires_mongo = pytest.mark.skipif(
    not os.environ.get("TEST_MONGO_URL"),
    reason="TEST_MONGO_URL not set — needs a live MongoDB",
)


# ----------------------------- query matching -------------------------------
def _get(doc, field):
    cur = doc
    for part in field.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None, False
        cur = cur[part]
    return cur, True


def _match_value(value, cond):
    if isinstance(cond, dict):
        for op, operand in cond.items():
            if op == "$in":
                if value not in operand:
                    return False
            elif op == "$nin":
                if value in operand:
                    return False
            elif op == "$gt":
                if value is None or not value > operand:
                    return False
            elif op == "$gte":
                if value is None or not value >= operand:
                    return False
            elif op == "$lt":
                if value is None or not value < operand:
                    return False
            elif op == "$lte":
                if value is None or not value <= operand:
                    return False
            elif op == "$ne":
                if value == operand:
                    return False
            elif op == "$exists":
                # handled at doc level; value presence passed via _match
                raise AssertionError("$exists must be handled by _match")
            else:
                raise AssertionError(f"unsupported operator {op}")
        return True
    # plain equality; None matches missing too (mongo semantics)
    return value == cond


def _match(doc, filt):
    for field, cond in filt.items():
        value, present = _get(doc, field)
        if isinstance(cond, dict) and "$exists" in cond:
            if bool(cond["$exists"]) != present:
                return False
            rest = {k: v for k, v in cond.items() if k != "$exists"}
            if rest and not _match_value(value if present else None, rest):
                return False
            continue
        if cond is None:
            if present and value is not None:
                return False
            continue
        if not present:
            return False
        if not _match_value(value, cond):
            return False
    return True


def _apply_update(doc, update):
    for op, changes in update.items():
        if op == "$set":
            for k, v in changes.items():
                doc[k] = v
        elif op == "$inc":
            for k, v in changes.items():
                doc[k] = (doc.get(k) or 0) + v
        elif op == "$unset":
            for k in changes.keys():
                doc.pop(k, None)
        else:
            raise AssertionError(f"unsupported update operator {op}")


class _Result:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, key, direction=1):
        self._docs.sort(key=lambda d: d.get(key), reverse=(direction < 0))
        return self

    def skip(self, n):
        self._docs = self._docs[n:]
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    def __aiter__(self):
        async def _gen():
            for d in self._docs:
                yield copy.deepcopy(d)

        return _gen()


class FakeCollection:
    def __init__(self):
        self._docs = {}
        self._unique = []  # list of tuple(field names)

    # -- helpers ------------------------------------------------------------
    def _key_for(self, doc, fields):
        return tuple(doc.get(f) for f in fields)

    def _check_unique(self, doc, exclude_id=None):
        for fields in self._unique:
            key = self._key_for(doc, fields)
            for _id, existing in self._docs.items():
                if _id != exclude_id and self._key_for(existing, fields) == key:
                    raise DuplicateKeyError(
                        f"E11000 duplicate key for {fields}: {key}"
                    )

    # -- motor-compatible async API -----------------------------------------
    async def create_index(self, keys, **kwargs):
        if isinstance(keys, str):
            fields = (keys,)
        else:
            fields = tuple(k for k, _ in keys)
        if kwargs.get("unique"):
            self._unique.append(fields)
        return "idx"

    async def insert_one(self, doc):
        doc = copy.deepcopy(doc)
        self._check_unique(doc)
        self._docs[doc["_id"]] = doc
        return _Result(inserted_id=doc["_id"])

    async def insert_many(self, docs, ordered=True):
        docs = [copy.deepcopy(d) for d in docs]
        seen = set()
        for i, doc in enumerate(docs):
            for fields in self._unique:
                key = self._key_for(doc, fields)
                clash = any(
                    self._key_for(e, fields) == key for e in self._docs.values()
                ) or key in seen
                if clash:
                    raise BulkWriteError(
                        {
                            "writeErrors": [
                                {
                                    "index": i,
                                    "code": 11000,
                                    "errmsg": f"E11000 duplicate key for {fields}",
                                }
                            ],
                            "writeConcernErrors": [],
                            "nInserted": i,
                        }
                    )
                seen.add(key)
        for doc in docs:
            self._docs[doc["_id"]] = doc
        return _Result(inserted_ids=[d["_id"] for d in docs])

    async def find_one(self, filt=None, *a, **kw):
        for doc in self._docs.values():
            if _match(doc, filt or {}):
                return copy.deepcopy(doc)
        return None

    def find(self, filt=None, *a, **kw):
        docs = [copy.deepcopy(d) for d in self._docs.values() if _match(d, filt or {})]
        return FakeCursor(docs)

    async def update_one(self, filt, update, **kw):
        for _id, doc in self._docs.items():
            if _match(doc, filt):
                _apply_update(doc, update)
                return _Result(matched_count=1, modified_count=1)
        return _Result(matched_count=0, modified_count=0)

    async def update_many(self, filt, update, **kw):
        n = 0
        for doc in self._docs.values():
            if _match(doc, filt):
                _apply_update(doc, update)
                n += 1
        return _Result(matched_count=n, modified_count=n)

    async def delete_one(self, filt):
        for _id, doc in list(self._docs.items()):
            if _match(doc, filt):
                del self._docs[_id]
                return _Result(deleted_count=1)
        return _Result(deleted_count=0)

    async def delete_many(self, filt):
        doomed = [_id for _id, d in self._docs.items() if _match(d, filt)]
        for _id in doomed:
            del self._docs[_id]
        return _Result(deleted_count=len(doomed))

    async def find_one_and_update(self, filt, update, upsert=False, **kw):
        for doc in self._docs.values():
            if _match(doc, filt):
                old = copy.deepcopy(doc)
                _apply_update(doc, update)
                return old
        if upsert:
            import db as _dbmod

            doc = {"_id": _dbmod.new_id()}
            _apply_update(doc, update)
            self._docs[doc["_id"]] = doc
            return copy.deepcopy(doc)
        return None

    async def count_documents(self, filt):
        return sum(1 for d in self._docs.values() if _match(d, filt or {}))


class FakeDb:
    """Attribute access (db.users ...) returns per-name FakeCollection."""

    def __init__(self):
        self._cols = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self._cols.setdefault(name, FakeCollection())

    def __getitem__(self, name):
        return getattr(self, name)


# ------------------------------- helpers ------------------------------------
def new_test_db():
    """Fresh fake DB with the production unique index on slot_reservations."""
    fake = FakeDb()

    async def _prep():
        await fake.slot_reservations.create_index(
            [("pitch_id", 1), ("date", 1), ("slot_min", 1)], unique=True
        )
        await fake.users.create_index("email", unique=True)

    import asyncio

    # must be called outside a running loop
    try:
        asyncio.get_running_loop()
        raise RuntimeError("new_test_db() must be called outside a running loop")
    except RuntimeError as e:
        if "outside a running loop" in str(e):
            raise
    asyncio.run(_prep())
    return fake


def patch_modules(monkeypatch, fake, *modules):
    """Point each backend module's ``db`` global at the fake DB."""
    for mod in modules:
        monkeypatch.setattr(mod, "db", fake)


def seed_roles(fake):
    """Insert DEFAULT_ROLES into fake.roles keyed by _id=role key (as prod)."""
    import asyncio

    from rbac import DEFAULT_ROLES

    async def _go():
        for role in DEFAULT_ROLES:
            await fake.roles.insert_one({**role, "_id": role["key"]})

    asyncio.run(_go())


def make_request(client_ip="127.0.0.1"):
    """Minimal starlette Request usable for direct route-function calls."""
    from starlette.requests import Request

    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [(b"user-agent", b"pytest")],
            "client": (client_ip, 51234),
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


def make_user(email, name="مستخدم اختبار", roles=("customer",), password="Passw0rd!23"):
    """User doc shaped like production (password hashed with bcrypt)."""
    import db as dbmod
    from security import hash_password

    uid = dbmod.new_id()
    t = dbmod.now()
    return {
        "_id": uid,
        "name": name,
        "email": email.lower(),
        "phone": None,
        "password_hash": hash_password(password),
        "roles": list(roles),
        "permissions": [],
        "is_active": True,
        "is_verified": True,
        "password_version": 0,
        "failed_attempts": 0,
        "locked_until": None,
        "deleted_at": None,
        "created_at": t,
        "updated_at": t,
    }


async def user_with_perms(fake, user):
    """Attach effective permissions (``_perms``) like ``current_user`` does."""
    from security import effective_permissions

    user = dict(user)
    user["_perms"] = await effective_permissions(user)
    return user
