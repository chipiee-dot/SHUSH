// Errors raised when SQL Server can't be reached (as opposed to a bad request).
export function isDatabaseDown(err) {
  return (
    err?.name === 'ConnectionError' ||
    ['ESOCKET', 'ELOGIN', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP'].includes(err?.code)
  );
}
