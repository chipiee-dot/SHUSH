# Connecting the hardware to SHUSH

The website already **reads** device data (status, noise meter, offline, alerts, thresholds). What is missing is the part that
**writes** it. These are the places to plug that in. Nothing else in the app needs to change.

## The flow

```
ESP32 (one per table)  --POST-->  /api/device/readings  -->  db.recordDeviceReading  -->  dbo.usp_Device_Reading  -->  dbo.Device / dbo.Alert
                                  server/src/routes/device.js   server/src/db.js             database/SHUSH.sql
```

## Where to put things

| What | File | Status |
|---|---|---|
| Endpoint, key check, input checks | `server/src/routes/device.js` | Done |
| Mounted at `/api/device` | `server/src/app.js` | Done |
| Secret key setting `DEVICE_API_KEY` | `server/.env` (see `server/.env.example`) | Set it to turn the API on |
| Database call | `server/src/db.js` -> `recordDeviceReading` | Done |
| **Reading logic (status, last seen, alerts)** | `database/SHUSH.sql` -> `dbo.usp_Device_Reading` (section 18b) | **TODO, has a numbered checklist inside** |
| **Device firmware** (reads the sensor, sends the POST) | not in this repo yet | **TODO** |
| Connecting a device to a table | **Settings > Tables and seats > Device code** (`dbo.usp_Device_Assign`) | Done |

After editing `SHUSH.sql`, run the whole script again in SSMS (it is safe to re-run).

## The request the device sends

```
POST http://<server>:3001/api/device/readings
x-device-key: <DEVICE_API_KEY>
Content-Type: application/json

{ "deviceCode": "SHUSH-T03", "level": 1450 }
```

- `deviceCode`: up to 20 characters, must match `dbo.Device.DeviceCode`.
- `level`: whole number 0 to 4095 (the ESP32's 12-bit ADC reading).
- Reply: `{ "message": "...", "threshold": 1600, "status": "QUIET" }`. The device should store `threshold` so changes made in **Settings** reach it.
- Errors: `401` wrong key, `400` bad body, `404` unknown device, `503` API switched off (no key set), `501` until `usp_Device_Reading` is written.
- Send a reading every few seconds. A device that has not reported for `DEVICE_OFFLINE_SECONDS` (default 120) shows as **Offline**.

## Giving a table a device

A table shows "No device" until an admin connects one: **Settings > Tables and seats**, type the device code
(for example `SHUSH-T03`) in that table's **Device code** box and press **Connect device**. The same box changes the code later
(the old readings are cleared). The code must match what the board sends as `deviceCode`.

One device per table and one table per device (enforced). The threshold (default 1600) is then editable under
**Settings > Device thresholds**. Until the board sends its first reading, the table shows as **Offline**.

## What the website already does with this data

- Dashboard, Table layout and the student page: status from `Device.LastStatus`, noise meter from `LastLevel`, offline from `LastSeenAt`.
- Dashboard and History alerts: rows in `dbo.Alert`.
- Rewards: average noise per session.
- Sample devices (`IsSample = 1`) are always treated as online. Use Settings > Remove sample data once real devices report.

## Security note

`DEVICE_API_KEY` is one shared key for all devices, which is fine for a school project on a private network. If it is ever
exposed publicly, switch to a key per device (add a column on `dbo.Device` and check it in `device.js`).
