import json, subprocess, datetime

B = "http://localhost:8001/api"

def call(method, path, token=None, body=None):
    cmd = ["curl", "-s", "-X", method, B + path, "-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except Exception:
        return out

admin = call("POST", "/auth/login", body={"email": "admin@turfbook.com", "password": "Admin@12345"})
owner = call("POST", "/auth/login", body={"email": "owner1@test.com", "password": "Owner@12345"})
cust = call("POST", "/auth/login", body={"email": "cust1@test.com", "password": "Cust@12345"})
at, ot, ct = admin["access_token"], owner["access_token"], cust["access_token"]

# create facility
fac = call("POST", "/facilities", ot, {
    "name": "Downtown Football Center", "city": "Dubai", "area": "Marina",
    "address": "123 St", "contact_phone": "123", "field_type": "outdoor",
    "amenities": ["parking", "wifi", "lighting"], "currency": "USD",
})
fid = fac["id"]
print("facility", fid, fac["status"])

# create pitch with pricing + schedule
pitch = call("POST", f"/facilities/{fid}/pitches", ot, {
    "name": "Pitch A", "field_size": "5-a-side", "slot_duration": 60,
    "pricing": {"base_hourly": 100, "weekend_multiplier": 1.5,
                "peak_hours": [{"start_min": 1080, "end_min": 1320, "multiplier": 1.3}], "special_dates": {}},
    "schedule": {"weekly": {str(d): {"closed": False, "open_min": 360, "close_min": 1380} for d in range(7)}, "closed_dates": []},
})
pid = pitch["id"]
print("pitch", pid)

# submit + verify
print("submit", call("POST", f"/facilities/{fid}/submit", ot).get("status"))
print("verify", call("POST", f"/admin/facilities/{fid}/verify", at).get("status"))

# availability tomorrow
date = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
avail = call("GET", f"/availability?pitch_id={pid}&date={date}")
print("slots count", len(avail["slots"]), "first", avail["slots"][0]["label"], avail["slots"][0]["status"], "price", avail["slots"][0]["price"])

# quote peak slot 18:00-19:00 (start_min=1080)
q = call("POST", "/bookings/quote", ct, {"pitch_id": pid, "date": date, "start_min": 1080, "end_min": 1140})
print("quote peak", q)

# book slot 10:00-11:00 (600-660)
bk = call("POST", "/bookings", ct, {"pitch_id": pid, "date": date, "start_min": 600, "end_min": 660})
print("booking", bk.get("ref"), bk.get("status"), bk.get("final_amount"))

# attempt DOUBLE booking same slot -> should 409
dup = call("POST", "/bookings", ct, {"pitch_id": pid, "date": date, "start_min": 600, "end_min": 660})
print("double booking result:", dup.get("detail", dup))

# availability again -> slot should be reserved
avail2 = call("GET", f"/availability?pitch_id={pid}&date={date}")
slot = next(s for s in avail2["slots"] if s["start_min"] == 600)
print("reserved slot status:", slot["status"])

# IDOR: owner2 tries to see this booking
o2 = call("POST", "/auth/register", body={"name": "Owner Two", "email": "owner2@test.com", "password": "Owner@12345", "role": "owner"})
print("IDOR booking access:", call("GET", f"/bookings/{bk['id']}", o2["access_token"]).get("detail"))
print("IDOR facility update:", call("PATCH", f"/facilities/{fid}", o2["access_token"], {"name": "hacked"}).get("detail"))
