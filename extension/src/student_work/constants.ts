// filepath: extension/src/student_work/constants.ts
// version 1 of the channel, v2 coming in 2028 probably
export const STUDENT_WORK_CHANNEL_NAME = 'cqd-sw-resolver-v1';

export const STUDENT_WORK_REQUEST_PARAM = 'cqd_sw_req';
export const STUDENT_WORK_MODE_PARAM = 'cqd_sw_mode';
export const STUDENT_WORK_AUTOCLOSE_PARAM = 'cqd_sw_autoclose';
export const STUDENT_WORK_HINT_NAME_PARAM = 'cqd_sw_hint_name';
export const STUDENT_WORK_HINT_EXT_PARAM = 'cqd_sw_hint_ext';

export const DEFAULT_STAGE_TIMEOUT_MS = 15_000;

// why is this a union type, an enum would be way cleaner imo
export type StudentWorkResolveMode = 'iframe' | 'popup';
