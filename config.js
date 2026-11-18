// =========================================================================
// فایل اتصال مرکزی (config.js)
// فقط کافی است لینک Web App گوگل اسکریپت خود را در خط زیر قرار دهید.
// =========================================================================
window.APP_ENDPOINT = {
  appsScriptUrl: "https://script.google.com/macros/s/AKfycby0yBmibLnEA1a2W4LBznwUMaFCIgpqKWApEqGgKzY-L373ZfMkTIYPyWd05gA3m1TM/exec" // لینک خروجی Deploy > Web app گوگل اسکریپت را اینجا بگذارید
};

// تنظیمات پیش‌فرض تا قبل از اولین ذخیره در پنل مدیریت
window.DEFAULT_CONFIG = {
  storeName: "نائیریکا بیوتی",
  footerNote: "از خرید و اعتماد شما سپاسگزاریم ✨",
  workerUrl: "",
  logoBase64: "",
  stampBase64: ""
};

window.FALLBACK_PRODUCTS = [
  {
    id: 1,
    name: "ضد آفتاب بیوتی آف چوسان",
    brand: "Beauty of Joseon",
    category: "مراقبتی",
    retailPrice: 680000,
    wholesalePrice: 540000,
    moq: 3,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80",
    expiryDate: "2028/05"
  },
  {
    id: 2,
    name: "آبرسان پوست چرب گارنیر",
    brand: "Garnier",
    category: "مراقبتی",
    retailPrice: 450000,
    wholesalePrice: 340000,
    moq: 6,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80",
    expiryDate: "2027/11"
  }
];