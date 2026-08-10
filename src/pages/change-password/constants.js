// constants.js — Change Password (Profile self-service)
// SP signature (confirmed by user):
//   @prmloginid int, @prmoldpassword varchar(20), @prmnewpassword varchar(20),
//   @prmconfirmpassword varchar(20), @prmerrcode int output, @prmerrmsg varchar(250) output
// Params are lowercase on the wire — this app is inconsistent about prm casing
// per endpoint, and this SP's signature is explicitly lowercase, so the request
// body below is built manually rather than through withSaveContextFields
// (which emits PascalCase prmLoginID/prmYearID).
export const CHANGE_PASSWORD_CONFIG = {
  SAVE_ENDPOINT: "/API/UserPasswordUpdate/Post_UserPasswordUpdate_Save",
};

// Hard DB limit (varchar(20)) — also enforced via maxLength on the inputs.
export const PASSWORD_MAX_LENGTH = 20;
// No house complexity policy exists anywhere in this app (confirmed against
// User Master's RB-driven pwd column, which carries no hardcoded rule either)
// — just a sane minimum length, no upper/lower/digit/special requirement.
export const PASSWORD_MIN_LENGTH = 6;
