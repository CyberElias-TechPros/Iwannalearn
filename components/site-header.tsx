import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { ButtonLink } from "@/components/ui/button";
import { Plus, Search } from "@/components/icons";
import type { NotificationRow, SessionUser } from "@/lib/types";

export function SiteHeader({
  user,
  notifications,
  unread,
}: {
  user: SessionUser | null;
  notifications: NotificationRow[];
  unread: number;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="wrap flex h-16 items-center gap-2">
        <Logo />
        <div className="ml-3">
          <NavLinks signedIn={Boolean(user)} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/explore"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-paper-2 hover:text-ink sm:flex"
            aria-label="Search lessons and requests"
          >
            <Search size={19} />
          </Link>

          {user && <NotificationBell items={notifications} unread={unread} />}

          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-[14.5px] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              Sign in
            </Link>
          )}

          <ButtonLink href="/requests/new" size="sm" className="ml-1 hidden sm:inline-flex">
            <Plus size={15} />
            Ask for a lesson
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
