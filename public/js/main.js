// small helper for any future client features
document.addEventListener('click', function(e){
  // placeholder for global interactions
});

// public/js/main.js1
document.addEventListener('DOMContentLoaded', () => {
    // product page logic: only run if PRODUCT is defined
    if (window.PRODUCT) {
      const product = window.PRODUCT;
      const colorSelect = document.getElementById('colorSelect');
      const thumbs = document.getElementById('thumbs');
      const mainImage = document.getElementById('mainImage');
      const selectedColorInput = document.getElementById('selectedColorInput');
  
      function renderThumbnailsForColor(color) {
        const imgs = product.images[color] || [];
        thumbs.innerHTML = imgs.map((img, i) => `<img class="thumbnail ${i===0? 'active' : ''}" src="${img}" data-img="${img}">`).join('');
        mainImage.src = imgs[0] || '';
        selectedColorInput && (selectedColorInput.value = color);
      }
  
      // initial render (choose first color)
      const initialColor = Object.keys(product.images)[0];
      renderThumbnailsForColor(initialColor);
  
      // click on thumbnails
      thumbs.addEventListener('click', (e) => {
        const t = e.target;
        if (t && t.classList.contains('thumbnail')) {
          const img = t.dataset.img;
          mainImage.src = img;
          // mark active
          document.querySelectorAll('#thumbs .thumbnail').forEach(n => n.classList.remove('active'));
          t.classList.add('active');
        }
      });
  
      // color change -> swap gallery
      colorSelect && colorSelect.addEventListener('change', (e) => {
        renderThumbnailsForColor(e.target.value);
      });
  
      // zoom on hover (desktop)
      let zoomTimeout;
      mainImage.addEventListener('mouseenter', () => {
        clearTimeout(zoomTimeout);
        mainImage.classList.add('zoom');
      });
      mainImage.addEventListener('mouseleave', () => {
        zoomTimeout = setTimeout(() => mainImage.classList.remove('zoom'), 80);
      });
    }
  
    // optional: update cart-count badge by polling (simple)
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
      // nothing fancy; server updates on page load - good enough
    }
  });
  