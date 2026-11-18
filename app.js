// =========================================================================
// منطق کاتالوگ مشتریان (app.js) - همگام‌سازی آنلاین با Google Apps Script
// =========================================================================
let config = { ...(window.DEFAULT_CONFIG || {}), ...JSON.parse(localStorage.getItem('beauty_live_cfg') || '{}') };
let products = JSON.parse(localStorage.getItem('beauty_live_products') || 'null') || (window.FALLBACK_PRODUCTS || []);
let cart = {};
let saleMode = 'retail';
let selectedCategory = 'همه';

function normalizeDigits(str) {
  if (str === null || str === undefined) return '';
  const persian = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabic  = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let out = String(str);
  for (let i = 0; i < 10; i++) {
    out = out.replace(persian[i], i).replace(arabic[i], i);
  }
  return out;
}

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.initDataUnsafe?.user) {
    const u = tg.initDataUnsafe.user;
    const nameInput = document.getElementById('buyerName');
    if (nameInput) nameInput.value = [u.first_name, u.last_name].filter(Boolean).join(' ');
  }
}

function applyConfigToUI() {
  document.getElementById('headerStoreName').innerText = config.storeName || 'فروشگاه آرایشی و بهداشتی';
  document.getElementById('invStoreName').innerText = config.storeName || 'فروشگاه آرایشی و بهداشتی';
  document.getElementById('invFooterNote').innerText = config.footerNote || '';

  if (config.logoBase64) {
    document.getElementById('headerLogo').src = config.logoBase64;
    document.getElementById('headerLogo').classList.remove('hidden');
    document.getElementById('headerFallbackIcon').classList.add('hidden');
    document.getElementById('invLogo').src = config.logoBase64;
    document.getElementById('invLogo').classList.remove('hidden');
  }
  if (config.stampBase64) {
    document.getElementById('invStamp').src = config.stampBase64;
    document.getElementById('invStamp').classList.remove('hidden');
    document.getElementById('invStampPlaceholder').classList.add('hidden');
  }
}

async function syncFromBackend(manual = false) {
  const endpoint = (window.APP_ENDPOINT?.appsScriptUrl || '').trim();
  if (!endpoint) {
    if (manual) alert('لینک Web App گوگل اسکریپت هنوز در فایل config.js قرار داده نشده است.');
    return;
  }

  const dot = document.getElementById('syncStatusDot');
  const txt = document.getElementById('syncStatusText');
  const icon = document.getElementById('refreshIcon');
  dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping';
  txt.innerText = 'در حال دریافت اطلاعات آنلاین...';
  icon.classList.add('animate-spin');

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'خطا در دریافت داده');

    if (data.config && Object.keys(data.config).length > 0) {
      config = { ...config, ...data.config };
      localStorage.setItem('beauty_live_cfg', JSON.stringify(config));
      applyConfigToUI();
    }

    if (Array.isArray(data.products) && data.products.length > 1) {
      const parsed = data.products.slice(1).map((r, idx) => ({
        id: idx + 1,
        name: String(r[0] || '').trim(),
        brand: String(r[1] || '').trim(),
        category: String(r[2] || 'عمومی').trim(),
        retailPrice: Number(normalizeDigits(r[3] || '0').replace(/[^\d]/g, '')) || 0,
        wholesalePrice: Number(normalizeDigits(r[4] || '0').replace(/[^\d]/g, '')) || 0,
        moq: Number(normalizeDigits(r[5] || '1').replace(/[^\d]/g, '')) || 1,
        image: String(r[6] || '').trim() || 'https://placehold.co/300x300/fff1f2/be123c?text=Cosmetic',
        expiryDate: String(r[7] || '').trim()
      })).filter(p => p.name && (p.retailPrice > 0 || p.wholesalePrice > 0));

      if (parsed.length > 0) {
        products = parsed;
        localStorage.setItem('beauty_live_products', JSON.stringify(products));
        renderCategories();
        renderProducts();
        updateCartUI();
      }
    }

    dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
    txt.innerText = `${products.length} محصول آماده سفارش`;
  } catch (err) {
    dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-500';
    txt.innerText = 'حالت آفلاین (نمایش کش)';
    if (manual) alert('خطا در اتصال آنلاین: ' + err.message);
  } finally {
    icon.classList.remove('animate-spin');
  }
}

