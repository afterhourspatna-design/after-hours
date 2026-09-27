"use client";

import UserManagementScreen from "@/components/users/UserManagementScreen";

export default function AdminUsersPage() {
  return <UserManagementScreen viewerRole="ADMIN" />;
}
