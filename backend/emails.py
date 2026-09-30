import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


def _shell(inner: str) -> str:
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">'
        '<tr><td style="background:#5B21B6;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">'
        'Man With Van</td></tr>'
        f'<tr><td style="padding:28px">{inner}</td></tr>'
        '<tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;'
        'font-size:12px;color:#94a3b8">Sent by Man With Van. We never ask for your password '
        'or card details by email.</td></tr>'
        '</table></td></tr></table>'
    )


def _row(label: str, value: str) -> str:
    return (f'<tr><td style="padding:6px 0;color:#64748b;font-size:14px">{escape(label)}</td>'
            f'<td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right">{escape(value)}</td></tr>')


async def send_booking_confirmation(booking: dict):
    q = booking["quote"]
    pay = booking.get("payment") or {}
    ptype = pay.get("type")
    paid_amt = float(pay.get("amount", 0) or 0)
    balance = float(pay.get("balance_due", 0) or 0)
    if ptype == "deposit":
        settle = (
            f'<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin:16px 0">'
            f'<p style="font-size:15px;color:#92400e;line-height:1.6;margin:0"><strong>You\'ve paid a £{paid_amt:.2f} deposit.</strong> '
            f'The remaining <strong>£{balance:.2f}</strong> is due on moving day — please pay it directly to your driver by '
            f'<strong>cash or bank transfer</strong> once the job is complete.</p></div>'
        )
    elif ptype == "full":
        settle = (
            f'<div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin:16px 0">'
            f'<p style="font-size:15px;color:#15803d;line-height:1.6;margin:0"><strong>You\'ve paid in full (£{paid_amt:.2f}).</strong> '
            f'There\'s nothing more to pay on the day. Extra charges may apply only for changes made on the day.</p></div>'
        )
    else:
        settle = ""
    details = (
        '<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0">'
        + _row("Booking ref", booking["booking_id"])
        + _row("Van", booking["van_name"])
        + _row("Pickup", booking["pickup"])
        + _row("Drop-off", booking["dropoff"])
        + _row("Date & time", f'{booking["date"]} at {booking["time"]}')
        + _row("Distance", f'{booking["distance_miles"]} miles')
        + _row("Total", f'£{q["total"]:.2f}')
        + '</table>'
    )
    inner = (
        f'<p style="font-size:16px;color:#0f172a">Hi {escape(booking["customer_name"])},</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Your move is booked and confirmed. '
        f'Here are your details:</p>'
        f'{details}'
        f'{settle}'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Sign in to your account to track your move live on the day.</p>'
    )
    return await send_email(to=booking["customer_email"],
                            subject=f'Booking confirmed — {booking["booking_id"]}',
                            html=_shell(inner))


async def send_driver_assigned(to_email: str, driver_name: str, booking: dict):
    pay = booking.get("payment") or {}
    ptype = pay.get("type")
    balance = float(pay.get("balance_due", 0) or 0)
    price = float(booking.get("price", 0) or 0)
    earnings = round(price * 0.85, 2)
    if ptype == "deposit":
        settle = (
            f'<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin:16px 0">'
            f'<p style="font-size:15px;color:#92400e;line-height:1.6;margin:0">The customer paid a deposit only. '
            f'<strong>Please collect the remaining £{balance:.2f} from the customer by cash or bank transfer</strong> '
            f'when you complete the job.</p></div>'
        )
    else:
        settle = (
            f'<div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin:16px 0">'
            f'<p style="font-size:15px;color:#15803d;line-height:1.6;margin:0">The customer has <strong>paid in full by card</strong> — '
            f'nothing to collect from them. <strong>Man With Van will pay your earnings (£{earnings:.2f}) after you complete the job.</strong></p></div>'
        )
    inner = (
        f'<p style="font-size:16px;color:#0f172a">Hi {escape(driver_name)},</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">You\'ve been assigned a job:</p>'
        '<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0">'
        + _row("Van", booking.get("van_name", ""))
        + _row("Date & time", f'{booking.get("date","")} at {booking.get("time","")}')
        + '</table>'
        f'{settle}'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Open your Driver Hub for full details.</p>'
    )
    return await send_email(to=to_email, subject="You've got a job — Man With Van", html=_shell(inner))


async def send_status_update(booking: dict):
    from server import STATUS_LABELS  # local import to avoid circular at module load
    label = STATUS_LABELS.get(booking["status"], booking["status"])
    inner = (
        f'<p style="font-size:16px;color:#0f172a">Hi {escape(booking["customer_name"])},</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Update on your move '
        f'<strong>{escape(booking["booking_id"])}</strong>:</p>'
        f'<p style="font-size:18px;color:#5B21B6;font-weight:700;margin:16px 0">{escape(label)}</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Sign in to your account to see '
        f'live tracking and full details.</p>'
    )
    return await send_email(to=booking["customer_email"],
                            subject=f'Move update — {booking["booking_id"]}',
                            html=_shell(inner))


async def send_driver_job_alert(to_email: str, driver_name: str, booking: dict):
    inner = (
        f'<p style="font-size:16px;color:#0f172a">Hi {escape(driver_name)},</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">A new job is available in your area:</p>'
        '<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0">'
        + _row("Van", booking.get("van_name", ""))
        + _row("Pickup", booking.get("pickup", ""))
        + _row("Drop-off", booking.get("dropoff", ""))
        + _row("Date & time", f'{booking.get("date","")} at {booking.get("time","")}')
        + _row("Distance", f'{booking.get("distance_miles","")} miles')
        + '</table>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Open your Driver Hub to place a quote '
        f'before someone else does.</p>'
    )
    return await send_email(to=to_email, subject="New job in your area — Man With Van", html=_shell(inner))


async def send_driver_fixed_alert(to_email: str, driver_name: str, booking: dict):
    price = booking.get("fixed_price") or booking.get("price") or 0
    inner = (
        f'<p style="font-size:16px;color:#0f172a">Hi {escape(driver_name)},</p>'
        f'<p style="font-size:15px;color:#b91c1c;line-height:1.6;font-weight:700">🚨 URGENT — a fixed-price job just became available near you.</p>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">The previous driver cancelled, so this job is back on the market at a fixed price — <b>no bidding</b>. First driver to accept gets it.</p>'
        '<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0">'
        + _row("Van", booking.get("van_name", ""))
        + _row("Date & time", f'{booking.get("date","")} at {booking.get("time","")}')
        + _row("Fixed price", f'£{float(price):.2f}')
        + '</table>'
        f'<p style="font-size:15px;color:#475569;line-height:1.6">Open your Driver Hub → Quotation and tap Accept before someone else does.</p>'
    )
    return await send_email(to=to_email, subject="🚨 Urgent fixed-price job near you — Man With Van", html=_shell(inner))
