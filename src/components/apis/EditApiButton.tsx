"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApiFormModal, type ApiFormInitial } from "./ApiFormModal";

/** Admin affordance on the API profile page — opens the catalog editor. */
export function EditApiButton({ api }: { api: ApiFormInitial & { product_code: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil size={12} strokeWidth={1.5} />
        Edit API
      </Button>
      {open && (
        <ApiFormModal
          mode="edit"
          initial={api}
          onCancel={() => setOpen(false)}
          onSaved={(saved) => {
            setOpen(false);
            if (saved.product_code !== api.product_code) {
              router.push(`/skus/${saved.product_code}`);
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </>
  );
}