function setSaleMode(mode) {
  saleMode = mode;
  const btnR = document.getElementById('btnModeRetail');
  const btnW = document.getElementById('btnModeWholesale');
  if (mode === 'retail') {
    btnR.className = 'py-1.5 text-xs font-bold rounded-lg bg-white text-rose-600 shadow-sm transition';
    btnW.className = 'py-1.5 text-xs font-bold rounded-lg text-stone-500 hover:text-stone-800 transition';
  } else {
    btnW.className = 'py-1.5 text-xs font-bold rounded-lg bg-white text-emerald-700 shadow-sm transition';
    btnR.className = 'py-1.5 text-xs font-bold rounded-lg text-stone-500 hover:text-stone-800 transition';
    Object.keys(cart).forEach(id => {
      const p = products.find(x => x.id == id);
      if (p && cart[id] < p.moq) cart[id] = p.moq;
    });
  }
  renderProducts();
  updateCartUI();
}

function renderCategories() {
  const cats = ['همه', ...new Set(products.map(p => p.category).filter(Boolean))];
  document.getElementById('categoryTabs').innerHTML = cats.map(c => `
    <button onclick="selectCategory('${c}')" class="px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition ${selectedCategory === c ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-600'}">
      ${c}
    </button>
  `).join('');
}

function selectCategory(cat) {
  selectedCategory = cat;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = products.filter(p => {
    const matchCat = selectedCategory === 'همه' || p.category === selectedCategory;
    const matchQuery = !query || p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query);
    return matchCat && matchQuery;
  });

  const grid = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyState');
  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = filtered.map(p => {
    const price = saleMode === 'retail' ? p.retailPrice : p.wholesalePrice;
    const qty = cart[p.id] || 0;
    const step = saleMode === 'wholesale' ? p.moq : 1;

    return `
      <div class="bg-white rounded-2xl border border-stone-200/80 overflow-hidden flex flex-col justify-between shadow-2xs">
        <div>
          <div class="relative aspect-square bg-stone-50 overflow-hidden">
            <img src="${p.image}" alt="${p.name}" loading="lazy" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/300x300/fff1f2/be123c?text=Cosmetic'" />
            ${p.brand ? `<span class="absolute top-2 right-2 bg-white/90 backdrop-blur-xs text-[10px] font-bold text-stone-700 px-2 py-0.5 rounded-md shadow-2xs">${p.brand}</span>` : ''}
            ${p.expiryDate ? `<span class="absolute top-2 left-2 bg-stone-800/80 text-white text-[9px] px-1.5 py-0.5 rounded-md" dir="ltr">EXP: ${p.expiryDate}</span>` : ''}
            ${saleMode === 'wholesale' ? `<span class="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md">حداقل ${p.moq} عدد</span>` : ''}
          </div>
          <div class="p-2.5">
            <h3 class="font-bold text-xs text-stone-800 line-clamp-2 leading-snug min-h-[2.2rem]">${p.name}</h3>
            <div class="mt-2 flex items-baseline justify-between">
              <span class="font-extrabold text-sm ${saleMode === 'retail' ? 'text-rose-600' : 'text-emerald-700'}">${price.toLocaleString('fa-IR')}</span>
              <span class="text-[10px] text-stone-400">تومان</span>
            </div>
          </div>
        </div>

        <div class="px-2.5 pb-2.5">
          ${qty === 0 ? `
            <button onclick="changeQty(${p.id}, ${step})" class="w-full py-2 rounded-xl bg-stone-100 hover:bg-rose-50 hover:text-rose-600 text-stone-700 font-bold text-[11px] transition">
              + افزودن به سبد
            </button>
          ` : `
            <div class="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl p-1">
              <button onclick="changeQty(${p.id}, 1)" class="w-7 h-7 rounded-lg bg-rose-600 text-white font-bold text-sm flex items-center justify-center">+</button>
              <span class="font-extrabold text-xs text-rose-900">${qty}</span>
              <button onclick="changeQty(${p.id}, -1)" class="w-7 h-7 rounded-lg bg-white text-rose-600 font-bold text-sm flex items-center justify-center">-</button>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function changeQty(id, delta) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const current = cart[id] || 0;
  let next = current + delta;

  if (saleMode === 'wholesale') {
    if (current === 0 && delta > 0) next = p.moq;
    else if (next < p.moq) next = 0;
  }

  if (next <= 0) delete cart[id];
  else cart[id] = next;

  renderProducts();
  updateCartUI();
}

function updateCartUI() {
  let totalCount = 0, totalAmount = 0;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = products.find(x => x.id == id);
    if (p) {
      const price = saleMode === 'retail' ? p.retailPrice : p.wholesalePrice;
      totalCount += qty;
      totalAmount += price * qty;
    }
  });

  const bar = document.getElementById('cartBar');
  if (totalCount > 0) {
    bar.classList.remove('hidden');
    document.getElementById('cartCount').innerText = totalCount.toLocaleString('fa-IR');
    document.getElementById('cartTotal').innerText = totalAmount.toLocaleString('fa-IR');
  } else {
    bar.classList.add('hidden');
  }
}

