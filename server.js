const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

app.set('view engine', 'ejs');

// DB helpers
const DB_PATH = path.join(__dirname, 'db.json');

function loadDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function findUserByEmail(email) {
  const db = loadDb();
  return db.users.find((u) => u.email === email);
}

// ROUTES ---------------------------------------------------

app.get('/', (req, res) => {
  const db = loadDb();
  res.render('index', {
    products: db.products,
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

app.get('/product/:id', (req, res) => {
  const db = loadDb();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).send('Product not found');

  const reviews = product.reviews || [];
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  res.render('product', {
    product,
    reviews,
    avgRating,
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

// Add Review
app.post('/review/add', (req, res) => {
  const { productId, rating, comment } = req.body;

  const db = loadDb();
  const product = db.products.find((p) => p.id === productId);
  if (!product) return res.status(404).send('Product not found');

  if (!product.reviews) product.reviews = [];

  product.reviews.push({
    user: (req.session.user && req.session.user.name) || 'Guest',
    rating: Number(rating),
    comment: comment || '',
    createdAt: new Date().toISOString(),
  });

  saveDb(db);
  res.redirect('/product/' + productId);
});

// Add to cart
app.post('/cart/add', (req, res) => {
  const { id, color, qty } = req.body;
  const db = loadDb();

  const product = db.products.find((p) => p.id === id);
  if (!product) return res.status(404).send('Product not found');

  req.session.cart = req.session.cart || [];

  const chosenImg =
    (product.images[color] && product.images[color][0]) ||
    Object.values(product.images)[0][0];

  req.session.cart.push({
    id: product.id,
    title: product.title,
    color,
    price: product.price,
    qty: Number(qty || 1),
    image: chosenImg,
  });

  res.redirect('/cart');
});

app.get('/cart', (req, res) => {
  res.render('cart', {
    cart: req.session.cart || [],
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

// Wishlist toggle
app.post('/wishlist/toggle', (req, res) => {
  const { productId } = req.body;

  req.session.wishlist = req.session.wishlist || [];

  if (req.session.wishlist.includes(productId)) {
    req.session.wishlist = req.session.wishlist.filter((id) => id !== productId);
  } else {
    req.session.wishlist.push(productId);
  }

  res.redirect('back');
});

app.get('/wishlist', (req, res) => {
  const db = loadDb();
  const items = db.products.filter(
    (p) => (req.session.wishlist || []).includes(p.id)
  );

  res.render('wishlist', {
    items,
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

// Signup/Login
app.get('/signup', (req, res) => {
  res.render('signup', {
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

app.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  const db = loadDb();
  if (findUserByEmail(email)) return res.send('Email already exists');

  const id = 'u' + Date.now();
  db.users.push({ id, name, email, password, isAdmin: false });
  saveDb(db);

  req.session.user = { id, name, email, isAdmin: false };
  res.redirect('/');
});

app.get('/login', (req, res) => {
  res.render('login', {
    user: req.session.user || null,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);

  if (!user || user.password !== password)
    return res.send('Invalid credentials');

  req.session.user = user;
  res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Admin
app.get('/admin', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin)
    return res.status(403).send('Forbidden');

  const db = loadDb();

  res.render('admin', {
    products: db.products,
    user: req.session.user,
    cartCount: (req.session.cart || []).length,
    wishlist: req.session.wishlist || [],
  });
});

// Add product from admin
app.post('/admin/add-product', (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin)
    return res.status(403).send('Forbidden');

  const { title, price, desc, imagesJson } = req.body;

  let imagesParsed = {};
  try {
    imagesParsed = JSON.parse(imagesJson);
  } catch {
    return res.send('Invalid JSON!');
  }

  const db = loadDb();
  db.products.push({
    id: 'p' + Date.now(),
    title,
    price: Number(price),
    desc,
    images: imagesParsed,
    stock: {},
    reviews: [],
  });

  saveDb(db);
  res.redirect('/admin');
});

// START SERVER
app.listen(PORT, () =>
  console.log(`Running → http://localhost:${PORT}`)
);
