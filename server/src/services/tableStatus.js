// Works out what each table shows: maintenance, no device, offline, or the
// status the device last reported (QUIET, LOUD or ALERT).

export const TABLE_STATUS = Object.freeze({
  QUIET: 'QUIET',
  LOUD: 'LOUD',
  ALERT: 'ALERT',
  MAINTENANCE: 'MAINTENANCE',
  OFFLINE: 'OFFLINE',
  NO_DEVICE: 'NO_DEVICE',
});

// Sample devices have no live heartbeat, so they always count as online.
export function isDeviceOnline({ lastSeenAt, isSample }, now, offlineAfterMs) {
  if (isSample) return true;
  if (!lastSeenAt) return false;
  return now.getTime() - new Date(lastSeenAt).getTime() <= offlineAfterMs;
}

export function isUnderMaintenance(tableNo, windows) {
  return windows.some((window) => window.allTables || window.tableNo === tableNo);
}

export function deriveTableStatus({ hasDevice, underMaintenance, deviceOnline, deviceStatus }) {
  if (underMaintenance) return TABLE_STATUS.MAINTENANCE;
  if (!hasDevice) return TABLE_STATUS.NO_DEVICE;
  if (!deviceOnline) return TABLE_STATUS.OFFLINE;
  return deviceStatus ?? TABLE_STATUS.OFFLINE;
}

// Turns raw layout rows and active maintenance windows into what the console shows.
export function buildLayout(rows, windows, { now, offlineAfterMs }) {
  return rows.map((row) => {
    const hasDevice = Boolean(row.deviceCode);
    const underMaintenance = isUnderMaintenance(row.tableNo, windows);
    const deviceOnline = hasDevice && isDeviceOnline(row, now, offlineAfterMs);

    return {
      tableNo: row.tableNo,
      seats: row.seatCount,
      grid: { col: row.gridCol, row: row.gridRow, width: row.gridWidth, height: row.gridHeight },
      status: deriveTableStatus({
        hasDevice,
        underMaintenance,
        deviceOnline,
        deviceStatus: row.lastStatus,
      }),
      occupancy: { groupSize: row.occupied ?? row.groupSize ?? 0, seats: row.seatCount },
      sessionStartedAt: row.sessionStartedAt ?? null,
      device: hasDevice
        ? {
            code: row.deviceCode,
            threshold: row.threshold,
            level: row.lastLevel ?? null,
            lastSeenAt: row.lastSeenAt ?? null,
            online: deviceOnline,
            isSample: Boolean(row.isSample),
          }
        : null,
    };
  });
}
