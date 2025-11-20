const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your_secret_key_change_this',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

app.set('view engine', 'ejs');

// DB helpers (dev only)
const DB_PATH = path.join(__dirname, 'db.json');

function loadDb() {
  // If db.json is missing, create a minimal one to avoid ENOENT
  if (!fs.existsSync(DB_PATH)) {
    const starter = { users: [], products: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(starter, null, 2), 'utf8');
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function findUserByEmail(email) {
  const db = loadDb();
  return (db.users || []).find(u => u.email === email);
}

/* ----------------------
   ROUTES
   ---------------------- */

// Home page
app.get('/', (req, res) => {
  const db = loadDb();
  res.render('index', {
    products: db.products || [],
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length
  });
});

// Product page
app.get('/product/:id', (req, res) => {
  const db = loadDb();
  const product = (db.products || []).find(p => p.id === req.params.id);
  if (!product) return res.status(404).send('Product not found');

  // compute reviews safely
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0;

  // sorting
  const sort = req.query.sort || 'newest';
  let sortedReviews = [...reviews];
  if (sort === 'highest') sortedReviews.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'lowest') sortedReviews.sort((a, b) => (a.rating || 0) - (b.rating || 0));
  else sortedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.render('product', {
    product,
    reviews: sortedReviews,
    avgRating,
    sort,
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length
  });
});

// Add review
app.post('/review/add', (req, res) => {
  const { productId, rating, comment } = req.body;
  const db = loadDb();
  const product = (db.products || []).find(p => p.id === productId);
  if (!product) return res.status(404).send('Product not found');

  product.reviews = product.reviews || [];
  product.reviews.push({
    user: (req.session.user && req.session.user.name) || 'Guest',
    rating: Number(rating) || 0,
    comment: comment || '',
    createdAt: new Date().toISOString()
  });

  saveDb(db);
  res.redirect(`/product/${productId}`);
});

// Add to cart
app.post('/cart/add', (req, res) => {
  const { id, color, qty } = req.body;
  const db = loadDb();
  const product = (db.products || []).find(p => p.id === id);
  if (!product) return res.status(404).send('Product not found');

  req.session.cart = req.session.cart || [];
  const quantity = Number(qty || 1);
  const chosenImage = (product.images && product.images[color] && product.images[color][0]) || (Object.values(product.images || {})[0] && Object.values(product.images || {})[0][0]) || '';

  const existing = req.session.cart.find(i => i.id === id && i.color === color);
  if (existing) existing.qty += quantity;
  else req.session.cart.push({
    id: product.id,
    title: product.title,
    price: product.price,
    color: color || '',
    image: chosenImage,
    qty: quantity
  });

  res.redirect('/cart');
});

// Cart view
app.get('/cart', (req, res) => {
  res.render('cart', {
    cart: req.session.cart || [],
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length
  });
});

// Wishlist (session-based)
app.post('/wishlist/toggle', (req, res) => {
  const { productId } = req.body;
  req.session.wishlist = req.session.wishlist || [];
  if (req.session.wishlist.includes(productId)) {
    req.session.wishlist = req.session.wishlist.filter(x => x !== productId);
  } else {
    req.session.wishlist.push(productId);
  }
  res.redirect('back');
});

app.get('/wishlist', (req, res) => {
  const db = loadDb();
  const wishlistIds = req.session.wishlist || [];
  const items = (db.products || []).filter(p => wishlistIds.includes(p.id));
  res.render('wishlist', {
    items,
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length
  });
});

// Signup / Login
app.get('/signup', (req, res) => {
  res.render('signup', { user: req.session.user || null, cartCount: (req.session.cart || []).length });
});
app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  const db = loadDb();
  if (findUserByEmail(email)) return res.send('Email already exists.');

  const id = 'u' + Date.now();
  db.users = db.users || [];
  db.users.push({ id, name, email, password, isAdmin: false });
  saveDb(db);

  req.session.user = { id, name, email, isAdmin: false };
  res.redirect('/');
});

app.get('/login', (req, res) => {
  res.render('login', { user: req.session.user || null, cartCount: (req.session.cart || []).length });
});
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) return res.send('Invalid credentials');
  req.session.user = { id: user.id, name: user.name, email: user.email, isAdmin: !!user.isAdmin };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin
app.get('/admin', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Forbidden');
  const db = loadDb();
  res.render('admin', {
    products: db.products || [],
    user: req.session.user,
    cartCount: (req.session.cart || []).length
  });
});

app.post('/admin/add-product', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) return res.status(403).send('Forbidden');
  const { title, price, desc, imagesJson } = req.body;
  let imagesObj = {};
  try { imagesObj = JSON.parse(imagesJson); } catch (e) { return res.send('Invalid JSON for images'); }
  const db = loadDb();
  const id = 'p' + Date.now();
  db.products = db.products || [];
  db.products.push({
    id,
    title,
    price: Number(price),
    desc: desc || '',
    images: imagesObj,
    stock: Object.keys(imagesObj || {}).reduce((o, k) => { o[k] = 5; return o; }, {}),
    reviews: []
  });
  saveDb(db);
  res.redirect('/admin');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
