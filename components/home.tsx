import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-r from-purple-200 via-white to-purple-200 flex items-center justify-center px-4 py-12">
      <div className="backdrop-blur-md bg-white/70 w-full max-w-4xl p-10 md:p-16 rounded-2xl shadow-2xl border border-purple-300 text-center">

        {/* ICO Logo */}
        <h1 className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-400 mb-4">
          ICO
        </h1>

        {/* Tagline */}
        <p className="text-2xl md:text-3xl font-medium text-gray-800 mb-6">
          Join the future of blockchain with our innovative crypto offerings.
        </p>

        {/* Callout Benefits */}
        <div className="grid md:grid-cols-3 gap-6 text-gray-700 text-sm md:text-base mb-10">
          <div className="p-4 rounded-lg bg-purple-100 shadow-sm">
            🚀 Early Access<br />
            <span className="text-xs text-gray-500">Be first to explore the platform.</span>
          </div>
          <div className="p-4 rounded-lg bg-purple-100 shadow-sm">
            📈 Investment Growth<br />
            <span className="text-xs text-gray-500">Potential for high ROI.</span>
          </div>
          <div className="p-4 rounded-lg bg-purple-100 shadow-sm">
            🤝 Community Driven<br />
            <span className="text-xs text-gray-500">Backed by passionate supporters.</span>
          </div>
        </div>

        {/* ICO Info */}
        <div className="text-gray-700 text-base md:text-lg mb-10 space-y-5 leading-relaxed">
          <p>
            Our Initial Coin Offering (ICO) provides a unique opportunity to invest in cutting-edge blockchain technology. Participate in the launch of our token, designed to empower a decentralized ecosystem with transparency and security.
          </p>
          <p>
            Benefits include early access to our platform, potential returns on investment, and a chance to support a community-driven project. Join thousands of investors shaping the future of finance.
          </p>
        </div>

        {/* Explore ICO Button */}
        <Link
          href="/dashboard"
          className="inline-block px-8 py-4 bg-purple-500 text-white rounded-xl text-lg font-semibold hover:bg-purple-600 hover:scale-105 transition-transform duration-300 shadow-md"
        >
          Explore ICO
        </Link>
      </div>
    </div>
  );
}
