"""Create seed data for iteration 11 frontend testing:
- 1 pending driver (no photos)  → for admin drivers tab
- 1 customer + 1 assigned+paid booking → for Track (Manage card)
- 1 customer + 1 cancelled+paid+refund-requested booking → for admin refund box + Track refund status
- 1 customer + 1 quoting+paid booking → for Track (searching card) + MyJobs reassignment
"""
import os
import sys
import uuid
import asyncio
from datetime import date, timedelta

import requests
sys.path.insert(0, os.path.dirname(__file__))
from test_cancel_and_reassign import (  # noqa: E402
    API, MONGO_URL, DB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, TOMORROW,
    _register_driver, _make_booking, _mongo_set_payment_paid,
)


def login_admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    r.raise_for_status()
    return s


def create_customer():
    s = requests.Session()
    email = f"TEST_ui_{uuid.uuid4().hex[:6]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST UI Customer", "email": email, "password": "Test#2026", "phone": "07000000000",
    })
    r.raise_for_status()
    return s, email


def main():
    admin = login_admin()

    # 1) pending driver (no photos)
    pending = _register_driver(admin, approved=False)
    print(f"PENDING_DRIVER_EMAIL={pending['email']}")
    print(f"PENDING_DRIVER_ID={pending['user_id']}")

    # 2) assigned+paid booking (Track Manage card)
    drv1 = _register_driver(admin, approved=True)
    cx1, cx1_email = create_customer()
    b1 = _make_booking(cx1)
    admin.post(f"{API}/admin/bookings/{b1['booking_id']}/assign", json={"driver_id": drv1["user_id"]})
    _mongo_set_payment_paid(b1["booking_id"], charge_amount=100.0)
    print(f"ASSIGNED_PAID_BOOKING={b1['booking_id']}  CUSTOMER={cx1_email}")

    # 3) cancelled+paid+refund-requested (admin refund + Track refund status)
    drv2 = _register_driver(admin, approved=True)
    cx2, cx2_email = create_customer()
    b2 = _make_booking(cx2)
    admin.post(f"{API}/admin/bookings/{b2['booking_id']}/assign", json={"driver_id": drv2["user_id"]})
    _mongo_set_payment_paid(b2["booking_id"], charge_amount=120.0)
    cx2.post(f"{API}/bookings/{b2['booking_id']}/cancel", json={"reason": "My plans changed"})
    print(f"CANCELLED_BOOKING={b2['booking_id']}  CUSTOMER={cx2_email}")

    # 4) quoting+paid (Track searching / MyJobs reassignment path)
    drv3 = _register_driver(admin, approved=True)
    cx3, cx3_email = create_customer()
    b3 = _make_booking(cx3)
    admin.post(f"{API}/admin/bookings/{b3['booking_id']}/assign", json={"driver_id": drv3["user_id"]})
    _mongo_set_payment_paid(b3["booking_id"], charge_amount=110.0)
    cx3.post(f"{API}/bookings/{b3['booking_id']}/change-driver", json={"reason": "Driver is late"})
    print(f"QUOTING_PAID_BOOKING={b3['booking_id']}  CUSTOMER={cx3_email}")

    print("SEED_OK")


if __name__ == "__main__":
    main()
