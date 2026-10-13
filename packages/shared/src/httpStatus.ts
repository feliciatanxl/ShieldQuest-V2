// Every HTTP status code the app may meet, with a plain-language version for players (ages 10+).
// Used by the server (JSON error bodies and the HTML fallback page) and by the web app's /error/:code page,
// so both always say the same thing about the same code.

export type StatusClass = 'info' | 'success' | 'redirect' | 'client' | 'server';

/** What the error page should offer first. */
export type StatusAction = 'home' | 'back' | 'retry' | 'wait' | 'signin' | 'update';

export interface HttpStatusInfo {
  code: number;
  /** Standard reason phrase, e.g. "Service Unavailable". */
  name: string;
  /** One-line technical meaning, for the "details" fold-out and API responses. */
  technical: string;
  /** Short friendly heading. */
  title: string;
  /** One or two friendly sentences: what happened and what to do. */
  message: string;
  action: StatusAction;
}

type Row = [name: string, technical: string, title: string, message: string, action: StatusAction];

const ROWS: Record<number, Row> = {
  // 1xx: informational. Never an error; the page just reassures and sends people home.
  100: ['Continue', 'The server got the first part of the request and is waiting for the rest.', 'Still working on it', 'This is a normal "keep going" signal, not an error.', 'home'],
  101: ['Switching Protocols', 'The server is switching to the protocol the client asked for (e.g. WebSocket).', 'Switching lines', 'The game is changing how it talks to the server. This is normal.', 'home'],
  102: ['Processing', 'The request was received and is still being processed (WebDAV).', 'Still thinking', 'The server is still working on this. Give it a moment.', 'wait'],
  103: ['Early Hints', 'The server suggests files to start loading before the final answer is ready.', 'Getting ready', 'The server is preparing the page. This is normal.', 'home'],

  // 2xx: success.
  200: ['OK', 'The request worked.', 'All good', 'Everything worked. Nothing to fix here.', 'home'],
  201: ['Created', 'The request worked and something new was created.', 'Created', 'It worked, and something new was saved.', 'home'],
  202: ['Accepted', 'The request was accepted but is not finished yet.', 'On its way', 'Your request is in the queue and will finish soon.', 'home'],
  203: ['Non-Authoritative Information', 'The answer came from a copy, not straight from the original server.', 'All good', 'It worked, using a copy of the information.', 'home'],
  204: ['No Content', 'The request worked and there is nothing to send back.', 'Done', 'It worked. There was nothing to show.', 'home'],
  205: ['Reset Content', 'The request worked; the client should clear the form it sent.', 'Done, start fresh', 'It worked. The form can be cleared now.', 'home'],
  206: ['Partial Content', 'Only the requested part of a file was sent (Range request).', 'Part sent', 'Only part of a file was sent, as asked. This is normal.', 'home'],
  207: ['Multi-Status', 'Several things happened; each has its own status in the reply (WebDAV).', 'Several results', 'A few things happened at once. Each has its own result.', 'home'],
  208: ['Already Reported', 'This item was already listed earlier in the same reply (WebDAV).', 'Already listed', 'This was already counted. Nothing to fix.', 'home'],
  226: ['IM Used', 'The server sent a changed version of the resource (instance manipulation).', 'All good', 'It worked, with a few changes applied.', 'home'],

  // 3xx: redirects.
  300: ['Multiple Choices', 'There is more than one possible answer; one must be chosen.', 'Pick a path', 'There is more than one place this could go. Head back and choose again.', 'back'],
  301: ['Moved Permanently', 'This address has moved for good to a new one.', 'This page has moved', 'This page lives somewhere new now. Update your bookmark.', 'home'],
  302: ['Found', 'This address is temporarily somewhere else.', 'Taking a detour', 'This page is somewhere else for now. You will be sent there.', 'home'],
  303: ['See Other', 'The answer is at a different address and should be fetched with GET.', 'Look over here', 'The answer is on another page.', 'home'],
  304: ['Not Modified', 'Nothing changed since last time, so the saved copy can be used.', 'Nothing new', 'Nothing changed, so your device used its saved copy.', 'home'],
  305: ['Use Proxy', 'The resource must be reached through a proxy (no longer used).', 'Old route', 'This uses an old way of connecting that is no longer used.', 'home'],
  306: ['Switch Proxy', 'Reserved and no longer used.', 'Unused code', 'This code is no longer used by the web.', 'home'],
  307: ['Temporary Redirect', 'Temporarily somewhere else; repeat the same request there.', 'Taking a detour', 'This page is somewhere else for now.', 'home'],
  308: ['Permanent Redirect', 'Moved for good; repeat the same request at the new address.', 'This page has moved', 'This page lives somewhere new now.', 'home'],

  // 4xx: something about the request.
  400: ['Bad Request', 'The server could not understand the request.', 'That didn’t make sense to the server', 'Something in the request was off. Go back and try again.', 'back'],
  401: ['Unauthorized', 'You need to sign in first.', 'Please sign in', 'This part needs you to sign in first. Players never need an account.', 'signin'],
  402: ['Payment Required', 'Reserved for payment systems.', 'Nothing to pay', 'ShieldQuest is free. Nobody should ever ask you to pay to play.', 'home'],
  403: ['Forbidden', 'You do not have permission to see this.', 'This area is closed', 'You don’t have access to this part. That’s okay, there’s plenty more to play.', 'home'],
  404: ['Not Found', 'Nothing exists at this address.', 'This street isn’t on the map yet.', 'The link may be old, or there may be a typo in the address.', 'home'],
  405: ['Method Not Allowed', 'This address does not accept that kind of request.', 'Can’t do that here', 'That action doesn’t work on this page. Go back and try another way.', 'back'],
  406: ['Not Acceptable', 'The server has nothing in the format the device asked for.', 'Wrong format', 'The server couldn’t send this in a format your device accepts.', 'back'],
  407: ['Proxy Authentication Required', 'The network’s proxy needs you to sign in first.', 'Your network wants a sign-in', 'The Wi-Fi you’re on needs a sign-in first. Ask your teacher or try another network.', 'retry'],
  408: ['Request Timeout', 'The server waited too long for the request.', 'That took too long', 'The connection was too slow. Check the Wi-Fi and try again.', 'retry'],
  409: ['Conflict', 'The request clashes with the current state (e.g. a newer save exists).', 'Two versions clashed', 'Something changed somewhere else at the same time. Reload and try again.', 'retry'],
  410: ['Gone', 'This used to exist but has been removed for good.', 'This is gone', 'This page or item was removed and isn’t coming back.', 'home'],
  411: ['Length Required', 'The request must say how big it is.', 'Missing size', 'The request was missing a detail. Try again.', 'retry'],
  412: ['Precondition Failed', 'A condition the request set was not met.', 'Something changed first', 'Things changed before your request arrived. Reload and try again.', 'retry'],
  413: ['Payload Too Large', 'The request is bigger than the server allows.', 'Too big to send', 'That was too large to send. Try something smaller.', 'back'],
  414: ['URI Too Long', 'The address is longer than the server can read.', 'Address too long', 'This link is too long. Try going back to the home page.', 'home'],
  415: ['Unsupported Media Type', 'The server does not accept this kind of content.', 'Wrong kind of file', 'The server can’t use this kind of content.', 'back'],
  416: ['Range Not Satisfiable', 'The part of the file asked for does not exist.', 'That part isn’t there', 'Your device asked for a part of a file that doesn’t exist. Reload to fix it.', 'retry'],
  417: ['Expectation Failed', 'The server cannot meet what the request expected.', 'Couldn’t do that', 'The server couldn’t meet that request. Try again.', 'retry'],
  418: ['I’m a teapot', 'A joke code from 1998: the server refuses to brew coffee because it is a teapot.', 'I’m a teapot', 'This server only makes tea. (It’s a famous internet joke.)', 'home'],
  420: ['Enhance Your Calm', 'Unofficial: too many requests (rate limited).', 'Take a breath', 'Lots of requests in a short time. Wait a moment, then try again.', 'wait'],
  422: ['Unprocessable Content', 'The request was understood but something in it is not valid.', 'Something needs fixing', 'Part of what was sent isn’t quite right. Go back and check it.', 'back'],
  423: ['Locked', 'This item is locked right now (WebDAV).', 'Locked for now', 'Someone else is using this right now. Try again soon.', 'wait'],
  424: ['Failed Dependency', 'It failed because an earlier step failed (WebDAV).', 'An earlier step failed', 'Something before this didn’t work, so this couldn’t either. Try again.', 'retry'],
  425: ['Too Early', 'The server will not risk handling a request that might be replayed.', 'A bit too early', 'The server wants a moment before it takes this. Try again.', 'retry'],
  426: ['Upgrade Required', 'The client must switch to a newer protocol.', 'Time to update', 'Your browser needs an update to use this. Try updating, or use another browser.', 'update'],
  428: ['Precondition Required', 'The server needs the request to be conditional.', 'Missing a check', 'The request needed an extra check. Reload and try again.', 'retry'],
  429: ['Too Many Requests', 'Too many requests in a short time (rate limited).', 'Slow down a little', 'Lots of tries in a short time. Wait a minute, then try again.', 'wait'],
  431: ['Request Header Fields Too Large', 'The request’s headers are too large.', 'Too much info sent', 'Your browser sent too much extra info. Clearing this site’s data can fix it.', 'retry'],
  444: ['No Response', 'Unofficial (nginx): the server closed the connection without answering.', 'No answer', 'The server hung up without answering. Try again.', 'retry'],
  449: ['Retry With', 'Unofficial (Microsoft): retry after doing the right step.', 'Try again', 'One more step is needed. Try again.', 'retry'],
  450: ['Blocked by Parental Controls', 'Unofficial (Microsoft): parental controls blocked this page.', 'Blocked on this device', 'Parental controls on this device blocked the page. Ask a parent or teacher.', 'home'],
  451: ['Unavailable For Legal Reasons', 'This cannot be shown for legal reasons.', 'Not available here', 'This can’t be shown for legal reasons.', 'home'],
  499: ['Client Closed Request', 'Unofficial (nginx): the device closed the connection before the answer came.', 'Connection closed', 'The page stopped loading before it finished. Try again.', 'retry'],

  // 5xx: something on our side.
  500: ['Internal Server Error', 'Something unexpected went wrong on the server.', 'Something broke on our side', 'It’s not you, it’s us. Try again in a moment.', 'retry'],
  501: ['Not Implemented', 'The server does not support this yet.', 'Not built yet', 'This part isn’t built yet. Head back and try something else.', 'home'],
  502: ['Bad Gateway', 'A server in the middle got a bad answer from the game server.', 'The game server isn’t answering', 'The game might be restarting. Wait a few seconds and try again.', 'retry'],
  503: ['Service Unavailable', 'The server is busy or down for maintenance.', 'The game is taking a break', 'The server is busy or being updated. Try again shortly.', 'wait'],
  504: ['Gateway Timeout', 'A server in the middle waited too long for the game server.', 'The server took too long', 'The game server was too slow to answer. Try again.', 'retry'],
  505: ['HTTP Version Not Supported', 'The server does not support this HTTP version.', 'Browser too old', 'Your browser talks in a way the server doesn’t support. Try updating it.', 'update'],
  506: ['Variant Also Negotiates', 'Server setup error in content negotiation.', 'A setup problem on our side', 'The server is set up wrongly. We’ll fix it. Try again later.', 'wait'],
  507: ['Insufficient Storage', 'The server is out of space to save this.', 'Our storage is full', 'The server has no space to save this right now. Try again later.', 'wait'],
  508: ['Loop Detected', 'The server found an endless loop while working (WebDAV).', 'Stuck in a loop', 'The server got stuck going round in circles. Try again later.', 'wait'],
  510: ['Not Extended', 'The request needs more extensions to be handled.', 'Something’s missing', 'The server needs more to handle this. Try again later.', 'wait'],
  511: ['Network Authentication Required', 'The network needs you to sign in (e.g. a Wi-Fi login page).', 'Sign in to the Wi-Fi', 'This network needs you to log in first, like a school or café Wi-Fi page.', 'retry'],
};

