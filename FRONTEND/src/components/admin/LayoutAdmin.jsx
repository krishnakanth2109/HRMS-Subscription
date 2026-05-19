import Sidebar from "./Sidebar";  // now from admin folder
import SidebarSupportAdmin from "../../pages/support-admin/SidebarSupportAdmin";
import Navbar from "./Navbar";
import NavbarSupportAdmin from "../../pages/support-admin/NavbarSupportAdmin";
import { Outlet } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

const LayoutAdmin = () => {
  const { user } = useContext(AuthContext);
  const[theme, setTheme] = useState(sessionStorage.getItem("adminTheme") || "white");
  const[bubbles, setBubbles] = useState([]);
  
  const themeBgImage = "../../../public/image.png"; 

  const toggleTheme = (selectedTheme) => {
    setTheme(selectedTheme);
    sessionStorage.setItem("adminTheme", selectedTheme);
    if (selectedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    if (theme === "bubbles") {
      const newBubbles = Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        size: Math.random() * 180 + 60,
        left: Math.random() * 100,
        top: Math.random() * 100,
        color: Math.random() > 0.6 ? '#93C5FD' : '#E0F2FE',
        opacity: Math.random() > 0.6 ? 0.6 : 0.8,
        duration: Math.random() * 20 + 10,
        delay: Math.random() * 10,
      }));
      setBubbles(newBubbles);
    } else {
      setBubbles([]);
    }
  }, [theme]);

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-gray-900' : theme === 'white' ? 'bg-white' : 'bg-[#F8FAFF]'}`}>
      
      {/* SIDEBAR */}
      <div className="z-30 hidden md:block md:relative">
        {user?.role === "support-admin" ? (
          <SidebarSupportAdmin mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        ) : (
          <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        )}
      </div>
      
      {/* Mobile Sidebar (Portal-like behavior) */}
      <div className="md:hidden">
        {user?.role === "support-admin" ? (
          <SidebarSupportAdmin mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        ) : (
          <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        )}
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        
        {/* NAVBAR */}
        {/* Given z-20 so it sits above the background, but below popups (z-50) */}
        <div className="z-20">
          {user?.role === "support-admin" ? (
            <NavbarSupportAdmin 
              currentTheme={theme} 
              onThemeChange={toggleTheme} 
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          ) : (
            <Navbar 
              currentTheme={theme} 
              onThemeChange={toggleTheme} 
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          )}
        </div>

        <main className="relative flex-1 overflow-hidden bg-transparent">
          <style>{`
            @keyframes blob-bounce {
              0% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
              100% { transform: translate(0, 0) scale(1); }
            }
          `}</style>

          {/* BACKGROUND LAYERS */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {theme === "bubbles" && bubbles.map((bubble) => (
              <div key={bubble.id} className="absolute rounded-full"
                style={{
                  width: `${bubble.size}px`, height: `${bubble.size}px`,
                  left: `${bubble.left}%`, top: `${bubble.top}%`,
                  backgroundColor: bubble.color, opacity: bubble.opacity,
                  filter: "blur(2px)", animation: `blob-bounce ${bubble.duration}s infinite ease-in-out alternate`,
                  animationDelay: `${bubble.delay}s`,
                }}
              />
            ))}

            {theme === "image" && (
              <div className="absolute inset-0 opacity-60 transition-opacity duration-700"
                style={{ backgroundImage: `url(https://image2url.com/r2/default/images/1773292744536-6fd3f832-9e97-4fb8-8a1d-1ddb3b5e2b15.png)`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
              />
            )}
          </div>

          {/* CONTENT */}
          {/* Removed specific z-indexes here so your Modals can freely escape and cover the Sidebar! */}
          <div className="relative h-full w-full overflow-y-auto px-2 md:p-4 lg:p-8">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default LayoutAdmin;
