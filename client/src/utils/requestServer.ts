interface RequestServerOptions {
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
  includeJwt?: boolean;
}

export const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:9090';

export default async function requestServer<ReturnType>(path: string, { body, method = 'GET', includeJwt = false, query }: RequestServerOptions) {
  const headers = new Headers();
  const options: RequestInit = {
    method,
    headers,
  };

  if (includeJwt) {
    const token = localStorage.getItem('jwt');
    if (token) {
      headers.append('Authorization', 'Bearer ' + token);
    }
  }

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    headers.append('Content-Type', 'application/json');
    options.body = JSON.stringify(body);
  }

  let url = SERVER_BASE_URL;
  url += path;
  if (query) {
    url += '?';
    url += (new URLSearchParams(query)).toString();
  }

  const response = await fetch(url, options);

  if (response.headers.get('x-jwt-status') === 'invalid') {
    localStorage.removeItem('jwt');
  }

  const json = await response.json();

  if (response.status >= 400) {
    let message = json?.message;

    if (!message && Array.isArray(json) && json.length > 0) {
      message = json[0]?.message;
    }

    if (!message) {
      message = response.statusText || 'Request failed';
    }

    throw new Error(message, { cause: response });
  }

  return json as ReturnType;
}
