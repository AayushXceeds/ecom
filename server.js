// server.js (FULL upgrade - color galleries, wishlist, reviews, sorting, stock)
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const path = require('path');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// lowdb setup
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { users: [], products: [], orders: [] };

  // seed admin
  if (!db.data.users.find(u => u.email === 'admin@demo.com')) {
    const hashed = await bcrypt.hash('admin123', 10);
    db.data.users.push({ id: nanoid(), name: 'Admin', email: 'admin@demo.com', password: hashed, isAdmin: true });
  }

  // seed products (color-based images, stock, reviews)
  if (!db.data.products || db.data.products.length === 0) {
    db.data.products = [
      {
        id: 'p1',
        title: 'Wireless Headphones',
        price: 1999,
        desc: 'Comfortable wireless headphones with deep bass and long battery life.',
        // images grouped by color
        images: {
          "Black Sabre": [
            '/public/images/boat_blacksabre.jpg',
            '/public/images/boat_blacksabre2.jpg',
            '/public/images/boat_blacksabre3.jpg'
          ],
          "Bold Blue": [
            '/public/images/boat_boldblue.jpg',
            '/public/images/boat_boldblue2.jpg',
            '/public/images/boat_boldblue3.jpg'
          ]
        },
        stock: { "Black Sabre": 12, "Bold Blue": 5 },
        reviews: [
          { id: nanoid(), user: 'Ravi', rating: 5, comment: 'Great sound and comfort', createdAt: new Date().toISOString() },
        ],
        tags: ['audio', 'headphones']
      },

      {
        id: 'p2',
        title: 'Smart Watch',
        price: 3499,
        desc: 'Track your fitness, notifications, and health metrics.',
        images: {
          "Space Blue": [
            '/public/images/noise_swspaceblue.jpg',
            '/public/images/noise_swcommon.jpg',
            '/public/images/noise_swcommon2.jpg',
            '/public/images/noise_swcommon3.jpg'
          ],
          "Rose Pink": [
            '/public/images/noise_swrosepink.jpg',
            '/public/images/noise_swcommon.jpg',
            '/public/images/noise_swcommon2.jpg',
            '/public/images/noise_swcommon3.jpg'
          ],
          "Deep Wine": [
            '/public/images/noise_swdeepwine.jpg',
            '/public/images/noise_swcommon.jpg',
            '/public/images/noise_swcommon2.jpg',
            '/public/images/noise_swcommon3.jpg'
          ]
        },
        stock: { "Space Blue": 8, "Rose Pink": 3, "Deep Wine": 1 },
        reviews: [
          { id: nanoid(), user: 'Neha', rating: 4, comment: 'Looks premium and works well', createdAt: new Date().toISOString() }
        ],
        tags: ['wearable', 'smartwatch']
      },

      {
        id: 'p3',
        title: 'Gaming Mouse',
        price: 1299,
        desc: 'High precision RGB gaming mouse for pro gamers.',
        images: {
          "Black": [
            '/public/images/logi_mouse1.jpg',
            '/public/images/logi_mouse2.jpg',
            '/public/images/logi_mouse3.jpg'
          ]
        },
        stock: { "Black": 20 },
        reviews: [],
        tags: ['gaming', 'mouse']
      }
    ];
  }

  await db.write();
}
initDB();

// Express config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 }
}));

// expose user/cart/wishlist to views
app.use(async (req, res, next) => {
  await db.read();
  res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || {};
  res.locals.wishlist = req.session.wishlist || [];
  res.locals.cartCount = Object.values(res.locals.cart).reduce((s, it) => s + (it.qty || 0), 0);
  next();
});

// auth guards
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Forbidden: Admin only');
  next();
}

// ---------- Routes ----------

// Home with optional search & tag
app.get('/', async (req, res) => {
  await db.read();
  let products = db.data.products || [];
  const q = (req.query.q || '').trim().toLowerCase();

  if (q) {
    products = products.filter(p => (p.title + ' ' + p.desc).toLowerCase().includes(q));
  }

  res.render('index', { products });
});

// Product page (supports sort param for reviews)
app.get('/product/:id', async (req, res) => {
  await db.read();
  const product = db.data.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).send('Product not found');

  // compute average rating
  const reviews = product.reviews || [];
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;

  // sort reviews if requested
  const sort = req.query.sort || 'newest'; // newest | highest | lowest
  let sortedReviews = [...reviews];
  if (sort === 'highest') sortedReviews.sort((a, b) => b.rating - a.rating);
  else if (sort === 'lowest') sortedReviews.sort((a, b) => a.rating - b.rating);
  else sortedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('product', { product, reviews: sortedReviews, avgRating: avg, sort });
});

