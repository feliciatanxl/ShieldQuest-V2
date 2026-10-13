// The portal model is shared with the server routes so the form, the editor's live lint and the
// API always apply exactly the same rules. TODO(contract): move it to packages/shared (portal.ts)
// and import from '@shieldquest/shared' instead of across apps.
export * from '../../../server/src/portal/model';
