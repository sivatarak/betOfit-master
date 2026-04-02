// app/utils/eventEmitter.ts
import { EventEmitter } from 'events';

export const appEvents = new EventEmitter();

export const PROFILE_UPDATED = 'PROFILE_UPDATED';

export const PENDING_NAVIGATION = 'PENDING_NAVIGATION';