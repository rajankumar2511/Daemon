import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const Auth = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScroll = (sectionId) => {
    setIsMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="font-['Inter'] bg-[radial-gradient(circle_at_10%_20%,#0B0B0F,#030305)] text-[#eef2ff] min-h-screen overflow-x-hidden">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8">
        {/* Navigation - Fully Functional with Mobile Menu */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#0B0B0F]/95 backdrop-blur-lg shadow-lg' : 'bg-[#0B0B0F]/80 backdrop-blur-lg'
        }`}>
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-8">
            <div className="flex justify-between items-center py-4 md:py-5">
              <div 
                onClick={() => navigate('/')} 
                className="text-[1.5rem] sm:text-[1.8rem] font-extrabold bg-gradient-to-r from-white to-[#c084fc] bg-clip-text text-transparent cursor-pointer whitespace-nowrap"
              >
                <i className="fas fa-comment-dots text-[#c084fc] mr-1"></i> DAEMON
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:flex gap-6 items-center flex-wrap">
                <button onClick={() => handleScroll('features')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer">
                  Features
                </button>
                <button onClick={() => handleScroll('tech')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer">
                  Tech Stack
                </button>
                <button onClick={() => handleScroll('performance')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer">
                  Performance
                </button>
                
                <Link 
                  to="/login" 
                  className="bg-[rgba(139,92,246,0.2)] px-5 py-2 rounded-full hover:bg-[rgba(139,92,246,0.4)] transition"
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-5 py-2 rounded-full font-semibold text-white shadow-md hover:scale-105 transition"
                >
                  Get Started
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden text-2xl text-[#cbd5e6] hover:text-[#c084fc] transition z-50"
              >
                <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            </div>

            {/* Mobile Menu */}
            <div className={`md:hidden transition-all duration-300 overflow-hidden ${
              isMenuOpen ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'
            }`}>
              <div className="flex flex-col gap-4">
                <button onClick={() => handleScroll('features')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer py-2 text-left">
                  Features
                </button>
                <button onClick={() => handleScroll('tech')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer py-2 text-left">
                  Tech Stack
                </button>
                <button onClick={() => handleScroll('performance')} className="text-[#cbd5e6] hover:text-[#c084fc] transition cursor-pointer py-2 text-left">
                  Performance
                </button>
                
                <Link 
                  to="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-[rgba(139,92,246,0.2)] px-5 py-2 rounded-full hover:bg-[rgba(139,92,246,0.4)] transition text-center"
                >
                  Log In
                </Link>
                <Link 
                  to="/signup" 
                  onClick={() => setIsMenuOpen(false)}
                  className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-5 py-2 rounded-full font-semibold text-white shadow-md hover:scale-105 transition text-center"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Spacer for fixed nav */}
        <div className="h-20"></div>

        {/* Hero Section - Based on actual project metrics */}
        <section className="flex flex-col items-center text-center py-12 sm:py-16 md:py-24 px-4">
          <div className="bg-[rgba(139,92,246,0.2)] px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[#c084fc] mb-5 backdrop-blur-sm">
            <i className="fas fa-tachometer-alt mr-1"></i> 2,000+ CONCURRENT USERS • &lt;100ms LATENCY
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold leading-tight max-w-[900px]">
            Real-time messaging that <span className="bg-gradient-to-r from-white to-[#C084FC] bg-clip-text text-transparent">actually scales</span>.
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[#b9c2d4] max-w-[650px] my-4 sm:my-6 px-4">
            Built with Redis Pub/Sub, BullMQ queues, and Socket.IO — 
            handling thousands of concurrent connections with zero message loss.
          </p>
          <div className="flex gap-3 sm:gap-4 flex-wrap justify-center">
            <Link to="/signup" className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-white shadow-lg shadow-purple-700/30 hover:scale-105 transition inline-flex items-center gap-2 text-base sm:text-lg">
              <i className="fas fa-comment"></i> Start Chatting
            </Link>
            <button onClick={() => handleScroll('features')} className="border border-[rgba(139,92,246,0.6)] px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-medium text-[#ddd9ff] hover:bg-[rgba(139,92,246,0.15)] transition inline-flex items-center gap-2 text-base sm:text-lg">
              <i className="fas fa-microphone-alt"></i> Voice & Video
            </button>
          </div>
          <div className="mt-6 sm:mt-8 text-xs sm:text-sm text-[#6f7393] flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2">
            <span><i className="fas fa-check-circle text-green-500"></i> WebRTC calls</span>
            <span><i className="fas fa-check-circle text-green-500"></i> File sharing</span>
            <span><i className="fas fa-check-circle text-green-500"></i> Read receipts</span>
            <span><i className="fas fa-check-circle text-green-500"></i> Offline messages</span>
          </div>
        </section>

        {/* Features Section - USER BENEFITS from actual features */}
        <div id="features" className="scroll-mt-24 px-4">
          <div className="text-center mt-8 sm:mt-12">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold">
              What you can actually do with Daemon
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-[#9ca3af] mt-3 max-w-2xl mx-auto px-4">
              No fluff. These features are built, tested, and working right now.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 md:gap-8 my-10 sm:my-16">
            {/* Feature cards remain the same but with responsive padding */}
            {[
              { icon: "fa-bolt", title: "Instant messaging", desc: "Messages deliver in under 100ms. See typing indicators, read receipts, and delivery status in real-time." },
              { icon: "fa-video", title: "Voice & video calls", desc: "Peer-to-peer WebRTC calls. Crystal clear audio and video — no third-party servers involved." },
              { icon: "fa-save", title: "Offline persistence", desc: "Missed messages? They'll be there when you reconnect. Auto-recovery with zero data loss." },
              { icon: "fa-laptop", title: "Multi-device sync", desc: "Logged in on phone and desktop? Presence syncs across all devices. See where you're active.", multiIcon: true },
              { icon: "fa-image", title: "File sharing", desc: "Share images, documents, and videos via Cloudinary with secure presigned URLs." },
              { icon: "fa-check-double", title: "Message lifecycle", desc: "Sent → Delivered → Seen. Full transparency on every message's journey." }
            ].map((feature, idx) => (
              <div key={idx} className="bg-[rgba(18,18,26,0.8)] backdrop-blur-md rounded-2xl p-5 sm:p-7 border border-[rgba(100,80,160,0.3)] hover:border-[#8b5cf6] transition">
                <div className="text-4xl sm:text-5xl text-[#a78bfa] mb-3 sm:mb-4">
                  {feature.multiIcon ? (
                    <>
                      <i className="fas fa-laptop"></i>
                      <i className="fas fa-mobile-alt ml-2"></i>
                    </>
                  ) : (
                    <i className={`fas ${feature.icon}`}></i>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">{feature.title}</h3>
                <p className="text-sm sm:text-base text-[#b9c2d4]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack Section */}
        <div id="tech" className="scroll-mt-24 bg-gradient-to-br from-[#0e0e17] to-[#07070e] rounded-2xl p-6 sm:p-8 md:p-12 my-8 sm:my-12 border border-[rgba(139,92,246,0.3)] mx-4">
          <div className="text-center mb-6 sm:mb-8">
            <i className="fas fa-cogs text-4xl sm:text-5xl text-[#c084fc] mb-3"></i>
            <h2 className="text-2xl sm:text-4xl font-bold">Built with production-grade tech</h2>
            <p className="text-sm sm:text-base md:text-lg text-[#b9c2d4] max-w-2xl mx-auto mt-3">
              No prototypes. This is real backend engineering.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-4 sm:mt-6">
            <div className="text-center p-3 sm:p-4 bg-[rgba(0,0,0,0.3)] rounded-xl">
              <i className="fab fa-node-js text-3xl sm:text-4xl text-green-500 mb-2"></i>
              <h3 className="font-bold text-sm sm:text-base">Node.js + Express</h3>
              <p className="text-xs text-[#9ca3af]">Async runtime</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-[rgba(0,0,0,0.3)] rounded-xl">
              <i className="fas fa-bolt text-3xl sm:text-4xl text-red-400 mb-2"></i>
              <h3 className="font-bold text-sm sm:text-base">Socket.IO</h3>
              <p className="text-xs text-[#9ca3af]">WebSockets + fallback</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-[rgba(0,0,0,0.3)] rounded-xl">
              <i className="fas fa-database text-3xl sm:text-4xl text-[#00b386] mb-2"></i>
              <h3 className="font-bold text-sm sm:text-base">Redis + BullMQ</h3>
              <p className="text-xs text-[#9ca3af]">Pub/Sub & queues</p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-[rgba(0,0,0,0.3)] rounded-xl">
              <i className="fas fa-leaf text-3xl sm:text-4xl text-green-600 mb-2"></i>
              <h3 className="font-bold text-sm sm:text-base">MongoDB</h3>
              <p className="text-xs text-[#9ca3af]">With compound indexing</p>
            </div>
          </div>
        </div>

        {/* Performance Section - Real metrics from resume */}
        <div id="performance" className="scroll-mt-24 bg-[rgba(20,20,30,0.65)] backdrop-blur-md border border-[rgba(90,80,150,0.25)] rounded-2xl p-6 sm:p-10 text-center my-8 sm:my-12 mx-4">
          <h2 className="text-2xl sm:text-4xl font-bold">Proven performance metrics</h2>
          <p className="text-sm sm:text-base md:text-lg text-[#cbcbe6] my-3 sm:my-4 max-w-xl mx-auto">
            Not claims — actual results from load testing and optimization.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-6 sm:mt-8">
            <div>
              <div className="text-3xl sm:text-5xl font-extrabold text-[#c084fc]">2,000+</div>
              <div className="text-xs sm:text-sm text-[#9ca3af] mt-1">Concurrent users supported</div>
            </div>
            <div>
              <div className="text-3xl sm:text-5xl font-extrabold text-[#c084fc]">&lt;100ms</div>
              <div className="text-xs sm:text-sm text-[#9ca3af] mt-1">Average message delivery</div>
            </div>
            <div>
              <div className="text-3xl sm:text-5xl font-extrabold text-[#c084fc]">85%</div>
              <div className="text-xs sm:text-sm text-[#9ca3af] mt-1">Query performance gain via indexing</div>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[rgba(100,80,160,0.2)] text-left max-w-2xl mx-auto">
            <p className="text-xs sm:text-sm text-[#b9c2d4]"><i className="fas fa-check-circle text-green-500 mr-2"></i> Zero message loss — BullMQ retry queue with 5-retry exponential backoff</p>
            <p className="text-xs sm:text-sm text-[#b9c2d4] mt-2"><i className="fas fa-check-circle text-green-500 mr-2"></i> Redis Pub/Sub for horizontal scaling across server instances</p>
            <p className="text-xs sm:text-sm text-[#b9c2d4] mt-2"><i className="fas fa-check-circle text-green-500 mr-2"></i> Backpressure-aware socket emission prevents server overload</p>
          </div>
        </div>

        {/* Project acknowledgment - honest about scope */}
        <div className="bg-[rgba(20,15,40,0.5)] rounded-2xl p-5 sm:p-8 text-center my-6 border border-dashed border-[#5b4c8f] mx-4">
          <i className="fas fa-code text-2xl sm:text-3xl text-[#8b5cf6] opacity-60"></i>
          <p className="text-sm sm:text-base md:text-lg max-w-[700px] mx-auto my-3 sm:my-4">
            A full-stack real-time messaging platform — built to solve actual engineering challenges 
            like concurrency, fault tolerance, and real-time state sync.
          </p>
          <div className="flex justify-center gap-3 sm:gap-5 flex-wrap mt-3 sm:mt-4 text-xs sm:text-sm">
            <div><i className="fab fa-github"></i> Open source</div>
            <div><i className="fas fa-chart-line"></i> Production ready</div>
            <div><i className="fas fa-shield-alt"></i> Self-hostable</div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-[rgba(20,20,30,0.65)] backdrop-blur-md border border-[rgba(90,80,150,0.25)] rounded-2xl p-6 sm:p-10 text-center my-8 sm:my-12 mx-4">
          <h2 className="text-2xl sm:text-4xl font-bold">Experience real-time messaging done right</h2>
          <p className="text-sm sm:text-base md:text-lg text-[#cbcbe6] my-3 sm:my-4 max-w-xl mx-auto">
            Join the platform built for performance, reliability, and transparency.
          </p>
          <div className="flex gap-3 sm:gap-4 justify-center flex-wrap mt-4 sm:mt-6">
            <Link to="/signup" className="bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-white shadow-lg inline-flex items-center gap-2 text-base sm:text-lg">
              <i className="fas fa-user-plus"></i> Create free account
            </Link>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="border border-[rgba(139,92,246,0.6)] px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-medium text-[#ddd9ff] hover:bg-[rgba(139,92,246,0.15)] inline-flex items-center gap-2 text-base sm:text-lg"
            >
              <i className="fab fa-github"></i> Star on GitHub
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[rgba(100,80,160,0.3)] mt-8 sm:mt-12 pt-6 sm:pt-8 pb-8 sm:pb-10 text-center text-[#8a8faa] text-xs sm:text-sm">
          <div className="flex justify-center gap-4 sm:gap-8 flex-wrap mb-4 sm:mb-6">
            <button onClick={() => handleScroll('features')} className="hover:text-[#c084fc] cursor-pointer">Features</button>
            <button onClick={() => handleScroll('tech')} className="hover:text-[#c084fc] cursor-pointer">Tech Stack</button>
            <button onClick={() => handleScroll('performance')} className="hover:text-[#c084fc] cursor-pointer">Performance</button>
            <a href="https://github.com/rajankumar2511/king-s-call" target="_blank" rel="noopener noreferrer" className="hover:text-[#c084fc]">GitHub</a>
            <Link to="/terms" className="hover:text-[#c084fc]">Terms</Link>
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 text-lg sm:text-xl">
            <i className="fab fa-github cursor-pointer hover:text-[#c084fc] transition"></i>
            <i className="fab fa-twitter cursor-pointer hover:text-[#c084fc] transition"></i>
            <i className="fab fa-discord cursor-pointer hover:text-[#c084fc] transition"></i>
          </div>
          <div className="mt-4 sm:mt-6">
            <p>Daemon — real-time messaging platform</p>
            <p className="text-xs mt-2 text-[#6a6c8a]">Node.js • Socket.IO • Redis • BullMQ • MongoDB</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Auth;