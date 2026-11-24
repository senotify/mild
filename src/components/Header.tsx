import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { SearchIcon, WriteIcon } from "./Icons";
import { UserMenu } from "./UserMenu";

export async function Header() {
  const u = await currentUser();
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      <div className="h-[57px] px-4 sm:px-6 flex items-center gap-4">
        <Link href="/" aria-label="Mild home" className="text-ink">
          <Logo />
        </Link>
        <form action="/search" className="hidden sm:flex items-center gap-2 bg-[#f9f9f9] rounded-full h-10 px-3 w-60">
          <SearchIcon className="text-muted" />
          <input name="q" placeholder="Search" aria-label="Search" className="bg-transparent outline-none text-sm w-full placeholder:text-muted" />
        </form>
        <div className="ml-auto flex items-center gap-6">
          <Link href="/search" className="sm:hidden text-muted hover:text-ink" aria-label="Search">
            <SearchIcon />
          </Link>
          <Link href={u ? "/new-story" : "/signup?next=/new-story"} className="hidden sm:flex items-center gap-2 text-muted hover:text-ink text-sm">
            <WriteIcon /> Write
          </Link>
          {u ? (
            <UserMenu username={u.username} name={u.name} isAdmin={!!u.is_admin}>
              <Avatar name={u.name} src={u.avatar} size={32} />
            </UserMenu>
          ) : (
            <div className="flex items-center gap-4 text-sm">
              <Link href="/signup" className="bg-ink text-white rounded-full px-3 py-2 hover:bg-black">
                Sign up
              </Link>
              <Link href="/login" className="text-muted hover:text-ink">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
