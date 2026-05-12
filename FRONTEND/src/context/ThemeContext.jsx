import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // pehle sessionStorage se check karenge, warna default blue
  const [themeColor, setThemeColorState] = useState(
    sessionStorage.getItem("themeColor") || "#3B82F6"
  );

  // function to update both state, CSS variable, and sessionStorage
  const setThemeColor = (color) => {
    setThemeColorState(color);
    sessionStorage.setItem("themeColor", color); // ✅ store in sessionStorage
    document.documentElement.style.setProperty("--main-bg-color", color);
    document.documentElement.style.setProperty("--primary-color", color);
  };

  // initialize CSS variable on first load (from state/sessionStorage)
  useEffect(() => {
    document.documentElement.style.setProperty("--main-bg-color", themeColor);
    document.documentElement.style.setProperty("--primary-color", themeColor);
  }, [themeColor]);

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

// custom hook
export const useTheme = () => useContext(ThemeContext);
