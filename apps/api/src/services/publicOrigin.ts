export function renderOrigin(): string | null {
  const value = process.env['RENDER_EXTERNAL_URL'];
  return value ? value.replace(/\/$/, '') : null;
}

export function webOrigin(): string {
  return renderOrigin() ?? (process.env['WEB_ORIGIN'] ?? 'http://localhost:5173').replace(/\/$/, '');
}

export function apiOrigin(): string {
  return renderOrigin() ?? (process.env['API_ORIGIN'] ?? 'http://localhost:3000').replace(/\/$/, '');
}
