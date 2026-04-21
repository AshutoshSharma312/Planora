const express = require('express');
const router = express.Router();
const { getEvents, getEventById, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { protect, admin } = require('../middleware/auth');

// get all events
router.get('/', getEvents);

// get event by id
router.get('/:id', getEventById);

// create new event (admin only)
router.post('/', protect, admin, createEvent);

// update event (admin only)
router.put('/:id', protect, admin, updateEvent);

// delete event (admin only)
router.delete('/:id', protect, admin, deleteEvent);

module.exports = router;
