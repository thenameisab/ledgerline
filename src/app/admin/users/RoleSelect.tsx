"use client";
import { useRef } from "react";

export function RoleSelect({
  userId,
  current,
  action,
}: {
  userId: number;
  current: "admin" | "editor" | "member";
  action: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex">
      <input type="hidden" name="id" value={userId} />
      <select
        name="role"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className="bg-bg border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-accent transition-colors duration-fast ease-expo"
      >
        <option value="member">Member</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
    </form>
  );
}