// Add review (must be logged in)
app.post('/review/add', requireLogin, async (req, res) => {
  const { productId, rating, comment } = req.body;
  await db.read();
  const product = db.data.products.find(p => p.id === productId);
  if (!product) return res.status(404).send('Product not found');

  product.reviews.push({
    id: nanoid(),
    user: req.session.user.name || req.session.user.email,
    rating: Number(rating),
    comment: comment || '',
    createdAt: new Date().toISOString()
  });

  await db.write();
  res.redirect('/product/' + productId);
});

// Add to cart (with selected color)
app.post('/cart/add', async (req, res) => {
  const { id, qty, color } = req.body;
  const quantity = Math.max(1, parseInt(qty || 1, 10));
  await db.read();
  const product = db.data.products.find(p => p.id === id);
  if (!product) return res.status(404).send('Product not found');

  // check stock
  const colorKey = color || Object.keys(product.images)[0];
  const available = (product.stock && product.stock[colorKey]) || 0;
  if (available < quantity) {
    // simply redirect back with a query (UI can show message if wanted)
    return res.redirect('back');
  }

  req.session.cart = req.session.cart || {};
  const cartKey = id + '::' + colorKey; // cart item per color
  if (!req.session.cart[cartKey]) {
    req.session.cart[cartKey] = { productId: id, product, color: colorKey, qty: 0 };
  }
  req.session.cart[cartKey].qty += quantity;

  return res.redirect('/cart');
});

// Cart page
app.get('/cart', (req, res) => {
  req.session.cart = req.session.cart || {};
  res.render('cart', { cart: req.session.cart });
});

// Update cart
app.post('/cart/update', (req, res) => {
  const updates = req.body; // { "p1::Black Sabre": "2", ... }
  req.session.cart = req.session.cart || {};
  for (const key in updates) {
    const qty = parseInt(updates[key], 10);
    if (isNaN(qty) || qty <= 0) delete req.session.cart[key];
    else if (req.session.cart[key]) req.session.cart[key].qty = qty;
  }
  res.redirect('/cart');
});

// Checkout (simple, require login)
app.post('/checkout', requireLogin, async (req, res) => {
  await db.read();
  const cart = req.session.cart || {};
  const items = Object.values(cart).map(c => ({ id: c.productId, title: c.product.title, price: c.product.price, qty: c.qty, color: c.color }));
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);

  // reduce stock
  items.forEach(it => {
    const prod = db.data.products.find(p => p.id === it.id);
    if (prod && prod.stock && prod.stock[it.color] !== undefined) {
      prod.stock[it.color] = Math.max(0, prod.stock[it.color] - it.qty);
    }
  });

  const order = { id: nanoid(), userId: req.session.user.id, items, total, createdAt: new Date().toISOString() };
  db.data.orders.push(order);
  await db.write();

  req.session.cart = {};
  res.render('admin', { message: 'Order placed! ID: ' + order.id, orders: db.data.orders.slice().reverse() });
});

// Wishlist: add/remove (stored in session)
app.post('/wishlist/toggle', async (req, res) => {
  const { productId } = req.body;
  req.session.wishlist = req.session.wishlist || [];
  const idx = req.session.wishlist.indexOf(productId);
  if (idx === -1) req.session.wishlist.push(productId);
  else req.session.wishlist.splice(idx, 1);
  res.redirect('back');
});

app.get('/wishlist', async (req, res) => {
  await db.read();
  const list = (req.session.wishlist || []).map(id => db.data.products.find(p => p.id === id)).filter(Boolean);
  res.render('wishlist', { list });
});

// Signup / Login / Logout
app.get('/signup', (req, res) => res.render('signup', { error: null }));
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  await db.read();
  if (db.data.users.find(u => u.email === email)) return res.render('signup', { error: 'Email already registered' });
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), name: name || 'User', email, password: hashed, isAdmin: false };
  db.data.users.push(user);
  await db.write();
  req.session.user = { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin };
  res.redirect('/');
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.render('login', { error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.render('login', { error: 'Invalid credentials' });
  req.session.user = { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin || false };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin (protected)
app.get('/admin', requireAdmin, async (req, res) => {
  await db.read();
  res.render('admin', { message: null, orders: db.data.orders.slice().reverse() });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