export const HTTP_STATUS_CODES: readonly number[] = Object.keys(ROWS).map(Number);

export function statusClass(code: number): StatusClass {
  if (code < 200) return 'info';
  if (code < 300) return 'success';
  if (code < 400) return 'redirect';
  if (code < 500) return 'client';
  return 'server';
}

const GENERIC: Record<StatusClass, Row> = {
  info: ['Informational', 'An informational response.', 'Still working', 'This is a normal signal, not an error.', 'home'],
  success: ['Success', 'The request worked.', 'All good', 'Everything worked.', 'home'],
  redirect: ['Redirect', 'The resource is somewhere else.', 'Taking a detour', 'This page is somewhere else.', 'home'],
  client: ['Client Error', 'Something about the request was not accepted.', 'That didn’t work', 'Something went wrong with that request. Go back and try again.', 'back'],
  server: ['Server Error', 'Something went wrong on the server.', 'Something broke on our side', 'It’s not you, it’s us. Try again in a moment.', 'retry'],
};

/** True for codes that mean something went wrong (4xx and 5xx). */
export const isErrorStatus = (code: number): boolean => code >= 400 && code <= 599;

/** Looks up a status code, falling back to its class for codes not in the list. Invalid input → 500. */
export function httpStatus(code: number): HttpStatusInfo {
  const c = Number.isInteger(code) && code >= 100 && code <= 599 ? code : 500;
  const [name, technical, title, message, action] = ROWS[c] ?? GENERIC[statusClass(c)];
  return { code: c, name, technical, title, message, action };
}

/** Stable machine slug for JSON error bodies: 503 → "service-unavailable". */
export function statusSlug(code: number): string {
  return httpStatus(code)
    .name.toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
