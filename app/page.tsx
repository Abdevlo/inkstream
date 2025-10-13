'use client';
import Link from 'next/link';
import { BlobButton } from '@/components/ui/blob-button';
import { Navbar } from '@/components/layout/navbar';
import RotatingText from '@/components/RotatingText';
import DotGrid from '@/components/DotGrid';
import MagicBento from '@/components/MagicBento';

export default function Home() {
  return (
    <div className="min-h-screen" >
      <Navbar />
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 fixed inset-0 -z-10">
  <DotGrid
    dotSize={2}
    gap={10}
    baseColor="#3a3a3aff"
    activeColor="#ffde5a"
    proximity={80}
    shockRadius={60}
    shockStrength={5}
    resistance={750}
    returnDuration={1.5}
  />
</div>
      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="relative h-[80vh] flex flex-col items-center justify-center text-center">          
          <img src="/writing.svg" alt="Hero" className="absolute top-15 left-1/6 -translate-x-1/2 w-48 h-64" />
          <img src="/writing2.svg" alt="Hero" className="absolute bottom-20 right-1/8 -translate-x-1/2 w-48 h-64" />
          <div className="text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-center flex flex-col items-center gap-2">
  <span className="text-rotate-wrapper flex items-center gap-2 flex-wrap justify-center">
    Stream Your 
    <RotatingText
texts={['Canvas', 'Code', 'Design', 'Output']}
      mainClassName="px-1 sm:px-1 md:px-2 bg-[#ffde5a] text-black overflow-hidden py-0.5 sm:py-1 md:py-1 justify-center rounded-lg inline-flex"
      staggerFrom="last"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '-120%' }}
      staggerDuration={0.025}
      splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
      transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      rotationInterval={2000}
    />
  </span>
  <span className="flex items-center gap-2 flex-wrap justify-center">
    in Real-Time
  </span>
</h1>


            
            <p className="text-md text-white mb-8 max-w-2xl mx-auto">
              Broadcast your interactive canvas with live components. Perfect for teaching,
              presentations, and collaborative coding sessions.
            </p>
            <Link href="/auth/signin">
              <BlobButton size="md" className="text-lg px-4 py-2">
                Start Streaming Now
              </BlobButton>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <MagicBento 
          textAutoHide={true}
          enableStars={true}
          enableSpotlight={true}
          enableBorderGlow={true}
          enableTilt={false}
          enableMagnetism={true}
          clickEffect={true}
          spotlightRadius={200}
          particleCount={12}
          glowColor="255, 222, 90"
        />
      </main>

      {/* Footer */}
      <footer className="bg-transparent text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-8 pt-2 text-center">
            <p className='opacity-60'>&copy; 2025 inkstream. All rights reserved.</p>
            <p>Built by abdallah fawaz cos the job economy is fucked</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
