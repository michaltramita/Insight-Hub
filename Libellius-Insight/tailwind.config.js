/** @type {import('tailwindcss').Config} */
export default {
  // Toto povie Tailwindu, aby sledoval triedu "dark" na <html> elemente
  darkMode: 'class', 
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}", // Pridané pre vašu štruktúru
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Musíme tu definovať vašu 'brand' farbu, aby ju Tailwind poznal
        brand: "#B81547",
      },
    },
  },
  plugins: [],
}
