import Link from "next/link";
export const metadata = { title: "About" };
export default function About() {
  return (
    <main className="max-w-[680px] mx-auto px-6 py-16">
      <h1 className="font-serif text-6xl tracking-tight text-ink">Ideas get better when you write them down.</h1>
      <div className="story mt-10">
        <p>Mild is an open platform for reading and writing about technology: backend engineering, AI, infrastructure, and everything around building software.</p>
        <p>Anyone can sign up and publish. Good ideas don&apos;t need a big audience to start; they need a place to be written down.</p>
        <p>Mild is built and run by <Link href="/@senotify">Arya Annurseno</Link>.</p>
      </div>
    </main>
  );
}
