const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('redis');

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// MongoDB Connection
// =======================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ MongoDB error:', err));

// =======================
// Redis Connection
// =======================
const redisClient = createClient({
  url: process.env.REDIS_URL 
});

redisClient.connect()
  .then(() => console.log('✅ Redis connected'))
  .catch(err => console.error('❌ Redis error:', err));

// =======================
// MongoDB Schema
// =======================
const itemSchema = new mongoose.Schema({
  name: String
});
const Item = mongoose.model('Item', itemSchema);

// =======================
// Routes
// =======================

// Create Item
app.post('/api/items', async (req, res) => {
  try {
    const newItem = new Item({ name: req.body.name });
    await newItem.save();

    // Invalidate Redis cache
    await redisClient.del('items');

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete Item
app.delete('/api/items/:id', async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);

    // Invalidate Redis cache
    await redisClient.del('items');

    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Items (with Redis caching)
app.get('/api/items', async (req, res) => {
  try {
    // 1️⃣ Check Redis cache
    const cache = await redisClient.get('items');
    if (cache) {
      console.log('⚡ Serving from Redis cache');
      return res.json(JSON.parse(cache));
    }

    // 2️⃣ If not in cache, get from MongoDB
    const items = await Item.find();

    // 3️⃣ Store in Redis with 60s expiration
    await redisClient.setEx('items', 60, JSON.stringify(items));

    console.log('🗄️ Serving from MongoDB');
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// Health + Utility Routes
// =======================
app.get('/', (req, res) => {
  res.status(200).send('🚀 ECS Backend is running successfully');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/mongouri', (req, res) => {
  res.status(200).send(`MongoDB URI: ${process.env.MONGODB_URI}`);
});

app.get('/redisuri', (req, res) => {
  res.status(200).send(`Redis URI: ${process.env.REDIS_URL}`);
});

// =======================
// Start Server
// =======================
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
