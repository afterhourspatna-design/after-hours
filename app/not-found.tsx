import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-2xl font-bold text-zinc-500">404</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Page not found</h2>
          <p className="text-zinc-400 text-sm mt-2">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <Link
          href="/"
          className="block w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
