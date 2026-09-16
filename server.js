const express = require('express');
const path = require('path');
const { createApp } = require('./api/app');
const app = createApp();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Direct Links running on port ${PORT}`));
