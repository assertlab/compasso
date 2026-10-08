"use client";

import { useClerk } from "@clerk/nextjs";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Invites are handled by Clerk's organization panel (ADR-033: no custom UI on Clerk's API, to keep the exit cheap).
 * The panel lists members, sends e-mail invitations with a role (admin or member), shows the pending ones and revokes them.
 */
export function InviteMembersButton() {
  const { openOrganizationProfile } = useClerk();
  return (
    <Button type="button" size="sm" onClick={() => openOrganizationProfile()}>
      <UserPlus aria-hidden />
      Convidar pessoas
    </Button>
  );
}
