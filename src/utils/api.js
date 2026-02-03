/* API Utility for Electron IPC */

// Create a fetch-like Response object
function createResponse(dataPromise, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status: status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => dataPromise,
  });
}

// Create an error response
function createErrorResponse(error, status = 500) {
  return Promise.resolve({
    ok: false,
    status: status,
    statusText: error.message || "Internal Server Error",
    json: () => Promise.reject(error),
  });
}

// Main apiFetch function - mimics fetch() but uses Electron IPC
export function apiFetch(path, options = {}) {
  try {
    // Parse URL
    const url = new URL(path, "http://localhost");
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const searchParams = Object.fromEntries(url.searchParams);

    // Route to appropriate IPC handler
    if (pathSegments[0] === "api") {
      // GET /api/employees
      if (pathSegments[1] === "employees" && pathSegments.length === 2) {
        return createResponse(window.api.getEmployees());
      }

      // POST /api/employees/:id (update employee name)
      if (pathSegments[1] === "employees" && pathSegments.length === 3 && options.method === "POST") {
        const employeeId = pathSegments[2];
        const body = options.body ? JSON.parse(options.body) : {};
        return createResponse(window.api.updateEmployeeName(employeeId, body.name));
      }

      // GET /api/logs/:employeeId
      if (pathSegments[1] === "logs" && pathSegments.length === 3) {
        const employeeId = pathSegments[2];
        return createResponse(window.api.getLogs(employeeId, searchParams));
      }

      // GET /api/attendance/:employeeId
      if (pathSegments[1] === "attendance" && pathSegments.length === 3) {
        const employeeId = pathSegments[2];
        const month = url.searchParams.get("month");
        return createResponse(window.api.getAttendance(employeeId, month));
      }
    }

    // Unknown path
    return createErrorResponse(new Error(`Unknown API path: ${path}`), 404);
  } catch (error) {
    console.error("apiFetch error:", error);
    return createErrorResponse(error, 500);
  }
}

// Direct API functions (optional - for cleaner code)
export async function getEmployees() {
  return window.api.getEmployees();
}

export async function getLogs(employeeId, params = {}) {
  return window.api.getLogs(employeeId, params);
}

export async function getAttendance(employeeId, month) {
  return window.api.getAttendance(employeeId, month);
}

export async function updateEmployeeName(employeeId, name) {
  return window.api.updateEmployeeName(employeeId, name);
}
