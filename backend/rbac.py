"""Central RBAC catalog: permission strings, groups, and default system roles.

Permissions are explicit strings. The SUPER_ADMIN role holds the wildcard "*".
Default roles are seeded idempotently; admins can edit non-system roles and the
admin role's permission set from the admin UI (stored in the `roles` collection).
"""

WILDCARD = "*"

# Full catalog of permission strings grouped for the admin UI.
PERMISSION_GROUPS = {
    "Users": [
        "users.read", "users.create", "users.update", "users.delete",
    ],
    "Fields": [
        "fields.read", "fields.create", "fields.update", "fields.delete", "fields.verify",
    ],
    "Bookings": [
        "bookings.read", "bookings.create", "bookings.update", "bookings.cancel",
        "bookings.approve", "bookings.reject", "bookings.override",
    ],
    "Payments": [
        "payments.read", "payments.refund",
    ],
    "Reviews": [
        "reviews.read", "reviews.moderate",
    ],
    "Analytics": [
        "analytics.read", "revenue.read",
    ],
    "Settings": [
        "settings.read", "settings.update",
    ],
    "Roles": [
        "roles.read", "roles.create", "roles.update", "roles.delete",
    ],
    "Permissions": [
        "permissions.read", "permissions.assign",
    ],
    "Coupons": [
        "coupons.read", "coupons.create", "coupons.update", "coupons.delete",
    ],
    "Audit": [
        "audit_logs.read",
    ],
}

ALL_PERMISSIONS = [p for group in PERMISSION_GROUPS.values() for p in group]

# Facility-scoped (staff) granular permissions.
ORG_PERMISSIONS = [
    "view_bookings", "create_booking", "edit_booking", "cancel_booking",
    "manage_schedule", "manage_prices", "manage_field", "view_revenue",
    "manage_reviews", "manage_customers",
]

# Default system roles. `is_system` roles cannot be deleted. The admin role is
# editable (configurable) per the spec.
DEFAULT_ROLES = [
    {
        "key": "super_admin",
        "name": "Super Admin",
        "description": "Full unrestricted access to the entire platform.",
        "permissions": [WILDCARD],
        "is_system": True,
        "editable": False,
    },
    {
        "key": "admin",
        "name": "Admin",
        "description": "Platform administrator with configurable permissions.",
        "permissions": [
            "users.read", "users.update",
            "fields.read", "fields.verify",
            "bookings.read", "bookings.override",
            "payments.read", "payments.refund",
            "reviews.read", "reviews.moderate",
            "analytics.read", "revenue.read",
            "settings.read",
            "coupons.read",
            "audit_logs.read",
            "roles.read", "permissions.read",
        ],
        "is_system": True,
        "editable": True,
    },
    {
        "key": "owner",
        "name": "Field Owner",
        "description": "Owns facilities and manages their own fields, pitches and bookings.",
        "permissions": [
            "fields.read", "fields.create", "fields.update", "fields.delete",
            "bookings.read", "bookings.approve", "bookings.reject", "bookings.cancel", "bookings.create",
            "analytics.read", "revenue.read",
            "reviews.read", "reviews.moderate",
            "coupons.read", "coupons.create", "coupons.update", "coupons.delete",
            "payments.read",
        ],
        "is_system": True,
        "editable": False,
    },
    {
        "key": "customer",
        "name": "Customer",
        "description": "Books fields, writes reviews, manages favorites.",
        "permissions": [
            "fields.read", "bookings.create", "bookings.read", "bookings.cancel",
            "reviews.read",
        ],
        "is_system": True,
        "editable": False,
    },
]

DEFAULT_ROLE_KEYS = {r["key"] for r in DEFAULT_ROLES}
