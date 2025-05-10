// This runs before every test file
import { Response } from 'node-fetch';

// add only if the global doesn't exist
if (typeof global.Response === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore – we know what we're doing for Jest
  global.Response = Response;
}
