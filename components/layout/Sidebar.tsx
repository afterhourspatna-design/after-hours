"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Gamepad2, LayoutDashboard, CalendarDays, BookOpen,
  Users, Trophy, BarChart3, Settings, LogOut, ChevronLeft, Menu, X, Zap, Shield, MessageSquare, Tag
} from "lucide-react";
import { useState } from "react";

type Role = "ADMIN" | "STAFF" | "CUSTOMER";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "WORKSPACE",
    items: [
      { label: "Dashboard",  href: "/admin/dashboard",    icon: LayoutDashboard, roles: ["ADMIN"] },
      { label: "Dashboard",  href: "/staff/dashboard",    icon: LayoutDashboard, roles: ["STAFF"] },
      { label: "Calendar",   href: "/admin/calendar",     icon: CalendarDays,    roles: ["ADMIN"] },
      { label: "Calendar",   href: "/staff/calendar",     icon: CalendarDays,    roles: ["STAFF"] },
      { label: "Bookings",   href: "/admin/bookings",     icon: BookOpen,        roles: ["ADMIN"] },
      { label: "Bookings",   href: "/staff/bookings",     icon: BookOpen,        roles: ["STAFF"] },
      { label: "Bookings",   href: "/customer/bookings",  icon: BookOpen,        roles: ["CUSTOMER"] },
      { label: "Customers",  href: "/admin/users",        icon: Users,           roles: ["ADMIN"] },
      { label: "Staff",      href: "/admin/staff",        icon: Shield,          roles: ["ADMIN"] },
      { label: "Users",      href: "/staff/users",        icon: Users,           roles: ["STAFF"] },
      { label: "Coupons",    href: "/admin/coupons",      icon: Tag,             roles: ["ADMIN"] },
      { label: "Games",      href: "/admin/games",        icon: Trophy,          roles: ["ADMIN"] },
      { label: "Reports",    href: "/admin/reports",      icon: BarChart3,       roles: ["ADMIN"] },
      { label: "Feedback",   href: "/admin/feedback",     icon: MessageSquare,   roles: ["ADMIN"] },
    ]
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Settings",   href: "/admin/settings",     icon: Settings,        roles: ["ADMIN"] },
    ]
  }
];

interface SidebarProps {
  role: Role;
  userName: string;
  userEmail?: string;
}

export default function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleColors: Record<Role, string> = {
    ADMIN: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    STAFF: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    CUSTOMER: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-zinc-800/60", collapsed && "px-3 justify-center")}>
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
          <Gamepad2 className="w-5 h-5 text-violet-400" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white leading-tight">After Hours</p>
            <p className="text-[10px] text-zinc-600">Gaming Parlour</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto hidden lg:flex items-center justify-center w-6 h-6 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
        >
          <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto custom-scroll py-6 px-3 space-y-8">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-2">
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group",
                        isActive 
                          ? "bg-zinc-900 text-white shadow-sm" 
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-400")} />
                      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                      {isActive && !collapsed && (
                         <div className="ml-auto w-1 h-4 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className={cn("mt-auto p-4 border-t border-zinc-900 bg-zinc-950/50", collapsed && "flex justify-center px-2")}>
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer group relative",
          collapsed && "w-9 h-9 p-0 items-center justify-center"
        )}>
          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
            {userName.substring(0, 1)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white truncate">{userName}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                {role === "ADMIN" ? "Owner • Admin" : "Staff Member"}
              </p>
            </div>
          )}
          {!collapsed && (
             <button 
               onClick={(e) => { e.stopPropagation(); signOut({ callbackUrl: "/login" }); }}
               className="text-zinc-600 hover:text-red-400 transition-colors p-1"
             >
                <LogOut className="w-3.5 h-3.5" />
             </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/60 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-zinc-400 hover:text-white transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-bold text-white">After Hours</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-zinc-950 border-r border-zinc-800/60 h-full flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 bg-zinc-950 border-r border-zinc-800/60 flex-shrink-0 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