function openCheckoutModal() {
  document.getElementById('invDate').innerText = new Date().toLocaleDateString('fa-IR');
  document.getElementById('invNumber').innerText = Math.floor(10000 + Math.random() * 90000);
  document.getElementById('invModeBadge').innerText = saleMode === 'retail' ? 'تک‌فروشی' : 'عمده‌فروشی';
  updateInvoicePreview();
  document.getElementById('checkoutModal').classList.remove('hidden');
  document.getElementById('checkoutModal').classList.add('flex');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.add('hidden');
  document.getElementById('checkoutModal').classList.remove('flex');
}

function updateInvoicePreview() {
  document.getElementById('invBuyerName').innerText = document.getElementById('buyerName').value.trim() || 'مشتری گرامی';
  document.getElementById('invBuyerPhone').innerText = document.getElementById('buyerPhone').value.trim() || '-';

  let rowsHtml = '', totalQty = 0, grandTotal = 0, idx = 1;
  Object.entries(cart).forEach(([id, qty]) => {
    const p = products.find(x => x.id == id);
    if (!p) return;
    const price = saleMode === 'retail' ? p.retailPrice : p.wholesalePrice;
    const rowSum = price * qty;
    totalQty += qty;
    grandTotal += rowSum;
    rowsHtml += `
      <tr>
        <td class="py-1.5 px-2 text-right text-stone-400">${idx++}</td>
        <td class="py-1.5 px-2 text-right font-medium text-stone-800">
          ${p.name}
          ${p.expiryDate ? `<span class="block text-[9px] text-stone-400" dir="ltr">EXP: ${p.expiryDate}</span>` : ''}
        </td>
        <td class="py-1.5 px-2 text-center font-bold">${qty}</td>
        <td class="py-1.5 px-2 text-left text-stone-600">${price.toLocaleString('fa-IR')}</td>
        <td class="py-1.5 px-2 text-left font-bold text-stone-900">${rowSum.toLocaleString('fa-IR')}</td>
      </tr>
    `;
  });

  document.getElementById('invItemsBody').innerHTML = rowsHtml;
  document.getElementById('invTotalQty').innerText = totalQty.toLocaleString('fa-IR');
  document.getElementById('invGrandTotal').innerText = grandTotal.toLocaleString('fa-IR');
}

async function renderInvoiceBlob() {
  const area = document.getElementById('invoiceCaptureArea');
  const canvas = await html2canvas(area, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff' });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function downloadInvoiceImage() {
  const blob = await renderInvoiceBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Factor-${Date.now()}.png`;
  a.click();
}

async function sendInvoiceToTelegram() {
  if (!config.workerUrl) {
    alert('آدرس Cloudflare Worker هنوز در پنل مدیریت ثبت نشده است.');
    return;
  }

  const btn = document.getElementById('btnSendTelegram');
  const oldText = btn.innerText;
  btn.disabled = true;
  btn.innerText = '⏳ در حال صدور و ارسال فاکتور...';

  try {
    const blob = await renderInvoiceBlob();
    const formData = new FormData();
    formData.append('photo', blob, 'invoice.png');
    formData.append('caption', `🧾 سفارش جدید (${saleMode === 'retail' ? 'تک' : 'عمده'})\n👤 خریدار: ${document.getElementById('invBuyerName').innerText}\n📞 تماس: ${document.getElementById('invBuyerPhone').innerText}\n💰 مبلغ کل: ${document.getElementById('invGrandTotal').innerText} تومان`);

    const res = await fetch(config.workerUrl, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.ok) {
      alert('✅ فاکتور تصویری با موفقیت ثبت و به چت ربات ارسال شد!');
      cart = {};
      updateCartUI();
      renderProducts();
      closeCheckoutModal();
    } else {
      throw new Error(data.error || data.description || 'خطا در ارسال فاکتور');
    }
  } catch (err) {
    alert('❌ خطا در ارتباط با سرور: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = oldText;
  }
}

applyConfigToUI();
renderCategories();
renderProducts();
syncFromBackend(false);