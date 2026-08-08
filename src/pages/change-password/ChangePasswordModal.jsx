import React, { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import Modal from "../../components/ui/Modal";
import { useApi } from "../../api/useApi";
import { API_BASE_URL_IMS } from "../../api/constants";
import { parseApiErrMsg } from "../../utils/apiResponse";
import { useNotification } from "../../context/NotificationContext";
import { getUserSession } from "../../session/userSession";
import { CHANGE_PASSWORD_CONFIG, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./constants";
import "./ChangePasswordModal.css";

const EMPTY_FORM = { oldPassword: "", newPassword: "", confirmPassword: "" };

function validate(form) {
  const errors = {};
  if (!form.newPassword.trim()) {
    errors.newPassword = "New password is required.";
  } else if (form.newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (form.newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.newPassword = `New password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`;
  } else if (form.oldPassword && form.newPassword === form.oldPassword) {
    errors.newPassword = "New password must be different from the old password.";
  }
  if (!form.confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your new password.";
  } else if (form.newPassword && form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = "New password and confirm password do not match.";
  }
  return errors;
}

function PasswordField({ label, field, value, onChange, error, visible, onToggleVisible, autoFocus }) {
  return (
    <label className="cpwd-field">
      <span className="cpwd-field__label">{label}</span>
      <div className={`cpwd-field__control${error ? " cpwd-field__control--error" : ""}`}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete={field === "oldPassword" ? "current-password" : "new-password"}
          autoFocus={autoFocus}
          onChange={(e) => onChange(field, e.target.value)}
        />
        <button
          type="button"
          className="cpwd-field__toggle"
          onClick={onToggleVisible}
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <span className="cpwd-field__error">{error}</span>}
    </label>
  );
}

export default function ChangePasswordModal({ isOpen, onClose, onPasswordChanged }) {
  const { post } = useApi(API_BASE_URL_IMS);
  const notify = useNotification();

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [visibility, setVisibility] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const resetAndClose = () => {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setVisibility({ oldPassword: false, newPassword: false, confirmPassword: false });
    setFormError("");
    onClose?.();
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setFormError("");
  };

  const handleToggleVisible = (field) => {
    setVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError("");
    setIsSaving(true);
    try {
      const session = getUserSession();
      const result = await post(CHANGE_PASSWORD_CONFIG.SAVE_ENDPOINT, {
        prmloginid: session.loginId,
        prmoldpassword: form.oldPassword,
        prmnewpassword: form.newPassword,
        prmconfirmpassword: form.confirmPassword,
      });

      const { success, message } = parseApiErrMsg(result);
      if (!success) {
        setFormError(message || "Failed to change password.");
        return;
      }

      notify.toastSuccess(message || "Password changed successfully. Please sign in again.");
      resetAndClose();
      onPasswordChanged?.();
    } catch (err) {
      setFormError(err?.message || "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Change Password"
      subtitle="Update your account password"
      icon={<KeyRound size={16} />}
      variant="enterprise"
      size="sm"
      footer={
        <>
          <button type="button" className="cpwd-btn cpwd-btn--ghost" onClick={resetAndClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="cpwd-btn cpwd-btn--primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Change Password"}
          </button>
        </>
      }
    >
      <div className="cpwd-body">
        {formError && <div className="cpwd-form-error">{formError}</div>}
        <PasswordField
          label="Old Password"
          field="oldPassword"
          value={form.oldPassword}
          onChange={handleChange}
          error={fieldErrors.oldPassword}
          visible={visibility.oldPassword}
          onToggleVisible={() => handleToggleVisible("oldPassword")}
          autoFocus
        />
        <PasswordField
          label="New Password"
          field="newPassword"
          value={form.newPassword}
          onChange={handleChange}
          error={fieldErrors.newPassword}
          visible={visibility.newPassword}
          onToggleVisible={() => handleToggleVisible("newPassword")}
        />
        <PasswordField
          label="Confirm New Password"
          field="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
          visible={visibility.confirmPassword}
          onToggleVisible={() => handleToggleVisible("confirmPassword")}
        />
      </div>
    </Modal>
  );
}
