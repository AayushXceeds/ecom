E-Commerce Web Application

This repository contains a complete e-commerce web application built using Node.js, Express.js, and EJS. It includes core features such as product pages, multiple product images, color variants, cart system, wishlist, reviews, and a minimal admin panel.

Features

Product System
• Multiple images per product
• Color variations with individual stock
• Dynamic switching of images based on color
• Clean and responsive user interface
• Detailed product page

Reviews
• 1–5 star rating system
• Text-based reviews
• Sorting options: Newest, Highest, Lowest
• Auto-calculated average rating

Wishlist
• Add or remove products
• Stored in session

Cart
• Add products with selected color
• Quantity support
• Session-based storage

Authentication
• User signup and login
• Password hashing
• Session-based authentication

Admin Panel
• Dedicated admin login
• View products and users
• Manage reviews
• Expandable for future enhancements

Technologies Used

Frontend:
• EJS
• CSS
• Vanilla JavaScript

Backend:
• Node.js
• Express.js
• Express-Session
• Bcrypt

Storage:
• LowDB (local JSON storage)

Project Structure

public/
— images/
— js/
— style.css

views/
— index.ejs
— product.ejs
— cart.ejs
— login.ejs
— signup.ejs
— admin.ejs

server.js
package.json
.gitignore
db.json (ignored)

How to Run the Project

1. Install dependencies
npm install

2. Start the server
npm start

3. Open in browser
http://localhost:3000

Admin Login

Email: admin@demo.com
Password: admin123
Admin dashboard: http://localhost:3000/admin

About

This project demonstrates a full-stack web application with backend logic, UI design, routing, authentication, sessions, data handling, and an admin dashboard.
Built by Aayush.

GitHub Profile: https://github.com/AayushXceeds

